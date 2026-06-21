"use client";

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Upload, Video } from 'lucide-react';
import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import { compressImageForUpload, compressVideoForUpload, getVideoCompressionBitrateKbps, IMAGE_UPLOAD_TARGET_BYTES, VIDEO_UPLOAD_TARGET_BYTES } from '../../lib/mediaCompression';

type Props = {
  imageUrls: string[];
  videoUrls: string[];
  onChange: (media: { imageUrls: string[]; videoUrls: string[] }) => void;
  disabled?: boolean;
};

export default function MuseumMediaUploader({ imageUrls, videoUrls, onChange, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progressMessage, setProgressMessage] = useState('');

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    setProgressMessage('Preparing media...');
    const nextImages = [...imageUrls];
    const nextVideos = [...videoUrls];

    try {
      const user = getFirebaseClientAuth().currentUser;
      if (!user) throw new Error('Please sign in again before uploading museum media.');
      const token = await user.getIdToken();

      for (const originalFile of Array.from(files)) {
        const needsCompression = originalFile.type.startsWith('image/')
          ? originalFile.size > IMAGE_UPLOAD_TARGET_BYTES
          : originalFile.size > VIDEO_UPLOAD_TARGET_BYTES;
        setProgressMessage(needsCompression ? `Compressing ${originalFile.name}...` : `Uploading ${originalFile.name}...`);
        const file = originalFile.type.startsWith('image/')
          ? await compressImageForUpload(originalFile)
          : needsCompression
            ? await compressVideoForUpload(originalFile, (progress) => {
                setProgressMessage(`Compressing ${originalFile.name}: ${Math.round(progress * 100)}%`);
              })
            : originalFile;
        const formData = new FormData();
        formData.append('file', file);
        if (file.type.startsWith('video/') && file.size > VIDEO_UPLOAD_TARGET_BYTES) {
          const targetBitrateKbps = await getVideoCompressionBitrateKbps(file);
          if (targetBitrateKbps) formData.append('targetVideoBitrateKbps', String(targetBitrateKbps));
        }
        const response = await fetch('/api/uploads/museum-media', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.mediaUrl) {
          throw new Error(payload?.message || `Unable to upload ${file.name}`);
        }
        if (payload.mediaType === 'video') nextVideos.push(String(payload.mediaUrl));
        else nextImages.push(String(payload.mediaUrl));
      }

      onChange({ imageUrls: nextImages, videoUrls: nextVideos });
      setProgressMessage('');
    } catch (uploadError) {
      setError((uploadError as Error).message || 'Media upload failed.');
    } finally {
      setUploading(false);
      setProgressMessage('');
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ImagePlus className="h-4 w-4 text-emerald-500" /> Museum Photos & Videos
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Files above 8MB (images) or 50MB (videos) are compressed automatically.</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Uploading' : 'Add media'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(event) => void uploadFiles(event.target.files)}
        />
      </div>

      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      {progressMessage ? <p className="text-xs font-medium text-emerald-600">{progressMessage}</p> : null}

      {(imageUrls.length > 0 || videoUrls.length > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {imageUrls.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-lg border bg-background">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Museum photo ${index + 1}`} className="h-28 w-full object-cover" />
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => onChange({ imageUrls: imageUrls.filter((_, itemIndex) => itemIndex !== index), videoUrls })}
                className="absolute right-1.5 top-1.5 rounded-md bg-black/70 p-1.5 text-white opacity-90 hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Remove museum photo ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {videoUrls.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-lg border bg-black">
              <video src={url} controls preload="metadata" className="h-28 w-full object-cover" aria-label={`Museum video ${index + 1}`} />
              <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 p-1 text-white"><Video className="h-3.5 w-3.5" /></span>
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => onChange({ imageUrls, videoUrls: videoUrls.filter((_, itemIndex) => itemIndex !== index) })}
                className="absolute right-1.5 top-1.5 rounded-md bg-black/70 p-1.5 text-white opacity-90 hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Remove museum video ${index + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
