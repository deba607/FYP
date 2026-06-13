# Dashboard Role Access Logic

This project uses the Cloud Firestore `users` collection to decide which dashboard links a logged-in user can see and which dashboard page they should use.

Expected Firestore location:

```txt
users/{userDocumentId}.role
```

The app first checks `users/{firebaseAuthUid}`. If that document is missing, it queries the `users` collection by the signed-in user's email. This supports both Firebase UID documents and project-created user documents.

## Role Matrix

| Firestore role | Visible dashboards |
| --- | --- |
| `admin` | Admin Dashboard, Museum Dashboard, Controller Dashboard |
| `museum` | Museum Dashboard, Controller Dashboard |
| `controller` | Controller Dashboard |
| `user` or missing role | No dashboard selector |

## Implementation Rule

The role-to-dashboard helper is:

`client/src/lib/dashboardAccess.ts`

It exposes `getDashboardLinksForRole(role)`, which returns the allowed dashboard links for the current role:

```ts
admin      -> /admin, /museum-dashboard, /controller-dashboard
museum     -> /museum-dashboard, /controller-dashboard
controller -> /controller-dashboard
default    -> []
```

## Header Behavior

The shared header is:

`client/src/components/mvpblocks/header-2.tsx`

The header waits for Firebase Auth and the Firestore user document before showing dashboard options. This prevents stale browser `localStorage` data from showing an old role, such as showing Admin Dashboard for a user whose Firestore role is now `museum`.

After the Firestore role is checked, the header calls:

```ts
getDashboardLinksForRole(signedInUser?.role)
```

The returned links are used for the desktop dashboard selector, the profile dropdown links, and the mobile menu dashboard links.

## Firestore Role Reader

The client-side Firestore user reader is:

`client/src/lib/firestoreUser.ts`

It reads the role from:

```txt
users/{firebaseAuthUid}
```

If that document does not exist, it falls back to:

```txt
users where email == signedInEmail
```

## Direct Route Protection

The Admin Dashboard page remains admin-only:

`client/src/app/admin/page.tsx`

If a non-admin dashboard user reaches `/admin` directly:

```ts
museum     -> redirects to /museum-dashboard
controller -> redirects to /controller-dashboard
```

Museum Dashboard allows `admin` and `museum`.

Controller Dashboard allows `admin`, `museum`, and `controller`.

## Firestore Museum Catalog

Museum details come from the Cloud Firestore `museums` collection:

```txt
museums/{museumDocumentId}
```

The shared API route is:

```txt
client/src/app/api/museums/route.ts
```

`GET /api/museums` now returns only Firestore museum documents. It does not merge data from `public/museums.json` or any embedded sample list.

The booking form uses this API for its museum selector:

```txt
client/src/components/booking/BookTicket.tsx
```

If Firestore has no museum documents, the booking form shows an empty-state message instead of falling back to sample museums.

The chatbot engine also loads museum data from the same API:

```txt
chatbot-engine/chatbot/museum_assistant.py
```

Set `CHATBOT_API_URL` when the Next.js app is not running at `http://localhost:3000`.
