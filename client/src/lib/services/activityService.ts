import { getFirebaseFirestore } from '../config/firebaseAdmin';

export type UserActivity = {
  id: string;
  userId: string | null;
  email: string;
  category: 'Auth' | 'Profile' | 'Booking' | 'Payment' | 'Chat' | 'Scan' | 'Navigation' | 'Interaction';
  action: string;
  details: string;
  timestamp: string;
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

export async function logUserActivity(
  userId: string | null,
  email: string,
  category: UserActivity['category'],
  action: string,
  details: string
) {
  try {
    const firestore = getFirebaseFirestore();
    const ref = firestore.collection('user_activities').doc();
    const now = new Date();

    const normalizedEmail = String(email || 'guest').trim().toLowerCase();

    await ref.set({
      userId: userId || null,
      email: normalizedEmail,
      category,
      action: action.trim(),
      details: details.trim(),
      timestamp: now
    });
  } catch (err) {
    console.error('Failed to write user activity log to Firestore:', err);
  }
}

export async function getUserActivities() {
  try {
    const firestore = getFirebaseFirestore();
    const snapshot = await firestore
      .collection('user_activities')
      .orderBy('timestamp', 'desc')
      .limit(200)
      .get();

    const activities = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || null,
        email: String(data.email || 'guest'),
        category: String(data.category || 'Auth') as UserActivity['category'],
        action: String(data.action || ''),
        details: String(data.details || ''),
        timestamp: toDateString(data.timestamp)
      };
    });

    return {
      success: true,
      activities
    };
  } catch (error) {
    console.error('Failed to fetch user activities from Firestore:', error);
    throw error;
  }
}
