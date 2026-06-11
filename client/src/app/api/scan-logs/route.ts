import { NextRequest } from 'next/server';
import { getScanLogs } from '../../../lib/services/controllerService';
import { ApiError, toErrorMessage } from '../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get('deviceId') || undefined;
    const result = await getScanLogs(deviceId);
    return jsonSuccess(result, 200);
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error.message, error.statusCode);
    }
    return jsonError(toErrorMessage(error, 'Unable to fetch scan logs'), 500);
  }
}
