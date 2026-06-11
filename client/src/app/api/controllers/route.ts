import { NextRequest } from 'next/server';
import { getControllers, registerController } from '../../../lib/services/controllerService';
import { ApiError, toErrorMessage } from '../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await getControllers();
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Unable to fetch controllers'), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, museumId, status } = body;
    const result = await registerController(name, museumId, status);
    return jsonSuccess(result, 201);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Unable to register controller'), 500);
  }
}
