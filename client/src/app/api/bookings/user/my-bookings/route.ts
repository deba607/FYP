import { NextRequest } from 'next/server';
import { requireFirebaseUser } from '@/lib/middleware/auth';
import { getBookingsForUser } from '@/lib/services/bookingService';
import { ApiError, toErrorMessage } from '@/lib/utils/errors';
import { jsonError, jsonSuccess } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await requireFirebaseUser(req);
    const result = await getBookingsForUser(user.uid);
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Failed to fetch user bookings'), 500);
  }
}
