# Auth and Firebase

## Firebase Client

Source: `client/src/lib/config/firebaseClient.ts`

The browser-side Firebase client initializes from public environment variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`

It exposes:

- `getFirebaseClientApp()`
- `getFirebaseClientAuth()`
- `getGoogleProvider()`

## Firebase Admin

Source: `client/src/lib/config/firebaseAdmin.ts`

Server-side Firebase Admin initializes from private environment variables:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL` or `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `FIREBASE_DATABASE_ID` for named Firestore databases when needed.

It exposes:

- `getFirebaseAdminApp()`
- `getFirebaseAuth()`
- `getFirebaseFirestore()`
- `getFirebaseRealtimeDatabase()`

## Password Auth

Source: `client/src/lib/services/authService.ts`

Password signup:

1. Normalizes email.
2. Checks Firestore `users` collection for duplicates.
3. Hashes password with `bcryptjs`.
4. Stores a user document with `authProvider: "password"`, `profileCompleted: true`, and `role: "user"`.
5. Returns a JWT signed with `JWT_SECRET`.

Password login:

1. Finds the user by normalized email.
2. Rejects Google-only accounts that have no password.
3. Compares password with bcrypt.
4. Returns a JWT and profile data.

## Google Auth

Google auth accepts a Firebase ID token, verifies it with Firebase Admin Auth, then creates or updates a Firestore user profile.

New Google users are created with:

- `authProvider: "google"`
- `profileCompleted: false`
- empty phone until profile completion.

## Profile Completion

The profile route verifies a Firebase bearer token and updates the user profile with phone, date of birth, address, photo URL, and profile completion state.

## Auth Middleware

Source: `client/src/lib/middleware/auth.ts`

API routes use optional or required Firebase user helpers to read bearer tokens and attach authenticated user identity where available.

## Data Stores

| Store | Collections/Paths |
| --- | --- |
| Firestore | `users`, `bookings` |
| Realtime Database | `bookings/{bookingId}`, `bookingsByUser/{userId}/{bookingId}`, `chat_messages/{sessionId}` |

