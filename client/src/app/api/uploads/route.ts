import { NextRequest } from 'next/server';
import { jsonError, jsonSuccess } from '@/lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return jsonError('No file uploaded', 400);
    }

    const arrayBuffer = await file.arrayBuffer();

    return jsonSuccess(
      {
        success: true,
        file: {
          name: file.name,
          type: file.type,
          size: file.size,
          bytesReceived: arrayBuffer.byteLength
        },
        message: 'Upload payload received. Persist to cloud storage in this route.'
      },
      200
    );
  } catch (error) {
    return jsonError((error as Error).message || 'Upload failed', 500);
  }
}
