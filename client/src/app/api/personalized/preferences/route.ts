import { NextRequest } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/middleware/auth';
import {
  getPersonalizationPreferences,
  updatePersonalizationPreferences
} from '../../../../lib/services/recommendationService';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    return jsonSuccess({ success: true, preferences: await getPersonalizationPreferences(user.uid) });
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.message, error.statusCode);
    return jsonError(toErrorMessage(error, 'Unable to load preferences'), 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    const body = await request.json().catch(() => ({}));
    const preferences = await updatePersonalizationPreferences(user.uid, {
      favoriteCategories: body.favoriteCategories,
      preferredLanguage: body.preferredLanguage,
      budgetMax: body.budgetMax,
      preferredCity: body.preferredCity,
      preferredState: body.preferredState,
      travelMode: body.travelMode
    });
    return jsonSuccess({ success: true, message: 'Preferences updated', preferences });
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.message, error.statusCode);
    return jsonError(toErrorMessage(error, 'Unable to update preferences'), 500);
  }
}
