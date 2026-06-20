export type DirectionMuseum = {
  museum_id?: string;
  name: string;
  location: string;
  state?: string;
  category?: string;
};

// TRAIN is a UI mode translated to Google TRANSIT with rail preferences.
export type TravelMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT' | 'TRAIN';

export type RouteStep = {
  distance: string;
  duration: string;
  instruction: string;
};

export type RouteSummary = {
  distance: string;
  distanceMeters: number;
  duration: string;
  durationSeconds: number;
  endAddress: string;
  startAddress: string;
  steps: RouteStep[];
};

export type RouteOrigin = string | google.maps.LatLngLiteral;

export function getMuseumDestination(museum: Pick<DirectionMuseum, 'name' | 'location' | 'state'>) {
  return [museum.name, museum.location, museum.state, 'India']
    .filter(Boolean)
    .join(', ');
}

export function buildGoogleMapsDirectionsUrl(
  destination: string,
  origin?: string,
  travelMode: TravelMode = 'DRIVING'
) {
  const params = new URLSearchParams({
    api: '1',
    destination,
    // Google Maps URLs expose train journeys through the broader transit mode.
    travelmode: travelMode === 'TRAIN' ? 'transit' : travelMode.toLowerCase()
  });

  if (origin?.trim()) {
    params.set('origin', origin.trim());
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
