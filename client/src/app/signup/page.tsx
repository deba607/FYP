"use client";

import type { FormEvent } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup } from 'firebase/auth';
import { signup, signupWithGoogle } from '../../lib/api';
import { getFirebaseClientAuth, getGoogleProvider } from '../../lib/config/firebaseClient';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setError('Please fill all required fields.');
      return;
    }

    try {
      setLoading(true);
      await signup({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password
      });

      setSuccess('Account created successfully. You can now sign in.');
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
    } catch (err) {
      setError((err as Error).message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
        router.push('/booking');
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
          disabled={googleLoading || loading}
          className="mb-4 w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-slate-900"
        >
          {googleLoading ? 'Connecting Google...' : 'Continue with Google'}
        </button>

        <div className="mb-4 text-center text-xs text-muted-foreground">or sign up with email</div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Full Name</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>

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
            <label className="mb-1 block text-sm font-medium">Phone</label>
            <input
              type="tel"
              className="w-full rounded-md border px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

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
