import { NextRequest } from 'next/server';
import { getBookingById, getBookingByBookingId } from '../../../../lib/services/bookingService';
import { logScan } from '../../../../lib/services/controllerService';
import { getFirebaseRealtimeDatabase } from '../../../../lib/config/firebaseAdmin';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { logUserActivity } from '../../../../lib/services/activityService';

export const runtime = 'nodejs';

type GateAction = 'entry' | 'exit';

type GrantedScan = {
  deviceName: string;
  scannedAt: string;
  gateAction: GateAction;
};

function toGateAction(value: unknown): GateAction {
  return value === 'exit' ? 'exit' : 'entry';
}

function formatScanTime(value: string) {
  if (!value) return 'earlier';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'earlier';
  return date.toLocaleTimeString('en-IN');
}

async function getGrantedScansForTicket(ticketId: string) {
  const database = getFirebaseRealtimeDatabase();
  const snapshot = await database.ref('scan_logs').once('value');
  const scans: GrantedScan[] = [];

  snapshot.forEach((child) => {
    const val = child.val();
    if (String(val?.ticketId || '').trim() !== ticketId) return;
    if (String(val?.outcome || '') !== 'granted') return;

    scans.push({
      deviceName: String(val?.deviceName || 'another gate'),
      scannedAt: String(val?.scannedAt || ''),
      gateAction: toGateAction(val?.gateAction)
    });
  });

  scans.sort((a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime());
  return scans;
}

export async function POST(req: NextRequest) {
  let ticketId = '';
  let deviceId = 'unknown';
  let gateAction: GateAction = 'entry';

  try {
    const body = await req.json().catch(() => ({}));
    ticketId = String(body.ticketId || '').trim();
    deviceId = String(body.deviceId || 'unknown').trim();
    gateAction = toGateAction(body.gateAction);

    if (!ticketId) {
      return jsonError('Ticket ID is required', 400);
    }

    // 1. Fetch booking details (by public bookingId or Firestore document ID)
    let booking: any = null;
    try {
      const res = await getBookingByBookingId(ticketId);
      booking = res.booking;
    } catch {
      try {
        const res = await getBookingById(ticketId);
        booking = res.booking;
      } catch {
        // Log denied scan: ticket not found
        await logScan(ticketId, deviceId, 'denied', 'Invalid ticket - Ticket not found', gateAction);
        void logUserActivity(null, 'guest', 'Scan', 'gate_scan', `${gateAction} scan denied for ticket ${ticketId}. Reason: Invalid ticket - Ticket not found`);
        return jsonSuccess({ valid: false, message: 'Invalid ticket - Ticket not found' }, 200);
      }
    }

    // Normalized ticket public ID
    const normalizedTicketId = booking.bookingId || ticketId;

    // 2. Check booking status
    if (booking.status === 'cancelled') {
      await logScan(normalizedTicketId, deviceId, 'denied', 'Access denied - Ticket is cancelled', gateAction);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan denied for ticket ${normalizedTicketId}. Reason: Access denied - Ticket has been cancelled`);
      return jsonSuccess({ valid: false, message: 'Access denied - Ticket has been cancelled', booking }, 200);
    }

    if (booking.paymentStatus !== 'paid' && booking.status !== 'confirmed') {
      await logScan(normalizedTicketId, deviceId, 'denied', 'Access denied - Ticket is unpaid/unconfirmed', gateAction);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan denied for ticket ${normalizedTicketId}. Reason: Access denied - Ticket is not confirmed or paid`);
      return jsonSuccess({ valid: false, message: 'Access denied - Ticket is not confirmed or paid', booking }, 200);
    }

    // 3. Visit Date Validation (Strict matching to local date)
    const todayInKolkata = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
    const todayStr = todayInKolkata.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (booking.visitDate !== todayStr) {
      const msg = `Access denied - Ticket is valid for date ${booking.visitDate}, but today is ${todayStr}`;
      await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ valid: false, message: msg, booking }, 200);
    }

    // 4. Entry / Exit Sequencing
    const grantedScans = await getGrantedScansForTicket(normalizedTicketId);
    const entryScan = grantedScans.find((scan) => scan.gateAction === 'entry');
    const exitScan = grantedScans.find((scan) => scan.gateAction === 'exit');

    if (gateAction === 'entry' && entryScan) {
      const msg = `Access denied - Ticket already entered at ${formatScanTime(entryScan.scannedAt)} on ${entryScan.deviceName}`;
      await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `entry scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ valid: false, message: msg, booking }, 200);
    }

    if (gateAction === 'exit' && !entryScan) {
      const msg = 'Exit denied - Ticket has not been scanned for entry yet';
      await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `exit scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ valid: false, message: msg, booking }, 200);
    }

    if (gateAction === 'exit' && exitScan) {
      const msg = `Exit denied - Ticket already exited at ${formatScanTime(exitScan.scannedAt)} on ${exitScan.deviceName}`;
      await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `exit scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ valid: false, message: msg, booking }, 200);
    }

    // 5. Successful Scan - Access Granted!
    const successMessage = gateAction === 'entry'
      ? 'Entry granted - Ticket verified successfully'
      : 'Exit recorded - Ticket verified successfully';
    await logScan(normalizedTicketId, deviceId, 'granted', successMessage, gateAction);
    void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan granted for ticket ${normalizedTicketId}. Reason: ${successMessage}`);
    return jsonSuccess({ valid: true, message: successMessage, booking, gateAction }, 200);

  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Error occurred during validation'), 500);
  }
}
