"use client";

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import Image from 'next/image';
import { completeProfile, uploadProfileImage } from '../../lib/api';
import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';

type StoredUser = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  photoURL?: string;
  profileCompleted?: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [photoChanged, setPhotoChanged] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedUserRaw = localStorage.getItem('museum_auth_user');
    const auth = getFirebaseClientAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsGoogleAuthenticated(Boolean(user));
      if (user?.email) {
        setEmail(user.email);
      }
      if (user?.displayName) {
        setName((prev) => prev || user.displayName || '');
      }
      if (user?.photoURL) {
        setPhotoURL((prev) => prev || user.photoURL || '');
      }
    });

    if (storedUserRaw) {
      try {
        const storedUser = JSON.parse(storedUserRaw) as StoredUser;
        setName(storedUser.name || '');
        setEmail(storedUser.email || '');
        setPhone(storedUser.phone || '');
        setDateOfBirth(storedUser.dateOfBirth || '');
        setAddress(storedUser.address || '');
        setPhotoURL(storedUser.photoURL || '');
      } catch {
        // Ignore malformed local storage user payload.
      }
    }

    return () => unsubscribe();
  }, []);

  const onSelectImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setSuccess('');

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setUploadingImage(true);
      const result = await uploadProfileImage(file);
      setPhotoURL(result.imageUrl);
      setPhotoChanged(true);
      // Update localStorage so other UI (navbar) can reflect the new avatar immediately
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('museum_auth_user');
          const stored = raw ? JSON.parse(raw) : {};
          stored.photoURL = result.imageUrl;
          localStorage.setItem('museum_auth_user', JSON.stringify(stored));
          // notify other components in same tab
          window.dispatchEvent(new Event('user_profile_updated'));
        } catch {
          // ignore localStorage errors
        }
      }
      setSuccess('Profile image uploaded successfully. Save profile to persist changes.');
    } catch (err) {
      setError((err as Error).message || 'Image upload failed.');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const onRemoveImage = () => {
    setPhotoURL('');
    setPhotoChanged(true);
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('museum_auth_user');
        const stored = raw ? JSON.parse(raw) : {};
        stored.photoURL = '';
        localStorage.setItem('museum_auth_user', JSON.stringify(stored));
        window.dispatchEvent(new Event('user_profile_updated'));
      } catch {
        // ignore
      }
    }
    setSuccess('Profile image removed. Save profile to persist changes.');
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const firebaseUser = getFirebaseClientAuth().currentUser;
    if (!firebaseUser) {
      setError('Please sign in with Google first.');
      return;
    }

    if (!phone.trim()) {
      setError('Phone number is required.');
      return;
    }

    if (password && password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password && password !== confirmPassword) {
      setError('Password and confirm password do not match.');
      return;
    }

    try {
      setLoading(true);
      const firebaseIdToken = await firebaseUser.getIdToken();
      const result = await completeProfile(
        {
          name: name.trim(),
          phone: phone.trim(),
          dateOfBirth,
          address: address.trim(),
          photoURL: photoChanged ? photoURL : undefined,
          password: password || undefined
        },
        firebaseIdToken
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem('museum_auth_user', JSON.stringify(result.user));
      }

      setSuccess('Profile completed successfully. Redirecting to booking...');
      setTimeout(() => {
        router.push('/booking');
      }, 1200);
    } catch (err) {
      setError((err as Error).message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-10">
      <div className="w-full rounded-xl border bg-background p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Complete Your Profile</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Finish your details to continue with museum ticket booking.
        </p>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Profile Image</label>
            <div className="mb-2 flex items-center gap-4">
              {photoURL ? (
                <Image
                  src={photoURL}
                  alt="Profile preview"
                  width={72}
                  height={72}
                  className="h-18 w-18 rounded-full border object-cover"
                />
              ) : (
                <div className="h-18 w-18 rounded-full border bg-slate-100" />
              )}

              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={onSelectImage}
                  disabled={uploadingImage}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">PNG/JPG up to 5MB. Uploaded to Cloudinary.</p>
                {photoURL && (
                  <button
                    type="button"
                    onClick={onRemoveImage}
                    className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Remove Image
                  </button>
                )}
              </div>
            </div>
          </div>

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
              className="w-full rounded-md border bg-slate-50 px-3 py-2"
              value={email}
              readOnly
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
            <label className="mb-1 block text-sm font-medium">Date of Birth</label>
            <input
              type="date"
              className="w-full rounded-md border px-3 py-2"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Address</label>
            <textarea
              className="w-full rounded-md border px-3 py-2"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your city and address"
              rows={3}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Set Password (optional)</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Set a password for email login"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Confirm Password</label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || uploadingImage || !isGoogleAuthenticated}
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            {loading ? 'Saving profile...' : 'Save and continue'}
          </button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Need another account?{' '}
          <Link href="/signup" className="text-primary underline">
            Go to sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
