import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getFirebaseFirestore } from '../config/firebaseAdmin';
import { getFirebaseAuth } from '../config/firebaseAdmin';
import { ApiError } from '../utils/errors';

type SignupInput = {
  name: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type StoredUser = {
  name: string;
  email: string;
  password?: string;
  phone: string;
  dateOfBirth?: string;
  address?: string;
  photoURL?: string;
  authProvider: 'password' | 'google';
  profileCompleted: boolean;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
};

type CompleteProfileInput = {
  name?: string;
  phone: string;
  dateOfBirth?: string;
  address?: string;
  password?: string;
  photoURL?: string;
};

function mapFirestoreError(error: unknown, fallbackMessage: string): ApiError {
  const message = error instanceof Error ? error.message : '';
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';

  if (message.includes('5 NOT_FOUND') || message.includes('NOT_FOUND') || code === '5' || code === 'not-found') {
    return new ApiError(
      'Cloud Firestore database not found. Enable Firestore in Firebase console or set FIREBASE_DATABASE_ID correctly.',
      503
    );
  }

  if (message.includes('PERMISSION_DENIED') || code === 'permission-denied' || code === '7') {
    return new ApiError('Firestore permission denied. Check Firestore rules and Firebase service account permissions.', 403);
  }

  return new ApiError(fallbackMessage, 500);
}

function createToken(userId: string, email: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new ApiError('JWT secret is not configured', 500);
  }

  return jwt.sign({ userId, email }, secret, { expiresIn: '7d' });
}

export function verifyAppToken(token: string): { userId: string; email: string } {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new ApiError('JWT secret is not configured', 500);
  }

  try {
    const decoded = jwt.verify(token, secret) as { userId?: string; email?: string };
    if (!decoded.userId || !decoded.email) {
      throw new ApiError('Invalid authentication token', 401);
    }

    return {
      userId: decoded.userId,
      email: decoded.email
    };
  } catch {
    throw new ApiError('Invalid or expired authentication token', 401);
  }
}

export async function verifyFirebaseIdToken(idToken: string): Promise<{ email: string; uid: string }> {
  if (!idToken) {
    throw new ApiError('Authentication token is required', 401);
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(idToken);
    const email = decoded.email?.trim().toLowerCase();

    if (!email) {
      throw new ApiError('Authenticated account email is unavailable', 401);
    }

    return {
      email,
      uid: decoded.uid
    };
  } catch {
    throw new ApiError('Invalid or expired Firebase token', 401);
  }
}

export async function signupUser(input: SignupInput) {
  const firestore = getFirebaseFirestore();
  const normalizedEmail = input.email.trim().toLowerCase();

  const existingUserSnapshot = await firestore
    .collection('users')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();

  if (!existingUserSnapshot.empty) {
    throw new ApiError('User already exists with this email', 400);
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);
  const userRef = firestore.collection('users').doc();
  const now = new Date();

  const user: StoredUser = {
    name: input.name,
    email: normalizedEmail,
    password: hashedPassword,
    phone: input.phone,
    authProvider: 'password',
    profileCompleted: true,
    role: 'user',
    createdAt: now,
    updatedAt: now
  };

  if (input.dateOfBirth?.trim()) {
    user.dateOfBirth = input.dateOfBirth.trim();
  }

  await userRef.set(user);

  const token = createToken(userRef.id, user.email);

  return {
    success: true,
    message: 'User registered successfully',
    token,
    user: {
      id: userRef.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileCompleted: user.profileCompleted
    }
  };
}

export async function loginUser(input: LoginInput) {
  const firestore = getFirebaseFirestore();
  const normalizedEmail = input.email.trim().toLowerCase();
  const userSnapshot = await firestore
    .collection('users')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();

  if (userSnapshot.empty) {
    throw new ApiError('Invalid email or password', 401);
  }

  const userDoc = userSnapshot.docs[0]!;
  const user = userDoc.data() as StoredUser;

  if (!user.password) {
    throw new ApiError('Please continue with Google sign-in for this account', 401);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    throw new ApiError('Invalid email or password', 401);
  }

  const token = createToken(userDoc.id, user.email);

  return {
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: userDoc.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth || '',
      address: user.address || '',
      photoURL: user.photoURL || '',
      profileCompleted: user.profileCompleted,
      role: user.role
    }
  };
}

