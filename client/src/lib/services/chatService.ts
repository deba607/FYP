import axios from 'axios';
import { ApiError } from '../utils/errors';
import { getFirebaseRealtimeDatabase } from '../config/firebaseAdmin';
import { encodeRtdbKey } from '../utils/firebaseKey';

const CHATBOT_ENGINE_URL = process.env.CHATBOT_ENGINE_URL || 'http://localhost:5001';

export async function sendMessageToChatbot(input: { message: string; session_id?: string }) {
  if (!input.message?.trim()) {
    throw new ApiError('Message is required', 400);
  }

  try {
    const response = await axios.post(`${CHATBOT_ENGINE_URL}/chat`, {
      message: input.message,
      session_id: input.session_id || 'default'
    });

    // Store messages in Firebase Realtime Database (server-side)
    try {
      const db = getFirebaseRealtimeDatabase();
      const sessionId = encodeRtdbKey(input.session_id || response.data.session_id || 'default');
      const sessionRef = db.ref(`chat_messages/${sessionId}`);

      // push user message
      await sessionRef.push({
        sender: 'user',
        message: input.message,
        timestamp: Date.now()
      });

      // push bot response
      await sessionRef.push({
        sender: 'bot',
        message: response.data.response,
        intent: response.data.intent || null,
        booking_data: response.data.booking_data || {},
        timestamp: Date.now()
      });
    } catch (err) {
      // don't block the chat flow if DB logging fails
      // eslint-disable-next-line no-console
      console.warn('Failed to write chat message to Firebase RTDB:', (err as Error).message);
    }

    return {
      success: true,
      response: response.data.response,
      intent: response.data.intent,
      booking_data: response.data.booking_data
    };
  } catch (error) {
    throw new ApiError((error as Error).message || 'Failed to process message', 500);
  }
}

export async function resetChatbotSession(input: { session_id?: string }) {
  try {
    await axios.post(`${CHATBOT_ENGINE_URL}/reset`, {
      session_id: input.session_id || 'default'
    });

    return {
      success: true,
      message: 'Session reset successfully'
    };
  } catch (error) {
    throw new ApiError((error as Error).message || 'Failed to reset session', 500);
  }
}
