import bcrypt from 'bcryptjs';
import { getFirebaseFirestore } from '../config/firebaseAdmin';
import { ApiError } from '../utils/errors';

export type VisitorPrices = {
  Adult: number;
  Child: number;
  'Senior Citizen': number;
  Student: number;
  Professor: number;
  'Researcher/Scientist': number;
};

export type MuseumRecord = {
  id: string; // Firestore document ID
  museum_id: string; // Unique slug identifier
  name: string;
  location: string;
  state: string;
  category: string;
  price: number; // Base price (compatible with older schemas)
  prices: VisitorPrices; // Category-specific prices
  capacity?: number; // Added capacity
  description?: string;
  imageUrl?: string;
  virtualTourUrl?: string;
  loginEmail?: string;
  createdAt: string;
  updatedAt?: string;
};

function toDateString(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '_');
}

async function findUserByEmail(email: string) {
  const firestore = getFirebaseFirestore();
  return firestore
    .collection('users')
    .where('email', '==', email.trim().toLowerCase())
    .limit(1)
    .get();
}

async function upsertMuseumLoginUser(input: {
  email: string;
  password: string;
  museumName: string;
  now: Date;
}) {
  const firestore = getFirebaseFirestore();
  const normalizedEmail = input.email.trim().toLowerCase();
  const hashedPassword = await bcrypt.hash(input.password, 10);
  const userSnapshot = await findUserByEmail(normalizedEmail);

  if (!userSnapshot.empty) {
    const userRef = userSnapshot.docs[0].ref;
    await userRef.update({
      name: input.museumName.trim() + ' Admin',
      email: normalizedEmail,
      password: hashedPassword,
      authProvider: 'password',
      profileCompleted: true,
      role: 'museum',
      updatedAt: input.now
    });
    return userRef.id;
  }

  const userRef = firestore.collection('users').doc();
  await userRef.set({
    name: input.museumName.trim() + ' Admin',
    email: normalizedEmail,
    password: hashedPassword,
    phone: '',
    authProvider: 'password',
    profileCompleted: true,
    role: 'museum',
    createdAt: input.now,
    updatedAt: input.now
  });
  return userRef.id;
}

export async function registerMuseum(input: {
  name: string;
  location: string;
  state: string;
  category: string;
  description?: string;
  imageUrl?: string;
  prices: VisitorPrices;
  loginEmail?: string;
  loginPassword?: string;
}) {
  if (!input.name || !input.name.trim()) {
    throw new ApiError('Museum name is required', 400);
  }
  if (!input.location || !input.location.trim()) {
    throw new ApiError('Location is required', 400);
  }
  
  // Basic validation of pricing categories
  const priceCategories: (keyof VisitorPrices)[] = ['Adult', 'Child', 'Senior Citizen', 'Student', 'Professor', 'Researcher/Scientist'];
  for (const cat of priceCategories) {
    const val = input.prices[cat];
    if (typeof val !== 'number' || Number.isNaN(val) || val < 0) {
      throw new ApiError(`Price for ${cat} must be a valid non-negative number`, 400);
    }
  }

  const firestore = getFirebaseFirestore();
  const now = new Date();

  // Validate and handle user credentials
  let normalizedEmail = '';
  if (input.loginEmail && input.loginEmail.trim()) {
    normalizedEmail = input.loginEmail.trim().toLowerCase();
    const existingUserSnapshot = await findUserByEmail(normalizedEmail);

    if (!existingUserSnapshot.empty) {
      throw new ApiError('User account with this email/user ID already exists', 400);
    }

    if (!input.loginPassword || input.loginPassword.length < 8) {
      throw new ApiError('Password must be at least 8 characters long', 400);
    }
  }
  
  const baseSlug = slugify(input.name);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const museum_id = `custom_${baseSlug}_${randomSuffix}`;

  const docRef = firestore.collection('museums').doc();

  const payload: Record<string, any> = {
    museum_id,
    name: input.name.trim(),
    location: input.location.trim(),
    state: (input.state || '').trim(),
    category: (input.category || 'General').trim(),
    price: input.prices.Adult ?? 200, // compat
    prices: input.prices,
    description: (input.description || '').trim(),
    imageUrl: input.imageUrl || '',
    createdAt: now,
    updatedAt: now
  };

  if (normalizedEmail) {
    payload.loginEmail = normalizedEmail;
  }

  // Save the museum details to Firestore
  await docRef.set(payload);

  // If credentials are provided, create the museum authority user account
  if (normalizedEmail && input.loginPassword) {
    await upsertMuseumLoginUser({
      email: normalizedEmail,
      password: input.loginPassword,
      museumName: input.name,
      now
    });
  }

  cachedMuseums = null;
  return {
    success: true,
    message: 'Museum and user account registered successfully',
    museum: {
      id: docRef.id,
      ...payload,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  };
}

export async function updateMuseum(id: string, input: {
  name: string;
  location: string;
  state: string;
  category: string;
  description?: string;
  imageUrl?: string;
  prices: VisitorPrices;
  loginEmail?: string;
  loginPassword?: string;
}) {
  if (!input.name || !input.name.trim()) {
    throw new ApiError('Museum name is required', 400);
  }
  if (!input.location || !input.location.trim()) {
    throw new ApiError('Location is required', 400);
  }

  const priceCategories: (keyof VisitorPrices)[] = ['Adult', 'Child', 'Senior Citizen', 'Student', 'Professor', 'Researcher/Scientist'];
  for (const cat of priceCategories) {
    const val = input.prices[cat];
    if (typeof val !== 'number' || Number.isNaN(val) || val < 0) {
      throw new ApiError(`Price for ${cat} must be a valid non-negative number`, 400);
    }
  }

  const firestore = getFirebaseFirestore();
  const docRef = firestore.collection('museums').doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new ApiError('Museum not found', 404);
  }

  const now = new Date();
  const oldData = doc.data() || {};
  const oldLoginEmail = oldData.loginEmail ? String(oldData.loginEmail).trim().toLowerCase() : '';
  const newLoginEmail = input.loginEmail ? input.loginEmail.trim().toLowerCase() : '';

  // Handle Login Email changes/validations
  if (newLoginEmail && newLoginEmail !== oldLoginEmail) {
    const existingUserSnapshot = await findUserByEmail(newLoginEmail);

    if (!existingUserSnapshot.empty) {
      throw new ApiError('User account with this email/user ID already exists', 400);
    }

    // Update login email in the user account document
    if (oldLoginEmail) {
      const userSnapshot = await findUserByEmail(oldLoginEmail);

      if (!userSnapshot.empty) {
        const userRef = userSnapshot.docs[0].ref;
        await userRef.update({
          email: newLoginEmail,
          updatedAt: now
        });
      }
    } else {
      // If no old user account was associated but they want to add one now,
      // password is required
      if (!input.loginPassword || input.loginPassword.length < 8) {
        throw new ApiError('Password of at least 8 characters is required to register the login account', 400);
      }
      await upsertMuseumLoginUser({
        email: newLoginEmail,
        password: input.loginPassword,
        museumName: input.name,
        now
      });
    }
  }

  // Handle password updates if provided
  if (input.loginPassword && input.loginPassword.trim()) {
    if (input.loginPassword.length < 8) {
      throw new ApiError('Password must be at least 8 characters long', 400);
    }

    const targetEmail = newLoginEmail || oldLoginEmail;
    if (targetEmail) {
      await upsertMuseumLoginUser({
        email: targetEmail,
        password: input.loginPassword,
        museumName: input.name,
        now
      });
    }
  }

  const payload: Record<string, any> = {
    name: input.name.trim(),
    location: input.location.trim(),
    state: (input.state || '').trim(),
    category: (input.category || 'General').trim(),
    price: input.prices.Adult ?? 200, // compat
    prices: input.prices,
    description: (input.description || '').trim(),
    imageUrl: input.imageUrl || '',
    updatedAt: now
  };

  if (newLoginEmail) {
    payload.loginEmail = newLoginEmail;
  }

  await docRef.update(payload);

  cachedMuseums = null;
  return {
    success: true,
    message: 'Museum and credentials updated successfully',
    museum: {
      id,
      ...doc.data(),
      ...payload,
      updatedAt: now.toISOString()
    }
  };
}

