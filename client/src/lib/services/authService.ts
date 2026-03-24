import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectToDatabase } from '@/lib/db/mongoose';
import { UserModel } from '@/models/User';
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

function createToken(userId: string, email: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new ApiError('JWT secret is not configured', 500);
  }

  return jwt.sign({ userId, email }, secret, { expiresIn: '7d' });
}

export async function signupUser(input: SignupInput) {
  await connectToDatabase();

  const existingUser = await UserModel.findOne({ email: input.email }).lean();

  if (existingUser) {
    throw new ApiError('User already exists with this email', 400);
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    password: hashedPassword,
    phone: input.phone,
    dateOfBirth: input.dateOfBirth
  });

  const token = createToken(user._id.toString(), user.email);

  return {
    success: true,
    message: 'User registered successfully',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone
    }
  };
}

export async function loginUser(input: LoginInput) {
  await connectToDatabase();

  const user = await UserModel.findOne({ email: input.email });

  if (!user) {
    throw new ApiError('Invalid email or password', 401);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    throw new ApiError('Invalid email or password', 401);
  }

  const token = createToken(user._id.toString(), user.email);

  return {
    success: true,
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    }
  };
}
