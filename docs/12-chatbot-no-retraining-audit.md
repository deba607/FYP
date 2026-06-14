# Chatbot No-Retraining Audit And Migration

## 1. Root Cause Analysis

The chatbot originally mixed two sources of truth:

- Firestore/Realtime Database for real app data.
- ChatterBot SQLite training data for museum answers.

That caused stale answers because ChatterBot stored trained statements in local SQLite files such as:

```text
chatbot-engine/museum_bot_firestore.db
chatbot-engine/museum_bot_firestore_next_*.db
chatbot-engine/museum_bot_recovered_*.db
```

When museum records changed in Firebase, previously trained ChatterBot statements did not change unless the bot retrained.

The old flow was:

```text
Firebase
  -> train ChatterBot
  -> answer from local SQLite statements
```

The required flow is now:

```text
User Message
  -> Intent Detection
  -> Firestore Query
  -> Business Logic
  -> Response
```

## 2. Files Modified

```text
chatbot-engine/chatbot/museum_assistant.py
chatbot-engine/chatbot/firestore_chat_service.py
chatbot-engine/chatbot/firestore_repositories.py
chatbot-engine/chatbot/production_intent_detector.py
chatbot-engine/chatbot/response_builder.py
docs/12-chatbot-no-retraining-audit.md
```

## 3. Functions Audited

Retraining or stale-data risk was found in:

```text
MuseumAssistant.__init__
MuseumAssistant.train_bot
MuseumAssistant.train_indian_museums_data
MuseumAssistant.start_firestore_museums_watch
MuseumAssistant.handle_museums_snapshot
MuseumAssistant.schedule_retrain
MuseumAssistant.retrain_from_cached_museums
MuseumAssistant.process_message
```

Automatic retraining has been removed. `train_bot()` and `train_indian_museums_data()` now return immediately and only log that training is skipped.

## 4. Before And After

Before:

```python
self.museums_data = self.load_museums_from_firestore()
self.train_bot()
self.start_firestore_museums_watch()
```

After:

```python
self.chatbot = self._create_chatbot()
self.museums_data = []
self.firestore_chat_service = FirestoreFirstChatbotService()
```

Before:

```python
def handle_museums_snapshot(...):
    self.museums_data = museums
    self.schedule_retrain()
```

After:

```python
# Removed.
# Firestore is queried at request time by FirestoreFirstChatbotService.
```

Before:

```python
trainer = ListTrainer(self.chatbot)
self.train_indian_museums_data(trainer)
```

After:

```python
logger.info("ChatterBot training skipped. Live data is read from Firestore.")
return
```

## 5. New Architecture Diagram

```text
Chat UI
  -> POST /chat
  -> MuseumAssistant.process_message
  -> FirestoreFirstChatbotService.handle
  -> ProductionIntentDetector.detect
  -> Firestore repositories
  -> MuseumService / BookingService / FAQService
  -> ResponseBuilder
  -> JSON response

Fallback only:
  unknown small talk
    -> ChatterBot.get_response
```

## 6. Updated Project Structure

```text
chatbot-engine/
  app.py
  firebase_admin_helper.py
  chatbot/
    museum_assistant.py
    firestore_chat_service.py
    firestore_repositories.py
    production_intent_detector.py
    production_services.py
    response_builder.py
    qr_service.py
    intent_classifier.py
    booking_handler.py
```

## 7. Production Implementation Rules

- Booking queries use Firestore/Realtime booking records, not ChatterBot training.
- Availability queries resolve the museum from Firestore on each request.
- Pricing queries resolve current Firestore `prices` or `price`.
- Museum timings query Firestore `timings`, `openingTime`, `closingTime`, and `closedDays`.
- FAQs query Firestore `faqs`.
- Small talk can fall back to ChatterBot.
- No Firebase snapshot callback retrains ChatterBot.
- No user message triggers ChatterBot training.

## 8. Logging And Debugging Strategy

Log these fields for service actions:

```text
session_id
intent
userId/email
museumId
bookingId
firestore_query_type
success/failure
latency_ms
error_message
```

Use `/training-status` to confirm:

```json
{
  "snapshotEnabled": false,
  "snapshotDisabledReason": "Automatic ChatterBot retraining is disabled; Firestore is queried at request time",
  "isTraining": false
}
```

## 9. Firestore Query Examples

Museum details:

```python
doc = db.collection("museums").document(museum_id).get()
```

Museum by custom ID:

```python
db.collection("museums").where("museum_id", "==", museum_id).limit(1).stream()
```

User booking:

```python
db.collection("bookings").where("userId", "==", user_id).stream()
```

FAQ:

```python
db.collection("faqs").stream()
```

## 10. Migration Plan

1. Stop automatic ChatterBot training at startup.
2. Remove Firestore snapshot retraining.
3. Route service intents through `FirestoreFirstChatbotService`.
4. Query Firestore repositories inside each service action.
5. Keep existing guided booking flow for collecting date/time/visitor fields.
6. Use Firestore pricing/details when creating or validating bookings.
7. Keep ChatterBot only for small talk fallback.
8. Ignore old SQLite training files for live facts.
9. Verify new Firebase changes appear on the next matching query.
10. Add tests for intent routing, Firestore query behavior, and booking ownership.
