# Chatbot Full-Service Actions

## Goal

The chatbot supports the complete visitor service path:

- Guest services: sign up, sign in, help, museum search, museum details, prices, timings, and discounts.
- Logged-in services: book tickets, confirm payment, show all user tickets, and show one ticket by Booking ID.

Guests can open the chatbot. Private actions return an auth-required response until the user signs in.

## Auth Flow

The chatbot engine uses the Next.js auth APIs:

- `POST /api/auth/signup`
- `POST /api/auth/login`

On success the engine returns:

```json
{
  "action": { "type": "auth_success" },
  "auth_result": {
    "token": "app-token",
    "firebaseCustomToken": "firebase-custom-token",
    "user": {}
  }
}
```

The React chatbot stores the app token, stores `museum_auth_user`, signs into Firebase with the custom token, and switches to logged-in mode.

Password-like signup/signin messages are redacted before chat/activity logging.

## Structured Chat Actions

The engine can return these frontend actions:

```json
{ "type": "auth_success" }
{ "type": "auth_required" }
{ "type": "show_my_tickets" }
{ "type": "show_ticket_by_id", "bookingId": "BM..." }
```

Ticket rendering stays in the React app. This keeps private ticket reads behind Firebase-authenticated Next.js APIs.

## Ticket Security

`show_my_tickets` and `show_ticket_by_id` both use:

```text
GET /api/bookings/user/my-bookings
```

The response includes only tickets owned by the logged-in user, matched by Firebase UID or the user's email fallback. A typed booking ID is filtered from that private result set, so another user's ticket is not exposed.

## Supported Commands

Examples:

- `help`
- `sign up`
- `login`
- `museums in Kolkata`
- `details of Indian Museum`
- `Indian Museum`
- `book ticket for Indian Museum`
- `confirm booking`
- `show my tickets`
- `show ticket BM123456789`
- `ticket status BM123456789`

## Booking And QR

## Museum Selection During Booking

The booking flow must always have `museum_details` before collecting date, time, visitor category, or ticket count.

Booking behavior:

- If the user says only `book ticket`, the bot asks for a museum name or city/location.
- If the user gives a museum name, the bot resolves that museum from Firestore and stores `museum_name`, `museum_location`, `museum_state`, `museum_id`, `museum_category`, and pricing in `booking_data`.
- If the user gives a location, such as `book ticket in Kolkata`, the bot searches Firestore museums for that location.
- If one museum matches, it is selected automatically.
- If multiple museums match, the bot returns a numbered choice list and waits for the user to choose the museum.
- The booking handler runs only after a museum has been selected.
- The React confirmation form re-checks the selected museum before payment. If only a museum ID/name is present, it refreshes `/api/museums` and fills the missing location/category.
- The Razorpay/demo payment order and verify APIs reject bookings without `museumName` and `museumLocation`.

This keeps Firestore as the source of truth and prevents bookings from being created with missing museum name/location.

## Museum Query Handling

Plain museum names are treated as museum-detail queries. For example, `Indian Museum` should resolve the museum from Firestore and return its location, state, category, price, and description.

Location search is normalized before querying Firestore. Extra words such as `in`, `the`, `city`, and `museums` are removed, so messages like `in the Kolkata` still search for `Kolkata`.

The intent classifier must match location/list words as whole words only. This prevents `Indian Museum` from being misread as a `museums in ...` query just because `indian` contains the letters `in`.

After booking confirmation, the frontend creates the QR from the public `bookingId`. The same QR value works with the controller scanner because validation uses:

```text
POST /api/bookings/validate-ticket
body.ticketId = bookingId
```
