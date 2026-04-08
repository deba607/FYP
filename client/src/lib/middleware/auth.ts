import { NextRequest } from 'next/server';
import { getFirebaseAuth } from '../config/firebaseAdmin';
import { ApiError } from '../utils/errors';

export type AuthenticatedUser = {
  uid: string;
  email?: string;
  name?: string;
};

export async function requireFirebaseUser(req: NextRequest): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError('No authentication token provided', 401);
  }

  const idToken = authHeader.replace('Bearer ', '').trim();

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(idToken);

    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name
    };
  } catch {
    throw new ApiError('Invalid or expired token', 401);
  }
}

export async function getOptionalFirebaseUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    return await requireFirebaseUser(req);
  } catch {
    return null;
  }
}
