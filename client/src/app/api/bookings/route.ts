import { NextRequest } from 'next/server';
import { createBooking, getAllBookings } from '@/lib/services/bookingService';
import { getOptionalFirebaseUser } from '@/lib/middleware/auth';
import { ApiError, toErrorMessage } from '@/lib/utils/errors';
import { jsonError, jsonSuccess } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await getAllBookings();
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Failed to fetch bookings'), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await getOptionalFirebaseUser(req);
    const result = await createBooking({
      ...body,
      userId: user?.uid || body.userId
    });
    return jsonSuccess(result, 201);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Failed to create booking'), 500);
  }
}
