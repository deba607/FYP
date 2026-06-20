"use client";

import type { ReactNode } from 'react';
import type { RecommendedMuseum } from '../../lib/recommendations';
import RecommendationCard from './RecommendationCard';

type RecommendationSectionProps = {
  title: string;
  description: string;
  icon: ReactNode;
  museums: RecommendedMuseum[];
  emptyMessage: string;
  onFavorite: (museum: RecommendedMuseum) => void;
  onView: (museum: RecommendedMuseum) => void;
  favoritePendingId?: string;
  emptyAction?: ReactNode;
};

export default function RecommendationSection({
  title,
  description,
  icon,
  museums,
  emptyMessage,
  onFavorite,
  onView,
  favoritePendingId,
  emptyAction
}: RecommendationSectionProps) {
  return (
    <section className="scroll-mt-24">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {museums.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {museums.map((museum) => (
            <RecommendationCard
              key={museum.museum_id || museum.id}
              museum={museum}
              onFavorite={onFavorite}
              onView={onView}
              favoritePending={favoritePendingId === (museum.museum_id || museum.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
          <p>{emptyMessage}</p>
          {emptyAction ? <div className="mt-4 flex justify-center">{emptyAction}</div> : null}
        </div>
      )}
    </section>
  );
}
