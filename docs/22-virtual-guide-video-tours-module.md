# Virtual Guide & Video Tours Module

## Status

This document records the planned production architecture and application logic for integrating virtual museum experiences with the AI chatbot and manual ticket-booking flows. It is a specification, not a declaration that every feature below has already been implemented.

## Objective

The Virtual Guide allows visitors to explore a museum digitally before or after booking without leaving the Bharat Museum Tickets website. Visitors can:

- Ask questions about museums.
- Watch official museum videos and virtual walkthroughs.
- Browse exhibit, artifact, gallery, and building photos.
- Read museum history, facts, highlights, and visitor tips.
- Receive personalized museum and media recommendations.
- Open directions or continue directly into ticket booking.

YouTube must remain embedded inside the application. An external YouTube page opens only when the visitor explicitly chooses **Open on YouTube**.

## Technology

- Frontend: Next.js, React, TypeScript, Tailwind CSS, Framer Motion.
- Application APIs: Next.js/Node.js API routes, compatible with Express services.
- Database: Firebase Firestore.
- Authentication: Firebase Authentication.
- Media storage: Cloudinary and/or Firebase Storage.
- External video source: official YouTube embeds.
- Chatbot: Python, ChatterBot, and deterministic intent/entity detection.

## Core Architecture

```text
Visitor
  |
  +-- Manual museum selection --------+
  |                                    |
  +-- Chatbot media intent ------------+--> Virtual Guide API layer
                                             |
                                             +-- museums
                                             +-- virtualTours
                                             +-- mediaGallery
                                             +-- exhibitions/artifacts
                                             +-- recommendation service
                                             |
                                             v
                                      Rich media components
                                             |
                          +------------------+------------------+
                          |                  |                  |
                     Embedded video     Photo gallery      Museum details
                          |                  |                  |
                          +------------------+------------------+
                                             |
                                  Booking / directions actions
```

The chatbot and manual booking interface must consume the same APIs and normalized media types. Neither flow should implement a separate media database or duplicate business logic.

## Firestore Schema

### `museums/{museumDocumentId}`

```ts
type Museum = {
  museum_id: string;
  name: string;
  city: string;
  state: string;
  category: string;
  description: string;
  history: string;
  timings: Record<string, unknown>;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
  bannerImage?: string;
  coordinates?: { latitude: number; longitude: number };
  active: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};
```

### `virtualTours/{tourDocumentId}`

```ts
type VirtualTour = {
  tour_id: string;
  museum_id: string;
  title: string;
  description: string;
  videoType: 'youtube' | 'firebase' | 'cloudinary' | 'mp4' | 'hls';
  videoUrl: string;
  thumbnail?: string;
  durationSeconds?: number;
  language: string;
  category:
    | 'museum overview'
    | 'gallery walkthrough'
    | 'history'
    | 'artifact'
    | 'audio guide';
  captionsUrl?: string;
  featured: boolean;
  active: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};
```

### `mediaGallery/{galleryDocumentId}`

```ts
type MediaGalleryItem = {
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
  active: boolean;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};
```

All cross-collection references use the stable `museum_id`. Firestore document IDs remain internal storage identifiers.

## API Contract

```text
GET /api/museums
GET /api/museums/:id
GET /api/museums/:id/videos
GET /api/museums/:id/gallery
GET /api/museums/:id/history
GET /api/museums/:id/highlights
GET /api/museums/search?q=&type=&language=&cursor=
GET /api/recommendations?museumId=&context=
```

Recommended administrative endpoints:

```text
POST   /api/museums/:id/videos
PATCH  /api/museums/:id/videos/:tourId
DELETE /api/museums/:id/videos/:tourId
POST   /api/museums/:id/gallery
PATCH  /api/museums/:id/gallery/:galleryId
DELETE /api/museums/:id/gallery/:galleryId
```

Media writes require authenticated `admin` or owning `museum` accounts. Public visitors receive only active, public media.

## Normalized Rich Chat Response

The Python chatbot returns structured actions alongside human-readable text:

```ts
type ChatbotVirtualGuideAction = {
  type: 'virtual_guide';
  museumId: string;
  museum?: Museum;
  tours: VirtualTour[];
  gallery: MediaGalleryItem[];
  suggestedActions: Array<
    | 'watch_overview'
    | 'open_gallery'
    | 'virtual_tour'
    | 'museum_history'
    | 'book_ticket'
    | 'directions'
    | 'recommendations'
  >;
};
```

The Next.js chat client renders this action as a `ChatbotMediaCard`; it must not parse display text to reconstruct media metadata.

## Chatbot Intent Logic

### Supported intents

- `show_video`
- `watch_museum`
- `virtual_tour`
- `show_gallery`
- `show_artifacts`
- `museum_history`
- `show_collections`
- `museum_images`
- `show_exhibitions`
- `book_ticket`
- `directions`
- `museum_timing`
- `ticket_price`
- `nearby_museums`

### Representative phrases

- “Show museum video.”
- “Take me inside the museum.”
- “Can I visit virtually?”
- “Show the gallery or exhibits.”
- “Play the museum documentary.”
- “Show historical videos.”
- “I want to see dinosaur fossils.”

### Resolution algorithm

1. Normalize the message and detect the media intent.
2. Extract a museum, artifact, category, location, or exhibition entity.
3. Resolve the entity against the live Firestore museum catalog.
4. If resolution is ambiguous, return museum choices instead of assuming.
5. Query tours/gallery/highlights by the resolved `museum_id`.
6. Return display text plus a structured `virtual_guide` action.
7. Preserve the active booking session while media is open.
8. After a tour ends or closes, offer booking, directions, or another museum.