let cachedMuseums: MuseumRecord[] | null = null;

export async function getCustomMuseums() {
  if (cachedMuseums) {
    return {
      success: true,
      museums: cachedMuseums
    };
  }

  const firestore = getFirebaseFirestore();
  const snapshot = await firestore.collection('museums').orderBy('createdAt', 'desc').get();

  const museums: MuseumRecord[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    const basePrice = Number(data.price ?? 200);
    const prices: VisitorPrices = data.prices || {
      Adult: basePrice,
      Child: Math.round(basePrice * 0.5),
      'Senior Citizen': Math.round(basePrice * 0.75),
      Student: Math.round(basePrice * 0.6),
      Professor: Math.round(basePrice * 0.9),
      'Researcher/Scientist': Math.round(basePrice * 0.9)
    };

    return {
      id: doc.id,
      museum_id: String(data.museum_id || doc.id),
      name: String(data.name || ''),
      location: String(data.location || ''),
      state: String(data.state || ''),
      category: String(data.category || ''),
      price: basePrice,
      prices,
      capacity: data.capacity ? Number(data.capacity) : undefined,
      description: data.description ? String(data.description) : undefined,
      imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
      virtualTourUrl: data.virtualTourUrl ? String(data.virtualTourUrl) : undefined,
      loginEmail: data.loginEmail ? String(data.loginEmail) : undefined,
      createdAt: toDateString(data.createdAt),
      updatedAt: data.updatedAt ? toDateString(data.updatedAt) : undefined
    };
  });

  cachedMuseums = museums;

  return {
    success: true,
    museums
  };
}

export async function deleteCustomMuseum(id: string) {
  const firestore = getFirebaseFirestore();
  const docRef = firestore.collection('museums').doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new ApiError('Museum not found', 404);
  }

  // Optional: Also delete user account matching loginEmail
  const data = doc.data() || {};
  const email = data.loginEmail ? String(data.loginEmail).trim().toLowerCase() : '';
  
  await docRef.delete();

  if (email) {
    try {
      const userSnapshot = await firestore
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        await userDoc.ref.delete();
      }
    } catch (err) {
      console.error('Failed to delete associated user account:', err);
    }
  }

  cachedMuseums = null;
  return {
    success: true,
    message: 'Museum and user account deleted successfully'
  };
}
