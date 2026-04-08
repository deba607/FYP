import axios from 'axios';
import { ApiError } from '../utils/errors';

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
