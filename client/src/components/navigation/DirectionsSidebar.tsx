"use client";

import { AlertTriangle, LoaderCircle, MapPin, Navigation } from 'lucide-react';
import type { RouteSummary } from '../../lib/directions';
import RoutePanel from './RoutePanel';

type DirectionsSidebarProps = {
  route: RouteSummary | null;
  loading: boolean;
  error: string;
};

export default function DirectionsSidebar({ route, loading, error }: DirectionsSidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col border-t bg-background lg:border-l lg:border-t-0" aria-live="polite">
      <div className="border-b p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Calculating the best route...
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : route ? (
          <RoutePanel route={route} />
        ) : (
          <div className="text-sm text-muted-foreground">Choose a starting point and click Navigate Here to build a route.</div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Navigation className="h-4 w-4 text-primary" /> Turn-by-turn directions
        </h3>
        {route?.steps.length ? (
          <ol className="mt-3 space-y-1">
            {route.steps.map((step, index) => (
              <li key={`${index}-${step.instruction}`} className="flex gap-3 rounded-md p-2.5 hover:bg-muted/60">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm leading-5">{step.instruction}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.distance} · {step.duration}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : !loading && !error ? (
          <div className="mt-6 flex flex-col items-center text-center text-sm text-muted-foreground">
            <MapPin className="mb-2 h-8 w-8 opacity-40" />
            Directions will appear here.
          </div>
        ) : null}
      </div>
    </aside>
  );
}
