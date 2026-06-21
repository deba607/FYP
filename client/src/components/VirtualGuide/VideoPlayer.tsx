"use client";

import { ExternalLink, Film } from 'lucide-react';
import { getYouTubeVideoId, type VirtualTour } from '../../lib/virtualGuide';

export default function VideoPlayer({ tour, title }: { tour?: VirtualTour; title?: string }) {
  if (!tour) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border bg-muted/20 p-6 text-center text-muted-foreground">
        <Film className="mb-2 h-8 w-8" />
        <p className="text-sm font-medium">No video has been added for this museum yet.</p>
      </div>
    );
  }

  const youtubeId = tour.videoType === 'youtube' ? getYouTubeVideoId(tour.videoUrl) : '';
  return (
    <figure className="overflow-hidden rounded-xl border bg-black shadow-sm">
      <div className="aspect-video w-full">
        {youtubeId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`}
            title={title || tour.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <video controls preload="metadata" poster={tour.thumbnail} className="h-full w-full bg-black object-contain">
            <source src={tour.videoUrl} type={tour.videoType === 'hls' ? 'application/vnd.apple.mpegurl' : 'video/mp4'} />
            {tour.captionsUrl ? <track kind="captions" src={tour.captionsUrl} srcLang={tour.language || 'en'} label="Captions" default /> : null}
            Your browser does not support embedded video playback.
          </video>
        )}
      </div>
      <figcaption className="flex items-start justify-between gap-3 bg-background p-3">
        <div>
          <div className="text-sm font-semibold">{tour.title}</div>
          {tour.description ? <p className="mt-1 text-xs text-muted-foreground">{tour.description}</p> : null}
        </div>
        {youtubeId ? (
          <a href={`https://www.youtube.com/watch?v=${youtubeId}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium hover:bg-muted">
            Open on YouTube <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}
