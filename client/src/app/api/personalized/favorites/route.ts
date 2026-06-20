import { NextRequest } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/middleware/auth';
import { setMuseumFavorite } from '../../../../lib/services/recommendationService';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    const body = await request.json().catch(() => ({}));
    const museumId = String(body.museumId || '').trim();
    if (!museumId) return jsonError('Museum ID is required', 400);
    const favorite = body.favorite !== false;
    await setMuseumFavorite(user.uid, museumId, favorite);
    return jsonSuccess({ success: true, museumId, favorite });
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.message, error.statusCode);
    return jsonError(toErrorMessage(error, 'Unable to update favorite'), 500);
  }
}
