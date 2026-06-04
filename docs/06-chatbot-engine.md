# Chatbot Engine

## Location

Source directory: `chatbot-engine/`

The chatbot engine is a Flask service that handles conversational museum information, signup/signin prompts, ticket search, ticket booking, and session reset.

## Flask Endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Returns healthy/unhealthy based on assistant initialization. |
| `POST` | `/chat` | Processes a message for a session and returns response, intent, and booking data. |
| `POST` | `/reset` | Clears a session from the assistant memory. |

## Main Files

| File | Purpose |
| --- | --- |
| `chatbot-engine/app.py` | Flask app, validation, CORS, logging, endpoint definitions, chat log persistence attempts. |
| `chatbot-engine/chatbot/museum_assistant.py` | Assistant orchestration, ChatterBot setup, CSV loading, training, session flows, museum search. |
| `chatbot-engine/chatbot/intent_classifier.py` | Keyword-based intent detection. |
| `chatbot-engine/chatbot/booking_handler.py` | Step-by-step booking field extraction and validation. |
| `chatbot-engine/firebase_admin_helper.py` | Firebase RTDB helper for chat logging. |
| `chatbot-engine/chatbot/indian museum dataset.csv` | Museum data source used for search and training. |

## Message Flow

1. Client calls `/api/chat/message` in the Next.js app.
2. Next.js forwards the message to `CHATBOT_ENGINE_URL/chat`.
3. Flask validates JSON body, message length, and session ID.
4. `MuseumAssistant.process_message()` classifies intent.
5. The assistant either handles an active flow or falls back to ChatterBot.
6. The response includes `response`, `intent`, and `booking_data`.
7. Chat logs are stored through Firebase RTDB or forwarded to the Next.js store route.

## Supported Intents

- `book_ticket`
- `signup`
- `signin`
- `confirm_booking`
- `payment`
- `search_ticket`
- `check_availability`
- `pricing`
- `museum_info`
- `discount`
- `general`

## Booking Conversation

The booking handler collects:

- Date.
- Time slot.
- Number of tickets.
- Visitor type.

When complete, the assistant marks `booking_data.ready_to_confirm = true`. The React chatbot component can then collect name, email, and phone, and call the booking API.

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Flask port, defaults to `5001`. |
| `DEBUG` | Enables debug mode when truthy. |
| `FLASK_ENV` | Development mode can enable debug. |
| `CHATBOT_API_URL` | Next.js app base URL for auth, bookings, and chat-store fallback. |

The Next.js app uses `CHATBOT_ENGINE_URL`, defaulting to `http://localhost:5001`, to call the Flask service.

