export const IMAGE_UPLOAD_TARGET_BYTES = 8 * 1024 * 1024;
export const VIDEO_UPLOAD_TARGET_BYTES = 50 * 1024 * 1024;
const VIDEO_COMPRESSION_BUDGET_BYTES = 45 * 1024 * 1024;

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('The browser could not compress this image.')),
      'image/webp',
      quality
    );
  });
}

export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= IMAGE_UPLOAD_TARGET_BYTES) return file;

  // Preserve animated GIFs; the server-side Cloudinary transformation compresses them.
  if (file.type === 'image/gif') return file;

  if (typeof createImageBitmap !== 'function') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const maxDimension = 2560;
    const initialScale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * initialScale));
    let height = Math.max(1, Math.round(bitmap.height * initialScale));
    let quality = 0.86;
    let result: Blob | null = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image compression is unavailable in this browser.');
      context.drawImage(bitmap, 0, 0, width, height);
      result = await canvasToBlob(canvas, quality);
      if (result.size <= IMAGE_UPLOAD_TARGET_BYTES) break;
      quality = Math.max(0.5, quality - 0.08);
      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }

    if (!result || result.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'museum-photo';
    return new File([result], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

export function getVideoCompressionBitrateKbps(file: File): Promise<number | null> {
  if (!file.type.startsWith('video/') || file.size <= VIDEO_UPLOAD_TARGET_BYTES) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    const finish = (value: number | null) => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
      resolve(value);
    };

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Number(video.duration);
      if (!Number.isFinite(duration) || duration <= 0) return finish(null);

      // Reserve roughly 96 kbps for audio and a 5MB container/metadata margin.
      const totalKbps = Math.floor((VIDEO_COMPRESSION_BUDGET_BYTES * 8) / duration / 1000);
      const videoKbps = Math.max(96, Math.min(5000, totalKbps - 96));
      finish(videoKbps);
    };
    video.onerror = () => finish(null);
    video.src = objectUrl;
  });
}

let ffmpegInstancePromise: Promise<import('@ffmpeg/ffmpeg').FFmpeg> | null = null;

async function getFFmpegInstance() {
  if (!ffmpegInstancePromise) {
    ffmpegInstancePromise = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: '/api/ffmpeg-core?asset=js',
        wasmURL: '/api/ffmpeg-core?asset=wasm'
      });
      return ffmpeg;
    })().catch((error) => {
      ffmpegInstancePromise = null;
      throw error;
    });
  }
  return ffmpegInstancePromise;
}

export async function compressVideoForUpload(file: File, onProgress?: (progress: number) => void): Promise<File> {
  if (!file.type.startsWith('video/') || file.size <= VIDEO_UPLOAD_TARGET_BYTES) return file;

  const bitrateKbps = await getVideoCompressionBitrateKbps(file);
  if (!bitrateKbps) throw new Error('Unable to read the video duration for compression.');

  const [{ fetchFile }, ffmpeg] = await Promise.all([import('@ffmpeg/util'), getFFmpegInstance()]);
  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const extension = file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || 'mp4';
  const inputName = `input_${id}.${extension}`;
  const outputName = `output_${id}.mp4`;
  const progressHandler = ({ progress }: { progress: number }) => onProgress?.(Math.max(0, Math.min(1, progress)));

  ffmpeg.on('progress', progressHandler);
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    let currentBitrateKbps = bitrateKbps;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const audioBitrateKbps = attempt < 2 ? 64 : 32;
      const exitCode = await ffmpeg.exec([
        '-i', inputName,
        '-vf', 'scale=w=1280:h=720:force_original_aspect_ratio=decrease',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-b:v', `${currentBitrateKbps}k`,
        '-maxrate', `${Math.max(64, Math.round(currentBitrateKbps * 1.1))}k`,
        '-bufsize', `${Math.max(128, currentBitrateKbps * 2)}k`,
        '-c:a', 'aac',
        '-b:a', `${audioBitrateKbps}k`,
        '-movflags', '+faststart',
        outputName
      ]);
      if (exitCode !== 0) throw new Error('Video compression could not be completed.');

      const output = await ffmpeg.readFile(outputName);
      if (typeof output === 'string') throw new Error('Video compression returned invalid output.');
      const bytes = new Uint8Array(output);
      if (!bytes.byteLength) throw new Error('Video compression produced an empty file.');
      if (bytes.byteLength <= VIDEO_UPLOAD_TARGET_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'museum-video';
        return new File([bytes], `${baseName}-compressed.mp4`, { type: 'video/mp4', lastModified: Date.now() });
      }

      const reductionRatio = (VIDEO_UPLOAD_TARGET_BYTES * 0.9) / bytes.byteLength;
      currentBitrateKbps = Math.max(24, Math.floor(currentBitrateKbps * reductionRatio));
      await ffmpeg.deleteFile(outputName).catch(() => undefined);
    }
    throw new Error('This video could not be reduced below 50MB while retaining playable audio and video.');
  } finally {
    ffmpeg.off('progress', progressHandler);
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
  }
}
