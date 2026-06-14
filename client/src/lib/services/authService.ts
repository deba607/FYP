import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getFirebaseFirestore } from '../config/firebaseAdmin';
import { getFirebaseAuth } from '../config/firebaseAdmin';
import { ApiError } from '../utils/errors';
import { logUserActivity } from './activityService';
import { sendOtpEmail } from './emailService';

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

type OtpData = {
  otp: string;
  expiresAt: Date;
  userDocId: string;
};

const globalForOtp = global as unknown as { otpCache?: Map<string, OtpData> };
const otpCache = globalForOtp.otpCache ?? new Map<string, OtpData>();
if (process.env.NODE_ENV !== 'production') globalForOtp.otpCache = otpCache;


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
  void logUserActivity(userRef.id, user.email, 'Auth', 'signup', `User registered using credentials (name: ${user.name}, phone: ${user.phone})`);

  const token = createToken(userRef.id, user.email);
  const firebaseCustomToken = await getFirebaseAuth().createCustomToken(userRef.id, { role: user.role });

  return {
    success: true,
    message: 'User registered successfully',
    token,
    firebaseCustomToken,
    user: {
      id: userRef.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileCompleted: user.profileCompleted,
      role: user.role
    }
  };
}

export async function loginUser(input: LoginInput) {
  const firestore = getFirebaseFirestore();
  const normalizedEmail = input.email.trim().toLowerCase();
  
  let userDoc: any = null;
  
  // Try querying by email first
  const userSnapshot = await firestore
    .collection('users')
    .where('email', '==', normalizedEmail)
    .limit(1)
    .get();

  if (!userSnapshot.empty) {
    userDoc = userSnapshot.docs[0]!;
  } else {
    // If not found by email, try fetching by Document ID (User ID)
    const docRef = firestore.collection('users').doc(input.email.trim());
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      userDoc = docSnap;
    }
  }

  if (!userDoc) {
    throw new ApiError('Invalid email, user ID, or password', 401);
  }

  const user = userDoc.data() as StoredUser;

  if (!user.password) {
    throw new ApiError('Please continue with Google sign-in for this account', 401);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    throw new ApiError('Invalid email, user ID, or password', 401);
  }

  const token = createToken(userDoc.id, user.email || userDoc.id);
  const firebaseCustomToken = await getFirebaseAuth().createCustomToken(userDoc.id, { role: user.role });
  void logUserActivity(userDoc.id, user.email || 'None', 'Auth', 'login', 'User logged in successfully using credentials');

  return {
    success: true,
    message: 'Login successful',
    token,
    firebaseCustomToken,
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
      void logUserActivity(userRef.id, user.email, 'Auth', 'signup', `User registered using Google (name: ${user.name})`);

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
    void logUserActivity(userDoc.id, existing.email || email, 'Auth', 'login', 'User logged in successfully using Google');

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
  void logUserActivity(userId, userDoc.data()?.email || '', 'Profile', 'profile_update', `Profile updated (phone: ${payload.phone})`);

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
      void logUserActivity(userRef.id, email, 'Auth', 'signup', `User registered automatically via email flow (name: ${newUser.name})`);
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
      void logUserActivity(userDoc.id, email, 'Profile', 'profile_update', `Profile completed/updated via email flow (phone: ${payload.phone})`);
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

/* ──────────────────────────────────────────────────────────
 *  Admin-only user management helpers
 * ────────────────────────────────────────────────────────── */

export async function getAllUsers() {
  try {
    const firestore = getFirebaseFirestore();
    const snapshot = await firestore
      .collection('users')
      .orderBy('createdAt', 'desc')
      .get();

    const users = snapshot.docs.map((doc) => {
      const data = doc.data() as StoredUser;
      // Never return password hashes to the client
      const { password: _pw, ...safe } = data;
      return {
        id: doc.id,
        ...safe,
        createdAt: data.createdAt instanceof Date
          ? data.createdAt.toISOString()
          : (data.createdAt as any)?.toDate?.()?.toISOString?.() ?? String(data.createdAt ?? ''),
        updatedAt: data.updatedAt instanceof Date
          ? data.updatedAt.toISOString()
          : (data.updatedAt as any)?.toDate?.()?.toISOString?.() ?? String(data.updatedAt ?? ''),
      };
    });

    return { success: true, users };
  } catch (error) {
    throw mapFirestoreError(error, 'Unable to fetch users');
  }
}

type AdminUserUpdate = {
  role?: 'user' | 'admin';
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
};

export async function updateUserByAdmin(userId: string, input: AdminUserUpdate) {
  if (!userId) {
    throw new ApiError('User ID is required', 400);
  }

  const allowedFields: (keyof AdminUserUpdate)[] = ['role', 'name', 'email', 'phone', 'address', 'dateOfBirth'];
  const payload: Record<string, unknown> = { updatedAt: new Date() };

  for (const key of allowedFields) {
    if (input[key] !== undefined) {
      payload[key] = typeof input[key] === 'string' ? (input[key] as string).trim() : input[key];
    }
  }

  if (Object.keys(payload).length <= 1) {
    throw new ApiError('No valid fields provided for update', 400);
  }

  try {
    const firestore = getFirebaseFirestore();
    const userRef = firestore.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new ApiError('User not found', 404);
    }

    await userRef.update(payload);
    const updated = (await userRef.get()).data() as StoredUser;
    const { password: _pw, ...safe } = updated;

    return {
      success: true,
      message: 'User updated successfully',
      user: { id: userId, ...safe },
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw mapFirestoreError(error, 'Unable to update user');
  }
}

export async function deleteUserByAdmin(userId: string) {
  if (!userId) {
    throw new ApiError('User ID is required', 400);
  }

  try {
    const firestore = getFirebaseFirestore();
    const userRef = firestore.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new ApiError('User not found', 404);
    }

    await userRef.delete();

    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw mapFirestoreError(error, 'Unable to delete user');
  }
}

