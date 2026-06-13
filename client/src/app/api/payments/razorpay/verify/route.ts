import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { createBooking, calculateBookingTotal } from '../../../../../lib/services/bookingService';
import { getOptionalFirebaseUser } from '../../../../../lib/middleware/auth';
import { ApiError, toErrorMessage } from '../../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../../lib/utils/apiResponse';
import { logUserActivity } from '../../../../../lib/services/activityService';

export const runtime = 'nodejs';

const ALLOWED_VISITOR_TYPES = new Set([
  'Adult',
  'Child',
  'Senior Citizen',
  'Student',
  'Professor',
  'Researcher/Scientist'
]);

function getRazorpaySecret() {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  return keySecret || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getOptionalFirebaseUser(req);

    const booking = body?.booking;
    if (!booking) {
      throw new ApiError('Missing booking details', 400);
    }

    if (!booking?.name || !booking?.email || !booking?.phone || !booking?.visitDate || !booking?.timeSlot) {
      throw new ApiError('Missing required booking fields', 400);
    }

    const visitorCombo = booking.visitorCombo as Record<string, number> | undefined;

    if (visitorCombo && Object.keys(visitorCombo).length > 0) {
      for (const vType of Object.keys(visitorCombo)) {
        if (!ALLOWED_VISITOR_TYPES.has(vType)) {
          throw new ApiError(`Invalid visitor type: ${vType}`, 400);
        }
      }
    } else {
      if (!ALLOWED_VISITOR_TYPES.has(String(booking.visitorType || ''))) {
        throw new ApiError('Invalid visitor type', 400);
      }
    }

    const secret = getRazorpaySecret();
    const isDemoPayment =
      body?.demoMode === true ||
      String(body?.razorpayOrderId || '').startsWith('order_demo_') ||
      String(body?.razorpayPaymentId || '').startsWith('pay_demo_');

    if (secret && !isDemoPayment) {
      if (!body?.razorpayOrderId || !body?.razorpayPaymentId || !body?.razorpaySignature) {
        throw new ApiError('Missing Razorpay payment details', 400);
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== body.razorpaySignature) {
        throw new ApiError('Invalid payment signature', 400);
      }
    } else if (!isDemoPayment) {
      throw new ApiError('Razorpay configuration is missing', 500);
    }

    const { pricePerTicket, totalAmount } = calculateBookingTotal({
      visitorType: booking.visitorType,
      numberOfTickets: Number(booking.numberOfTickets || 0),
      pricePerTicket: booking.pricePerTicket,
      museumId: booking.museumId,
      museumName: booking.museumName,
      museumLocation: booking.museumLocation,
      museumCategory: booking.museumCategory,
      visitorCombo
    });

    if (totalAmount <= 0) {
      throw new ApiError('Unable to calculate payment amount', 400);
    }

    const result = await createBooking({
      ...booking,
      userId: user?.uid || booking.userId,
      pricePerTicket,
      paymentStatus: 'paid',
      paymentProvider: isDemoPayment ? 'demo' : 'razorpay',
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature || '',
      status: 'confirmed'
    });

    void logUserActivity(
      user?.uid || booking.userId || null,
      booking.email,
      'Payment',
      isDemoPayment ? 'demo_payment_verified' : 'payment_verified',
      `${isDemoPayment ? 'Verified demo payment' : 'Verified Razorpay payment'} for booking ${result.booking.bookingId} (${booking.museumName || 'Bharat Museum'}). Amount: INR ${totalAmount}`
    );

    return jsonSuccess(
      {
        success: true,
        message: 'Payment verified and booking created successfully',
        booking: {
          ...result.booking,
          totalAmount
        }
      },
      201
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Failed to verify payment'), 500);
  }
}
