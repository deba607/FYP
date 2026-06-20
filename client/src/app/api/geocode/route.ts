import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() || '';
  if (!query || query.length > 300) {
    return NextResponse.json({ coordinates: null, error: 'A valid address is required.' }, { status: 400 });
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'in');
  url.searchParams.set('q', query);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'BharatMuseumTickets/1.0 (museum location search)'
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      return NextResponse.json({ coordinates: null }, { status: 502 });
    }

    const results = await response.json() as Array<{ lat?: string; lon?: string }>;
    const lat = Number(results[0]?.lat);
    const lng = Number(results[0]?.lon);
    const coordinates = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    return NextResponse.json({ coordinates });
  } catch {
    return NextResponse.json({ coordinates: null }, { status: 502 });
  }
}
