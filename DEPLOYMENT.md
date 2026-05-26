# Deployment & Run Notes

This document lists required steps to run the chatbot engine and Next.js app locally and in production.

## Prerequisites
- Python 3.10+ (for chatbot-engine)
- Node.js 18+ and pnpm/npm (for Next.js client)
- Git

## Important: spaCy model
The chatbot uses spaCy for light NLP utilities. Install the Python package and the English model in the chatbot virtual environment:

PowerShell (from `chatbot-engine`):

```powershell
# create venv if needed
python -m venv .venv
. .\.venv\Scripts\Activate.ps1
# install dependencies
.\.venv\Scripts\python -m pip install -r requirements.txt
# install english model
.\.venv\Scripts\python -m spacy download en_core_web_sm
```

Note: On Unix/macOS activate with `source .venv/bin/activate`.

## Running chatbot-engine (development)

```powershell
cd chatbot-engine
. .\.venv\Scripts\Activate.ps1
python app.py
# Server will run on http://127.0.0.1:5001
```

The server trains ChatterBot ListTrainer on startup (this is fast for the included CSV and canned phrases). Wait for logs: `Museum assistant initialized successfully`.

## Running Next.js app (client)

```bash
cd client
# install deps
pnpm install    # or npm install
# set .env.local with required variables (see README)
pnpm dev        # or npm run dev
```

Key env vars in `.env.local`:
- `NEXT_PUBLIC_API_URL` (default `/api`)
- `MONGODB_URI` (if using local Mongo)
- `JWT_SECRET`
- `CHATBOT_ENGINE_URL` (default `http://localhost:5001`)
- Firebase credentials if using Firebase services

## How the Chat flow works
- The client calls Next.js route `/api/chat/message`.
- The Next.js route calls `src/lib/services/chatService.ts` which proxies to the running chatbot engine at `CHATBOT_ENGINE_URL` (default `http://localhost:5001`).
- The chatbot engine runs Flask and exposes `/chat` and `/reset` endpoints.

## Troubleshooting
- If chatbot returns `Can't find model 'en_core_web_sm'`, ensure you installed the model in the same Python environment used to run `app.py`:
  - Run `.venv\Scripts\python -m spacy download en_core_web_sm`.
- If Next.js cannot reach the chatbot, verify `CHATBOT_ENGINE_URL` is correct and the Flask server is listening.
- Use the health endpoint for quick checks: `GET http://localhost:5001/health` (returns `{status: 'healthy'}` when ready).

## Production
- Do not use Flask dev server in production. Run the chatbot engine under a WSGI server (Gunicorn, uWSGI) or containerize it.
- For Next.js, deploy to Vercel or a Node server using `next start` after building.
- Ensure all server-only env vars are not exposed via `NEXT_PUBLIC_*`.

## Quick test commands

From a machine with both services running:

```bash
# Chat health
curl -s http://localhost:5001/health | jq
# Send message
curl -s -X POST http://localhost:5001/chat -H "Content-Type: application/json" -d '{"message":"I want to sign up","session_id":"test"}' | jq
```

## Notes
- The project already contains fallback logic: if the Next.js chat service cannot reach the chatbot engine, it will return an error; ensure the engine is reachable during integration tests.
- Keep `requirements.txt` and client `package.json` in sync when adding dependencies.
