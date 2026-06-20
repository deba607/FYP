import { NextRequest } from 'next/server';
import { getCrowdInsights, getDetailedCrowdInsight, configureMuseumCapacity } from '../../../lib/services/crowdService';
import { requireFirebaseUser } from '../../../lib/middleware/auth';
import { jsonError, jsonSuccess } from '../../../lib/utils/apiResponse';
import { ApiError, toErrorMessage } from '../../../lib/utils/errors';
import { getFirebaseFirestore } from '../../../lib/config/firebaseAdmin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const museumId = new URL(request.url).searchParams.get('museumId') || undefined;
    if (museumId) {
      const detailed = await getDetailedCrowdInsight(museumId);
      return jsonSuccess({ success: true, detailed }, 200, {
        headers: { 'Cache-Control': 'private, no-store' }
      });
    }
    return jsonSuccess({ success: true, insights: await getCrowdInsights() }, 200, {
      headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' }
    });
  } catch (error) {
    return jsonError(toErrorMessage(error, 'Unable to load crowd insights'), 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    const body = await request.json().catch(() => ({}));
    const museumId = String(body.museumId || '');
    if (user.role !== 'admin') {
      if (user.role !== 'museum' || !user.email) return jsonError('Crowd configuration access denied', 403);
      const museums = await getFirebaseFirestore().collection('museums')
        .where('loginEmail', '==', user.email.trim().toLowerCase()).limit(10).get();
      const ownsMuseum = museums.docs.some((doc) => [doc.id, String(doc.data().museum_id || '')].includes(museumId));
      if (!ownsMuseum) return jsonError('You can configure only your assigned museum', 403);
    }
    await configureMuseumCapacity(museumId, Number(body.capacity));
    return jsonSuccess({ success: true, message: 'Museum capacity updated' });
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.message, error.statusCode);
    return jsonError(toErrorMessage(error, 'Unable to update crowd configuration'), 500);
  }
}
