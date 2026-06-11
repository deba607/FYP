import { NextRequest } from 'next/server';
import { resetPasswordWithOtp } from '../../../../lib/services/authService';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, otp, password } = body;

    if (!email) {
      return jsonError('Email or User ID is required', 400);
    }
    if (!otp) {
      return jsonError('Verification code is required', 400);
    }
    if (!password) {
      return jsonError('New password is required', 400);
    }

    const result = await resetPasswordWithOtp(email, otp, password);
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Failed to reset password'), 500);
  }
}
