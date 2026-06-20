import type { MuseumCatalogItem } from './museumCatalog';

export type PersonalizationPreferences = {
  favoriteCategories: string[];
  preferredLanguage: string;
  budgetMax: number | null;
  preferredCity: string;
  preferredState: string;
  travelMode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT' | 'TRAIN';
};

export type CrowdLevel = 'Low' | 'Moderate' | 'High' | 'Critical' | 'Unknown';

export type RecommendedMuseum = MuseumCatalogItem & {
  distanceKm?: number;
  distanceAccuracy?: 'exact' | 'approximate';
  confidence: number;
  score: number;
  reason: string;
  reasons: string[];
  rating: number | null;
  ratingCount: number;
  crowdLevel: CrowdLevel;
  trendScore: number;
  isFavorite: boolean;
};

export type PersonalizedExhibition = {
  id: string;
  name: string;
  museumId: string;
  museumName?: string;
  category?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  imageUrl?: string;
  reason: string;
};

export type PersonalizedEvent = {
  id: string;
  name: string;
  museumId?: string;
  museumName?: string;
  category?: string;
  date?: string;
  description?: string;
};

export type PersonalizedRecommendations = {
  success: true;
  generatedAt: string;
  cached: boolean;
  user: { name: string; preferredArea: string };
  preferences: PersonalizationPreferences;
  profileCompleteness: number;
  suggestedVisitTime: string;
  sections: {
    recommended: RecommendedMuseum[];
    nearby: RecommendedMuseum[];
    trending: RecommendedMuseum[];
    lessCrowded: RecommendedMuseum[];
    recentlyViewed: RecommendedMuseum[];
    continueExploring: RecommendedMuseum[];
    exhibitions: PersonalizedExhibition[];
    events: PersonalizedEvent[];
  };
};

export const DEFAULT_PERSONALIZATION_PREFERENCES: PersonalizationPreferences = {
  favoriteCategories: [],
  preferredLanguage: 'en',
  budgetMax: null,
  preferredCity: '',
  preferredState: '',
  travelMode: 'DRIVING'
};
