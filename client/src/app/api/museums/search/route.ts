import { NextRequest } from 'next/server';
import { getCustomMuseums } from '../../../../lib/services/museumService';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { toErrorMessage } from '../../../../lib/utils/errors';
import { toPublicMuseum } from '../../../../lib/services/virtualGuideService';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const query = new URL(request.url).searchParams.get('q')?.trim().toLowerCase() || '';
    const { museums } = await getCustomMuseums();
    const terms = query.split(/\s+/).filter((term) => term.length >= 2);
    const results = museums
      .map((museum) => {
        const searchable = [museum.name, museum.location, museum.state, museum.category, museum.description, museum.history, ...(museum.highlights || [])].join(' ').toLowerCase();
        const score = !query ? 1 : terms.reduce((total, term) => total + (searchable.includes(term) ? 1 : 0), 0) + (museum.name.toLowerCase().includes(query) ? 5 : 0);
        return { museum, score };
      })
      .filter((result) => result.score > 0)
      .sort((first, second) => second.score - first.score || first.museum.name.localeCompare(second.museum.name))
      .slice(0, 30)
      .map((result) => toPublicMuseum(result.museum));
    return jsonSuccess({ success: true, query, count: results.length, museums: results });
  } catch (error) {
    return jsonError(toErrorMessage(error, 'Unable to search museums'), 500);
  }
}
