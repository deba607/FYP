const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Custom .env parser
try {
  const env = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8');
  env.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = (match[2] || '').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
} catch (e) {
  console.warn('Failed to load .env file:', e.message);
}

async function run() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

  console.log('Using databaseURL:', databaseURL);
  if (!projectId || !clientEmail || !privateKey) {
    console.error('Firebase environment variables are missing');
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    }),
    databaseURL
  });

  const db = admin.database();
  const ref = db.ref('chat_messages');
  const snapshot = await ref.limitToLast(5).once('value');
  const val = snapshot.val();
  console.log('RTDB chat_messages:', JSON.stringify(val, null, 2));

  process.exit(0);
}

run().catch(console.error);
