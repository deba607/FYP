import { NextRequest } from 'next/server';
import { getBookingById, getBookingByBookingId } from '../../../../lib/services/bookingService';
import { logScan } from '../../../../lib/services/controllerService';
import { getFirebaseFirestore } from '../../../../lib/config/firebaseAdmin';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { logUserActivity } from '../../../../lib/services/activityService';

export const runtime = 'nodejs';

const GATE_OPEN_DURATION_MS = 7000;

export async function POST(req: NextRequest) {
  let ticketId = '';
  let deviceId = 'unknown';

  try {
    const body = await req.json().catch(() => ({}));
    ticketId = String(body.ticketId || '').trim();
    deviceId = String(body.deviceId || 'unknown').trim();

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
        await logScan(ticketId, deviceId, 'denied', 'Invalid ticket - Ticket not found');
        void logUserActivity(null, 'guest', 'Scan', 'gate_scan', `Gate scan denied for ticket ${ticketId}. Reason: Invalid ticket - Ticket not found`);
        return jsonSuccess({ success: true, valid: false, openGate: false, openDurationMs: 0, message: 'Invalid ticket - Ticket not found' }, 200);
      }
    }

    // Normalized ticket public ID
    const normalizedTicketId = booking.bookingId || ticketId;

    // 2. Check booking status
    if (booking.status === 'cancelled') {
      await logScan(normalizedTicketId, deviceId, 'denied', 'Access denied - Ticket is cancelled');
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `Gate scan denied for ticket ${normalizedTicketId}. Reason: Access denied - Ticket has been cancelled`);
      return jsonSuccess({ success: true, valid: false, openGate: false, openDurationMs: 0, message: 'Access denied - Ticket has been cancelled', booking }, 200);
    }

    if (booking.paymentStatus !== 'paid' && booking.status !== 'confirmed') {
      await logScan(normalizedTicketId, deviceId, 'denied', 'Access denied - Ticket is unpaid/unconfirmed');
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `Gate scan denied for ticket ${normalizedTicketId}. Reason: Access denied - Ticket is not confirmed or paid`);
      return jsonSuccess({ success: true, valid: false, openGate: false, openDurationMs: 0, message: 'Access denied - Ticket is not confirmed or paid', booking }, 200);
    }

    // 3. Double-Scan / Duplicate Scan Prevention
    const firestore = getFirebaseFirestore();
    const duplicateSnapshot = await firestore
      .collection('scan_logs')
      .where('ticketId', '==', normalizedTicketId)
      .where('outcome', '==', 'granted')
      .limit(1)
      .get();

    if (!duplicateSnapshot.empty) {
      const firstScan = duplicateSnapshot.docs[0]!.data();
      const firstScanTime = firstScan.scannedAt
        ? new Date(
            firstScan.scannedAt.toDate ? firstScan.scannedAt.toDate() : firstScan.scannedAt
          ).toLocaleTimeString('en-IN')
        : 'earlier';
      const gateName = firstScan.deviceName || 'another gate';
      const msg = `Access denied - Ticket already scanned at ${firstScanTime} on ${gateName}`;
      await logScan(normalizedTicketId, deviceId, 'denied', msg);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `Gate scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ success: true, valid: false, openGate: false, openDurationMs: 0, message: msg, booking }, 200);
    }

    // 4. Visit Date Validation (Strict matching to local date)
    const todayInKolkata = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
    const todayStr = todayInKolkata.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (booking.visitDate !== todayStr) {
      const msg = `Access denied - Ticket is valid for date ${booking.visitDate}, but today is ${todayStr}`;
      await logScan(normalizedTicketId, deviceId, 'denied', msg);
      void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `Gate scan denied for ticket ${normalizedTicketId}. Reason: ${msg}`);
      return jsonSuccess({ success: true, valid: false, openGate: false, openDurationMs: 0, message: msg, booking }, 200);
    }

    // 5. Successful Scan - Access Granted!
    await logScan(normalizedTicketId, deviceId, 'granted', 'Access granted - Ticket verified successfully');
    void logUserActivity(booking.userId || null, booking.email || 'guest', 'Scan', 'gate_scan', `Gate scan granted for ticket ${normalizedTicketId}. Reason: Access granted - Ticket verified successfully`);
    return jsonSuccess({
      success: true,
      valid: true,
      openGate: true,
      openDurationMs: GATE_OPEN_DURATION_MS,
      message: 'Access granted - Ticket is valid',
      booking
    }, 200);

  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Error occurred during validation'), 500);
  }
}