export async function sendOtp(emailOrId: string, purpose: 'registration' | 'forgot_password') {
  const firestore = getFirebaseFirestore();
  let email = emailOrId.trim();

  // If emailOrId is a user ID, look up the email
  let userDocId = '';
  if (!email.includes('@')) {
    const userDoc = await firestore.collection('users').doc(email).get();
    if (!userDoc.exists) {
      throw new ApiError('No user found with this User ID.', 404);
    }
    const userData = userDoc.data();
    email = userData?.email || '';
    userDocId = userDoc.id;
    if (!email) {
      throw new ApiError('User ID has no associated email address.', 400);
    }
  } else {
    // Check if user exists for forgot_password
    if (purpose === 'forgot_password') {
      const userSnapshot = await firestore
        .collection('users')
        .where('email', '==', email.toLowerCase())
        .limit(1)
        .get();
      if (userSnapshot.empty) {
        throw new ApiError('No account found with this email address.', 404);
      }
      userDocId = userSnapshot.docs[0].id;
    }
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

  // Save to in-memory cache
  otpCache.set(email.toLowerCase(), {
    otp,
    expiresAt,
    userDocId
  });

  // Send the email
  await sendOtpEmail(email, otp, purpose);

  return {
    success: true,
    message: 'Verification code sent successfully.',
    email
  };
}

export async function verifyOtp(emailOrId: string, otp: string) {
  const firestore = getFirebaseFirestore();
  let email = emailOrId.trim().toLowerCase();

  // Resolve user ID to email if needed
  if (!email.includes('@')) {
    const userDoc = await firestore.collection('users').doc(emailOrId.trim()).get();
    if (userDoc.exists) {
      email = (userDoc.data()?.email || '').toLowerCase();
    }
  }

  const data = otpCache.get(email);
  if (!data) {
    throw new ApiError('No verification code request found for this email.', 400);
  }

  if (data.otp !== otp.trim()) {
    throw new ApiError('Invalid verification code.', 400);
  }

  if (new Date() > data.expiresAt) {
    otpCache.delete(email);
    throw new ApiError('Verification code has expired.', 400);
  }

  return {
    success: true,
    message: 'Code verified successfully.'
  };
}

export async function resetPasswordWithOtp(emailOrId: string, otp: string, passwordInput: string) {
  if (!passwordInput || passwordInput.length < 8) {
    throw new ApiError('Password must be at least 8 characters long.', 400);
  }

  const firestore = getFirebaseFirestore();
  let email = emailOrId.trim().toLowerCase();
  let userDocId = '';

  // Resolve user ID to email and get user doc ID
  if (!email.includes('@')) {
    const userDoc = await firestore.collection('users').doc(emailOrId.trim()).get();
    if (!userDoc.exists) {
      throw new ApiError('User not found.', 404);
    }
    email = (userDoc.data()?.email || '').toLowerCase();
    userDocId = userDoc.id;
  } else {
    const userSnapshot = await firestore
      .collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();
    if (userSnapshot.empty) {
      throw new ApiError('User not found.', 404);
    }
    userDocId = userSnapshot.docs[0].id;
  }

  // Verify OTP
  await verifyOtp(email, otp);

  // Hash new password
  const hashedPassword = await bcrypt.hash(passwordInput, 10);

  // Update password in Firestore
  await firestore.collection('users').doc(userDocId).update({
    password: hashedPassword,
    updatedAt: new Date()
  });

  // Delete the OTP from in-memory cache
  otpCache.delete(email);

  void logUserActivity(userDocId, email, 'Auth', 'password_reset_otp', 'Password reset successfully using OTP verification');

  return {
    success: true,
    message: 'Password has been reset successfully.'
  };
}
