# Chatbot Profile Prefill Booking

## Goal

The chatbot booking confirmation form should use the logged-in user's saved profile details automatically. It should only ask for details that are missing from the profile.

## Behavior

- The chatbot reads profile data from `museum_auth_user` in local storage.
- It also falls back to the active Firebase user for display name and email.
- Saved `name`, `email`, and `phone` are used silently in the booking payload.
- The confirmation form renders only missing required fields:
  - If name is saved, do not show the full name input.
  - If email is saved, do not show the email input.
  - If phone is saved, do not show the phone input.
- If all three fields exist in the profile, the user only sees the visit and ticket summary plus the confirm button.

## Validation

The final booking still requires:

- name
- email
- phone

Validation uses profile values first, then any typed values for missing fields. Razorpay/demo payment prefill and booking creation use the same resolved details.
