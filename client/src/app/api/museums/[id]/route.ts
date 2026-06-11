import { NextRequest } from 'next/server';
import { deleteCustomMuseum, updateMuseum } from '../../../../lib/services/museumService';
import { ApiError, toErrorMessage } from '../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

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
    const body = await req.json();
    const { name, location, state, category, description, imageUrl, prices, loginEmail, loginPassword } = body;

    const result = await updateMuseum(id, {
      name,
      location,
      state,
      category,
      description,
      imageUrl,
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
