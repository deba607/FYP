import { findMuseum, getMuseumTours } from '../../../../../lib/services/virtualGuideService';
import { ApiError, toErrorMessage } from '../../../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try { const { id } = await context.params; const museum = await findMuseum(id); return jsonSuccess({ success: true, museumId: museum.museum_id, videos: await getMuseumTours(museum) }); }
  catch (error) { if (error instanceof ApiError) return jsonError(error.message, error.statusCode); return jsonError(toErrorMessage(error, 'Unable to load museum videos'), 500); }
}
