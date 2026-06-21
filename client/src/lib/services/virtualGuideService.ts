import { getFirebaseFirestore } from '../config/firebaseAdmin';
import { ApiError } from '../utils/errors';
import { getCustomMuseums, type MuseumRecord } from './museumService';
import type { MediaGalleryItem, MuseumVirtualGuide, VirtualTour } from '../virtualGuide';

function text(value: unknown) { return String(value || '').trim(); }
function stringList(value: unknown) { return Array.isArray(value) ? value.map(text).filter(Boolean) : []; }
function toMillis(value: any) {
  if (value?.toMillis) return value.toMillis();
  const millis = new Date(value || 0).getTime();
  return Number.isFinite(millis) ? millis : 0;
}

export async function findMuseum(identifier: string): Promise<MuseumRecord> {
  const wanted = decodeURIComponent(identifier || '').trim().toLowerCase();
  const { museums } = await getCustomMuseums();
  const museum = museums.find((item) => (
    item.id.toLowerCase() === wanted ||
    item.museum_id.toLowerCase() === wanted ||
    item.name.toLowerCase() === wanted
  ));
  if (!museum) throw new ApiError('Museum not found', 404);
  return museum;
}

export function toPublicMuseum(museum: MuseumRecord) {
  const { loginEmail: _loginEmail, ...publicMuseum } = museum;
  return publicMuseum;
}

async function queryByMuseumId(collectionName: string, museum: MuseumRecord) {
  const db = getFirebaseFirestore();
  const identifiers = Array.from(new Set([museum.museum_id, museum.id].filter(Boolean)));
  const snapshots = await Promise.all(identifiers.map((identifier) => (
    db.collection(collectionName).where('museum_id', '==', identifier).limit(100).get()
  )));
  const records = new Map<string, Record<string, any>>();
  snapshots.forEach((snapshot) => snapshot.docs.forEach((doc) => records.set(doc.id, { id: doc.id, ...doc.data() })));
  return Array.from(records.values()).filter((record) => record.active !== false);
}

export async function getMuseumTours(museum: MuseumRecord): Promise<VirtualTour[]> {
  const records = await queryByMuseumId('virtualTours', museum);
  const tours = records.map((record): VirtualTour | null => {
    const videoUrl = text(record.videoUrl);
    if (!videoUrl) return null;
    const videoType = text(record.videoType).toLowerCase();
    return {
      id: text(record.id),
      tour_id: text(record.tour_id || record.id),
      museum_id: museum.museum_id,
      title: text(record.title) || `${museum.name} virtual tour`,
      description: text(record.description),
      videoType: ['youtube', 'firebase', 'cloudinary', 'mp4', 'hls'].includes(videoType) ? videoType as VirtualTour['videoType'] : 'mp4',
      videoUrl,
      thumbnail: text(record.thumbnail) || undefined,
      durationSeconds: Number(record.durationSeconds || record.duration || 0) || undefined,
      language: text(record.language) || 'en',
      category: (text(record.category) || 'museum overview') as VirtualTour['category'],
      captionsUrl: text(record.captionsUrl) || undefined,
      featured: Boolean(record.featured),
      _createdAt: toMillis(record.createdAt)
    } as VirtualTour & { _createdAt: number };
  }).filter((tour): tour is VirtualTour & { _createdAt: number } => Boolean(tour));

  const existingUrls = new Set(tours.map((tour) => tour.videoUrl));
  const fallbackUrls = Array.from(new Set([
    ...(museum.videoUrls || []),
    museum.videoUrl || '',
    museum.virtualTourUrl || ''
  ].filter(Boolean)));
  fallbackUrls.forEach((videoUrl, index) => {
    if (existingUrls.has(videoUrl)) return;
    tours.push({
      id: `museum-video-${index}`,
      tour_id: `${museum.museum_id}-video-${index}`,
      museum_id: museum.museum_id,
      title: index === 0 ? `${museum.name} overview` : `${museum.name} tour ${index + 1}`,
      description: museum.description || '',
      videoType: /youtu(?:\.be|be\.com)/i.test(videoUrl) ? 'youtube' : /\.m3u8(?:$|\?)/i.test(videoUrl) ? 'hls' : 'mp4',
      videoUrl,
      language: 'en',
      category: index === 0 ? 'museum overview' : 'gallery walkthrough',
      featured: index === 0,
      _createdAt: 0
    } as VirtualTour & { _createdAt: number });
  });

  return tours
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b._createdAt - a._createdAt)
    .map(({ _createdAt: _ignored, ...tour }) => tour);
}

export async function getMuseumGallery(museum: MuseumRecord): Promise<MediaGalleryItem[]> {
  const records = await queryByMuseumId('mediaGallery', museum);
  const gallery = records.map((record): MediaGalleryItem | null => {
    const imageUrl = text(record.imageUrl);
    if (!imageUrl) return null;
    return {
      id: text(record.id),
      gallery_id: text(record.gallery_id || record.id),
      museum_id: museum.museum_id,
      title: text(record.title) || museum.name,
      imageUrl,
      thumbnailUrl: text(record.thumbnailUrl) || undefined,
      caption: text(record.caption) || undefined,
      description: text(record.description) || undefined,
      type: (text(record.type) || 'gallery') as MediaGalleryItem['type'],
      artifactFacts: stringList(record.artifactFacts),
      featured: Boolean(record.featured),
      _createdAt: toMillis(record.createdAt)
    } as MediaGalleryItem & { _createdAt: number };
  }).filter((item): item is MediaGalleryItem & { _createdAt: number } => Boolean(item));

  const existingUrls = new Set(gallery.map((item) => item.imageUrl));
  Array.from(new Set([...(museum.imageUrls || []), museum.imageUrl || ''].filter(Boolean))).forEach((imageUrl, index) => {
    if (existingUrls.has(imageUrl)) return;
    gallery.push({
      id: `museum-image-${index}`,
      gallery_id: `${museum.museum_id}-image-${index}`,
      museum_id: museum.museum_id,
      title: index === 0 ? museum.name : `${museum.name} gallery ${index + 1}`,
      imageUrl,
      caption: museum.description,
      type: index === 0 ? 'building' : 'gallery',
      featured: index === 0,
      _createdAt: 0
    } as MediaGalleryItem & { _createdAt: number });
  });

  return gallery
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b._createdAt - a._createdAt)
    .map(({ _createdAt: _ignored, ...item }) => item);
}

export async function getMuseumVirtualGuide(identifier: string): Promise<MuseumVirtualGuide> {
  const museum = await findMuseum(identifier);
  const [tours, gallery] = await Promise.all([getMuseumTours(museum), getMuseumGallery(museum)]);
  const history = text(museum.history) || museum.description || '';
  const highlights = Array.from(new Set([
    ...stringList(museum.highlights),
    museum.category ? `${museum.category} collections` : '',
    museum.location ? `Located in ${museum.location}${museum.state ? `, ${museum.state}` : ''}` : '',
    tours.length ? `${tours.length} virtual experience${tours.length === 1 ? '' : 's'}` : '',
    gallery.length ? `${gallery.length} gallery highlight${gallery.length === 1 ? '' : 's'}` : ''
  ].filter(Boolean)));
  return { museum: toPublicMuseum(museum), tours, gallery, history, highlights } as MuseumVirtualGuide;
}
