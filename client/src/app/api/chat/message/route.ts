import { NextRequest } from 'next/server';
import { sendMessageToChatbot } from '../../../../lib/services/chatService';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { logUserActivity } from '../../../../lib/services/activityService';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await sendMessageToChatbot(body);
    
    const snippet = String(body.message || '').substring(0, 60);
    void logUserActivity(
      null,
      'chatbot-visitor',
      'Chat',
      'chatbot_message',
      `Sent chatbot query: "${snippet}${snippet.length >= 60 ? '...' : ''}"`
    );

    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }

    return jsonError(toErrorMessage(error, 'Failed to process message'), 500);
  }
}
