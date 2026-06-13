import type { User } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import { getFirebaseClientFirestore } from './config/firebaseClient';

export type FirestoreUserRecord = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  photoURL?: string;
  profileCompleted?: boolean;
  role?: string;
};

function fromFirebaseUser(firebaseUser: User): FirestoreUserRecord {
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || '',
    email: firebaseUser.email || '',
    photoURL: firebaseUser.photoURL || '',
    role: 'user',
  };
}

export function subscribeToFirestoreUser(
  firebaseUser: User,
  onUser: (user: FirestoreUserRecord) => void,
  onError?: (error: Error) => void
) {
  const db = getFirebaseClientFirestore();
  let fallbackUnsubscribe: (() => void) | null = null;

  const directUnsubscribe = onSnapshot(
    doc(db, 'users', firebaseUser.uid),
    (snapshot) => {
      if (snapshot.exists()) {
        fallbackUnsubscribe?.();
        fallbackUnsubscribe = null;
        onUser({ id: snapshot.id, ...snapshot.data() });
        return;
      }

      const email = firebaseUser.email?.trim().toLowerCase();
      if (!email) {
        onUser(fromFirebaseUser(firebaseUser));
        return;
      }

      if (!fallbackUnsubscribe) {
        fallbackUnsubscribe = onSnapshot(
          query(collection(db, 'users'), where('email', '==', email), limit(1)),
          (querySnapshot) => {
            const userDoc = querySnapshot.docs[0];
            if (userDoc) {
              onUser({ id: userDoc.id, ...userDoc.data() });
            } else {
              onUser(fromFirebaseUser(firebaseUser));
            }
          },
          (error) => onError?.(error)
        );
      }
    },
    (error) => onError?.(error)
  );

  return () => {
    directUnsubscribe();
    fallbackUnsubscribe?.();
  };
}
