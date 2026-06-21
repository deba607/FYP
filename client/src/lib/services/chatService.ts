import axios from 'axios';
import { ApiError } from '../utils/errors';
import { getFirebaseRealtimeDatabase } from '../config/firebaseAdmin';
import { encodeRtdbKey } from '../utils/firebaseKey';
import { after } from 'next/server';

const CHATBOT_ENGINE_URL = process.env.CHATBOT_ENGINE_URL || 'http://localhost:5001';

function redactSensitiveChatMessage(message: string, intent?: string) {
  const text = String(message || '').trim();
  const lower = text.toLowerCase();

  if (
    (intent === 'signup' || intent === 'signin') &&
    text &&
    !text.includes('@') &&
    !['sign up', 'signup', 'register', 'create account', 'sign in', 'signin', 'login', 'log in'].some((keyword) => lower.includes(keyword))
  ) {
    return '[redacted auth message]';
  }

  return message;
}

async function storeChatExchange(input: {
  message: string;
  sessionId: string;
  response: string;
  intent?: string;
  bookingData?: Record<string, unknown>;
  action?: unknown;
}) {
  try {
    const db = getFirebaseRealtimeDatabase();
    const sessionRef = db.ref(`chat_messages/${encodeRtdbKey(input.sessionId)}`);

    await Promise.all([
      sessionRef.push({
        sender: 'user',
        message: redactSensitiveChatMessage(input.message, input.intent),
        timestamp: Date.now()
      }),
      sessionRef.push({
        sender: 'bot',
        message: input.response,
        intent: input.intent || null,
        booking_data: input.bookingData || {},
        action: input.action || null,
        timestamp: Date.now()
      })
    ]);
  } catch (err) {
    console.warn('Failed to write chat message to Firebase RTDB:', (err as Error).message);
  }
}

export async function sendMessageToChatbot(input: {
  message: string;
  session_id?: string;
  language?: string;
  auth?: {
    token?: string;
    email?: string;
    userId?: string;
    isLoggedIn?: boolean;
  };
}) {
  if (!input.message?.trim()) {
    throw new ApiError('Message is required', 400);
  }

  try {
    const response = await axios.post(`${CHATBOT_ENGINE_URL}/chat`, {
      message: input.message,
      session_id: input.session_id || 'default',
      language: input.language || 'en',
      auth: input.auth || {}
    });

    // Persist analytics after the response is sent. Chat latency should only be
    // determined by the chatbot engine, not by two extra database writes.
    after(() => storeChatExchange({
      message: input.message,
      sessionId: input.session_id || response.data.session_id || 'default',
      response: response.data.response,
      intent: response.data.intent,
      bookingData: response.data.booking_data,
      action: response.data.action
    }));

    return {
      success: true,
      response: response.data.response,
      intent: response.data.intent,
      booking_data: response.data.booking_data,
      action: response.data.action || null,
      auth_result: response.data.auth_result || null
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
