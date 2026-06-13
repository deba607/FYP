import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

let firebaseClientApp: FirebaseApp | null = null;

function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error('Firebase client environment variables are not fully configured');
  }

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  };
}

export function getFirebaseClientApp() {
  if (firebaseClientApp) {
    return firebaseClientApp;
  }

  firebaseClientApp = getApps().length ? getApp() : initializeApp(getFirebaseConfig());
  return firebaseClientApp;
}

export function getFirebaseClientAuth() {
  return getAuth(getFirebaseClientApp());
}

export function getFirebaseClientFirestore() {
  return getFirestore(getFirebaseClientApp());
}

export function getFirebaseClientRealtimeDatabase() {
  return getDatabase(getFirebaseClientApp());
}

export function getGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}
