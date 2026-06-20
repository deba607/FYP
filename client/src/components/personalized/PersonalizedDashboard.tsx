"use client";

import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  Compass,
  LocateFixed,
  MapPinned,
  RefreshCw,
  Settings2,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
  WandSparkles
} from 'lucide-react';
import {
  getPersonalizedRecommendations,
  savePersonalizationPreferences,
  trackPersonalizationActivity,
  updateMuseumFavorite
} from '../../lib/api';
import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import type { PersonalizationPreferences, PersonalizedRecommendations, RecommendedMuseum } from '../../lib/recommendations';
import PreferencePanel from './PreferencePanel';
import RecommendationSection from './RecommendationSection';
import { loadGoogleMaps } from '../../lib/googleMaps';

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-8 px-4 py-10">
      <div className="h-52 rounded-3xl bg-muted" />
      {[1, 2].map((section) => <div key={section}><div className="mb-4 h-8 w-64 rounded bg-muted" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((card) => <div key={card} className="h-80 rounded-2xl bg-muted" />)}</div></div>)}
    </div>
  );
}

export default function PersonalizedDashboard() {
  const [data, setData] = useState<PersonalizedRecommendations | null>(null);
  const [authToken, setAuthToken] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [favoritePendingId, setFavoritePendingId] = useState('');
  const [locating, setLocating] = useState(false);

  const loadRecommendations = useCallback(async (token: string, refresh = false) => {
    if (!token) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      setData(await getPersonalizedRecommendations(token, refresh));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load recommendations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const auth = getFirebaseClientAuth();
    return onAuthStateChanged(auth, async (user) => {
      setAuthReady(true);
      if (!user) {
        setAuthToken('');
        setLoading(false);
        return;
      }
      const token = await user.getIdToken();
      setAuthToken(token);
      await loadRecommendations(token);
    });
  }, [loadRecommendations]);

  const categories = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.sections.recommended.map((museum) => museum.category).filter(Boolean))).sort();
  }, [data]);

  const updateMuseumAcrossSections = (museumId: string, isFavorite: boolean) => {
    setData((current) => {
      if (!current) return current;
      const update = (museums: RecommendedMuseum[]) => museums.map((museum) =>
        (museum.museum_id || museum.id) === museumId ? { ...museum, isFavorite } : museum
      );
      return {
        ...current,
        sections: {
          ...current.sections,
          recommended: update(current.sections.recommended),
          nearby: update(current.sections.nearby),
          trending: update(current.sections.trending),
          lessCrowded: update(current.sections.lessCrowded),
          recentlyViewed: update(current.sections.recentlyViewed),
          continueExploring: update(current.sections.continueExploring)
        }
      };
    });
  };

  const handleFavorite = async (museum: RecommendedMuseum) => {
    if (!authToken) return;
    const museumId = museum.museum_id || museum.id;
    const next = !museum.isFavorite;
    setFavoritePendingId(museumId);
    updateMuseumAcrossSections(museumId, next);
    try {
      await updateMuseumFavorite(authToken, museumId, next);
    } catch (favoriteError) {
      updateMuseumAcrossSections(museumId, !next);
      setError(favoriteError instanceof Error ? favoriteError.message : 'Unable to update favorite.');
    } finally {
      setFavoritePendingId('');
    }
  };

  const handleView = (museum: RecommendedMuseum) => {
    if (!authToken) return;
    void trackPersonalizationActivity(authToken, { type: 'viewed', museumId: museum.museum_id || museum.id });
  };

  const handleSavePreferences = async (preferences: PersonalizationPreferences) => {
    if (!authToken) return;
    setSavingPreferences(true);
    setError('');
    try {
      await savePersonalizationPreferences(authToken, preferences);
      setPreferencesOpen(false);
      await loadRecommendations(authToken, true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save preferences.');
    } finally {
      setSavingPreferences(false);
    }
  };

  const detectCurrentArea = async () => {
    if (!authToken || !data) return;
    const currentPreferences = data.preferences;
    if (!navigator.geolocation) {
      setError('Location is unavailable in this browser. Add your city or state in Preferences instead.');
      return;
    }

    setLocating(true);
    setError('');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });
      let city = '';
      let state = '';
      try {
        const maps = await loadGoogleMaps();
        const response = await new maps.maps.Geocoder().geocode({
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        });
        const components = response.results[0]?.address_components || [];
        const findComponent = (...types: string[]) => components.find((component) =>
          types.some((type) => component.types.includes(type))
        )?.long_name || '';
        city = findComponent('locality', 'postal_town', 'administrative_area_level_2');
        state = findComponent('administrative_area_level_1');
      } catch (geocoderError) {
        console.warn('Google Maps Geocoding failed, trying OpenStreetMap reverse geocoding fallback...', geocoderError);
        const fallbackRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        ).then((res) => res.json()).catch(() => null);

        if (fallbackRes && fallbackRes.address) {
          city = fallbackRes.address.city || fallbackRes.address.town || fallbackRes.address.village || fallbackRes.address.suburb || fallbackRes.address.county || '';
          state = fallbackRes.address.state || '';
        }
      }

      if (!city && !state) throw new Error('Could not identify a city or state for this location. Please enter it manually in Preferences.');

      await savePersonalizationPreferences(authToken, {
        ...currentPreferences,
        preferredCity: city,
        preferredState: state
      });
      await loadRecommendations(authToken, true);
    } catch (locationError) {
      const permissionDenied = Boolean(
        locationError && typeof locationError === 'object' && 'code' in locationError &&
        Number((locationError as { code?: number }).code) === 1
      );
      setError(permissionDenied
        ? 'Location permission was denied. Add your city or state in Preferences instead.'
        : locationError instanceof Error ? locationError.message : 'Unable to detect your current area.');
    } finally {
      setLocating(false);
    }
  };

  if (!authReady || loading) return <DashboardSkeleton />;

  if (!authToken) {
    return (
      <main className="mx-auto grid min-h-[65vh] max-w-3xl place-items-center px-4 py-12 text-center">
        <div className="rounded-3xl border bg-background/80 p-8 shadow-xl backdrop-blur sm:p-12">
          <Sparkles className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-5 text-3xl font-bold">Your museum journey, personalized</h1>
          <p className="mt-3 text-muted-foreground">Sign in to receive private recommendations based on your interests, bookings, favorites, and recent exploration.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground">Sign in to continue</Link>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-4 text-center">
        <div><h1 className="text-2xl font-bold">Recommendations are temporarily unavailable</h1><p className="mt-2 text-muted-foreground">{error}</p><button onClick={() => loadRecommendations(authToken, true)} className="mt-5 rounded-md bg-primary px-4 py-2 text-primary-foreground">Try again</button></div>
      </main>
    );
  }

  const sections = data.sections;
  const virtualTourMuseum = sections.recommended.find((museum) => museum.virtualTourUrl);

  return (
    <main className="relative overflow-hidden pb-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_top_left,rgba(244,63,94,0.18),transparent_45%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.15),transparent_38%)]" />
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-8 sm:py-12">
        <section className="overflow-hidden rounded-3xl border bg-background/75 p-6 shadow-xl backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold text-primary"><WandSparkles className="h-3.5 w-3.5" /> Personalized Experience</div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Welcome back, {data.user.name}</h1>
              <p className="mt-3 max-w-2xl text-muted-foreground">Recommendations generated from your private preferences and live Firestore museum data. Every card explains why it was selected.</p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border bg-background px-3 py-1.5">Profile {data.profileCompleteness}% complete</span>
                {data.user.preferredArea ? <span className="rounded-full border bg-background px-3 py-1.5">Preferred area: {data.user.preferredArea}</span> : null}
                <span className="rounded-full border bg-background px-3 py-1.5">Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPreferencesOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted"><Settings2 className="h-4 w-4" /> Preferences</button>
              <button type="button" disabled={refreshing} onClick={() => loadRecommendations(authToken, true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border bg-background/70 p-4"><Clock3 className="h-5 w-5 text-primary" /><div className="mt-3 text-xs text-muted-foreground">Suggested visit time</div><div className="mt-1 font-semibold">{data.suggestedVisitTime}</div></div>
            <div className="rounded-2xl border bg-background/70 p-4"><MapPinned className="h-5 w-5 text-primary" /><div className="mt-3 text-xs text-muted-foreground">Nearby matches</div><div className="mt-1 font-semibold">{sections.nearby.length} museums</div></div>
            <div className="rounded-2xl border bg-background/70 p-4"><CalendarDays className="h-5 w-5 text-primary" /><div className="mt-3 text-xs text-muted-foreground">Current highlights</div><div className="mt-1 font-semibold">{sections.exhibitions.length + sections.events.length} exhibitions & events</div></div>
            <div className="rounded-2xl border bg-background/70 p-4"><Compass className="h-5 w-5 text-primary" /><div className="mt-3 text-xs text-muted-foreground">Travel preference</div><div className="mt-1 font-semibold">{data.preferences.travelMode.replace('_', ' ')}</div></div>
          </div>
        </section>

        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div> : null}

        <RecommendationSection title="Recommended for You" description="Your strongest matches across interests, history, location, budget, and live museum signals." icon={<Sparkles className="h-5 w-5" />} museums={sections.recommended} emptyMessage="Add preferences to begin shaping your recommendations." onFavorite={handleFavorite} onView={handleView} favoritePendingId={favoritePendingId} />
        <RecommendationSection title="Continue Exploring" description="Fresh places connected to your bookings, interests, favorites, and recent exploration." icon={<Compass className="h-5 w-5" />} museums={sections.continueExploring} emptyMessage="Add more museums to the live catalog to unlock additional places to explore." onFavorite={handleFavorite} onView={handleView} favoritePendingId={favoritePendingId} />
        <RecommendationSection title="Nearby Museums" description={data.user.preferredArea ? `Museums matching ${data.user.preferredArea}.` : 'Museums matching your preferred or saved area.'} icon={<MapPinned className="h-5 w-5" />} museums={sections.nearby} emptyMessage="Use your current area or add a city/state to find matching museums." emptyAction={<div className="flex flex-wrap justify-center gap-2"><button type="button" disabled={locating} onClick={() => void detectCurrentArea()} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"><LocateFixed className="h-4 w-4" />{locating ? 'Detecting area...' : 'Use current location'}</button><button type="button" onClick={() => setPreferencesOpen(true)} className="rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">Enter city or state</button></div>} onFavorite={handleFavorite} onView={handleView} favoritePendingId={favoritePendingId} />
        <RecommendationSection title="Trending Museums" description="Ranked from real visits, bookings, and rating activity." icon={<TrendingUp className="h-5 w-5" />} museums={sections.trending} emptyMessage="Trending data will appear after visitor activity is recorded." onFavorite={handleFavorite} onView={handleView} favoritePendingId={favoritePendingId} />
        <RecommendationSection title="Less Crowded" description="Museums currently reporting lower occupancy." icon={<Users className="h-5 w-5" />} museums={sections.lessCrowded} emptyMessage="No live low-crowd signals are available right now." onFavorite={handleFavorite} onView={handleView} favoritePendingId={favoritePendingId} />
        <RecommendationSection title="Recently Viewed" description="Quickly return to museums you explored recently." icon={<Clock3 className="h-5 w-5" />} museums={sections.recentlyViewed} emptyMessage="Open a recommendation and it will appear here on your next refresh." onFavorite={handleFavorite} onView={handleView} favoritePendingId={favoritePendingId} />

        <section>
          <div className="mb-4"><h2 className="text-2xl font-bold">Recommended Exhibitions</h2><p className="mt-1 text-sm text-muted-foreground">Live Firestore exhibition highlights, prioritized by your interests.</p></div>
          {sections.exhibitions.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sections.exhibitions.map((item) => <article key={item.id} className="flex flex-col rounded-2xl border bg-background p-5 shadow-sm"><div className="text-xs font-semibold text-primary">{item.category || 'Exhibition'}</div><h3 className="mt-2 text-lg font-bold">{item.name}</h3>{item.museumName ? <p className="mt-1 text-sm text-muted-foreground">{item.museumName}</p> : null}<p className="mt-3 text-sm">{item.reason}</p>{item.description ? <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.description}</p> : null}{item.museumId ? <Link href={`/booking/new?museum=${encodeURIComponent(item.museumId)}`} className="mt-auto pt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Book Tickets for this Museum →</Link> : null}</article>)}</div> : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No active exhibitions have been published yet.</div>}
        </section>

        <section>
          <div className="mb-4"><h2 className="text-2xl font-bold">Upcoming Events</h2><p className="mt-1 text-sm text-muted-foreground">Plan around current museum programs and seasonal events.</p></div>
          {sections.events.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sections.events.map((item) => <article key={item.id} className="flex flex-col rounded-2xl border bg-background p-5 shadow-sm"><CalendarDays className="h-5 w-5 text-primary" /><h3 className="mt-3 text-lg font-bold">{item.name}</h3>{item.museumName ? <p className="mt-1 text-sm text-muted-foreground">{item.museumName}</p> : null}{item.date ? <p className="mt-3 text-sm font-medium">{new Date(item.date).toLocaleDateString()}</p> : null}{item.description ? <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.description}</p> : null}{item.museumId ? <Link href={`/booking/new?museum=${encodeURIComponent(item.museumId)}`} className="mt-auto pt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Book Tickets for this Museum →</Link> : null}</article>)}</div> : <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No upcoming events have been published yet.</div>}
        </section>

        <section className="rounded-2xl border bg-muted/20 p-5">
          <h2 className="font-bold">Quick Actions</h2>
          <div className="mt-3 flex flex-wrap gap-2"><Link href="/booking/new" className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Ticket className="h-4 w-4" /> Book Ticket</Link><Link href="/booking/directions" className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium"><MapPinned className="h-4 w-4" /> Directions</Link>{virtualTourMuseum?.virtualTourUrl ? <a href={virtualTourMuseum.virtualTourUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium"><Compass className="h-4 w-4" /> Virtual Tour</a> : <button type="button" disabled title="Add virtualTourUrl to a museum document to enable this action" className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium opacity-50"><Compass className="h-4 w-4" /> Virtual Tour unavailable</button>}<Link href="/booking/chat" className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium"><Sparkles className="h-4 w-4" /> Ask the chatbot</Link></div>
        </section>
      </div>

      <PreferencePanel open={preferencesOpen} preferences={data.preferences} categories={categories} saving={savingPreferences} onClose={() => setPreferencesOpen(false)} onSave={handleSavePreferences} />
    </main>
  );
}
