# Firestore-First Chatbot Implementation

## What Was Added

The Python chatbot now has a production-oriented Firestore-first layer. Live service actions read Firestore at request time instead of using trained ChatterBot data.

## Modules

- `production_intent_detector.py`: deterministic service intent detection.
- `firestore_repositories.py`: Firestore repositories for museums, bookings, and FAQs.
- `production_services.py`: business logic for availability, booking ownership, cancellation, prices, timings, QR ticket lookup, and FAQs.
- `qr_service.py`: QR data URL generation from booking ID.
- `response_builder.py`: structured chatbot responses.
- `firestore_chat_service.py`: orchestrates intent -> Firestore query -> business logic -> response.

## REST APIs

```text
POST /production-chat
POST /booking/availability
GET  /booking/<booking_id>
POST /booking/<booking_id>/cancel
GET  /booking/<booking_id>/qr
GET  /museums/<museum_id>/details
GET  /museums/<museum_id>/timings
GET  /museums/<museum_id>/prices
```

Private booking routes require the caller to send user context through headers or request auth metadata:

```text
Authorization: Bearer <firebase-id-token>
X-User-Id: <user-id>
X-User-Email: <email>
```

The chatbot `/chat` route also calls the Firestore-first layer before ChatterBot fallback for:

- cancel ticket
- check availability
- museum details
- museum timings
- ticket prices
- generate QR
- check existing booking
- FAQ

The existing guided booking flow remains active for collecting date, time, and visitor category.

## Source Of Truth

Firestore collections used:

- `museums`
- `bookings`
- `faqs`

ChatterBot is not used for live data. It remains only as fallback/general conversation support.
