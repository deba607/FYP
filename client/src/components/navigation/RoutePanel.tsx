"use client";

import { Clock3, Flag, Route, Signpost } from 'lucide-react';
import type { RouteSummary } from '../../lib/directions';

type RoutePanelProps = {
  route: RouteSummary;
};

export default function RoutePanel({ route }: RoutePanelProps) {
  const eta = new Date(Date.now() + route.durationSeconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  const items = [
    { label: 'Distance', value: route.distance, icon: Route },
    { label: 'Duration', value: route.duration, icon: Clock3 },
    { label: 'ETA', value: eta, icon: Flag },
    { label: 'Turns', value: String(route.steps.length), icon: Signpost }
  ];

  return (
    <section aria-label="Route summary">
      <h3 className="text-sm font-semibold">Route summary</h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {items.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-md border bg-muted/40 p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <div className="mt-1 truncate text-sm font-semibold" title={value}>{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
