import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getFirebaseFirestore } from '@/lib/config/firebaseAdmin';
import { ApiError } from '@/lib/utils/errors';

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
  password: string;
  phone: string;
  dateOfBirth?: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
};

function createToken(userId: string, email: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new ApiError('JWT secret is not configured', 500);
  }

  return jwt.sign({ userId, email }, secret, { expiresIn: '7d' });
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
    dateOfBirth: input.dateOfBirth,
    role: 'user',
    createdAt: now,
    updatedAt: now
  };

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
      phone: user.phone
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
      role: user.role
    }
  };
}
