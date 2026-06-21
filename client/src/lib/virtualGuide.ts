import type { MuseumCatalogItem } from './museumCatalog';

export type VirtualTour = {
  id: string;
  tour_id: string;
  museum_id: string;
  title: string;
  description: string;
  videoType: 'youtube' | 'firebase' | 'cloudinary' | 'mp4' | 'hls';
  videoUrl: string;
  thumbnail?: string;
  durationSeconds?: number;
  language: string;
  category: 'museum overview' | 'gallery walkthrough' | 'history' | 'artifact' | 'audio guide';
  captionsUrl?: string;
  featured: boolean;
};

export type MediaGalleryItem = {
  id: string;
  gallery_id: string;
  museum_id: string;
  title: string;
  imageUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  description?: string;
  type: 'artifact' | 'gallery' | 'building' | 'painting' | 'statue';
  artifactFacts?: string[];
  featured: boolean;
};

export type MuseumVirtualGuide = {
  museum: MuseumCatalogItem;
  tours: VirtualTour[];
  gallery: MediaGalleryItem[];
  history: string;
  highlights: string[];
};

export type VirtualGuideChatAction = {
  type: 'virtual_guide';
  museumId: string;
  initialView?: 'overview' | 'videos' | 'gallery' | 'history';
};

export function getYouTubeVideoId(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || '';
    if (parsed.hostname.endsWith('youtube.com')) {
      if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || '';
      if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || '';
      return parsed.searchParams.get('v') || '';
    }
  } catch {
    return '';
  }
  return '';
}

export async function fetchVirtualGuide(museumId: string): Promise<MuseumVirtualGuide> {
  const response = await fetch(`/api/museums/${encodeURIComponent(museumId)}/virtual-guide`, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.guide) throw new Error(payload?.message || 'Unable to load the virtual guide.');
  return payload.guide as MuseumVirtualGuide;
}
