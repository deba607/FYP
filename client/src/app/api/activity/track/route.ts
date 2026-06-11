import { NextRequest } from 'next/server';
import { logUserActivity } from '../../../../lib/services/activityService';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, email, category, action, details } = body;

    if (!category || !action || !details) {
      throw new ApiError('Missing required activity log fields (category, action, details)', 400);
    }

    const validCategories = new Set(['Auth', 'Profile', 'Booking', 'Payment', 'Chat', 'Scan', 'Navigation', 'Interaction']);
    if (!validCategories.has(category)) {
      throw new ApiError(`Invalid activity category: ${category}`, 400);
    }

    const resolvedEmail = String(email || 'guest').trim();
    const resolvedUserId = userId ? String(userId) : null;

    // Async log call (non-blocking)
    void logUserActivity(
      resolvedUserId,
      resolvedEmail,
      category as any,
      String(action),
      String(details)
    );

    return jsonSuccess({ success: true }, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Failed to log activity'), 500);
  }
}
