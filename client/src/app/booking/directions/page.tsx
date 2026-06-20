"use client";

import { useEffect, useMemo, useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import MuseumDirections from '../../../components/navigation/MuseumDirections';
import type { DirectionMuseum } from '../../../lib/directions';
import { getMuseumsForClient } from '../../../lib/clientMuseums';

export default function MuseumDirectionsPage() {
  const [museums, setMuseums] = useState<DirectionMuseum[]>([]);
  const [selectedMuseumId, setSelectedMuseumId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    getMuseumsForClient()
      .then(({ museums: list, source }) => {
        if (!mounted) return;
        setMuseums(list);
        const requestedMuseum = new URLSearchParams(window.location.search).get('museum');
        setSelectedMuseumId(
          list.find((museum) => museum.museum_id === requestedMuseum)?.museum_id || list[0]?.museum_id || ''
        );
        setLoadMessage(
          source === 'firestore'
            ? ''
            : 'Unable to load the live Firestore museum catalog.'
        );
      })
      .catch(() => {
        if (mounted) setLoadMessage('Unable to load museums right now.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedMuseum = useMemo(() => {
    return museums.find((museum) => museum.museum_id === selectedMuseumId) || museums[0] || null;
  }, [museums, selectedMuseumId]);

  const filteredMuseums = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return museums;

    return museums.filter((museum) =>
      [museum.name, museum.location, museum.state, museum.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized))
    );
  }, [museums, query]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Virtual Guide to the Museum</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Get step-by-step directions from your current location or a typed starting point to the museum.
        </p>
      </div>

      <div className="space-y-6">
        <section className="rounded-xl border bg-background p-4 shadow-sm">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search museums by name or location"
              className="h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>

          {loading ? (
            <div className="rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">Loading museums...</div>
          ) : filteredMuseums.length > 0 ? (
            <div className="grid max-h-72 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {loadMessage ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {loadMessage}
                </div>
              ) : null}
              {filteredMuseums.map((museum) => (
                <button
                  key={museum.museum_id || museum.name}
                  type="button"
                  onClick={() => setSelectedMuseumId(museum.museum_id || '')}
                  className={`rounded-lg border p-4 text-left transition hover:bg-muted ${
                    selectedMuseum?.museum_id === museum.museum_id ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="font-semibold">{museum.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {museum.location || 'Location unavailable'}
                  </div>
                  {museum.category ? (
                    <div className="mt-1 text-xs text-muted-foreground">{museum.category}</div>
                  ) : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
              {museums.length === 0
                ? loadMessage || 'No museums are available in the Firestore database.'
                : 'No museums match your search.'}
            </div>
          )}
        </section>

        <MuseumDirections museum={selectedMuseum} expanded />
      </div>
    </main>
  );
}
