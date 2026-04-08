import { getApps, cert, initializeApp, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let firebaseApp: App | null = null;
let firestoreInstance: Firestore | null = null;

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
    projectId
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

  // Firestore `getFirestore()` does not accept a second `databaseId` argument
  // in the current firebase-admin types, so always initialize with the app.
  firestoreInstance = getFirestore(getFirebaseAdminApp());

  return firestoreInstance;
}
