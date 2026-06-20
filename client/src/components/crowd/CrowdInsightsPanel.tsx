"use client";

import { useCallback, useEffect, useState, useMemo } from 'react';
import { Activity, AlertTriangle, Clock3, RefreshCw, Save, Users, Search, ArrowLeft, Clock, DoorOpen, BarChart3 } from 'lucide-react';
import type { CrowdInsight, CrowdLevel } from '../../lib/crowd';
import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import { cn } from '../../lib/utils';

type Props = {
  museumId?: string;
  title?: string;
  description?: string;
  canConfigure?: boolean;
  showDetails?: boolean;
  className?: string;
  limit?: number;
};

const levelStyles: Record<CrowdLevel, string> = {
  Low: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20',
  Moderate: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20',
  High: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20',
  Critical: 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20',
  Unknown: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/10'
};

function guidance(level: CrowdLevel) {
  if (level === 'Critical') return 'Near capacity. Delay non-essential entry and follow staff instructions.';
  if (level === 'High') return 'Busy period. Expect queues and consider visiting later.';
  if (level === 'Moderate') return 'Moderate visitor flow with possible short waits.';
  if (level === 'Low') return 'A comfortable time to visit based on current occupancy.';
  return 'Capacity is not configured; live entry and exit totals are still shown.';
}

