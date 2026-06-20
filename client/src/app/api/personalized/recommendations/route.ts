import { NextRequest } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/middleware/auth';
import { generatePersonalizedRecommendations } from '../../../../lib/services/recommendationService';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    const force = new URL(request.url).searchParams.get('refresh') === 'true';
    const result = await generatePersonalizedRecommendations(user, { force });
    return jsonSuccess(result, 200, {
      headers: { 'Cache-Control': 'private, no-store' }
    });
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.message, error.statusCode);
    return jsonError(toErrorMessage(error, 'Unable to generate recommendations'), 500);
  }
}
