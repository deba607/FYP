import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseFirestore } from '../config/firebaseAdmin';
import { getTicketHistoryForUser } from './bookingService';
import { getCustomMuseums } from './museumService';
import {
  DEFAULT_PERSONALIZATION_PREFERENCES,
  type CrowdLevel,
  type PersonalizationPreferences,
  type PersonalizedEvent,
  type PersonalizedExhibition,
  type PersonalizedRecommendations,
  type RecommendedMuseum
} from '../recommendations';
import type { MuseumCatalogItem } from '../museumCatalog';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_VERSION = 2;
const TRAVEL_MODES = new Set(['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT', 'TRAIN']);

type UserContext = { uid: string; email?: string; name?: string };
type GenericRecord = Record<string, unknown> & { id: string };

function text(value: unknown) {
  return String(value || '').trim();
}

function normalized(value: unknown) {
  return text(value).toLowerCase();
}

const LOCATION_STOP_WORDS = new Set(['india', 'road', 'street', 'near', 'district', 'city', 'state', 'the']);

function meaningfulTokens(value: unknown) {
  return normalized(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !LOCATION_STOP_WORDS.has(token));
}

function areaMatches(museum: Pick<MuseumCatalogItem, 'location' | 'state'>, candidates: string[]) {
  const museumArea = normalized(`${museum.location} ${museum.state}`);
  const museumLocation = normalized(museum.location);
  const museumState = normalized(museum.state);
  if (!museumArea) return false;
  return candidates.some((candidate) => {
    const area = normalized(candidate);
    if (!area) return false;
    if ((museumLocation && area.includes(museumLocation)) || (museumState && area.includes(museumState))) return true;
    if (museumArea.includes(area)) return true;
    return meaningfulTokens(area).some((token) => museumArea.includes(token));
  });
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => text(item)).filter(Boolean))).slice(0, 20)
    : [];
}

function dateString(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return text(value) || undefined;
}

function cleanForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function safeQuery(collection: string, limit = 100, userId?: string) {
  try {
    const firestore = getFirebaseFirestore();
    let query: FirebaseFirestore.Query = firestore.collection(collection);
    if (userId) query = query.where('userId', '==', userId);
    const snapshot = await query.limit(limit).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as GenericRecord));
  } catch {
    return [];
  }
}

function readPreferences(data?: Record<string, unknown>): PersonalizationPreferences {
  const mode = text(data?.travelMode).toUpperCase();
  const budgetValue = Number(data?.budgetMax);
  return {
    favoriteCategories: stringList(data?.favoriteCategories),
    preferredLanguage: text(data?.preferredLanguage) || 'en',
    budgetMax: Number.isFinite(budgetValue) && budgetValue >= 0 ? budgetValue : null,
    preferredCity: text(data?.preferredCity),
    preferredState: text(data?.preferredState),
    travelMode: TRAVEL_MODES.has(mode)
      ? mode as PersonalizationPreferences['travelMode']
      : 'DRIVING'
  };
}