export default function CrowdInsightsPanel({ museumId, title = 'Live Crowd Insights', description = 'Real-time visitor flow from verified entry and exit scans.', canConfigure = false, showDetails = false, className, limit }: Props) {
  const [insights, setInsights] = useState<CrowdInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [capacityDraft, setCapacityDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');

  // Detailed view state
  const [selectedMuseumId, setSelectedMuseumId] = useState<string | null>(null);
  const [detailedData, setDetailedData] = useState<any>(null);
  const [detailedLoading, setDetailedLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const load = useCallback(async () => {
    try {
      const query = museumId ? `?museumId=${encodeURIComponent(museumId)}` : '';
      const response = await fetch(`/api/crowd${query}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to load crowd insights');
      const loadedInsights = Array.isArray(payload.insights)
        ? payload.insights
        : payload.detailed?.insight
          ? [payload.detailed.insight]
          : [];
      setInsights(loadedInsights.slice(0, limit || 100));
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load crowd insights');
    } finally {
      setLoading(false);
    }
  }, [limit, museumId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15000);
    const refreshImmediately = () => void load();
    window.addEventListener('crowd-insights-updated', refreshImmediately);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('crowd-insights-updated', refreshImmediately);
    };
  }, [load]);

  // Load detailed analytics
  const loadDetailed = useCallback(async (id: string) => {
    setDetailedLoading(true);
    try {
      const response = await fetch(`/api/crowd?museumId=${encodeURIComponent(id)}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to load detailed crowd insights');
      setDetailedData(payload.detailed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load detailed crowd insights');
    } finally {
      setDetailedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMuseumId) {
      void loadDetailed(selectedMuseumId);
      const timer = setInterval(() => void loadDetailed(selectedMuseumId), 15000);
      return () => clearInterval(timer);
    } else {
      setDetailedData(null);
    }
  }, [selectedMuseumId, loadDetailed]);

  const saveCapacity = async (insight: CrowdInsight) => {
    const capacity = Number(capacityDraft[insight.museumId] || insight.capacity);
    const user = getFirebaseClientAuth().currentUser;
    if (!user) {
      setError('Sign in again to configure museum capacity.');
      return;
    }
    setSavingId(insight.museumId);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/crowd', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ museumId: insight.museumId, capacity })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to update capacity');
      await load();
      if (selectedMuseumId === insight.museumId) {
        await loadDetailed(insight.museumId);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update capacity');
    } finally {
      setSavingId('');
    }
  };

  const filteredInsights = useMemo(() => {
    if (!searchQuery.trim()) return insights;
    return insights.filter((ins) =>
      ins.museumName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [insights, searchQuery]);

  return (
    <section className={cn('rounded-2xl border bg-background/90 p-5 shadow-md backdrop-blur-xl', className)} aria-live="polite">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary animate-pulse" />
            <h2 className="text-lg font-bold">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void load();
            if (selectedMuseumId) void loadDetailed(selectedMuseumId);
          }}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', (loading || detailedLoading) && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Error Alert */}
      {error ? (
        <div className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Interactive Search input */}
      {!museumId && showDetails && (
        <div className="relative mt-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              className="w-full rounded-lg border bg-background pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/45"
              placeholder="Search museums to plan visiting hours & check crowded gates..."
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedMuseumId(null);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground font-medium"
              >
                Clear
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {searchFocused && filteredInsights.length > 0 && (
            <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-background p-1.5 shadow-xl">
              {filteredInsights.map((insight) => (
                <button
                  key={insight.museumId}
                  type="button"
                  onMouseDown={() => {
                    setSelectedMuseumId(insight.museumId);
                    setSearchQuery(insight.museumName);
                  }}
                  className="flex w-full flex-col rounded-md px-3 py-2 text-left text-sm hover:bg-muted transition"
                >
                  <span className="font-semibold">{insight.museumName}</span>
                  <span className="text-xs text-muted-foreground">Crowd Status: {insight.crowdLevel}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detailed Analysis View */}
      {showDetails && selectedMuseumId && detailedData ? (
        <div className="mt-6 space-y-6 rounded-xl border bg-muted/10 p-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedMuseumId(null);
                  setDetailedData(null);
                  setSearchQuery('');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to all museums
              </button>
              <h3 className="text-xl font-bold">{detailedData.insight.museumName}</h3>
            </div>

            {/* Best Time to Visit highlight badge */}
            <div className="flex items-center gap-2.5 rounded-xl border bg-primary/5 p-3 text-primary border-primary/10">
              <Clock className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">Best Time to Visit</div>
                <div className="text-sm font-extrabold">{detailedData.bestTimeToVisit}</div>
              </div>
            </div>
          </div>

          {/* Grid Layout: Live flow & Gate Congestion */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Live flow panel */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Users className="h-4 w-4 text-primary" /> Live Flow & Occupancy
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border bg-background p-4 text-center">
                  <div className="text-xs text-muted-foreground">Currently Inside</div>
                  <div className="mt-1 text-3xl font-black">{detailedData.insight.currentVisitors}</div>
                </div>
                <div className="rounded-xl border bg-background p-4 text-center">
                  <div className="text-xs text-muted-foreground">Crowd Level</div>
                  <div className={cn('mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold', levelStyles[detailedData.insight.crowdLevel as CrowdLevel])}>
                    {detailedData.insight.crowdLevel}
                  </div>
                </div>
              </div>

              {detailedData.insight.capacity ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Occupancy load</span>
                    <span>{detailedData.insight.occupancyPercent}% of {detailedData.insight.capacity} capacity</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        detailedData.insight.crowdLevel === 'Critical' && 'bg-red-500',
                        detailedData.insight.crowdLevel === 'High' && 'bg-orange-500',
                        detailedData.insight.crowdLevel === 'Moderate' && 'bg-amber-500',
                        detailedData.insight.crowdLevel === 'Low' && 'bg-emerald-500'
                      )}
                      style={{ width: `${detailedData.insight.occupancyPercent || 0}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <p className="text-xs leading-5 text-muted-foreground bg-background rounded-lg border p-3 border-dashed">
                {guidance(detailedData.insight.crowdLevel)}
              </p>
            </div>

            {/* Gate flow status panel */}
            <div className="space-y-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <DoorOpen className="h-4 w-4 text-primary" /> Gate Telemetry (Live Scan Flow)
              </h4>
              <div className="space-y-3">
                {detailedData.gateStatus.map((gate: any) => {
                  const gateStyles = {
                    Low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
                    Moderate: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
                    High: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                  }[gate.crowdLevel as 'Low' | 'Moderate' | 'High'] || 'bg-slate-500/10 text-slate-600';

                  return (
                    <div key={gate.gateId} className="flex items-center justify-between border bg-background rounded-xl p-3 shadow-sm hover:border-muted transition">
                      <div>
                        <div className="text-sm font-bold">{gate.gateName}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{gate.recommendation}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{gate.scanCount} scans (last 30m)</span>
                        <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase', gateStyles)}>
                          {gate.crowdLevel === 'High' ? 'Crowded' : gate.crowdLevel === 'Moderate' ? 'Moderate' : 'Quiet'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Hourly Timeline Chart */}
          <div className="space-y-4 border-t pt-4">
            <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <BarChart3 className="h-4 w-4 text-primary" /> Today's Hourly Occupancy Distribution
            </h4>
            <div className="flex h-44 items-end gap-2 pt-6">
              {detailedData.hourlyHistory.map((h: any, idx: number) => {
                const maxPeak = Math.max(...detailedData.hourlyHistory.map((x: any) => x.peakVisitors), 1);
                const heightPercent = Math.min(100, Math.round((h.peakVisitors / maxPeak) * 100));

                let barColor = 'bg-emerald-500/60 dark:bg-emerald-500/40 hover:bg-emerald-500';
                if (h.peakVisitors > maxPeak * 0.75) {
                  barColor = 'bg-red-500/60 dark:bg-red-500/40 hover:bg-red-500';
                } else if (h.peakVisitors > maxPeak * 0.4) {
                  barColor = 'bg-amber-500/60 dark:bg-amber-500/40 hover:bg-amber-500';
                }

                return (
                  <div key={idx} className="group relative flex flex-1 flex-col items-center">
                    <div className="pointer-events-none absolute bottom-full mb-2.5 hidden rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] text-white group-hover:block z-25 text-center shadow-xl font-medium">
                      <div>Peak: {h.peakVisitors} visitors</div>
                      <div className="text-slate-400 text-[9px] mt-0.5">{h.entries} entries / {h.exits} exits</div>
                    </div>
                    <div className={cn('w-full rounded-t-md transition-all duration-300', barColor)} style={{ height: `${Math.max(8, heightPercent)}%` }} />
                    <span className="text-[10px] text-muted-foreground mt-2 font-mono">{h.hour}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Main Grid View */}
      {(!selectedMuseumId || !detailedData) && (
        <>
          {loading && insights.length === 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-48 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : filteredInsights.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No matching museums are active for crowd monitoring.
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredInsights.map((insight) => (
                <article
                  key={insight.museumId}
                  onClick={() => {
                    if (showDetails) {
                      setSelectedMuseumId(insight.museumId);
                    }
                  }}
                  className={cn(
                    "rounded-xl border bg-muted/20 p-4 transition-all",
                    showDetails
                      ? "group hover:-translate-y-0.5 hover:shadow-md hover:border-muted cursor-pointer"
                      : "cursor-default"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className={cn(
                        "truncate font-semibold transition",
                        showDetails && "group-hover:text-primary"
                      )} title={insight.museumName}>
                        {insight.museumName}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {insight.status === 'live' ? 'Gate telemetry active' : 'Waiting for first gate scan'}
                      </p>
                    </div>
                    <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', levelStyles[insight.crowdLevel])}>
                      {insight.crowdLevel}
                    </span>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> Inside now
                      </div>
                      <div className="mt-1 text-3xl font-black">{insight.currentVisitors}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{insight.entriesToday} entered today</div>
                      <div>{insight.exitsToday} exited today</div>
                      <div>Peak {insight.peakVisitorsToday}</div>
                    </div>
                  </div>

                  {insight.capacity ? (
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-xs">
                        <span>Occupancy</span>
                        <span>{insight.occupancyPercent}% of {insight.capacity}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            insight.crowdLevel === 'Critical' ? 'bg-red-500' : insight.crowdLevel === 'High' ? 'bg-orange-500' : insight.crowdLevel === 'Moderate' ? 'bg-amber-500' : 'bg-emerald-500'
                          )}
                          style={{ width: `${insight.occupancyPercent || 0}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <p className="mt-3 text-xs leading-5 text-muted-foreground line-clamp-1">{guidance(insight.crowdLevel)}</p>
                  {insight.updatedAt ? (
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock3 className="h-3 w-3" /> Updated {new Date(insight.updatedAt).toLocaleTimeString()}
                    </p>
                  ) : null}

                  {canConfigure ? (
                    <div className="mt-4 flex gap-2 border-t pt-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min="1"
                        max="1000000"
                        value={capacityDraft[insight.museumId] ?? insight.capacity ?? ''}
                        onChange={(event) => setCapacityDraft((current) => ({ ...current, [insight.museumId]: event.target.value }))}
                        placeholder="Set capacity"
                        className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={savingId === insight.museumId}
                        onClick={() => void saveCapacity(insight)}
                        className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
                      >
                        <Save className="h-3.5 w-3.5" /> Save
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
