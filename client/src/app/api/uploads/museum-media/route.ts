import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { requireFirebaseUser } from '../../../../lib/middleware/auth';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { ApiError } from '../../../../lib/utils/errors';
import { IMAGE_UPLOAD_TARGET_BYTES, VIDEO_UPLOAD_TARGET_BYTES } from '../../../../lib/mediaCompression';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    if (user.role !== 'admin' && user.role !== 'museum') {
      return jsonError('Museum media upload access denied', 403);
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return jsonError('No file uploaded', 400);

    const mediaType = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : null;
    if (!mediaType) return jsonError('Only image and video files are allowed', 400);

    const targetBytes = mediaType === 'image' ? IMAGE_UPLOAD_TARGET_BYTES : VIDEO_UPLOAD_TARGET_BYTES;
    if (mediaType === 'image' && file.size > 30 * 1024 * 1024) {
      return jsonError('Image is too large to process safely (max 30MB)', 400);
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return jsonError('Cloudinary environment variables are not configured', 500);
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'bharat-museum/museum-media';
    const publicId = `museum_${timestamp}_${crypto.randomBytes(5).toString('hex')}`;
    const shouldCompress = file.size > targetBytes;
    const requestedVideoBitrate = Number(formData.get('targetVideoBitrateKbps'));
    const videoBitrateKbps = Number.isFinite(requestedVideoBitrate)
      ? Math.max(96, Math.min(5000, Math.round(requestedVideoBitrate)))
      : 600;
    const transformation = shouldCompress
      ? mediaType === 'image'
        ? 'c_limit,h_2560,q_auto:good,w_2560'
        : `ac_aac,br_${videoBitrateKbps}k,c_limit,f_mp4,h_720,vc_h264,w_1280`
      : '';
    const signaturePayload = [
      `folder=${folder}`,
      `public_id=${publicId}`,
      `timestamp=${timestamp}`,
      ...(transformation ? [`transformation=${transformation}`] : [])
    ].join('&') + apiSecret;
    const signature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    const cloudinaryForm = new FormData();
    cloudinaryForm.append('file', file);
    cloudinaryForm.append('api_key', apiKey);
    cloudinaryForm.append('timestamp', String(timestamp));
    cloudinaryForm.append('signature', signature);
    cloudinaryForm.append('folder', folder);
    cloudinaryForm.append('public_id', publicId);
    if (transformation) cloudinaryForm.append('transformation', transformation);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${mediaType}/upload`,
      { method: 'POST', body: cloudinaryForm }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return jsonError(payload?.error?.message || 'Cloudinary upload failed', 502);

    const mediaUrl = String(payload?.secure_url || '');
    if (!mediaUrl) return jsonError('Cloudinary did not return a media URL', 502);

    return jsonSuccess({
      success: true,
      message: `${mediaType === 'image' ? 'Photo' : 'Video'} uploaded successfully`,
      mediaType,
      mediaUrl,
      compressed: shouldCompress,
      originalBytes: file.size,
      storedBytes: Number(payload?.bytes || 0),
      publicId: String(payload?.public_id || '')
    });
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.message, error.statusCode);
    return jsonError((error as Error).message || 'Museum media upload failed', 500);
  }
}
