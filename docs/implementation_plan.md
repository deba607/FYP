# Implementation Plan - Chatbot Razorpay Payment Integration

This plan details the technical steps to integrate Razorpay payment support into the chatbot. Once implemented, confirming a ticket reservation in the chatbot will open the Razorpay payment modal, complete the payment check, and confirm the booking, identical to the standard ticket booking page.

## Proposed Changes

### Frontend Component

#### [MODIFY] [BookingWithChatBot.tsx](file:///d:/Final+Year+Project/FYP/Bharat_Museum_Tickets_Next/client/src/components/booking/BookingWithChatBot.tsx)
- **Import Payment APIs**: Add `createRazorpayOrder` and `verifyRazorpayPayment` to the imports from `../../lib/api`.
- **Add Script Loader Helper**: Add the `loadRazorpayScript()` helper function to dynamically import Razorpay's checkout script.
- **Refactor `confirmBooking`**:
  - Build the booking payload containing user contact info, date, time slot, tickets, museum details, and `visitorCombo`.
  - Call `createRazorpayOrder` to obtain the Razorpay order ID and key ID.
  - Load the Razorpay script and open the checkout modal using new `window.Razorpay` instance.
  - Upon successful payment authorization, invoke `verifyRazorpayPayment` with payment details to verify signature and persist the confirmed booking.
  - Render the final confirmation text (including the generated `bookingId`) in the chat messages list upon verification.
  - Display error alerts in the chat messages list if payment is cancelled or failed.

## Verification Plan

### Automated Verification
- Verify code compiles successfully using `npm run build` in the client directory.

### Manual Verification
1. Run the local servers (`npm run dev` and `py app.py`).
2. Interact with the chatbot to select date, time, tickets, and visitor categories.
3. Click "Confirm Booking" in the sidebar form.
4. Verify the Razorpay payment modal opens up.
5. complete a test payment.
6. Verify the payment is verified successfully and the confirmation receipt message displays in the chatbot logs.
