"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { signupWithGoogle } from '../../lib/api';
import { getFirebaseClientAuth, getGoogleProvider } from '../../lib/config/firebaseClient';

export default function SignupPage() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onGoogleSignup = async () => {
    setError('');
    setSuccess('');

    try {
      setGoogleLoading(true);
      const auth = getFirebaseClientAuth();
      const provider = getGoogleProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const apiResult = await signupWithGoogle(idToken);

      if (typeof window !== 'undefined') {
        localStorage.setItem('museum_auth_user', JSON.stringify(apiResult.user));
      }

      if (apiResult.user.profileCompleted) {
        setSuccess('Account already exists. Signed in successfully.');
        router.push('/');
        return;
      }

      router.push('/profile');
    } catch (err) {
      setError((err as Error).message || 'Google signup failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <div className="w-full rounded-xl border bg-background p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Create Account</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign up to continue booking museum tickets.</p>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

        <button
          type="button"
          onClick={onGoogleSignup}
          disabled={googleLoading}
          className="mb-4 w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900"
        >
          {googleLoading ? 'Connecting Google...' : 'Continue with Google'}
        </button>

        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
