import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';

function loadEnvFile(envPath) {
  const text = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1);

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

async function run() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(__dirname, '../.env');
  loadEnvFile(envPath);

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const firestoreDatabaseId = process.env.FIREBASE_DATABASE_ID?.trim();

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
        ...(databaseURL ? { databaseURL } : {})
      });

  try {
    const firestore = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
    const snap = await firestore.collection('_probe').doc('health').get();
    console.log('FIRESTORE_OK', snap.exists);
  } catch (error) {
    console.log('FIRESTORE_ERR', error instanceof Error ? error.message : String(error));
  }

  try {
    const database = getDatabase(app);
    const ref = database.ref('_probe/health');
    await ref.set({ ts: Date.now() });
    const snap = await ref.get();
    console.log('RTDB_OK', Boolean(snap.val()));
  } catch (error) {
    console.log('RTDB_ERR', error instanceof Error ? error.message : String(error));
  }
}

run();
