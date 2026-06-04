# API Routes

All routes live under `client/src/app/api` and run in the Next.js app.

## Health

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Basic app health endpoint. |

## Auth Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/signup` | Creates a password user in Firestore and returns an app JWT. |
| `POST` | `/api/auth/login` | Validates email/password and returns an app JWT plus user profile fields. |
| `POST` | `/api/auth/google` | Accepts a Firebase Google ID token and creates or logs in a Google user record. |
| `POST` | `/api/auth/profile` | Completes or updates profile data using a Firebase bearer token. |

Auth service source: `client/src/lib/services/authService.ts`

## Booking Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/bookings` | Returns all bookings sorted newest first. |
| `POST` | `/api/bookings` | Creates a booking, optionally assigning the Firebase user from bearer auth. |
| `GET` | `/api/bookings/[id]` | Fetches a booking by Firestore document ID. |
| `DELETE` | `/api/bookings/[id]` | Deletes a booking by Firestore document ID. |
| `PATCH` | `/api/bookings/[id]/status` | Updates booking status to `pending`, `confirmed`, or `cancelled`. |
| `GET` | `/api/bookings/by-booking-id/[bookingId]` | Fetches a booking by generated public booking ID. |
| `POST` | `/api/bookings/check-availability` | Checks available capacity for a date and time slot. |
| `GET` | `/api/bookings/user/my-bookings` | Returns bookings for the authenticated Firebase user. |

Booking service source: `client/src/lib/services/bookingService.ts`

## Payment Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/payments/razorpay/order` | Validates booking input, calculates amount, and creates a Razorpay order. |
| `POST` | `/api/payments/razorpay/verify` | Verifies Razorpay signature and creates a paid, confirmed booking. |

The verify route is the trusted booking creation step for paid bookings.

## Chat Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/chat/message` | Sends a message to the Flask chatbot engine and stores chat logs in RTDB. |
| `POST` | `/api/chat/reset` | Resets a chatbot session in the Flask engine. |
| `GET` | `/api/chat/history` | Loads chat messages from Firebase Realtime Database. |
| `POST` | `/api/chat/store` | Stores forwarded chat logs, used by the chatbot engine fallback path. |

Chat service source: `client/src/lib/services/chatService.ts`

## Upload Route

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/uploads` | Uploads a profile image and returns an image URL/public ID. |

## Response Helpers

Source: `client/src/lib/utils/apiResponse.ts`

Routes use shared JSON success and error helpers so responses remain consistent.

