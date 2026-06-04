# Project Overview

## Purpose

Bharat Museum Tickets is a museum ticketing platform with:

- Public-facing pages for museum information, pricing, contact, and team/about content.
- User authentication with password and Google sign-in.
- Ticket booking with museum selection, visitor categories, date/time slots, Razorpay payment, and booking confirmation.
- Chatbot-assisted museum information and booking.
- Firebase Firestore and Realtime Database persistence.
- IoT ticket validation flows for Raspberry Pi and optional ESP32 devices.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `client/` | Next.js 15 app with React 19, API routes, Firebase Admin/client configuration, booking UI, auth UI, and shared components. |
| `chatbot-engine/` | Flask service exposing `/health`, `/chat`, and `/reset`; uses ChatterBot and local CSV museum data. |
| `iot/` | Python and MicroPython implementations for QR scanning, backend validation, and gate control. |
| `scripts/` | Utility scripts, including CSV-to-public-museum JSON generation. |
| `firestore.rules` | Firestore access rules. |
| `firebase.json` | Firebase project config. |
| Root `*.md` files | Existing setup, deployment, integration, migration, and production notes. |

## Runtime Architecture

1. Browser users interact with pages in `client/src/app`.
2. Client components call helpers in `client/src/lib/api.ts`.
3. Next.js API routes in `client/src/app/api` run on Node.js and call service modules.
4. Firebase Admin services store users, bookings, chat logs, and profile data.
5. Razorpay routes create and verify payment orders before a paid booking is persisted.
6. Chat UI calls the Next.js chat API, which forwards messages to the Flask chatbot engine.
7. IoT devices scan ticket QR payloads and call a backend validation endpoint.

## Important Dependencies

| Area | Key Packages |
| --- | --- |
| Next app | `next`, `react`, `typescript`, `tailwindcss`, `lucide-react`, `framer-motion` |
| Firebase | `firebase`, `firebase-admin`, `@google-cloud/firestore` |
| Auth | `bcryptjs`, `jsonwebtoken`, Firebase Auth |
| Payments | Razorpay HTTP API and checkout script |
| Chatbot | Flask, ChatterBot, CSV museum data |
| IoT | `opencv-python`, `pyzbar`, optional MQTT/HTTP clients |

## Development Entry Points

- Next app: `cd client && npm run dev`
- Next build: `cd client && npm run build`
- Next lint: `cd client && npm run lint`
- Chatbot engine: `cd chatbot-engine && python app.py`
- Raspberry Pi device: `cd iot && python -m raspberry_pi.main`

