import type { MuseumCatalogItem } from './museumCatalog';

export type ClientMuseum = MuseumCatalogItem;

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  mapValue?: {
    fields?: Record<string, FirestoreValue>;
  };
};

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
};

function getString(fields: Record<string, FirestoreValue>, key: string) {
  return String(fields[key]?.stringValue || '').trim();
}

function getNumber(fields: Record<string, FirestoreValue>, key: string, fallback = 0) {
  const value = fields[key];
  if (!value) return fallback;
  if (typeof value.doubleValue === 'number') return value.doubleValue;
  if (value.integerValue) return Number(value.integerValue);
  return fallback;
}

function getMapNumber(fields: Record<string, FirestoreValue>, mapKey: string, valueKey: string, fallback: number) {
  const nested = fields[mapKey]?.mapValue?.fields || {};
  return getNumber(nested, valueKey, fallback);
}

function getTimestamp(fields: Record<string, FirestoreValue>, key: string) {
  return fields[key]?.timestampValue || new Date().toISOString();
}

function getDocId(path: string) {
  return path.split('/').pop() || '';
}

function normalizeMuseum(doc: FirestoreDocument): ClientMuseum | null {
  const fields = doc.fields || {};
  const docId = getDocId(doc.name);
  const name = getString(fields, 'name');
  if (!name) return null;

  const price = getNumber(fields, 'price', 200);

  return {
    id: docId,
    museum_id: getString(fields, 'museum_id') || docId,
    name,
    location: getString(fields, 'location'),
    state: getString(fields, 'state'),
    category: getString(fields, 'category'),
    price,
    prices: {
      Adult: getMapNumber(fields, 'prices', 'Adult', price),
      Child: getMapNumber(fields, 'prices', 'Child', Math.round(price * 0.5)),
      'Senior Citizen': getMapNumber(fields, 'prices', 'Senior Citizen', Math.round(price * 0.75)),
      Student: getMapNumber(fields, 'prices', 'Student', Math.round(price * 0.6)),
      Professor: getMapNumber(fields, 'prices', 'Professor', Math.round(price * 0.9)),
      'Researcher/Scientist': getMapNumber(fields, 'prices', 'Researcher/Scientist', Math.round(price * 0.9))
    },
    description: getString(fields, 'description') || undefined,
    imageUrl: getString(fields, 'imageUrl') || undefined,
    virtualTourUrl: getString(fields, 'virtualTourUrl') || undefined,
    latitude: fields.latitude ? getNumber(fields, 'latitude') : undefined,
    longitude: fields.longitude ? getNumber(fields, 'longitude') : undefined,
    createdAt: getTimestamp(fields, 'createdAt'),
    updatedAt: fields.updatedAt ? getTimestamp(fields, 'updatedAt') : undefined
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`Firestore museums request timed out after ${ms}ms`)), ms);
    })
  ]);
}

export async function getClientMuseumsFromFirestore(timeoutMs = 12000) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!projectId || !apiKey) {
    throw new Error('Firebase client environment variables are not configured.');
  }

  const url = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/museums`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('orderBy', 'createdAt desc');
  url.searchParams.set('pageSize', '100');

  const response = await withTimeout(fetch(url.toString(), { cache: 'no-store' }), timeoutMs);
  if (!response.ok) {
    throw new Error('Firestore museums request failed.');
  }

  const payload = await response.json();
  const documents = Array.isArray(payload?.documents) ? payload.documents as FirestoreDocument[] : [];

  return documents
    .map(normalizeMuseum)
    .filter((museum): museum is ClientMuseum => Boolean(museum));
}

export async function getMuseumsForClient(): Promise<{ museums: ClientMuseum[]; source: string }> {
  try {
    const museums = await getClientMuseumsFromFirestore();
    return {
      museums,
      source: 'firestore'
    };
  } catch {
    try {
      const response = await fetch('/api/museums', { cache: 'no-store' });
      if (!response.ok) throw new Error('Museums API failed');
      const payload = await response.json();
      const museums = Array.isArray(payload?.museums) ? payload.museums : [];

      return {
        museums: museums as ClientMuseum[],
        source: payload?.source || 'api'
      };
    } catch {
      return {
        museums: [],
        source: 'unavailable'
      };
    }
  }
}