export async function signupOrLoginWithGoogle(googleIdToken: string) {
  if (!googleIdToken) {
    throw new ApiError('Google token is required', 400);
  }

  let decoded: Awaited<ReturnType<ReturnType<typeof getFirebaseAuth>['verifyIdToken']>>;
  try {
    decoded = await getFirebaseAuth().verifyIdToken(googleIdToken);
  } catch {
    throw new ApiError('Invalid or expired Google authentication token', 401);
  }

  const email = decoded.email?.trim().toLowerCase();

  if (!email) {
    throw new ApiError('Google account email is unavailable', 400);
  }

  try {
    const firestore = getFirebaseFirestore();
    const snapshot = await firestore
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    const now = new Date();

    if (snapshot.empty) {
      const userRef = firestore.collection('users').doc(decoded.uid);
      const user: StoredUser = {
        name: decoded.name || email.split('@')[0] || 'Museum Visitor',
        email,
        phone: '',
        dateOfBirth: '',
        authProvider: 'google',
        profileCompleted: false,
        role: 'user',
        createdAt: now,
        updatedAt: now
      };

      if (decoded.picture) {
        user.photoURL = decoded.picture;
      }

      await userRef.set(user);

      return {
        success: true,
        message: 'Google signup successful',
        user: {
          id: userRef.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          photoURL: user.photoURL,
          profileCompleted: user.profileCompleted,
          role: user.role
        }
      };
    }

    const userDoc = snapshot.docs[0]!;
    const existing = userDoc.data() as StoredUser;

    const updatePayload: Partial<StoredUser> = {
      authProvider: 'google',
      updatedAt: now
    };

    if (!existing.name && decoded.name) {
      updatePayload.name = decoded.name;
    }

    if (!existing.photoURL && decoded.picture) {
      updatePayload.photoURL = decoded.picture;
    }

    if (Object.keys(updatePayload).length > 1) {
      await userDoc.ref.update(updatePayload);
    }

    return {
      success: true,
      message: 'Google login successful',
      user: {
        id: userDoc.id,
        name: existing.name || decoded.name || email.split('@')[0] || 'Museum Visitor',
        email: existing.email,
        phone: existing.phone || '',
        dateOfBirth: existing.dateOfBirth || '',
        address: existing.address || '',
        photoURL: existing.photoURL || decoded.picture,
        profileCompleted: Boolean(existing.profileCompleted && existing.phone),
        role: existing.role || 'user'
      }
    };
  } catch (error) {
    throw mapFirestoreError(error, 'Google authentication failed');
  }
}

export async function completeUserProfile(userId: string, input: CompleteProfileInput) {
  if (!input.phone?.trim()) {
    throw new ApiError('Phone number is required', 400);
  }

  const firestore = getFirebaseFirestore();
  const userRef = firestore.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new ApiError('User not found', 404);
  }

  const now = new Date();
  const payload: Partial<StoredUser> = {
    phone: input.phone.trim(),
    dateOfBirth: input.dateOfBirth?.trim() || '',
    address: input.address?.trim() || '',
    profileCompleted: true,
    updatedAt: now
  };

  if (input.name?.trim()) {
    payload.name = input.name.trim();
  }

  await userRef.update(payload);

  const updatedDoc = await userRef.get();
  const user = updatedDoc.data() as StoredUser;

  return {
    success: true,
    message: 'Profile updated successfully',
    user: {
      id: updatedDoc.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth || '',
      address: user.address || '',
      profileCompleted: user.profileCompleted,
      role: user.role
    }
  };
}

export async function completeUserProfileByEmail(email: string, input: CompleteProfileInput) {
  if (!input.phone?.trim()) {
    throw new ApiError('Phone number is required', 400);
  }

  if (input.password && input.password.length < 8) {
    throw new ApiError('Password must be at least 8 characters long', 400);
  }

  try {
    const firestore = getFirebaseFirestore();
    const normalizedEmail = email.trim().toLowerCase();

    const userSnapshot = await firestore
      .collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    const now = new Date();
    let userDoc: any = userSnapshot.docs[0];

    if (!userDoc) {
      const userRef = firestore.collection('users').doc();
      const hashedPassword = input.password ? await bcrypt.hash(input.password, 10) : undefined;
      const newUser: StoredUser = {
        name: input.name?.trim() || email.split('@')[0] || 'Museum Visitor',
        email: normalizedEmail,
        phone: input.phone.trim(),
        dateOfBirth: input.dateOfBirth?.trim() || '',
        address: input.address?.trim() || '',
        authProvider: 'google',
        profileCompleted: true,
        role: 'user',
        createdAt: now,
        updatedAt: now
      };

      if (input.photoURL?.trim()) {
        newUser.photoURL = input.photoURL.trim();
      }

      if (hashedPassword) {
        newUser.password = hashedPassword;
      }

      await userRef.set(newUser);
      userDoc = await userRef.get();
    } else {
      const payload: Partial<StoredUser> = {
        phone: input.phone.trim(),
        dateOfBirth: input.dateOfBirth?.trim() || '',
        address: input.address?.trim() || '',
        profileCompleted: true,
        authProvider: 'google',
        updatedAt: now
      };

      if (input.name?.trim()) {
        payload.name = input.name.trim();
      }

      if (input.password) {
        payload.password = await bcrypt.hash(input.password, 10);
      }

      if (input.photoURL !== undefined) {
        payload.photoURL = input.photoURL.trim();
      }

      await userDoc.ref.update(payload);
      userDoc = await userDoc.ref.get();
    }

    const updated = userDoc.data() as StoredUser;

    return {
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: userDoc.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        dateOfBirth: updated.dateOfBirth || '',
        address: updated.address || '',
        photoURL: updated.photoURL || '',
        profileCompleted: updated.profileCompleted,
        role: updated.role
      }
    };
  } catch (error) {
    throw mapFirestoreError(error, 'Failed to save profile');
  }
}
