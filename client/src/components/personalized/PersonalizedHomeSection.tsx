"use client";

import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { ArrowRight, RefreshCw, Sparkles, WandSparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPersonalizedRecommendations,
  trackPersonalizationActivity,
  updateMuseumFavorite
} from '../../lib/api';
import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import type { RecommendedMuseum } from '../../lib/recommendations';
import RecommendationCard from './RecommendationCard';

export default function PersonalizedHomeSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState('');
  const [museums, setMuseums] = useState<RecommendedMuseum[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingFavorite, setPendingFavorite] = useState('');

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { rootMargin: '240px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const load = useCallback(async (authToken: string, refresh = false) => {
    setLoading(true);
    setError('');
    try {
      const response = await getPersonalizedRecommendations(authToken, refresh);
      setMuseums(response.sections.recommended.slice(0, 4));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Recommendations are unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!inView) return;
    return onAuthStateChanged(getFirebaseClientAuth(), async (user) => {
      setAuthReady(true);
      if (!user) {
        setToken('');
        setLoading(false);
        return;
      }
      const idToken = await user.getIdToken();
      setToken(idToken);
      await load(idToken);
    });
  }, [inView, load]);

  const handleFavorite = async (museum: RecommendedMuseum) => {
    if (!token) return;
    const id = museum.museum_id || museum.id;
    const favorite = !museum.isFavorite;
    setPendingFavorite(id);
    setMuseums((current) => current.map((item) => (item.museum_id || item.id) === id ? { ...item, isFavorite: favorite } : item));
    try {
      await updateMuseumFavorite(token, id, favorite);
    } catch (favoriteError) {
      setMuseums((current) => current.map((item) => (item.museum_id || item.id) === id ? { ...item, isFavorite: !favorite } : item));
      setError(favoriteError instanceof Error ? favoriteError.message : 'Unable to update favorite.');
    } finally {
      setPendingFavorite('');
    }
  };

  const handleView = (museum: RecommendedMuseum) => {
    if (token) void trackPersonalizationActivity(token, { type: 'viewed', museumId: museum.museum_id || museum.id });
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden border-y py-16 sm:py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(244,63,94,0.15),transparent_38%),radial-gradient(circle_at_85%_70%,rgba(251,191,36,0.12),transparent_35%)]" />
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
              <WandSparkles className="h-3.5 w-3.5" /> Personalized Experience
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Museums selected around you</h2>
            <p className="mt-3 text-muted-foreground">Live recommendations based on your interests, bookings, favorites, budget, location, and museum activity—with a reason for every suggestion.</p>
          </div>
          <Link href="/personalized" className="inline-flex w-fit items-center gap-2 rounded-md border bg-background px-4 py-2.5 text-sm font-semibold transition hover:bg-muted">
            Open full dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {!inView || !authReady || loading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading personalized recommendations">
            {[1, 2, 3, 4].map((item) => <div key={item} className="h-80 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : !token ? (
          <div className="mt-8 grid min-h-64 place-items-center rounded-3xl border bg-background/75 p-8 text-center shadow-sm backdrop-blur">
            <div className="max-w-xl">
              <Sparkles className="mx-auto h-10 w-10 text-primary" />
              <h3 className="mt-4 text-2xl font-bold">Make the homepage yours</h3>
              <p className="mt-2 text-sm text-muted-foreground">Sign in to privately combine your interests, bookings, favorites, and recent exploration into useful museum recommendations.</p>
              <Link href="/login" className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Sign in for recommendations <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        ) : error && museums.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button type="button" onClick={() => load(token, true)} className="mt-4 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"><RefreshCw className="h-4 w-4" /> Try again</button>
          </div>
        ) : museums.length ? (
          <>
            {error ? <p className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {museums.map((museum) => (
                <RecommendationCard key={museum.museum_id || museum.id} museum={museum} compact onFavorite={handleFavorite} onView={handleView} favoritePending={pendingFavorite === (museum.museum_id || museum.id)} />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No live museums are available for recommendations yet.</div>
        )}
      </div>
    </section>
  );
}
