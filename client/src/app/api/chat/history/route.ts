import { NextRequest } from 'next/server';
import { getFirebaseRealtimeDatabase } from '../../../../lib/config/firebaseAdmin';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { encodeRtdbKey } from '../../../../lib/utils/firebaseKey';

export const runtime = 'nodejs';

type StoredChatMessage = {
  sender?: 'user' | 'bot';
  message?: string;
  timestamp?: number;
  intent?: string | null;
  booking_data?: Record<string, unknown>;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSessionId = searchParams.get('session_id') || 'default';
    const limitRaw = searchParams.get('limit') || '100';
    const limit = Math.max(1, Math.min(Number(limitRaw) || 100, 300));

    const sessionId = encodeRtdbKey(rawSessionId);
    const db = getFirebaseRealtimeDatabase();

    const snapshot = await db.ref(`chat_messages/${sessionId}`).limitToLast(limit).get();
    const value = (snapshot.val() || {}) as Record<string, StoredChatMessage>;

    const messages = Object.entries(value)
      .map(([id, entry]) => ({
        id,
        sender: entry?.sender || 'bot',
        message: entry?.message || '',
        timestamp: typeof entry?.timestamp === 'number' ? entry.timestamp : 0,
        intent: entry?.intent ?? null,
        booking_data: entry?.booking_data || {}
      }))
      .filter((m) => m.message)
      .sort((a, b) => a.timestamp - b.timestamp);

    return jsonSuccess({ success: true, messages }, 200);
  } catch (err) {
    return jsonError('Failed to load chat history', 500, { error: (err as Error).message });
  }
}
