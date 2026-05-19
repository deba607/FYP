import { NextRequest } from 'next/server';
import { calculateBookingTotal } from '../../../../../lib/services/bookingService';
import { getOptionalFirebaseUser } from '../../../../../lib/middleware/auth';
import { ApiError, toErrorMessage } from '../../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

const ALLOWED_VISITOR_TYPES = new Set([
  'Adult',
  'Child',
  'Senior Citizen',
  'Student',
  'Professor',
  'Researcher/Scientist'
]);

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new ApiError('Razorpay configuration is missing', 500);
  }

  return { keyId, keySecret };
}

function getBasicAuthHeader(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getOptionalFirebaseUser(req);

    if (!body?.name || !body?.email || !body?.phone || !body?.visitDate || !body?.timeSlot) {
      throw new ApiError('Missing required booking fields', 400);
    }

    if (!ALLOWED_VISITOR_TYPES.has(String(body.visitorType || ''))) {
      throw new ApiError('Invalid visitor type', 400);
    }

    const numberOfTickets = Number(body.numberOfTickets || 0);
    if (!Number.isInteger(numberOfTickets) || numberOfTickets < 1 || numberOfTickets > 10) {
      throw new ApiError('Please select between 1 and 10 tickets', 400);
    }

    const { pricePerTicket, totalAmount } = calculateBookingTotal({
      visitorType: body.visitorType,
      numberOfTickets,
      pricePerTicket: body.pricePerTicket,
      museumId: body.museumId,
      museumName: body.museumName,
      museumLocation: body.museumLocation,
      museumCategory: body.museumCategory
    });

    if (totalAmount <= 0) {
      throw new ApiError('Unable to calculate payment amount', 400);
    }

    const { keyId, keySecret } = getRazorpayCredentials();
    const currency = 'INR';
    const receipt = `rcpt_${Date.now()}`;

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: getBasicAuthHeader(keyId, keySecret),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(totalAmount * 100),
        currency,
        receipt,
        payment_capture: 1,
        notes: {
          museumName: body.museumName || '',
          museumLocation: body.museumLocation || '',
          museumCategory: body.museumCategory || '',
          visitorType: body.visitorType,
          numberOfTickets: String(numberOfTickets),
          email: body.email,
          userId: user?.uid || body.userId || ''
        }
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(data?.error?.description || data?.error || 'Failed to create Razorpay order', 502);
    }

    return jsonSuccess(
      {
        success: true,
        keyId,
        order: data,
        amount: totalAmount,
        currency,
        pricePerTicket
      },
      200
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Failed to create Razorpay order'), 500);
  }
}