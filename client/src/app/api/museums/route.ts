import { NextRequest } from 'next/server';
import { getCustomMuseums, registerMuseum } from '../../../lib/services/museumService';
import { ApiError, toErrorMessage } from '../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const customResult = await getCustomMuseums();
    const firestoreMuseums = customResult.museums || [];
    const seenIds = new Set<string>();
    const uniqueMuseums = firestoreMuseums.filter((m) => {
      if (!m.museum_id) return false;
      if (seenIds.has(m.museum_id)) return false;
      seenIds.add(m.museum_id);
      return true;
    });

    return jsonSuccess({
      success: true,
      count: uniqueMuseums.length,
      museums: uniqueMuseums
    }, 200, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    return jsonError(toErrorMessage(error, 'Unable to fetch museums'), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, location, state, category, prices, description, imageUrl, loginEmail, loginPassword } = body;
    
    const result = await registerMuseum({
      name,
      location,
      state,
      category,
      prices,
      description,
      imageUrl,
      loginEmail,
      loginPassword
    });

    return jsonSuccess(result, 201);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Unable to register museum'), 500);
  }
}
