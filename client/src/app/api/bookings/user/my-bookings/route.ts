import { NextRequest } from 'next/server';
import { requireFirebaseUser } from '../../../../../lib/middleware/auth';
import { getTicketHistoryForUser } from '../../../../../lib/services/bookingService';
import { ApiError, toErrorMessage } from '../../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await requireFirebaseUser(req);
    const url = new URL(req.url);
    const fallbackEmail = url.searchParams.get('email');
    const result = await getTicketHistoryForUser({
      userId: user.uid,
      email: user.email || fallbackEmail
    });
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Failed to fetch user bookings'), 500);
  }
}
