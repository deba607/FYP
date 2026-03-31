import { NextRequest } from 'next/server';
import { completeUserProfileByEmail, verifyFirebaseIdToken } from '@/lib/services/authService';
import { ApiError, toErrorMessage } from '@/lib/utils/errors';
import { jsonError, jsonSuccess } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new ApiError('No authentication token provided', 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const authUser = await verifyFirebaseIdToken(token);

    const body = await req.json();

    const result = await completeUserProfileByEmail(authUser.email, {
      name: body?.name,
      phone: body?.phone,
      dateOfBirth: body?.dateOfBirth,
      address: body?.address,
      password: body?.password,
      photoURL: body?.photoURL
    });

    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Profile update failed'), 500);
  }
}
