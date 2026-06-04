# Booking and Payments

## Booking Model

Source: `client/src/lib/services/bookingService.ts`

Bookings include:

- Generated public `bookingId`, such as `BM...`.
- Firestore document ID exposed as `_id`.
- Visitor details: name, email, phone.
- Visit details: date, time slot, ticket count, visitor type.
- Museum details: ID, name, location, category, price per ticket.
- Payment fields: status, provider, Razorpay order/payment IDs, signature.
- Booking status: `pending`, `confirmed`, or `cancelled`.
- Timestamps: `createdAt`, `updatedAt`.

## Ticket Pricing

Default visitor-type pricing:

| Visitor Type | Price |
| --- | ---: |
| Adult | 200 |
| Child | 100 |
| Senior Citizen | 150 |
| Student | 120 |
| Professor | 180 |
| Researcher/Scientist | 180 |

When a positive museum-specific `pricePerTicket` is provided, the service uses it instead of the default visitor-type price.

## Standard Booking Flow

Source: `client/src/components/booking/BookTicket.tsx`

1. User selects museum, visitor category, date, time slot, and ticket count.
2. Component validates name, email, phone, future/current date, and 1-10 tickets.
3. Frontend calls `/api/payments/razorpay/order`.
4. Razorpay checkout script opens.
5. On successful payment, frontend calls `/api/payments/razorpay/verify`.
6. Verify route checks the Razorpay signature.
7. A paid confirmed booking is created in Firestore and mirrored to Realtime Database.
8. UI shows the generated booking ID and summary.

## Direct Booking Flow

`POST /api/bookings` can create a booking without Razorpay. This is used by chatbot confirmation and can also be used for administrative or test flows.

## Availability

`POST /api/bookings/check-availability` checks confirmed bookings for a time slot and date, then compares total tickets against a fixed capacity of `100`.

## Booking Persistence

Each booking is written to:

- Firestore: `bookings/{documentId}`
- Realtime Database: `bookings/{bookingId}`
- Realtime Database by user, when available: `bookingsByUser/{userId}/{bookingId}`

## Razorpay Configuration

Required environment variables:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

The order route creates an order using Razorpay Basic Auth. The verify route uses HMAC SHA-256 with `RAZORPAY_KEY_SECRET` to validate `razorpayOrderId|razorpayPaymentId`.

