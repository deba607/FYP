import { NextRequest } from 'next/server';
import { getBookingById, getBookingByBookingId } from '../../../../lib/services/bookingService';
import { getControllerById, logScan } from '../../../../lib/services/controllerService';
import { getFirebaseRealtimeDatabase, getFirebaseFirestore } from '../../../../lib/config/firebaseAdmin';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { logUserActivity } from '../../../../lib/services/activityService';
import { extractBookingIdFromQrValue } from '../../../../lib/ticketQr';

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
  const snapshot = await database
    .ref('scan_logs')
    .orderByChild('ticketId')
    .equalTo(ticketId)
    .once('value');
  const scans: GrantedScan[] = [];

  snapshot.forEach((child) => {
    const val = child.val();
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
    ticketId = extractBookingIdFromQrValue(String(body.ticketId || ''));
    deviceId = String(body.deviceId || 'unknown').trim();
    gateAction = toGateAction(body.gateAction);

    if (!ticketId) {
      return jsonError('Ticket ID is required', 400);
    }

    const controllerResultPromise = getControllerById(deviceId)
      .then((value) => ({ ok: true, value }) as const)
      .catch((error) => ({ ok: false, error }) as const);

    // 1. Fetch booking details (by public bookingId or Firestore document ID)
    let booking: any = null;
    try {
      const res = await getBookingByBookingId(ticketId, { enrich: false });
      booking = res.booking;
    } catch {
      try {
        const res = await getBookingById(ticketId, { enrich: false });
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

    const controllerResult = await controllerResultPromise;
    if (!controllerResult.ok) {
      const msg = 'Access denied - Controller device is not registered';
      await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ valid: false, message: msg, booking }, 200);
    }
    const controller = controllerResult.value;
    if (controller.status !== 'active') {
      const msg = `Access denied - Controller "${controller.name || deviceId}" is ${controller.status}`;
      await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction, controller);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ valid: false, message: msg, booking }, 200);
    }

    if (!controller.museumId) {
      const msg = `Access denied - Controller "${controller.name || deviceId}" is not linked to a museum`;
      await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction, controller);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ valid: false, message: msg, booking }, 200);
    }

    // Resolve museum IDs to verify if they are the same museum
    let museumIdsMatch = false;
    if (booking.museumId && controller.museumId) {
      if (String(booking.museumId) === controller.museumId) {
        museumIdsMatch = true;
      } else {
        try {
          const firestore = getFirebaseFirestore();
          // Find the museum matching booking.museumId
          let museumDoc = await firestore.collection('museums').doc(booking.museumId).get();
          if (!museumDoc.exists) {
            const snap = await firestore.collection('museums')
              .where('museum_id', '==', booking.museumId)
              .limit(1)
              .get();
            if (!snap.empty) {
              museumDoc = snap.docs[0];
            }
          }

          if (museumDoc.exists) {
            const mData = museumDoc.data();
            const validIds = [
              museumDoc.id,
              mData?.museum_id
            ].filter(Boolean).map(String);
            
            if (validIds.includes(controller.museumId)) {
              museumIdsMatch = true;
            }
          }
        } catch (err) {
          console.error('Failed to resolve museum for validation comparison:', err);
        }
      }
    }

    if (!museumIdsMatch) {
      const msg = `Access denied - this ticket is for ${booking.museumName || 'another museum'}, but this gate belongs to ${controller.name || 'another museum gate'}`;
      await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction, controller);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ valid: false, message: msg, booking }, 200);
    }

    // 2. Check booking status
    if (booking.status === 'cancelled') {
      await logScan(normalizedTicketId, deviceId, 'denied', 'Access denied - Ticket is cancelled', gateAction, controller);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan denied for ticket ${normalizedTicketId}. Reason: Access denied - Ticket has been cancelled`);
      return jsonSuccess({ valid: false, message: 'Access denied - Ticket has been cancelled', booking }, 200);
    }

    if (booking.paymentStatus !== 'paid' && booking.status !== 'confirmed') {
      await logScan(normalizedTicketId, deviceId, 'denied', 'Access denied - Ticket is unpaid/unconfirmed', gateAction, controller);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan denied for ticket ${normalizedTicketId}. Reason: Access denied - Ticket is not confirmed or paid`);
      return jsonSuccess({ valid: false, message: 'Access denied - Ticket is not confirmed or paid', booking }, 200);
    }

    // 3. Visit Date Validation (Strict matching to local date)
    const todayInKolkata = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
    const todayStr = todayInKolkata.toISOString().split('T')[0]; // YYYY-MM-DD

    if (booking.visitDate !== todayStr) {
      const msg = `Access denied - Ticket is valid for date ${booking.visitDate}, but today is ${todayStr}`;
      await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction, controller);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ valid: false, message: msg, booking }, 200);
    }

    // 4. Entry / Exit Sequencing
    const grantedScans = await getGrantedScansForTicket(normalizedTicketId);
    const entryScans = grantedScans.filter((scan) => scan.gateAction === 'entry');
    const exitScans = grantedScans.filter((scan) => scan.gateAction === 'exit');

    const entryCount = entryScans.length;
    const exitCount = exitScans.length;

    let totalTicketsAllowed = Number(booking.numberOfTickets || 0);
    if (booking.visitorCombo && typeof booking.visitorCombo === 'object') {
      const comboSum = Object.values(booking.visitorCombo).reduce((sum: number, val: any) => sum + Number(val || 0), 0);
      if (comboSum > totalTicketsAllowed) {
        totalTicketsAllowed = comboSum;
      }
    }
    if (totalTicketsAllowed <= 0) {
      totalTicketsAllowed = 1;
    }

    if (gateAction === 'entry' && entryCount >= totalTicketsAllowed) {
      const lastEntry = entryScans[entryCount - 1];
      const msg = `Access denied - All ${totalTicketsAllowed} tickets have already entered. Last entry at ${formatScanTime(lastEntry?.scannedAt || '')} on ${lastEntry?.deviceName || 'unknown gate'}`;
      await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction, controller);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `entry scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ valid: false, message: msg, booking }, 200);
    }

    if (gateAction === 'exit') {
      if (entryCount === 0) {
        const msg = 'Exit denied - Ticket has not been scanned for entry yet';
        await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction, controller);
        void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `exit scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
        return jsonSuccess({ valid: false, message: msg, booking }, 200);
      }
      if (exitCount >= entryCount) {
        const msg = `Exit denied - All entered visitors (${entryCount}) have already exited`;
        await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction, controller);
        void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `exit scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
        return jsonSuccess({ valid: false, message: msg, booking }, 200);
      }
      if (exitCount >= totalTicketsAllowed) {
        const msg = `Exit denied - All ${totalTicketsAllowed} tickets have already exited`;
        await logScan(normalizedTicketId, deviceId, 'denied', msg, gateAction, controller);
        void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `exit scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
        return jsonSuccess({ valid: false, message: msg, booking }, 200);
      }
    }

    // 5. Successful Scan - Access Granted!
    const successMessage = gateAction === 'entry'
      ? `Entry granted - Ticket ${entryCount + 1} of ${totalTicketsAllowed} verified successfully`
      : `Exit recorded - Ticket ${exitCount + 1} of ${totalTicketsAllowed} verified successfully`;
    await logScan(normalizedTicketId, deviceId, 'granted', successMessage, gateAction, controller);
    void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `${gateAction} scan granted for ticket ${normalizedTicketId}. Reason: ${successMessage}`);
    return jsonSuccess({ valid: true, message: successMessage, booking, gateAction }, 200);

  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Error occurred during validation'), 500);
  }
}
