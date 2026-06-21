"use client";

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Images, X, ZoomIn } from 'lucide-react';
import type { MediaGalleryItem } from '../../lib/virtualGuide';

export default function Gallery({ items }: { items: MediaGalleryItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeItem = activeIndex === null ? null : items[activeIndex];
  const move = useCallback((direction: number) => setActiveIndex((current) => current === null ? null : (current + direction + items.length) % items.length), [items.length]);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveIndex(null);
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, move]);

  if (!items.length) {
    return <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center text-muted-foreground"><Images className="mb-2 h-8 w-8" /><p className="text-sm">No gallery photos have been added yet.</p></div>;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item, index) => (
          <button key={item.gallery_id || item.id} type="button" onClick={() => setActiveIndex(index)} className="group relative overflow-hidden rounded-xl border bg-muted text-left focus:outline-none focus:ring-2 focus:ring-primary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumbnailUrl || item.imageUrl} alt={item.caption || item.title} loading="lazy" className="h-36 w-full object-cover transition duration-300 group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 text-xs font-medium text-white">
              <span className="line-clamp-2">{item.title}</span><ZoomIn className="h-4 w-4 shrink-0" />
            </span>
          </button>
        ))}
      </div>

      {activeItem ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={`${activeItem.title} image preview`} onMouseDown={(event) => { if (event.target === event.currentTarget) setActiveIndex(null); }}>
          <button type="button" onClick={() => setActiveIndex(null)} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close image preview"><X className="h-5 w-5" /></button>
          {items.length > 1 ? <button type="button" onClick={() => move(-1)} className="absolute left-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Previous image"><ChevronLeft className="h-6 w-6" /></button> : null}
          <figure className="max-h-[90vh] max-w-5xl text-center text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeItem.imageUrl} alt={activeItem.caption || activeItem.title} className="max-h-[75vh] max-w-full rounded-lg object-contain" />
            <figcaption className="mx-auto mt-3 max-w-2xl"><div className="font-semibold">{activeItem.title}</div>{activeItem.caption ? <p className="mt-1 text-sm text-white/70">{activeItem.caption}</p> : null}{activeItem.artifactFacts?.length ? <ul className="mt-2 text-left text-sm text-white/80">{activeItem.artifactFacts.map((fact) => <li key={fact}>• {fact}</li>)}</ul> : null}</figcaption>
          </figure>
          {items.length > 1 ? <button type="button" onClick={() => move(1)} className="absolute right-3 rounded-full bg-white/10 p-3 text-white hover:bg-white/20" aria-label="Next image"><ChevronRight className="h-6 w-6" /></button> : null}
        </div>
      ) : null}
    </>
  );
}
