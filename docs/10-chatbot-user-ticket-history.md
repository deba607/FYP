# Chatbot User Ticket History Logic

## Goal

When a user is logged in and opens the chatbot, the chatbot must be able to show only that user's tickets.

Each ticket shown in chat includes:

- Booking ID
- QR code for gate scanning
- Museum name and location
- Visit date and time slot
- Ticket count and visitor category
- Payment amount
- Active or expired status
- Latest gate action: `entry`, `exit`, `denied`, or `not_scanned`
- Latest scan message, scan time, and controller device name when available

## Data Sources

Bookings are read from Firebase Realtime Database:

- `bookings/{bookingId}`
- `bookingsByUser/{userId}/{bookingId}`

Gate actions are read from Firebase Realtime Database:

- `scan_logs/{scanLogId}`

The chatbot user identity comes from Firebase Auth. The frontend sends the Firebase ID token to:

- `GET /api/bookings/user/my-bookings`

The API also accepts the logged-in email as a fallback query value so older bookings that were saved without `userId` can still be matched by email.

## Ticket Ownership

The API returns tickets for the authenticated user when either condition is true:

1. The booking exists under `bookingsByUser/{firebaseUid}`.
2. The booking email matches the logged-in user's email.

This keeps new bookings linked by `userId` while still showing older email-only bookings.

## Expiry Logic

A ticket is marked expired when:

```text
booking.visitDate < today's date in Asia/Kolkata
```

If the visit date is today or in the future, the ticket is shown as active.

## Gate Action Logic

The latest scan log for the booking decides the displayed gate action:

```text
message contains "exit" => exit
outcome is "granted"   => entry
outcome is "denied"    => denied
no scan log            => not_scanned
```

The current controller validation flow records successful ticket validation as an entry action. If an exit scanner is added later, writing scan log messages containing `exit` will make the chatbot show `Exit recorded`.

## QR Logic

The QR code value is always the public `bookingId`.

The controller dashboard already validates scanned values through:

```text
POST /api/bookings/validate-ticket
body.ticketId = bookingId
```

So the same QR works for chatbot tickets, normal booking tickets, email tickets, and the controller scanner.

## Chatbot Behavior

The chatbot header has a `My Tickets` button.

When clicked:

1. The frontend gets the Firebase ID token for the logged-in user.
2. It calls `/api/bookings/user/my-bookings`.
3. The API returns only that user's ticket history.
4. The chatbot renders each ticket inside the chat with QR, status, and gate action details.

If the user is not authenticated, the chatbot asks the user to login again.
