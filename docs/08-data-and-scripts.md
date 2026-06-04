# Data and Scripts

## Museum Data

| File | Purpose |
| --- | --- |
| `chatbot-engine/chatbot/indian museum dataset.csv` | Source CSV for chatbot training and museum search. |
| `chatbot-engine/chatbot/museum_training_normalized.csv` | Normalized training data. |
| `client/public/museums.json` | Public museum list consumed by the booking UI. |

The booking form first uses an embedded fallback museum list, then attempts to load `/museums.json` and replace the list with public data.

## Data Generation

Source: `scripts/generate_museums_json.py`

This script converts museum CSV data into JSON for the frontend public folder. Use it when museum CSV data changes and the booking UI needs the latest public museum list.

## Client Utility Scripts

| File | Purpose |
| --- | --- |
| `client/scripts/firebase_probe.mjs` | Probes Firebase connectivity/configuration. |
| `client/scripts/firestore_admin_probe.mjs` | Probes Firestore Admin access. |
| `client/scripts/firestore_create_default.mjs` | Creates or verifies default Firestore setup data. |
| `client/scripts/convert-alias-imports.js` | Converts alias imports. |
| `client/scripts/fix-import-slashes.cjs` | Fixes import slash formatting. |

## Firebase Files

| File | Purpose |
| --- | --- |
| `firebase.json` | Firebase project config. |
| `firestore.rules` | Firestore security rules. |
| `firestore.indexes.json` | Firestore indexes. |
| `deploy-rules.ps1` | PowerShell helper for deploying Firebase rules. |

## Existing Root Documentation

The repository already includes setup and operational guides:

- `SETUP_GUIDE.md`
- `DEPLOYMENT.md`
- `PRODUCTION_CHECKLIST.md`
- `FIREBASE_SETUP.md`
- `FIREBASE_CONSOLE_SETUP.md`
- `FIRESTORE_SETUP_GUIDE.md`
- `DATABASE_MIGRATION.md`
- `CHATBOT_INTEGRATION.md`
- `CHATBOT_BOOKING_GUIDE.md`
- `USER_REGISTRATION_FLOW.md`

The new `docs/` files focus on codebase sections and source responsibilities, while the root docs remain useful for setup and deployment instructions.

