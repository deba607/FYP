import type { ClientMuseum } from './clientMuseums';

export type Coordinates = {
  lat: number;
  lng: number;
};

export type NearbyMuseum = ClientMuseum & {
  distanceKm: number;
  distanceAccuracy: 'exact' | 'approximate';
};

const GEOCODE_CACHE_KEY = 'bharat-museum-geocode-cache-v1';

type CachedCoordinates = Coordinates & {
  accuracy?: NearbyMuseum['distanceAccuracy'];
};

function toRadians(value: number) {
  return value * (Math.PI / 180);
}

export function calculateDistanceKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(to.lat - from.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const startLatitude = toRadians(from.lat);
  const endLatitude = toRadians(to.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function readGeocodeCache() {
  if (typeof window === 'undefined') return {} as Record<string, CachedCoordinates>;

  try {
    return JSON.parse(window.sessionStorage.getItem(GEOCODE_CACHE_KEY) || '{}') as Record<string, CachedCoordinates>;
  } catch {
    return {} as Record<string, CachedCoordinates>;
  }
}

function writeGeocodeCache(cache: Record<string, CachedCoordinates>) {
  try {
    window.sessionStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Recommendations still work if private browsing prevents session storage.
  }
}

function museumCoordinates(museum: ClientMuseum): Coordinates | null {
  if (Number.isFinite(museum.latitude) && Number.isFinite(museum.longitude)) {
    return { lat: Number(museum.latitude), lng: Number(museum.longitude) };
  }
  return null;
}

async function geocodeWithOpenStreetMap(address: string) {
  const url = new URL('/api/geocode', window.location.origin);
  url.searchParams.set('q', address);

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return null;

  const result = await response.json() as { coordinates?: { lat?: number; lng?: number } | null };
  const lat = Number(result.coordinates?.lat);
  const lng = Number(result.coordinates?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

async function resolveMuseumCoordinates(museum: ClientMuseum) {
  const exactAddress = [museum.name, museum.location, museum.state, 'India'].filter(Boolean).join(', ');
  const areaAddress = [museum.location, museum.state, 'India'].filter(Boolean).join(', ');
  const exact = await geocodeWithOpenStreetMap(exactAddress);
  await wait(1100);
  if (exact) return { ...exact, accuracy: 'exact' as const };

  // Custom/demo museum names are often absent from map indexes. City/state still
  // provides a useful approximate distance instead of dropping the museum.
  if (areaAddress !== exactAddress) {
    const area = await geocodeWithOpenStreetMap(areaAddress);
    await wait(1100);
    if (area) return { ...area, accuracy: 'approximate' as const };
  }

  return null;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function getCurrentCoordinates() {
  return new Promise<Coordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      }),
      (error) => reject(new Error(
        error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. Allow location access and try “museums near me” again.'
          : 'Your current location could not be detected. Check GPS and try again.'
      )),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
    );
  });
}

export async function findNearbyMuseums(origin: Coordinates, museums: ClientMuseum[], limit = 4) {
  const cache = readGeocodeCache();

  const located: Array<NearbyMuseum | null> = [];
  for (const museum of museums) {
    const address = [museum.name, museum.location, museum.state, 'India'].filter(Boolean).join(', ');
    const cacheKey = address.toLowerCase();
    const storedCoordinates = museumCoordinates(museum);
    let coordinates: CachedCoordinates | null = storedCoordinates
      ? { ...storedCoordinates, accuracy: 'exact' }
      : cache[cacheKey] || null;

    if (!coordinates) {
      try {
        coordinates = await resolveMuseumCoordinates(museum);
      } catch {
        coordinates = null;
      }
    }

    if (!coordinates) {
      located.push(null);
      continue;
    }
    cache[cacheKey] = coordinates;
    located.push({
      ...museum,
      distanceKm: calculateDistanceKm(origin, coordinates),
      distanceAccuracy: coordinates.accuracy || 'approximate'
    });
  }

  writeGeocodeCache(cache);
  return located
    .filter((museum): museum is NearbyMuseum => Boolean(museum))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
