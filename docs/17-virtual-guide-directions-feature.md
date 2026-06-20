# Virtual Guide Directions Feature

## Purpose

Virtual Guide Directions provides an interactive route from a user's current or manually entered location to a Firestore museum without taking the user away from Bharat Museum Tickets.

Google Maps opens only after an explicit click on **Open in Google Maps**. **Navigate Here** always starts or updates the embedded route.

## User Flows

### Dedicated directions page

Open:

```text
/booking/directions
```

The page keeps the existing live Firestore search and museum selection. After selecting a museum, a user can:

1. Enter a starting address or use the browser's current location.
2. Select Driving, Walking, Cycling, Public Transit, or Train.
3. Click **Navigate Here**.
4. View the interactive map, route polyline, start/destination markers, route summary, and turn-by-turn steps inside the site.
5. Optionally click **Open in Google Maps** to continue in Google Maps.

On desktop the embedded map uses approximately 70% of the navigation workspace and the directions sidebar uses 30%. The workspace stacks vertically on tablets and phones.

### Booking cards

`MuseumDirections` remains reusable in `compact` mode. Booking flows render a lightweight card first. The Google Maps JavaScript API and embedded map chunk are loaded only after **Navigate Here** is clicked.

### Chatbot directions

The chatbot exposes directions in several easy-to-discover places:

- A permanent **Directions** button in the chatbot header.
- A **Directions** button after museum selection.
- A **Directions to Museum** button on ticket-history cards.
- Local recognition of natural messages such as `directions to Indian Museum`, `walk to Victoria Memorial`, or `train route to National Rail Museum`.

When no museum is selected or a typed name does not match, the chatbot loads the unchanged live Firestore catalog and displays an in-chat museum destination selector. Selecting a museum adds the full-width compact `MuseumDirections` workspace directly to the conversation.

Inside chat, users can enter a starting point or use GPS, choose any travel mode, view the embedded route and turn-by-turn steps, and explicitly open Google Maps if wanted. The chat viewport expands responsively to make the embedded map usable while keeping the Maps code lazy-loaded.

## Folder Structure

```text
client/src/
├── app/booking/directions/page.tsx
├── components/navigation/
│   ├── DirectionsSidebar.tsx
│   ├── EmbeddedMap.tsx
│   ├── MuseumDirections.tsx
│   ├── RoutePanel.tsx
│   └── TravelModeSelector.tsx
└── lib/
    ├── clientMuseums.ts
    ├── directions.ts
    └── googleMaps.ts
```

## Component Responsibilities

### `MuseumDirections.tsx`

Owns the navigation state:

```text
selected Firestore museum
manual/cached GPS origin
travel mode
navigation active state
route loading/error state
normalized route summary
```

It is the only component that opens the external Google Maps URL, and only from the **Open in Google Maps** click handler.

### `EmbeddedMap.tsx`

Lazy-loads the Google Maps JavaScript API, creates the map, calls `google.maps.DirectionsService`, and passes the result to `DirectionsRenderer`.

`DirectionsRenderer` displays:

- The interactive map.
- The route polyline.
- The start marker.
- The museum destination marker.
- Automatic viewport fitting around the route.

The route request uses the selected mode:

```ts
service.route({
  origin,
  destination,
  travelMode: google.maps.TravelMode[travelMode],
  provideRouteAlternatives: false
});
```

Completed and in-flight requests are cached in a bounded in-memory map by origin, destination, and mode. This prevents duplicate API calls during React Strict Mode and when a route combination is revisited.

### `RoutePanel.tsx`

Displays total distance, estimated duration, calculated ETA, and the number of route steps/turns.

### `DirectionsSidebar.tsx`

Displays route status and scrollable turn-by-turn instructions. Google instruction HTML is converted to plain text before rendering.

### `TravelModeSelector.tsx`

Provides accessible controls for:

- Driving
- Walking
- Cycling (`BICYCLING` in the Maps API)
- Public Transit
- Train (Google Transit with train and rail preferences)

Train uses `TRANSIT` with `transitOptions.modes` set to `TRAIN` and `RAIL`, because Google Maps does not expose train as a top-level travel mode. Transit, train, and cycling depend on route availability in the selected region. A `ZERO_RESULTS` response is shown as a user-friendly route-not-found state.

## Google Maps Setup

Add this client-side environment variable:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_browser_restricted_key
```

In the same Google Cloud project:

1. Enable billing.
2. Enable the **Maps JavaScript API** and routing/directions access required by `DirectionsService`.
3. Restrict the key to website HTTP referrers.
4. Add the production domain and local development origins such as `http://localhost:3000/*`.
5. Restrict API usage to the enabled Maps APIs.

The loader lives in `client/src/lib/googleMaps.ts`. It inserts the Maps script once with `loading=async`, shares the same Promise between components, and resets after a script error so a later attempt can retry.

## Museum Destination

The selected object is the existing Firestore museum object. No duplicate museum lookup or static museum data is used.

The destination remains:

```text
museum name + location + state + India
```

`DirectionsService` geocodes this address while calculating the route, so no Firestore schema change is required.

## Location and Fallback Behavior

Current location uses the browser Geolocation API with a 10-second timeout. A successful latitude/longitude pair is stored in `sessionStorage` under:

```text
bharat-museum-current-location
```

The cached location is reused for the rest of the browser tab session. It is not persisted across sessions or sent to Firestore.

If GPS is missing, times out, or permission is denied, the UI focuses the manual starting-location input and explains what to do. Manual addresses and landmarks are geocoded by the route request.

Handled states include:

- Map module and Maps API loading.
- Route calculation loading.
- Missing API configuration or script failure.
- Invalid starting point or museum address.
- GPS unavailable, timeout, or permission denial.
- No route for the selected travel mode.
- Request denial, quota limit, and generic API errors.

## Firestore Loading (Unchanged)

The directions redesign does not modify `client/src/lib/clientMuseums.ts` or its loading order:

1. Read `museums` directly from Cloud Firestore with the Firestore REST API.
2. If the direct read fails, call `/api/museums`.
3. If both fail, show no museums and report that the live catalog could not be loaded.

No built-in or dummy museums are used. Expected fields remain:

```text
museum_id
name
location
state
category
price
prices
description
imageUrl
createdAt
```

## External Google Maps Behavior

The external URL remains:

```text
https://www.google.com/maps/dir/?api=1
```

It includes the current origin when available and the selected travel mode. It is never opened by museum selection, geolocation success, route completion, or **Navigate Here**. It opens only from **Open in Google Maps**.

## Verification

```powershell
cd client
npm run lint
npm run build
```

Manual checks:

1. Select a Firestore museum and confirm no redirect occurs.
2. Enter a valid origin and test all travel modes.
3. Confirm distance, duration, ETA, turn count, polyline, markers, and steps appear.
4. Deny location permission and confirm manual routing still works.
5. Select another museum and confirm the route updates in place.
6. Confirm only **Open in Google Maps** creates a new Google Maps tab.
7. Test desktop, tablet, and mobile layouts.
