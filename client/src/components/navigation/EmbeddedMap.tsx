"use client";

import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MapPinned } from 'lucide-react';
import type { RouteOrigin, RouteSummary, TravelMode } from '../../lib/directions';
import { loadGoogleMaps } from '../../lib/googleMaps';

type EmbeddedMapProps = {
  origin: RouteOrigin;
  destination: string;
  travelMode: TravelMode;
  onRouteChange: (route: RouteSummary | null) => void;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string) => void;
};

const routeRequests = new Map<string, Promise<google.maps.DirectionsResult>>();

function originKey(origin: RouteOrigin) {
  return typeof origin === 'string' ? origin.trim().toLowerCase() : `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`;
}

function directionsError(status: string) {
  switch (status) {
    case 'ZERO_RESULTS':
      return 'No route was found for this travel mode. Try another mode or starting point.';
    case 'NOT_FOUND':
      return 'The starting point or museum location could not be found.';
    case 'OVER_QUERY_LIMIT':
      return 'The map request limit has been reached. Please try again shortly.';
    case 'REQUEST_DENIED':
      return 'The route request was denied. Check the Maps API key and enabled APIs.';
    case 'INVALID_REQUEST':
      return 'The route request is incomplete. Check the starting location.';
    default:
      return 'Google Maps could not calculate this route. Please try again.';
  }
}

function requestDirections(
  maps: typeof google,
  origin: RouteOrigin,
  destination: string,
  travelMode: TravelMode
) {
  const key = `${originKey(origin)}|${destination.trim().toLowerCase()}|${travelMode}`;
  const cached = routeRequests.get(key);
  if (cached) return cached;

  const request = new Promise<google.maps.DirectionsResult>((resolve, reject) => {
    const service = new maps.maps.DirectionsService();
    service.route(
      {
        origin,
        destination,
        travelMode: travelMode === 'TRAIN'
          ? maps.maps.TravelMode.TRANSIT
          : maps.maps.TravelMode[travelMode],
        // DirectionsService has no top-level TRAIN mode. These preferences
        // request train/rail results while retaining Google's transit fallback.
        transitOptions: travelMode === 'TRAIN'
          ? { modes: ['TRAIN', 'RAIL'] }
          : undefined,
        provideRouteAlternatives: false
      },
      (result, status) => {
        if (status === maps.maps.DirectionsStatus.OK && result) resolve(result);
        else reject(new Error(directionsError(status)));
      }
    );
  });

  routeRequests.set(key, request);
  request.catch(() => routeRequests.delete(key));

  // Keep the small in-memory cache bounded during long sessions.
  if (routeRequests.size > 20) routeRequests.delete(routeRequests.keys().next().value!);
  return request;
}

function plainText(html: string) {
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  return documentNode.body.textContent?.trim() || html;
}

function summarizeRoute(result: google.maps.DirectionsResult): RouteSummary {
  const leg = result.routes[0].legs[0];
  return {
    distance: leg.distance?.text || 'Unavailable',
    distanceMeters: leg.distance?.value || 0,
    duration: leg.duration?.text || 'Unavailable',
    durationSeconds: leg.duration?.value || 0,
    startAddress: leg.start_address,
    endAddress: leg.end_address,
    steps: leg.steps.map((step) => ({
      distance: step.distance?.text || '',
      duration: step.duration?.text || '',
      instruction: plainText(step.instructions)
    }))
  };
}

export default function EmbeddedMap({
  origin,
  destination,
  travelMode,
  onRouteChange,
  onLoadingChange,
  onError
}: EmbeddedMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const callbacksRef = useRef({ onRouteChange, onLoadingChange, onError });
  const [mapLoading, setMapLoading] = useState(true);

  useEffect(() => {
    callbacksRef.current = { onRouteChange, onLoadingChange, onError };
  }, [onRouteChange, onLoadingChange, onError]);

  useEffect(() => {
    let cancelled = false;
    callbacksRef.current.onLoadingChange(true);
    callbacksRef.current.onError('');

    loadGoogleMaps()
      .then(async (maps) => {
        if (cancelled || !containerRef.current) return;

        if (!rendererRef.current) {
          const map = new maps.maps.Map(containerRef.current, {
            center: { lat: 22.9734, lng: 78.6569 },
            zoom: 5,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: false
          });
          rendererRef.current = new maps.maps.DirectionsRenderer({
            map,
            suppressMarkers: false,
            polylineOptions: {
              strokeColor: '#e11d48',
              strokeOpacity: 0.9,
              strokeWeight: 6
            }
          });
          setMapLoading(false);
        }

        const result = await requestDirections(maps, origin, destination, travelMode);
        if (cancelled) return;
        rendererRef.current?.setDirections(result);
        callbacksRef.current.onRouteChange(summarizeRoute(result));
        callbacksRef.current.onLoadingChange(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMapLoading(false);
        callbacksRef.current.onRouteChange(null);
        callbacksRef.current.onLoadingChange(false);
        callbacksRef.current.onError(error instanceof Error ? error.message : 'Unable to load the route.');
      });

    return () => {
      cancelled = true;
    };
  }, [destination, origin, travelMode]);

  return (
    <div className="relative h-full min-h-[360px] w-full overflow-hidden bg-muted lg:min-h-[560px]">
      <div ref={containerRef} className="absolute inset-0" aria-label="Interactive route map" />
      {mapLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted text-sm text-muted-foreground">
          <LoaderCircle className="mb-2 h-7 w-7 animate-spin text-primary" />
          Loading interactive map...
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
        <MapPinned className="h-3 w-3" /> Start and destination markers follow the selected route
      </div>
    </div>
  );
}
