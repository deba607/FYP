import { NextRequest } from 'next/server';
import { updateBookingStatus } from '@/lib/services/bookingService';
import { ApiError, toErrorMessage } from '@/lib/utils/errors';
import { jsonError, jsonSuccess } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const body = await req.json();
    const { id } = await context.params;

    const result = await updateBookingStatus(id, body.status);

    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Failed to update booking status'), 500);
  }
}
