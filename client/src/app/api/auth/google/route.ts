import { NextRequest } from 'next/server';
import { signupOrLoginWithGoogle } from '../../../../lib/services/authService';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const googleIdToken = String(body?.idToken || '').trim();
    const result = await signupOrLoginWithGoogle(googleIdToken);
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Google authentication failed'), 500);
  }
}
