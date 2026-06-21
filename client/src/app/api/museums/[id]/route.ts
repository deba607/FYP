import { NextRequest } from 'next/server';
import { deleteCustomMuseum, updateMuseum } from '../../../../lib/services/museumService';
import { findMuseum, toPublicMuseum } from '../../../../lib/services/virtualGuideService';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { requireFirebaseUser } from '../../../../lib/middleware/auth';
import { getFirebaseFirestore } from '../../../../lib/config/firebaseAdmin';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    return jsonSuccess({ success: true, museum: toPublicMuseum(await findMuseum(id)) }, 200);
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.message, error.statusCode);
    return jsonError(toErrorMessage(error, 'Unable to load museum'), 500);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const result = await deleteCustomMuseum(id);
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Unable to delete museum'), 500);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await requireFirebaseUser(req);
    if (user.role !== 'admin') {
      if (user.role !== 'museum' || !user.email) return jsonError('Museum update access denied', 403);
      const museumDocument = await getFirebaseFirestore().collection('museums').doc(id).get();
      const ownerEmail = String(museumDocument.data()?.loginEmail || '').trim().toLowerCase();
      if (!museumDocument.exists || ownerEmail !== user.email.trim().toLowerCase()) {
        return jsonError('You can update only your assigned museum', 403);
      }
    }
    const body = await req.json();
    const { name, location, state, category, description, history, highlights, imageUrl, imageUrls, videoUrl, videoUrls, prices, loginEmail, loginPassword } = body;

    const result = await updateMuseum(id, {
      name,
      location,
      state,
      category,
      description,
      history,
      highlights,
      imageUrl,
      imageUrls,
      videoUrl,
      videoUrls,
      prices,
      loginEmail,
      loginPassword
    });

    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Unable to update museum'), 500);
  }
}
