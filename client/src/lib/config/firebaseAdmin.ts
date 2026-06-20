import { getApps, cert, initializeApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase, Database } from 'firebase-admin/database';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

let firebaseApp: App | null = null;
let firestoreInstance: Firestore | null = null;
let realtimeDatabaseInstance: Database | null = null;

export function getFirebaseAdminApp() {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (getApps().length > 0) {
    firebaseApp = getApps()[0]!;
    return firebaseApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin environment variables are not fully configured');
  }

  firebaseApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey
    }),
    projectId,
    databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  });

  return firebaseApp;
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseFirestore() {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  const app = getFirebaseAdminApp();
  const databaseId = process.env.FIREBASE_DATABASE_ID?.trim();

  // Apply custom database id (for named Firestore databases) when provided.
  if (databaseId && databaseId !== '(default)') {
    firestoreInstance = getFirestore(app, databaseId);
  } else {
    firestoreInstance = getFirestore(app);
  }

  return firestoreInstance;
}

export function getFirebaseRealtimeDatabase() {
  if (realtimeDatabaseInstance) {
    return realtimeDatabaseInstance;
  }

  const app = getFirebaseAdminApp();

  realtimeDatabaseInstance = getDatabase(app);
  return realtimeDatabaseInstance;
}
