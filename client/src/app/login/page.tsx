"use client";

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { login, signupWithGoogle } from '@/lib/api';
import { getFirebaseClientAuth, getGoogleProvider } from '@/lib/config/firebaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    try {
      setLoading(true);
      const result = await login(email.trim(), password) as {
        token?: string;
        user?: Record<string, unknown>;
      };

      if (typeof window !== 'undefined') {
        if (result.token) {
          localStorage.setItem('museum_auth_token', result.token);
        }
        if (result.user) {
          localStorage.setItem('museum_auth_user', JSON.stringify(result.user));
        }
      }

      setSuccess('Login successful.');
      router.push('/booking');
    } catch (err) {
      setError((err as Error).message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignin = async () => {
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
        router.push('/booking');
        return;
      }

      router.push('/profile');
    } catch (err) {
      setError((err as Error).message || 'Google sign in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <div className="w-full rounded-xl border bg-background p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Sign In</h1>
        <p className="mb-6 text-sm text-muted-foreground">Use your account credentials.</p>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

        <button
          type="button"
          onClick={onGoogleSignin}
          disabled={googleLoading || loading}
          className="mb-4 w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900"
        >
          {googleLoading ? 'Connecting Google...' : 'Continue with Google'}
        </button>

        <div className="mb-4 text-center text-xs text-muted-foreground">or sign in with email</div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          New here?{' '}
          <Link href="/signup" className="text-primary underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
