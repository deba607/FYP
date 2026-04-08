import { NextRequest } from 'next/server';
import { getBookingByBookingId } from '../../../../../lib/services/bookingService';
import { ApiError, toErrorMessage } from '../../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

type Context = {
  params: Promise<{ bookingId: string }>;
};

export async function GET(_req: NextRequest, context: Context) {
  try {
    const { bookingId } = await context.params;
    const result = await getBookingByBookingId(bookingId);
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Failed to fetch booking'), 500);
  }
}
