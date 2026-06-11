import { NextRequest } from 'next/server';
import { sendOtp } from '../../../../lib/services/authService';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, purpose } = body;

    if (!email) {
      return jsonError('Email or User ID is required', 400);
    }
    if (!purpose) {
      return jsonError('Purpose is required', 400);
    }

    const result = await sendOtp(email, purpose);
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Failed to send verification code'), 500);
  }
}
