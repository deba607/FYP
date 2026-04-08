import { NextRequest } from 'next/server';
import { jsonError, jsonSuccess } from '../../../lib/utils/apiResponse';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return jsonError('No file uploaded', 400);
    }

    if (!file.type.startsWith('image/')) {
      return jsonError('Only image files are allowed', 400);
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      return jsonError('Image is too large (max 5MB)', 400);
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return jsonError('Cloudinary environment variables are not configured', 500);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'bharat-museum/profile-images';
    const publicId = `profile_${timestamp}_${crypto.randomBytes(4).toString('hex')}`;

    const signaturePayload = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    const form = new FormData();
    form.append('file', file);
    form.append('api_key', apiKey);
    form.append('timestamp', String(timestamp));
    form.append('signature', signature);
    form.append('folder', folder);
    form.append('public_id', publicId);

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: form
      }
    );

    const payload = await uploadResponse.json().catch(() => ({}));

    if (!uploadResponse.ok) {
      return jsonError(payload?.error?.message || 'Cloudinary upload failed', 502);
    }

    const secureUrl = String(payload?.secure_url || '');
    if (!secureUrl) {
      return jsonError('Cloudinary did not return image URL', 502);
    }

    return jsonSuccess(
      {
        success: true,
        message: 'Image uploaded successfully',
        imageUrl: secureUrl,
        publicId: payload?.public_id || ''
      },
      200
    );
  } catch (error) {
    return jsonError((error as Error).message || 'Upload failed', 500);
  }
}
