import { NextRequest } from 'next/server';
import { getFirebaseRealtimeDatabase } from '../../../../lib/config/firebaseAdmin';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { encodeRtdbKey } from '../../../../lib/utils/firebaseKey';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sessionId = encodeRtdbKey(String(body?.session_id || 'default'));

    const db = getFirebaseRealtimeDatabase();
    const sessionRef = db.ref(`chat_messages/${sessionId}`);

    if (body?.user_message) {
      await sessionRef.push({
        sender: 'user',
        message: body.user_message,
        timestamp: Date.now()
      });
    }

    if (body?.bot_message) {
      await sessionRef.push({
        sender: 'bot',
        message: body.bot_message,
        intent: body?.intent || null,
        booking_data: body?.booking_data || {},
        action: body?.action || null,
        timestamp: Date.now()
      });
    }

    return jsonSuccess({ success: true }, 200);
  } catch (err) {
    return jsonError('Failed to store chat message', 500, { error: (err as Error).message });
  }
}
