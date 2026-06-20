import { NextRequest } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/middleware/auth';
import { recordPersonalizationActivity } from '../../../../lib/services/recommendationService';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';

export const runtime = 'nodejs';

const ACTIVITY_TYPES = new Set(['viewed', 'search', 'visited']);

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    const body = await request.json().catch(() => ({}));
    const type = String(body.type || '');
    if (!ACTIVITY_TYPES.has(type)) return jsonError('Invalid personalization activity type', 400);
    await recordPersonalizationActivity(user.uid, {
      type: type as 'viewed' | 'search' | 'visited',
      museumId: body.museumId,
      query: body.query
    });
    return jsonSuccess({ success: true });
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.message, error.statusCode);
    return jsonError(toErrorMessage(error, 'Unable to record personalization activity'), 500);
  }
}
