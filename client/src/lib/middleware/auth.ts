import { NextRequest } from 'next/server';
import { getFirebaseAuth, getFirebaseFirestore } from '../config/firebaseAdmin';
import { ApiError } from '../utils/errors';

export type AuthenticatedUser = {
  uid: string;
  email?: string;
  name?: string;
  role?: string;
};

export async function requireFirebaseUser(req: NextRequest): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError('No authentication token provided', 401);
  }

  const idToken = authHeader.replace('Bearer ', '').trim();

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(idToken);
    let role = typeof decoded.role === 'string' ? decoded.role : undefined;
    if (!role) {
      const userDocument = await getFirebaseFirestore().collection('users').doc(decoded.uid).get().catch(() => null);
      const storedRole = userDocument?.exists ? userDocument.data()?.role : undefined;
      role = typeof storedRole === 'string' ? storedRole : undefined;
    }

    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name,
      role
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
