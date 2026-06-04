# Frontend Sections

## App Shell

Source:

- `client/src/app/layout.tsx`
- `client/src/app/providers.tsx`
- `client/src/app/globals.css`

The root layout sets page metadata, wraps the app in shared providers, and renders the global header and footer around every page.

## Pages

| Route | File | Purpose |
| --- | --- | --- |
| `/` | `client/src/app/page.tsx` | Home page with text reveal, booking block, visual sections, FAQ, and tooltip section. |
| `/about-us` | `client/src/app/about-us/page.tsx` | About/team information. |
| `/features` | `client/src/app/features/page.tsx` | Feature-focused page. |
| `/pricing` | `client/src/app/pricing/page.tsx` | Pricing content. |
| `/contact` | `client/src/app/contact/page.tsx` | Contact form/content. |
| `/login` | `client/src/app/login/page.tsx` | Login UI. |
| `/signup` | `client/src/app/signup/page.tsx` | Registration UI. |
| `/profile` | `client/src/app/profile/page.tsx` | Profile completion and profile management. |
| `/booking` | `client/src/app/booking/page.tsx` | Booking section landing page. |
| `/booking/book-ticket` | `client/src/app/booking/book-ticket/page.tsx` | Standard ticket booking route. |
| `/booking/new` | `client/src/app/booking/new/page.tsx` | Alternate/new booking route. |
| `/booking/chat` | `client/src/app/booking/chat/page.tsx` | Chat-based booking route. |
| `/booking/chatbot` | `client/src/app/booking/chatbot/page.tsx` | Chatbot booking route. |
| `/booking/show` | `client/src/app/booking/show/page.tsx` | Booking lookup/display route. |
| `/booking/show-ticket` | `client/src/app/booking/show-ticket/page.tsx` | Ticket display route. |

## Booking Components

| Component | Purpose |
| --- | --- |
| `client/src/components/booking/BookingBlock.tsx` | Home/booking section callout. |
| `client/src/components/booking/BookTicket.tsx` | Main form booking flow with museum selection, visitor category, date/time, ticket count, Razorpay checkout, and verification. |
| `client/src/components/booking/BookingWithChatBot.tsx` | Chat UI that sends messages to the chatbot API, loads chat history, tracks booking data, and can confirm a booking. |
| `client/src/components/booking/ShowTicket.tsx` | Ticket lookup/display component. |

## Shared UI and Layout Components

The app uses reusable components under:

- `client/src/components/ui`
- `client/src/components/mvpblocks`

Important shared blocks include:

- `header-2.tsx`: global navigation header.
- `footer-4col.tsx`: global footer.
- `hero-1.tsx`, `feature-1.tsx`, `faq-2.tsx`, `team-9.tsx`: page sections.
- `button.tsx`, `input.tsx`, `label.tsx`, `listbox.tsx`, `dropdown-menu.tsx`: base controls.

## Client API Helper

Source: `client/src/lib/api.ts`

The frontend calls all backend routes through this file. It wraps `fetch`, normalizes JSON errors, and exposes helpers for:

- Booking creation and lookup.
- Razorpay order creation and payment verification.
- Chat messages, chat reset, and chat history integration.
- Login, signup, Google auth, profile completion.
- Profile image upload.

