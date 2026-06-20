"use client";

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Compass, ExternalLink, LocateFixed, MapPinned, Navigation, Route } from 'lucide-react';
import {
  buildGoogleMapsDirectionsUrl,
  getMuseumDestination,
  type DirectionMuseum,
  type RouteOrigin,
  type RouteSummary,
  type TravelMode
} from '../../lib/directions';
import { cn } from '../../lib/utils';
import DirectionsSidebar from './DirectionsSidebar';
import TravelModeSelector from './TravelModeSelector';

const EmbeddedMap = dynamic(() => import('./EmbeddedMap'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[360px] items-center justify-center bg-muted text-sm text-muted-foreground lg:min-h-[560px]">
      Loading map module...
    </div>
  )
});

type MuseumDirectionsProps = {
  museum?: DirectionMuseum | null;
  compact?: boolean;
  className?: string;
  expanded?: boolean;
};

const LOCATION_CACHE_KEY = 'bharat-museum-current-location';

function getCachedLocation(): google.maps.LatLngLiteral | null {
  try {
    const cached = sessionStorage.getItem(LOCATION_CACHE_KEY);
    if (!cached) return null;
    const value = JSON.parse(cached) as google.maps.LatLngLiteral;
    return Number.isFinite(value.lat) && Number.isFinite(value.lng) ? value : null;
  } catch {
    return null;
  }
}

function cacheLocation(location: google.maps.LatLngLiteral) {
  try {
    sessionStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(location));
  } catch {
    // Routing still works when storage is blocked; only the session cache is skipped.
  }
}

export default function MuseumDirections({
  museum,
  compact = false,
  className,
  expanded = false
}: MuseumDirectionsProps) {
  const [originInput, setOriginInput] = useState('');
  const [routeOrigin, setRouteOrigin] = useState<RouteOrigin | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('DRIVING');
  const [navigationActive, setNavigationActive] = useState(expanded);
  const [locating, setLocating] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [error, setError] = useState('');
  const originInputRef = useRef<HTMLInputElement>(null);

  const destination = useMemo(() => museum ? getMuseumDestination(museum) : '', [museum]);

  useEffect(() => {
    setRoute(null);
    setError('');
  }, [destination]);

  const locateCurrentUser = useCallback(() => {
    if (!museum) {
      setError('Select a museum first.');
      return;
    }

    const cached = getCachedLocation();
    if (cached) {
      setRouteOrigin(cached);
      setNavigationActive(true);
      setOriginInput('');
      setError('');
      return;
    }

    if (!navigator.geolocation) {
      setError('GPS is unavailable in this browser. Enter a starting location instead.');
      originInputRef.current?.focus();
      return;
    }

    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current = { lat: position.coords.latitude, lng: position.coords.longitude };
        cacheLocation(current);
        setRouteOrigin(current);
        setOriginInput('');
        setNavigationActive(true);
        setLocating(false);
      },
      (locationError) => {
        const message = locationError.code === locationError.PERMISSION_DENIED
          ? 'Location permission was denied. Enter a starting address or landmark instead.'
          : 'Your GPS location is unavailable. Enter a starting address or landmark instead.';
        setError(message);
        setLocating(false);
        originInputRef.current?.focus();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [museum]);

  const navigateHere = () => {
    if (!museum) {
      setError('Select a museum first.');
      return;
    }

    const manualOrigin = originInput.trim();
    if (manualOrigin) {
      setRouteOrigin(manualOrigin);
      setNavigationActive(true);
      setError('');
      return;
    }

    locateCurrentUser();
  };

  const openInGoogleMaps = () => {
    if (!destination) {
      setError('Select a museum first.');
      return;
    }

    const externalOrigin = typeof routeOrigin === 'string'
      ? routeOrigin
      : routeOrigin
        ? `${routeOrigin.lat},${routeOrigin.lng}`
        : originInput.trim() || undefined;
    window.open(
      buildGoogleMapsDirectionsUrl(destination, externalOrigin, travelMode),
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleRouteChange = useCallback((nextRoute: RouteSummary | null) => setRoute(nextRoute), []);
  const handleRouteLoading = useCallback((loading: boolean) => setRouteLoading(loading), []);
  const handleRouteError = useCallback((message: string) => setError(message), []);

  return (
    <section className={cn('overflow-hidden rounded-xl border bg-background text-left shadow-sm', className)}>
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Route className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{compact ? 'Directions' : 'Virtual Guide Navigation'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {museum ? (
                <><span className="font-medium text-foreground">{museum.name}</span>{museum.location ? ` · ${museum.location}` : ''}</>
              ) : 'Choose a museum to start navigation.'}
            </p>
          </div>
        </div>

        {!compact ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Build and follow a route without leaving the website. Google Maps opens only when you request it.
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto]">
          <div className="relative">
            <MapPinned className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={originInputRef}
              value={originInput}
              onChange={(event) => setOriginInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') navigateHere();
              }}
              placeholder="Starting address or landmark"
              aria-label="Starting location"
              className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              onClick={navigateHere}
              disabled={!museum || locating}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Navigation className="h-4 w-4" />
              {locating ? 'Locating...' : 'Navigate Here'}
            </button>
            <button
              type="button"
              onClick={openInGoogleMaps}
              disabled={!museum}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ExternalLink className="h-4 w-4" /> Open in Google Maps
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
          <button
            type="button"
            onClick={locateCurrentUser}
            disabled={!museum || locating}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LocateFixed className="h-4 w-4" /> Use my current location
          </button>
          <TravelModeSelector value={travelMode} onChange={setTravelMode} disabled={!museum || locating} />
        </div>

        {error && !navigationActive ? (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" role="alert">
            <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>

      {navigationActive && routeOrigin && destination ? (
        <div className="grid min-h-[560px] border-t lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
          <EmbeddedMap
            origin={routeOrigin}
            destination={destination}
            travelMode={travelMode}
            onRouteChange={handleRouteChange}
            onLoadingChange={handleRouteLoading}
            onError={handleRouteError}
          />
          <DirectionsSidebar route={route} loading={routeLoading} error={error} />
        </div>
      ) : expanded ? (
        <div className="grid min-h-[420px] place-items-center border-t bg-muted/30 p-8 text-center">
          <div className="max-w-sm">
            <MapPinned className="mx-auto h-10 w-10 text-primary/60" />
            <h3 className="mt-3 font-semibold">Your embedded map will appear here</h3>
            <p className="mt-1 text-sm text-muted-foreground">Enter a starting point or use your current location, then click Navigate Here.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
