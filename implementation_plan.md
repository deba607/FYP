# Implementation Plan - Chatbot Booking Flow and Localization Fixes

The goal of this plan is to:
1. Ensure the backend chatbot server properly restarts to load recent changes in classification logic.
2. Extend the backend localization logic in `app.py` to translate intermediate booking prompts (Date, Time, Tickets, Visitor Type, Summary) to Hindi, Bengali, and Tamil, preventing them from falling back to the generic fallback message.
3. Validate the booking flow in multiple languages and confirm that the manual and chatbot booking details show correct parameters in the grey confirmation box.

## User Review Required

> [!IMPORTANT]
> The Flask chatbot server (`py app.py`) runs in a production-like setting (`DEBUG=False`, `FLASK_ENV=production`) without a hot-reload watcher. We will terminate the old server process and start a new one to apply the python logic edits.

## Proposed Changes

### Chatbot Backend (`chatbot-engine`)

#### [MODIFY] [app.py](file:///d:/Final%20Year%20Project/FYP/Bharat_Museum_Tickets_Next/chatbot-engine/app.py)
- Update `CHAT_TRANSLATIONS` to add localized strings for:
  - Relative dates (`today`, `tomorrow`)
  - Intermediate prompts (Date prompt, Time prompt, Ticket Count prompt, Visitor Type prompt)
  - Booking summary headers and keys (`museum_label`, `date_label`, `time_label`, `tickets_label`, `type_label`, `total_label`)
- Modify `localize_bot_message` function to check for the intermediate booking prompts and summary, applying the corresponding translations dynamically instead of returning the `"fallback"` translation.

## Verification Plan

### Manual Verification
1. Propose restarting the chatbot Flask backend.
2. Use the browser agent to open the chatbot UI at `http://localhost:3000/booking/chat`.
3. Test the booking flow in English by clicking "Book Tickets" on a museum, confirming that:
   - The location-based museum list dropdown is skipped.
   - The chatbot goes straight to the date selection.
   - The final summary and grey details box display the correct parameters.
4. Test the booking flow in Hindi/Bengali/Tamil to verify that intermediate prompts are properly translated and do not trigger the fallback message.
