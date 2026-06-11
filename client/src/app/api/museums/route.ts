import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { getCustomMuseums, registerMuseum } from '../../../lib/services/museumService';
import { ApiError, toErrorMessage } from '../../../lib/utils/errors';
import { jsonError, jsonSuccess } from '../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // 1. Load static museums from museums.json
    let staticMuseums: any[] = [];
    try {
      const filePath = path.join(process.cwd(), 'public', 'museums.json');
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        staticMuseums = JSON.parse(fileContent);
      }
    } catch (fsError) {
      console.error('Failed to read static museums.json:', fsError);
    }

    // 2. Load custom museums from Firestore
    let customMuseums: any[] = [];
    try {
      const customResult = await getCustomMuseums();
      customMuseums = customResult.museums || [];
    } catch (dbError) {
      console.error('Failed to load custom museums from Firestore:', dbError);
    }

    // Combine custom museums (listed first) and static museums
    const combined = [...customMuseums, ...staticMuseums];

    // Remove duplicates based on museum_id
    const seenIds = new Set<string>();
    const uniqueMuseums = combined.filter((m) => {
      if (!m.museum_id) return false;
      if (seenIds.has(m.museum_id)) return false;
      seenIds.add(m.museum_id);
      return true;
    });

    return jsonSuccess({
      success: true,
      count: uniqueMuseums.length,
      museums: uniqueMuseums
    }, 200);
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
