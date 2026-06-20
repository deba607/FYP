"use client";

import Link from 'next/link';
import { Bookmark, BookmarkCheck, ExternalLink, MapPin, Navigation, Sparkles, Star, Ticket } from 'lucide-react';
import type { RecommendedMuseum } from '../../lib/recommendations';

type RecommendationCardProps = {
  museum: RecommendedMuseum;
  onFavorite: (museum: RecommendedMuseum) => void;
  onView: (museum: RecommendedMuseum) => void;
  favoritePending?: boolean;
  compact?: boolean;
  onMoreLike?: (museum: RecommendedMuseum) => void;
};

export default function RecommendationCard({
  museum,
  onFavorite,
  onView,
  favoritePending,
  compact,
  onMoreLike
}: RecommendationCardProps) {
  const museumParam = encodeURIComponent(museum.museum_id || museum.id);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-background/85 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg">
      <button type="button" onClick={() => onView(museum)} className="relative block h-36 w-full overflow-hidden bg-gradient-to-br from-primary/20 via-amber-100/40 to-muted text-left sm:h-40">
        {museum.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={museum.imageUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center"><Sparkles className="h-10 w-10 text-primary/40" /></div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm">
          {museum.confidence}% match
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium shadow-sm">
          Crowd: {museum.crowdLevel}
        </span>
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-1 font-semibold" title={museum.name}>{museum.name}</h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">{museum.location}{museum.state ? `, ${museum.state}` : ''}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={favoritePending}
            onClick={() => onFavorite(museum)}
            aria-label={museum.isFavorite ? `Remove ${museum.name} from favorites` : `Save ${museum.name} to favorites`}
            className="rounded-full border p-2 text-primary transition hover:bg-primary/10 disabled:opacity-50"
          >
            {museum.isFavorite ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-muted px-2 py-1">{museum.category || 'Museum'}</span>
          <span className="rounded-full bg-muted px-2 py-1">INR {museum.price}</span>
          {typeof museum.distanceKm === 'number' ? (
            <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              {museum.distanceKm < 1 ? `${Math.round(museum.distanceKm * 1000)} m away` : `${museum.distanceKm.toFixed(1)} km away`}
            </span>
          ) : null}
          {museum.rating !== null ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <Star className="h-3 w-3 fill-current" /> {museum.rating}
            </span>
          ) : null}
        </div>

        <div className="mt-3 rounded-lg bg-primary/5 p-2.5 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-primary">Why this?</span> {museum.reason}
        </div>

        {!compact && museum.description ? <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{museum.description}</p> : null}

        <div className={`mt-auto grid gap-2 pt-4 ${onMoreLike ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <Link
            href={`/booking/new?museum=${museumParam}` as any}
            onClick={() => onView(museum)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Ticket className="h-3.5 w-3.5" /> Book Ticket
          </Link>
          <Link
            href={`/booking/directions?museum=${museumParam}` as any}
            onClick={() => onView(museum)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition hover:bg-muted"
          >
            <Navigation className="h-3.5 w-3.5" /> Directions
          </Link>
          {onMoreLike ? (
            <button type="button" onClick={() => onMoreLike(museum)} className="inline-flex h-9 items-center justify-center gap-1 rounded-md border px-1 text-[11px] font-medium transition hover:bg-muted">
              <Sparkles className="h-3.5 w-3.5" /> More Like
            </button>
          ) : null}
          {museum.virtualTourUrl ? (
            <a href={museum.virtualTourUrl} target="_blank" rel="noopener noreferrer" onClick={() => onView(museum)} className="col-span-full inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2 text-xs font-medium transition hover:bg-muted">
              <ExternalLink className="h-3.5 w-3.5" /> Virtual Tour
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
