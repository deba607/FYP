import { getFirebaseRealtimeDatabase } from '../config/firebaseAdmin';

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
    const db = getFirebaseRealtimeDatabase();
    const now = new Date();

    const normalizedEmail = String(email || 'guest').trim().toLowerCase();

    await db.ref('user_activities').push({
      userId: userId || null,
      email: normalizedEmail,
      category,
      action: action.trim(),
      details: details.trim(),
      timestamp: now.toISOString()
    });
  } catch (err) {
    console.error('Failed to write user activity log to Realtime Database:', err);
  }
}

export async function getUserActivities() {
  try {
    const db = getFirebaseRealtimeDatabase();
    const snapshot = await db
      .ref('user_activities')
      .orderByChild('timestamp')
      .limitToLast(200)
      .once('value');

    const activities: UserActivity[] = [];
    snapshot.forEach((child) => {
      const val = child.val();
      activities.push({
        id: child.key || '',
        userId: val.userId || null,
        email: String(val.email || 'guest'),
        category: String(val.category || 'Auth') as UserActivity['category'],
        action: String(val.action || ''),
        details: String(val.details || ''),
        timestamp: toDateString(val.timestamp)
      });
    });

    // Reverse to get descending order (newest first)
    activities.reverse();

    return {
      success: true,
      activities
    };
  } catch (error) {
    console.error('Failed to fetch user activities from Realtime Database:', error);
    throw error;
  }
}
