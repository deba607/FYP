import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleAuth } from 'google-auth-library';

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

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  loadEnvFile(path.resolve(__dirname, '../.env'));

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey
    },
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });

  const token = await auth.getAccessToken();

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases?databaseId=%28default%29`;
  const body = {
    locationId: 'asia-south1',
    type: 'FIRESTORE_NATIVE'
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  console.log('CREATE_STATUS', response.status);
  console.log(text);
}

main().catch((err) => {
  console.error('CREATE_FAILED', err?.message || String(err));
  process.exit(1);
});