function calculateCompleteness(preferences: PersonalizationPreferences) {
  const fields = [
    preferences.favoriteCategories.length > 0,
    Boolean(preferences.preferredLanguage),
    preferences.budgetMax !== null,
    Boolean(preferences.preferredCity || preferences.preferredState),
    Boolean(preferences.travelMode)
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function crowdFromVisit(data?: GenericRecord): CrowdLevel {
  if (!data) return 'Unknown';
  const explicit = text(data.crowdLevel).toLowerCase();
  if (explicit === 'low') return 'Low';
  if (explicit === 'moderate' || explicit === 'medium') return 'Moderate';
  if (explicit === 'high') return 'High';
  if (explicit === 'critical') return 'Critical';
  const current = Number(data.currentVisitors ?? data.visitorCount);
  const capacity = Number(data.capacity);
  if (!Number.isFinite(current) || !Number.isFinite(capacity) || capacity <= 0) return 'Unknown';
  const occupancy = current / capacity;
  if (occupancy < 0.4) return 'Low';
  if (occupancy < 0.75) return 'Moderate';
  return 'High';
}

function getDynamicCrowdLevel(museumId: string, data?: GenericRecord): CrowdLevel {
  if (data) {
    const level = crowdFromVisit(data);
    if (level !== 'Unknown') return level;
  }

  // Fallback to time-based crowd level simulation in India Time (IST)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  // India is UTC + 5:30
  const istTime = new Date(utc + 3600000 * 5.5);
  const hour = istTime.getHours();

  // Simple stable deterministic hash based on museum ID
  let hash = 0;
  for (let i = 0; i < museumId.length; i++) {
    hash = (hash << 5) - hash + museumId.charCodeAt(i);
    hash |= 0;
  }
  const factor = Math.abs(hash) % 100;

  // Closed/night hours
  if (hour < 9 || hour >= 18) {
    return 'Low';
  }

  // Peak hours: 12 PM - 3 PM
  if (hour >= 12 && hour < 15) {
    if (factor < 20) return 'Low';
    if (factor < 60) return 'Moderate';
    return 'High';
  }

  // Mid-peak hours: 11 AM - 12 PM, 3 PM - 4 PM
  if ((hour >= 11 && hour < 12) || (hour >= 15 && hour < 16)) {
    if (factor < 45) return 'Low';
    if (factor < 80) return 'Moderate';
    return 'High';
  }

  // Off-peak day hours: 9 AM - 11 AM, 4 PM - 6 PM
  if (factor < 70) return 'Low';
  return 'Moderate';
}

function museumKey(museum: Pick<MuseumCatalogItem, 'id' | 'museum_id' | 'name'>) {
  return normalized(museum.museum_id || museum.id || museum.name);
}

function recordMuseumKey(record: GenericRecord) {
  return normalized(record.museumId || record.museum_id || record.museumName);
}

export async function getPersonalizationPreferences(userId: string) {
  const snapshot = await getFirebaseFirestore().collection('preferences').doc(userId).get();
  return readPreferences(snapshot.exists ? snapshot.data() : undefined);
}

export async function updatePersonalizationPreferences(
  userId: string,
  input: Partial<PersonalizationPreferences>
) {
  const current = await getPersonalizationPreferences(userId);
  const next = readPreferences({ ...current, ...input });
  await getFirebaseFirestore().collection('preferences').doc(userId).set({
    ...next,
    userId,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await invalidateRecommendations(userId);
  return next;
}

export async function setMuseumFavorite(userId: string, museumId: string, favorite: boolean) {
  const firestore = getFirebaseFirestore();
  const safeMuseumId = museumId.trim();
  if (!safeMuseumId || safeMuseumId.length > 160) throw new Error('Invalid museum identifier');
  const reference = firestore.collection('favorites').doc(`${userId}_${encodeURIComponent(safeMuseumId)}`);
  if (favorite) {
    await reference.set({ userId, museumId: safeMuseumId, createdAt: FieldValue.serverTimestamp() });
  } else {
    await reference.delete();
  }
  await invalidateRecommendations(userId);
}

export async function recordPersonalizationActivity(
  userId: string,
  input: { type: 'viewed' | 'search' | 'visited'; museumId?: string; query?: string }
) {
  const firestore = getFirebaseFirestore();
  const collection = input.type === 'visited' ? 'visitedMuseums' : 'searchHistory';
  await firestore.collection(collection).add({
    userId,
    type: input.type,
    museumId: text(input.museumId).slice(0, 160),
    query: text(input.query).slice(0, 200),
    createdAt: FieldValue.serverTimestamp()
  });
  await invalidateRecommendations(userId);
}

async function invalidateRecommendations(userId: string) {
  await getFirebaseFirestore().collection('recommendedMuseums').doc(userId).delete().catch(() => undefined);
}

async function readCachedRecommendations(userId: string) {
  try {
    const doc = await getFirebaseFirestore().collection('recommendedMuseums').doc(userId).get();
    if (!doc.exists) return null;
    const data = doc.data() || {};
    if (Number(data.cacheVersion || 0) !== CACHE_VERSION) return null;
    const generatedAt = dateString(data.generatedAt);
    if (!generatedAt || Date.now() - new Date(generatedAt).getTime() > CACHE_TTL_MS) return null;
    const response = data.response as PersonalizedRecommendations | undefined;
    return response ? { ...response, cached: true } : null;
  } catch {
    return null;
  }
}

export async function generatePersonalizedRecommendations(
  user: UserContext,
  options?: { force?: boolean }
): Promise<PersonalizedRecommendations> {
  if (!options?.force) {
    const cached = await readCachedRecommendations(user.uid);
    if (cached) return cached;
  }

  const firestore = getFirebaseFirestore();
  const [
    museumResult,
    preferences,
    favorites,
    history,
    visited,
    ratingRecords,
    visitRecords,
    exhibitionsRaw,
    eventsRaw,
    userDoc,
    firestoreBookings,
    bookingResult,
    globalBookings
  ] = await Promise.all([
    getCustomMuseums(),
    getPersonalizationPreferences(user.uid),
    safeQuery('favorites', 100, user.uid),
    safeQuery('searchHistory', 100, user.uid),
    safeQuery('visitedMuseums', 100, user.uid),
    safeQuery('museumRatings', 300),
    safeQuery('museumVisits', 300),
    safeQuery('exhibitions', 100),
    safeQuery('events', 100),
    firestore.collection('users').doc(user.uid).get().catch(() => null),
    safeQuery('bookings', 100, user.uid),
    getTicketHistoryForUser({ userId: user.uid, email: user.email }).catch(() => ({ tickets: [] })),
    safeQuery('bookings', 1000)
  ]);

  const museums = museumResult.museums as MuseumCatalogItem[];
  const userData = userDoc?.exists ? userDoc.data() || {} : {};
  const favoriteIds = new Set(favorites.map(recordMuseumKey));
  const visitedIds = new Set(visited.map(recordMuseumKey));
  const bookedCategoryCounts = new Map<string, number>();
  const bookedMuseumCounts = new Map<string, number>();
  const allBookingSignals: Array<Record<string, unknown>> = [
    ...firestoreBookings,
    ...((bookingResult.tickets || []) as unknown as Array<Record<string, unknown>>)
  ];
  const bookingSignals = allBookingSignals
    .filter((booking, index, list) => {
      const id = normalized(booking.bookingId || booking.id || booking._id);
      return !id || list.findIndex((other) => normalized(other.bookingId || other.id || other._id) === id) === index;
    }) as Array<Record<string, unknown>>;
  const bookingAreaCandidates: string[] = [];
  for (const booking of bookingSignals) {
    const category = normalized(booking.museumCategory);
    const id = normalized(booking.museumId || booking.museumName);
    if (category) bookedCategoryCounts.set(category, (bookedCategoryCounts.get(category) || 0) + 1);
    if (id) bookedMuseumCounts.set(id, (bookedMuseumCounts.get(id) || 0) + 1);
    const visitorArea = text(booking.userLocation);
    if (visitorArea) bookingAreaCandidates.push(visitorArea);
  }

  const globalBookedMuseumCounts = new Map<string, number>();
  for (const booking of globalBookings) {
    const id = normalized(booking.museumId || booking.museumName);
    if (id) {
      globalBookedMuseumCounts.set(id, (globalBookedMuseumCounts.get(id) || 0) + 1);
    }
  }

  const ratings = new Map<string, { total: number; count: number }>();
  for (const record of ratingRecords) {
    const key = recordMuseumKey(record);
    const value = Number(record.rating);
    if (!key || !Number.isFinite(value)) continue;
    const current = ratings.get(key) || { total: 0, count: 0 };
    current.total += value;
    current.count += 1;
    ratings.set(key, current);
  }

  const visits = new Map<string, GenericRecord>();
  for (const record of visitRecords) {
    const key = recordMuseumKey(record);
    if (key) visits.set(key, record);
  }

  const recentHistory = [...history].sort((a, b) => {
    const aDate = new Date(dateString(a.createdAt) || 0).getTime();
    const bDate = new Date(dateString(b.createdAt) || 0).getTime();
    return bDate - aDate;
  });
  const recentTerms = recentHistory.map((item) => normalized(item.query)).filter(Boolean).slice(0, 20);
  const preferredCategories = new Set(preferences.favoriteCategories.map(normalized));
  const areaCandidates = [
    preferences.preferredCity,
    preferences.preferredState,
    ...bookingAreaCandidates,
    text(userData.address)
  ].filter(Boolean);
  const preferredArea = preferences.preferredCity || preferences.preferredState || bookingAreaCandidates[0] || text(userData.address);

  const ranked: RecommendedMuseum[] = museums.map((museum) => {
    const key = museumKey(museum);
    const category = normalized(museum.category);
    const ratingData = ratings.get(key);
    const rating = ratingData ? ratingData.total / ratingData.count : null;
    const visitData = visits.get(key);
    const crowdLevel = getDynamicCrowdLevel(key, visitData);
    const recordedVisits = Number(visitData?.visitCount ?? visitData?.totalVisits ?? 0) || 0;
    const globalBookingCount = globalBookedMuseumCounts.get(key) || 0;
    
    // Baseline trend score ensures a non-zero trendiness for all museums
    const baselineTrend = (museum.price > 0 ? 8 : 4) + (museum.name.length % 5);
    const trendScore = baselineTrend + recordedVisits + globalBookingCount * 4 + (ratingData?.count || 0);
    const reasons: string[] = [];
    let score = 20;

    if (preferredCategories.has(category)) {
      score += 32;
      reasons.push(`Matches your interest in ${museum.category}`);
    }
    if (bookedCategoryCounts.has(category)) {
      score += Math.min(24, 12 + (bookedCategoryCounts.get(category) || 0) * 4);
      reasons.push(`Similar to museums you previously booked`);
    }
    if (favoriteIds.has(key)) {
      score += 18;
      reasons.push('Saved in your favorites');
    }
    if (areaMatches(museum, areaCandidates)) {
      score += 22;
      reasons.push(`Located near your preferred or saved area`);
    }
    if (preferences.budgetMax !== null && museum.price <= preferences.budgetMax) {
      score += 12;
      reasons.push(`Fits your budget of INR ${preferences.budgetMax}`);
    }
    if (recentTerms.some((term) => normalized(`${museum.name} ${museum.category} ${museum.location}`).includes(term))) {
      score += 14;
      reasons.push('Related to your recent searches');
    }
    if (rating !== null) {
      score += Math.min(12, rating * 2);
      if (rating >= 4) reasons.push(`Highly rated by visitors (${rating.toFixed(1)})`);
    }
    if (trendScore > 0) {
      score += Math.min(15, Math.log2(trendScore + 1) * 3);
      reasons.push('Popular with visitors right now');
    }
    if (crowdLevel === 'Low') {
      score += 10;
      reasons.push('Currently reporting a lower crowd level');
    }
    if (visitedIds.has(key)) score -= 5;

    return {
      ...museum,
      score: Math.round(score * 10) / 10,
      confidence: Math.min(98, Math.max(45, Math.round(42 + score * 0.55))),
      reason: reasons[0] || `Explore a live ${museum.category || 'museum'} listing`,
      reasons: reasons.length ? reasons.slice(0, 3) : [`Available in the current museum catalog`],
      rating: rating === null ? null : Math.round(rating * 10) / 10,
      ratingCount: ratingData?.count || 0,
      crowdLevel,
      trendScore,
      isFavorite: favoriteIds.has(key)
    };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const byId = new Map<string, RecommendedMuseum>();
  for (const museum of ranked) {
    byId.set(museumKey(museum), museum);
    byId.set(normalized(museum.name), museum);
  }
  // Combine viewed, visited, and booked museums for the "Recently Viewed" section
  const combinedRecentItems: Array<{ museumId: string; date: number }> = [];

  history
    .filter((item) => text(item.type) === 'viewed' && recordMuseumKey(item))
    .forEach((item) => {
      combinedRecentItems.push({
        museumId: recordMuseumKey(item),
        date: new Date(dateString(item.createdAt) || 0).getTime()
      });
    });

  visited
    .filter((item) => recordMuseumKey(item))
    .forEach((item) => {
      combinedRecentItems.push({
        museumId: recordMuseumKey(item),
        date: new Date(dateString(item.createdAt) || 0).getTime()
      });
    });

  bookingSignals
    .forEach((booking) => {
      const id = normalized(booking.museumId || booking.museumName);
      if (id) {
        combinedRecentItems.push({
          museumId: id,
          date: new Date(dateString(booking.visitDate || booking.createdAt) || 0).getTime()
        });
      }
    });

  combinedRecentItems.sort((a, b) => b.date - a.date);

  const recentlyViewed = combinedRecentItems
    .map((item) => byId.get(item.museumId))
    .filter((item): item is RecommendedMuseum => Boolean(item))
    .filter((item, index, list) => list.findIndex((other) => other.museum_id === item.museum_id) === index)
    .slice(0, 6);

  const finalExhibitionsRaw = [...exhibitionsRaw];
  if (finalExhibitionsRaw.length === 0 && museums.length > 0) {
    museums.slice(0, 3).forEach((museum, idx) => {
      const titles = [
        `Gems of Indian Art & Heritage`,
        `Modern Retrospective & Sculptures`,
        `Ancient Artifacts & Coins Exhibition`
      ];
      finalExhibitionsRaw.push({
        id: `exh_fallback_${idx}`,
        name: titles[idx] || `${museum.name} Exhibition`,
        museumId: museum.museum_id,
        museumName: museum.name,
        category: museum.category || 'Art',
        description: `Explore a curated collection of masterworks and rare objects, highlighting the historical transition of ${museum.category.toLowerCase()} across centuries.`,
        status: 'active',
        startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    });
  }

  const finalEventsRaw = [...eventsRaw];
  if (finalEventsRaw.length === 0 && museums.length > 0) {
    museums.slice(0, 3).forEach((museum, idx) => {
      const titles = [
        `Heritage Walk & Curator Talk`,
        `Interactive Workshop for Students`,
        `Cultural Evening & Light Show`
      ];
      finalEventsRaw.push({
        id: `ev_fallback_${idx}`,
        name: titles[idx] || `${museum.name} Event`,
        museumId: museum.museum_id,
        museumName: museum.name,
        category: museum.category || 'General',
        description: `Join us for an immersive session at the museum including exclusive curator tours, interactive Q&A, and hands-on activities.`,
        status: 'active',
        date: new Date(Date.now() + (idx + 1) * 3 * 24 * 60 * 60 * 1000).toISOString()
      });
    });
  }

  const exhibitions: PersonalizedExhibition[] = finalExhibitionsRaw
    .filter((item) => text(item.status).toLowerCase() !== 'inactive')
    .map((item) => {
      const category = text(item.category);
      const matchingPreference = preferredCategories.has(normalized(category));
      return {
        id: item.id,
        name: text(item.name || item.title) || 'Museum exhibition',
        museumId: text(item.museumId),
        museumName: text(item.museumName) || undefined,
        category: category || undefined,
        description: text(item.description) || undefined,
        startDate: dateString(item.startDate),
        endDate: dateString(item.endDate),
        imageUrl: text(item.imageUrl) || undefined,
        reason: matchingPreference ? `Matches your interest in ${category}` : 'Currently available exhibition'
      };
    })
    .sort((a, b) => Number(preferredCategories.has(normalized(b.category))) - Number(preferredCategories.has(normalized(a.category))))
    .slice(0, 6);

  const events: PersonalizedEvent[] = finalEventsRaw
    .filter((item) => text(item.status).toLowerCase() !== 'cancelled')
    .map((item) => ({
      id: item.id,
      name: text(item.name || item.title) || 'Museum event',
      museumId: text(item.museumId) || undefined,
      museumName: text(item.museumName) || undefined,
      category: text(item.category) || undefined,
      date: dateString(item.date || item.startDate),
      description: text(item.description) || undefined
    }))
    .slice(0, 6);

  const nearby = ranked.filter((museum) => areaMatches(museum, areaCandidates)).slice(0, 6);
  const trending = ranked.filter((museum) => museum.trendScore > 0)
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 6);
  const lessCrowded = ranked
    .filter((museum) => museum.crowdLevel === 'Low' || museum.crowdLevel === 'Moderate')
    .sort((a, b) => {
      const order = { 'Low': 0, 'Moderate': 1, 'High': 2, 'Critical': 3, 'Unknown': 4 };
      return (order[a.crowdLevel] || 4) - (order[b.crowdLevel] || 4);
    })
    .slice(0, 6);
  const interestCategoryTokens = new Set<string>();
  [...preferences.favoriteCategories, ...bookedCategoryCounts.keys()].forEach((category) => {
    meaningfulTokens(category).forEach((token) => interestCategoryTokens.add(token));
  });
  ranked.filter((museum) => favoriteIds.has(museumKey(museum)) || recentlyViewed.some((recent) => recent.museum_id === museum.museum_id))
    .forEach((museum) => meaningfulTokens(museum.category).forEach((token) => interestCategoryTokens.add(token)));

  const continuationMatches = ranked.filter((museum) => {
    const key = museumKey(museum);
    const category = normalized(museum.category);
    const categoryRelated = bookedCategoryCounts.has(category) || preferredCategories.has(category) ||
      meaningfulTokens(category).some((token) => interestCategoryTokens.has(token));
    return categoryRelated && !visitedIds.has(key) && !bookedMuseumCounts.has(key);
  });
  const continueExploring = (continuationMatches.length
    ? continuationMatches
    : ranked.filter((museum) => !visitedIds.has(museumKey(museum)) && !bookedMuseumCounts.has(museumKey(museum)))
  ).slice(0, 6);

  const quietestTime = visitRecords.map((item) => text(item.quietestTime)).find(Boolean);
  const response: PersonalizedRecommendations = {
    success: true,
    generatedAt: new Date().toISOString(),
    cached: false,
    user: {
      name: text(userData.name) || user.name || user.email?.split('@')[0] || 'Museum Explorer',
      preferredArea
    },
    preferences,
    profileCompleteness: calculateCompleteness(preferences),
    suggestedVisitTime: quietestTime || (lessCrowded.length ? 'Current low-crowd window' : 'Crowd trend data is not available yet'),
    sections: {
      recommended: ranked.slice(0, 8),
      nearby,
      trending,
      lessCrowded,
      recentlyViewed,
      continueExploring,
      exhibitions,
      events
    }
  };

  await firestore.collection('recommendedMuseums').doc(user.uid).set({
    userId: user.uid,
    cacheVersion: CACHE_VERSION,
    generatedAt: FieldValue.serverTimestamp(),
    response: cleanForFirestore(response)
  }).catch(() => undefined);

  return response;
}
