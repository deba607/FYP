import { NextRequest } from 'next/server';
import { deleteBooking, getBookingById } from '../../../../lib/services/bookingService';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const result = await getBookingById(id);
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Failed to fetch booking'), 500);
  }
}

export async function DELETE(_req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const result = await deleteBooking(id);
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Failed to delete booking'), 500);
  }
}