## Chatbot Workflow

```text
User: “I want to visit Indian Museum”
  -> Resolve Indian Museum
  -> Show museum rich card
  -> Ask “Would you like a virtual tour first?”
       -> Yes: open embedded guide
       -> Skip: continue booking
  -> On guide close/completion
  -> Offer Book Now / Directions / Another Museum
```

The virtual-guide step is optional and cannot discard the selected museum or already collected booking details.

## Manual Booking Integration

After museum selection, the booking page displays an **Explore Before Visiting** panel containing:

- Museum introduction.
- Embedded overview video.
- Photo gallery.
- Top exhibits and artifacts.
- Museum history and facts.
- Audio guide.
- Visitor highlights and tips.
- Virtual Tour, Gallery, History, Directions, and Book Ticket actions.

Recommended flow:

```text
Museum selection
  -> Optional video preview and gallery
  -> History/highlights
  -> Visitor information
  -> Ticket configuration
  -> Payment
  -> QR ticket
```

Exploration never forces navigation away from the booking page and never resets form state.

## Frontend Components

```text
client/src/components/VirtualGuide/
  VirtualGuide.tsx
  VideoPlayer.tsx
  Gallery.tsx
  MuseumHistory.tsx
  ArtifactViewer.tsx
  VirtualTourCard.tsx
  MediaCarousel.tsx
  ChatbotMediaCard.tsx
  TourRecommendation.tsx
  BookingMediaPanel.tsx

client/src/hooks/
  useVirtualGuide.ts
  useMuseumMedia.ts
  useRecommendations.ts

client/src/lib/
  virtualGuide.ts
  media.ts
  recommendations.ts
```

Components should use dynamic imports for heavy players and galleries. Shared data hooks handle loading, caching, pagination, cancellation, and retry states.

## Embedded Video Player

Support:

- YouTube iframe embeds from allow-listed official URLs.
- Cloudinary/Firebase MP4.
- HLS/adaptive streaming where available.
- Play, pause, resume, seek, fullscreen, captions, playback speed, and quality.
- Related and next videos.
- Optional autoplay only after user interaction and with reduced-motion/data-saving checks.

Never inject arbitrary iframe HTML. Parse and validate video IDs/URLs server-side and render from typed data.

## Photo Gallery

Support grid, carousel, fullscreen preview, zoom, touch swipe, keyboard navigation, captions, and artifact information. Sharing and downloading are optional and must respect media permissions.

## Recommendations

Rank tours and museums using:

- Current museum/category.
- Previous bookings and visits.
- Search/view history.
- Popular media and trending exhibitions.
- Nearby museums.
- User language and accessibility preferences.

Recommendation responses include a reason and exclude inactive or inaccessible media.

## Search

Unified search covers museums, videos, artifacts, exhibitions, history, galleries, and collections. It supports autocomplete, fuzzy matching, voice input, filters, pagination, and keyboard navigation.

## Accessibility

- Semantic controls and screen-reader labels.
- Complete keyboard navigation and visible focus.
- Text-to-speech and voice guidance integration.
- Captions/subtitles and transcripts for videos.
- High-contrast and enlarged-text compatibility.
- Reduced-motion behavior.
- Focus management for fullscreen players and gallery dialogs.
- WCAG-aware color contrast and touch target sizing.

## Performance

- Lazy-load players, thumbnails, gallery pages, and recommendations.
- Use `next/image` or optimized Cloudinary delivery for images.
- Load video metadata before full video data.
- Use pagination/cursors and skeleton states.
- Cache public catalog responses with controlled revalidation.
- Dynamically import large player/gallery bundles.
- Cancel stale search and media requests.

## Security

- Require Firebase authentication and role/ownership checks for media writes.
- Validate MIME type, file signature, URL protocol, ownership, and size.
- Sanitize captions and textual metadata.
- Allow-list YouTube, Cloudinary, and Firebase media hosts.
- Store only public visitor-safe fields in public API responses.
- Apply Firebase Storage and Firestore security rules.
- Use signed uploads and never expose storage/API secrets.
- Rate-limit search, recommendation, and upload routes.

## Error Handling

- Missing media: show museum information and booking actions without a broken player.
- Failed player: offer retry and an explicit external-source button when permitted.
- Unsupported browser: show transcript, thumbnail, and source alternative.
- Ambiguous museum: request a choice.
- Deleted/inactive media: remove it from results and recommendations.
- Network failure: preserve booking/chat state and provide retry.

## Implementation Order

1. Finalize schemas, indexes, shared TypeScript types, and security rules.
2. Add read APIs for museum tours, gallery, history, and highlights.
3. Build normalized media hooks and accessible player/gallery components.
4. Add `BookingMediaPanel` to manual booking.
5. Add chatbot intents and structured `virtual_guide` actions.
6. Render rich chatbot media cards.
7. Add recommendations and unified search.
8. Add authenticated media administration.
9. Add caching, analytics, performance safeguards, and automated tests.

## Acceptance Criteria

- Visitors can watch and browse media without leaving the site.
- Chatbot and manual booking use the same media records and APIs.
- Media exploration never loses booking state.
- YouTube opens externally only after an explicit click.
- All media interfaces work on mobile and with keyboard/screen readers.
- Missing or failed media does not block booking.
- Only authorized admins or owning museum authorities can modify media.
- Public APIs expose only active content.
- Videos are captioned or provide transcripts where required.
