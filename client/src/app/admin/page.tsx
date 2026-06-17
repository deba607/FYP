"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CalendarClock,
  CheckCircle2,
  IndianRupee,
  Loader2,
  Search,
  Shield,
  ShieldAlert,
  Ticket,
  Trash2,
  Users,
  RefreshCw,
  Landmark,
  Sparkles,
  Upload,
  Edit,
  Eye,
  EyeOff
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminSidebar } from '../../components/ui/admin-sidebar';
import { DashboardCard } from '../../components/ui/dashboard-card';
import { DashboardHeader } from '../../components/ui/dashboard-header';
import { RevenueChart } from '../../components/ui/revenue-chart';
import { SidebarInset, SidebarProvider } from '../../components/ui/sidebar';
import { getFirebaseClientFirestore, getFirebaseClientRealtimeDatabase, getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import { collection, query as firestoreQuery, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { ref, onValue, query as databaseQuery, orderByChild, limitToLast } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { subscribeToFirestoreUser } from '../../lib/firestoreUser';

type Booking = {
  id?: string;
  _id: string;
  bookingId: string;
  userId?: string | null;
  name: string;
  email: string;
  phone: string;
  visitDate: string;
  timeSlot: string;
  numberOfTickets: number;
  visitorType: string;
  totalAmount: number;
  museumName?: string | null;
  museumLocation?: string | null;
  museumCategory?: string | null;
  paymentStatus?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | string;
  createdAt: string;
};

type StoredUser = {
  name?: string;
  email?: string;
  role?: 'user' | 'admin' | string;
};

type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'user' | 'admin' | string;
  authProvider: 'password' | 'google' | string;
  profileCompleted: boolean;
  dateOfBirth?: string;
  address?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
};

type HealthState = 'checking' | 'healthy' | 'error';

const statusOptions = ['pending', 'confirmed', 'cancelled'] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function statusClass(status: string) {
  if (status === 'confirmed') return 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300';
  if (status === 'cancelled') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300';
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300';
}

function activityCategoryClass(category: string) {
  switch (category) {
    case 'Auth':
      return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300';
    case 'Profile':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300';
    case 'Booking':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300';
    case 'Payment':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300';
    case 'Chat':
      return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-300';
    case 'Scan':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300';
    case 'Navigation':
      return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300';
    case 'Interaction':
      return 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-300';
    default:
      return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  }
}

function formatDateTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function readStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem('museum_auth_user');
    return raw ? JSON.parse(raw) as StoredUser : null;
  } catch {
    return null;
  }
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<HealthState>('checking');
  const [user, setUser] = useState<StoredUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);

  // ── User management state ──
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [userQuery, setUserQuery] = useState('');

  // ── Museum management state ──
  const [museumsList, setMuseumsList] = useState<any[]>([]);
  const [museumsLoading, setMuseumsLoading] = useState(false);
  const [museumsError, setMuseumsError] = useState('');
  const [museumsSuccess, setMuseumsSuccess] = useState('');

  // Registration form fields state
  const [museumName, setMuseumName] = useState('');
  const [museumLocation, setMuseumLocation] = useState('');
  const [museumState, setMuseumState] = useState('');
  const [museumCategory, setMuseumCategory] = useState('');
  const [museumPrice, setMuseumPrice] = useState(200); // base price compat
  const [museumDescription, setMuseumDescription] = useState('');
  const [museumImageUrl, setMuseumImageUrl] = useState('');

  // Category pricing states
  const [priceAdult, setPriceAdult] = useState(200);
  const [priceChild, setPriceChild] = useState(100);
  const [priceSenior, setPriceSenior] = useState(150);
  const [priceStudent, setPriceStudent] = useState(120);
  const [priceProfessor, setPriceProfessor] = useState(180);
  const [priceResearcher, setPriceResearcher] = useState(180);

  // Login credentials states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form mode tracking
  const [formMode, setFormMode] = useState<'register' | 'edit'>('register');
  const [editingId, setEditingId] = useState('');

  // OTP Verification states for Museum Registration
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [originalEmail, setOriginalEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');

  // AI Image upload and analysis state
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [, setAnalysisWarning] = useState('');

  const loadMuseumsList = useCallback(async () => {
    setMuseumsSuccess('Real-time museum sync active.');
    setTimeout(() => setMuseumsSuccess(''), 3000);
  }, []);

  const resetMuseumForm = () => {
    setMuseumName('');
    setMuseumLocation('');
    setMuseumState('');
    setMuseumCategory('');
    setMuseumPrice(200);
    setPriceAdult(200);
    setPriceChild(100);
    setPriceSenior(150);
    setPriceStudent(120);
    setPriceProfessor(180);
    setPriceResearcher(180);
    setMuseumDescription('');
    setMuseumImageUrl('');
    setLoginEmail('');
    setLoginPassword('');
    setConfirmPassword('');
    setShowAdminPassword(false);
    setShowConfirmPassword(false);
    setOriginalEmail('');
    setIsEmailVerified(false);
    setIsOtpSent(false);
    setOtpCode('');
    setOtpError('');
    setOtpSuccess('');
    setFormMode('register');
    setEditingId('');
  };

  const handleSendOtp = async () => {
    if (!loginEmail.trim() || !loginEmail.includes('@') || !loginEmail.includes('.')) {
      setOtpError('Please enter a valid email address.');
      return;
    }

    setOtpLoading(true);
    setOtpError('');
    setOtpSuccess('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), purpose: 'registration' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to send verification code.');
      }
      setIsOtpSent(true);
      setOtpSuccess(data.message || 'Verification code sent successfully.');
    } catch (err) {
      setOtpError((err as Error).message || 'Failed to send verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setOtpError('Please enter a valid 6-digit verification code.');
      return;
    }

    setOtpLoading(true);
    setOtpError('');
    setOtpSuccess('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail.trim(), otp: otpCode.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Invalid verification code.');
      }
      setIsEmailVerified(true);
      setIsOtpSent(false);
      setOtpCode('');
      setOtpSuccess('Email verified successfully!');
    } catch (err) {
      setOtpError((err as Error).message || 'Invalid verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRegisterMuseum = async (e: React.FormEvent) => {
    e.preventDefault();
    setMuseumsError('');
    setMuseumsSuccess('');

    if (!museumName.trim() || !museumLocation.trim() || !museumState.trim()) {
      setMuseumsError('Museum Name, Location, and State are required fields.');
      return;
    }

    // Validate login credentials during registration
    if (loginEmail.trim()) {
      if (!isEmailVerified) {
        setMuseumsError('Please verify the supervisor login email address using the verification code before registering.');
        return;
      }
      if (!loginPassword || !confirmPassword) {
        setMuseumsError('Password and Confirm Password are required to create a museum login account.');
        return;
      }
      if (loginPassword !== confirmPassword) {
        setMuseumsError('Passwords do not match.');
        return;
      }
      if (loginPassword.length < 8) {
        setMuseumsError('Password must be at least 8 characters long.');
        return;
      }
      if (!loginEmail.includes('@') || !loginEmail.includes('.')) {
        setMuseumsError('Please enter a valid email address for Login ID.');
        return;
      }
    }

    try {
      setMuseumsLoading(true);
      const res = await fetch('/api/museums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: museumName,
          location: museumLocation,
          state: museumState,
          category: museumCategory,
          description: museumDescription,
          imageUrl: museumImageUrl,
          loginEmail: loginEmail.trim() || undefined,
          loginPassword: loginPassword || undefined,
          prices: {
            Adult: Number(priceAdult),
            Child: Number(priceChild),
            'Senior Citizen': Number(priceSenior),
            Student: Number(priceStudent),
            Professor: Number(priceProfessor),
            'Researcher/Scientist': Number(priceResearcher)
          }
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to register museum');
      }

      setMuseumsSuccess(`Museum "${museumName}" registered successfully!`);
      resetMuseumForm();
      void loadMuseumsList();
    } catch (err) {
      setMuseumsError((err as Error).message || 'Failed to register museum.');
    } finally {
      setMuseumsLoading(false);
    }
  };

  const handleUpdateMuseum = async (e: React.FormEvent) => {
    e.preventDefault();
    setMuseumsError('');
    setMuseumsSuccess('');

    if (!museumName.trim() || !museumLocation.trim() || !museumState.trim()) {
      setMuseumsError('Museum Name, Location, and State are required fields.');
      return;
    }

    // Validate login credentials if provided/updated
    if (loginEmail.trim()) {
      if (!loginEmail.includes('@') || !loginEmail.includes('.')) {
        setMuseumsError('Please enter a valid email address for Login ID.');
        return;
      }
      const isEmailChanged = loginEmail.trim().toLowerCase() !== originalEmail.toLowerCase();
      if (isEmailChanged && !isEmailVerified) {
        setMuseumsError('Please verify the new supervisor login email address using the verification code before updating.');
        return;
      }
    }

    if (loginPassword || confirmPassword) {
      if (loginPassword !== confirmPassword) {
        setMuseumsError('Passwords do not match.');
        return;
      }
      if (loginPassword.length < 8) {
        setMuseumsError('Password must be at least 8 characters long.');
        return;
      }
    }

    try {
      setMuseumsLoading(true);
      const res = await fetch(`/api/museums/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: museumName,
          location: museumLocation,
          state: museumState,
          category: museumCategory,
          description: museumDescription,
          imageUrl: museumImageUrl,
          loginEmail: loginEmail.trim() || undefined,
          loginPassword: loginPassword || undefined,
          prices: {
            Adult: Number(priceAdult),
            Child: Number(priceChild),
            'Senior Citizen': Number(priceSenior),
            Student: Number(priceStudent),
            Professor: Number(priceProfessor),
            'Researcher/Scientist': Number(priceResearcher)
          }
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to update museum');
      }

      setMuseumsSuccess(`Museum "${museumName}" updated successfully!`);
      resetMuseumForm();
      void loadMuseumsList();
    } catch (err) {
      setMuseumsError((err as Error).message || 'Failed to update museum.');
    } finally {
      setMuseumsLoading(false);
    }
  };

  const loadMuseumToForm = (museum: any) => {
    setMuseumsError('');
    setMuseumsSuccess('');
    setFormMode('edit');
    setEditingId(museum.id);

    setMuseumName(museum.name || '');
    setMuseumLocation(museum.location || '');
    setMuseumState(museum.state || '');
    setMuseumCategory(museum.category || '');
    setMuseumDescription(museum.description || '');
    setMuseumImageUrl(museum.imageUrl || '');
    setLoginEmail(museum.loginEmail || '');
    setOriginalEmail(museum.loginEmail || '');
    setIsEmailVerified(!!museum.loginEmail);
    setIsOtpSent(false);
    setOtpCode('');
    setOtpError('');
    setOtpSuccess('');
    setLoginPassword('');
    setConfirmPassword('');
    setShowAdminPassword(false);
    setShowConfirmPassword(false);

    const prices = museum.prices || {};
    const base = Number(museum.price ?? 200);
    setPriceAdult(Number(prices.Adult ?? base));
    setPriceChild(Number(prices.Child ?? Math.round(base * 0.5)));
    setPriceSenior(Number(prices["Senior Citizen"] ?? Math.round(base * 0.75)));
    setPriceStudent(Number(prices.Student ?? Math.round(base * 0.6)));
    setPriceProfessor(Number(prices.Professor ?? Math.round(base * 0.9)));
    setPriceResearcher(Number(prices["Researcher/Scientist"] ?? Math.round(base * 0.9)));

    // Scroll smoothly to form header
    const formHeader = document.getElementById('museum-details-form-header');
    if (formHeader) {
      formHeader.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDeleteMuseum = async (id: string, name: string) => {
    const ok = window.confirm(`Delete museum "${name}"? This cannot be undone.`);
    if (!ok) return;

    setMuseumsError('');
    setMuseumsSuccess('');

    try {
      setMuseumsLoading(true);
      const res = await fetch(`/api/museums/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to delete museum');
      }

      setMuseumsSuccess(`Museum "${name}" deleted successfully.`);
      if (editingId === id) {
        resetMuseumForm();
      }
      void loadMuseumsList();
    } catch (err) {
      setMuseumsError((err as Error).message || 'Failed to delete museum.');
    } finally {
      setMuseumsLoading(false);
    }
  };

  const handleImageAnalyze = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMuseumsError('');
    setMuseumsSuccess('');
    setAnalyzingImage(true);
    setAnalysisWarning('');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch('/api/admin/museums/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            mimeType: file.type
          })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data?.success) {
          throw new Error(data?.message || 'AI Image analysis failed');
        }

        const { attributes } = data;

        // Auto-fill form fields
        setMuseumName(attributes.name || '');
        setMuseumLocation(attributes.location || '');
        setMuseumState(attributes.state || '');
        setMuseumCategory(attributes.category || '');
        setMuseumDescription(attributes.description || '');
        
        const extractedPrices = attributes.prices || {};
        setPriceAdult(Number(extractedPrices.Adult ?? 200));
        setPriceChild(Number(extractedPrices.Child ?? 100));
        setPriceSenior(Number(extractedPrices["Senior Citizen"] ?? 150));
        setPriceStudent(Number(extractedPrices.Student ?? 120));
        setPriceProfessor(Number(extractedPrices.Professor ?? 180));
        setPriceResearcher(Number(extractedPrices["Researcher/Scientist"] ?? 180));
        
        setMuseumsSuccess('AI successfully extracted museum attributes from the image!');
      } catch (err) {
        setMuseumsError((err as Error).message || 'Failed to analyze image.');
      } finally {
        setAnalyzingImage(false);
      }
    };
    reader.onerror = () => {
      setMuseumsError('Failed to read image file.');
      setAnalyzingImage(false);
    };
    reader.readAsDataURL(file);
  };

  // ── Museum filtering state ──
  const [selectedMuseum, setSelectedMuseum] = useState('All Museums');

  const museumOptions = useMemo(() => {
    const names = bookings
      .map((b) => b.museumName)
      .filter((name): name is string => Boolean(name));
    return ['All Museums', ...Array.from(new Set(names))];
  }, [bookings]);

  const isAdmin = user?.role === 'admin';
  const userRole = user?.role;

  useEffect(() => {
    setUser(readStoredUser());
    setAuthChecked(true);

    const auth = getFirebaseClientAuth();
    let unsubscribeFirestoreUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setFirebaseAuthReady(true);
      if (unsubscribeFirestoreUser) {
        unsubscribeFirestoreUser();
        unsubscribeFirestoreUser = null;
      }

      if (firebaseUser) {
        unsubscribeFirestoreUser = subscribeToFirestoreUser(
          firebaseUser,
          (data) => {
            const updatedUser = {
              name: data.name || firebaseUser.displayName || '',
              email: data.email || firebaseUser.email || '',
              role: data.role || 'user',
            };
            localStorage.setItem('museum_auth_user', JSON.stringify({
              id: firebaseUser.uid,
              phone: data.phone || '',
              dateOfBirth: data.dateOfBirth || '',
              address: data.address || '',
              photoURL: data.photoURL || firebaseUser.photoURL || '',
              profileCompleted: !!data.profileCompleted,
              ...updatedUser
            }));
            setUser(updatedUser);
          },
          (err) => {
            console.error("Admin Firestore user listener error:", err);
          }
        );
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestoreUser) {
        unsubscribeFirestoreUser();
      }
    };
  }, []);

  useEffect(() => {
    if (!authChecked || !userRole || userRole === 'admin') return;

    if (userRole === 'museum') {
      router.replace('/museum-dashboard');
    } else if (userRole === 'controller') {
      router.replace('/controller-dashboard');
    }
  }, [authChecked, router, userRole]);

  // ── Section state ──
  const [activeSection, setActiveSection] = useState('dashboard');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['dashboard', 'bookings', 'users', 'analytics', 'visitors', 'activity', 'museums'].includes(hash)) {
        setActiveSection(hash);
      } else {
        setActiveSection('dashboard');
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // ── Visitors stats aggregation ──
  const visitorStats = useMemo(() => {
    const map = new Map<string, {
      email: string;
      name: string;
      phone: string;
      totalTickets: number;
      totalSpent: number;
      lastVisit: string;
    }>();

    bookings.forEach((booking) => {
      const email = booking.email || 'guest';
      const existing = map.get(email);
      if (existing) {
        existing.totalTickets += Number(booking.numberOfTickets || 0);
        existing.totalSpent += Number(booking.totalAmount || 0);
        if (new Date(booking.visitDate) > new Date(existing.lastVisit)) {
          existing.lastVisit = booking.visitDate;
        }
      } else {
        map.set(email, {
          email,
          name: booking.name || 'Guest',
          phone: booking.phone || '-',
          totalTickets: Number(booking.numberOfTickets || 0),
          totalSpent: Number(booking.totalAmount || 0),
          lastVisit: booking.visitDate || '-'
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [bookings]);

  // ── User activity logs ──
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [userActivityLoading, setUserActivityLoading] = useState(false);
  const [activityQuery, setActivityQuery] = useState('');
  const [selectedActivityCategory, setSelectedActivityCategory] = useState('All Categories');
  const [selectedActivityEmail, setSelectedActivityEmail] = useState('All Users');

  const loadUserActivity = useCallback(async () => {
    // Real-time sync is active, no manual fetching required
  }, []);

  useEffect(() => {
    if (activeSection === 'activity' && isAdmin) {
      void loadUserActivity();
    }
  }, [activeSection, isAdmin, loadUserActivity]);

  const filteredUserActivity = useMemo(() => {
    let list = userActivity;

    if (selectedActivityCategory !== 'All Categories') {
      list = list.filter((a) => a.category === selectedActivityCategory);
    }

    if (selectedActivityEmail !== 'All Users') {
      const selectedEmail = selectedActivityEmail.trim().toLowerCase();
      list = list.filter((a) => String(a.email || '').trim().toLowerCase() === selectedEmail);
    }

    const needle = activityQuery.trim().toLowerCase();
    if (!needle) return list;

    return list.filter((act) => {
      return [
        act.email,
        act.category,
        act.action,
        act.details,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [userActivity, activityQuery, selectedActivityCategory, selectedActivityEmail]);

  const activityEmailOptions = useMemo(() => {
    const emails = new Set<string>();
    userActivity.forEach((activity) => {
      const email = String(activity.email || '').trim();
      if (email && email.toLowerCase() !== 'guest') {
        emails.add(email.toLowerCase());
      }
    });

    return Array.from(emails).sort((a, b) => a.localeCompare(b));
  }, [userActivity]);

  const loadBookings = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  const checkHealth = useCallback(async () => {
    setHealth('checking');

    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      setHealth(response.ok && data?.success ? 'healthy' : 'error');
    } catch {
      setHealth('error');
    }
  }, []);

  // ── User management callbacks ──
  const loadUsers = useCallback(async () => {
    // Real-time sync active, no manual fetching required
  }, []);

  const updateUserRole = async (userId: string, nextRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Unable to update user');
      }

      setAllUsers((current) =>
        current.map((u) => u.id === userId ? { ...u, role: nextRole } : u)
      );
    } catch (err) {
      setUsersError((err as Error).message || 'Unable to update user');
    }
  };

  const deleteUser = async (target: UserRecord) => {
    const ok = window.confirm(`Delete user ${target.name || target.email}? This cannot be undone.`);
    if (!ok) return;

    try {
      const response = await fetch(`/api/admin/users/${target.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Unable to delete user');
      }

      setAllUsers((current) => current.filter((u) => u.id !== target.id));
    } catch (err) {
      setUsersError((err as Error).message || 'Unable to delete user');
    }
  };

  const filteredUsers = useMemo(() => {
    const needle = userQuery.trim().toLowerCase();
    if (!needle) return allUsers;

    return allUsers.filter((u) =>
      [u.name, u.email, u.phone, u.role, u.authProvider]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [allUsers, userQuery]);

  useEffect(() => {
    if (!authChecked || !isAdmin || !firebaseAuthReady) return;

    setLoading(true);
    setUsersLoading(true);
    setMuseumsLoading(true);
    setUserActivityLoading(true);

    const fStore = getFirebaseClientFirestore();
    const rdb = getFirebaseClientRealtimeDatabase();

    // 1. Museums Listener
    const museumsQuery = firestoreQuery(collection(fStore, 'museums'), orderBy('createdAt', 'desc'));
    const unsubscribeMuseums = onSnapshot(museumsQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || String(data.createdAt || ''),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || String(data.updatedAt || '')
        };
      });
      setMuseumsList(list);
      setMuseumsLoading(false);
    }, (err) => {
      console.error('Failed to subscribe to museums:', err);
      setMuseumsLoading(false);
    });

    // 2. Bookings Listener (Realtime Database)
    const bookingsRef = databaseQuery(ref(rdb, 'bookings'), orderByChild('createdAt'), limitToLast(500));
    const unsubscribeBookings = onValue(bookingsRef, (snapshot) => {
      const list: Booking[] = [];
      snapshot.forEach((child) => {
        const val = child.val() || {};
        list.push({
          id: child.key || '',
          _id: child.key || '',
          bookingId: String(val.bookingId || child.key || ''),
          userId: val.userId || null,
          name: String(val.name || ''),
          email: String(val.email || ''),
          phone: String(val.phone || ''),
          visitDate: String(val.visitDate || ''),
          timeSlot: String(val.timeSlot || ''),
          numberOfTickets: Number(val.numberOfTickets || 0),
          visitorType: String(val.visitorType || ''),
          totalAmount: Number(val.totalAmount || 0),
          museumName: val.museumName || null,
          museumLocation: val.museumLocation || null,
          museumCategory: val.museumCategory || null,
          paymentStatus: val.paymentStatus || '',
          status: String(val.status || 'pending'),
          createdAt: String(val.createdAt || '')
        });
      });
      // Sort descending by createdAt
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(list);
      setLoading(false);
    }, (err) => {
      console.error('Failed to subscribe to bookings:', err);
      setLoading(false);
    });

    // 3. Users Listener
    const usersQuery = firestoreQuery(collection(fStore, 'users'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: String(data.name || ''),
          email: String(data.email || ''),
          phone: String(data.phone || ''),
          role: String(data.role || 'user'),
          authProvider: String(data.authProvider || 'password'),
          profileCompleted: Boolean(data.profileCompleted),
          dateOfBirth: data.dateOfBirth || '',
          address: data.address || '',
          photoURL: data.photoURL || '',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || String(data.createdAt || ''),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || String(data.updatedAt || '')
        };
      });
      setAllUsers(list);
      setUsersLoading(false);
    }, (err) => {
      console.error('Failed to subscribe to users:', err);
      setUsersLoading(false);
    });

    // 4. User Activities Listener (Realtime Database)
    const activitiesRef = databaseQuery(ref(rdb, 'user_activities'), orderByChild('timestamp'), limitToLast(200));
    const unsubscribeActivities = onValue(activitiesRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        list.push({
          id: child.key || '',
          userId: val.userId || null,
          email: String(val.email || 'guest'),
          category: String(val.category || 'Auth'),
          action: String(val.action || ''),
          details: String(val.details || ''),
          timestamp: String(val.timestamp || '')
        });
      });
      list.reverse();
      setUserActivity(list);
      setUserActivityLoading(false);
    }, (err) => {
      console.error('Failed to subscribe to user activities:', err);
      setUserActivityLoading(false);
    });

    // Run health check initially
    void checkHealth();

    return () => {
      unsubscribeMuseums();
      unsubscribeBookings();
      unsubscribeUsers();
      unsubscribeActivities();
    };
  }, [authChecked, checkHealth, isAdmin, firebaseAuthReady]);

  const filteredBookings = useMemo(() => {
    let list = bookings;

    if (selectedMuseum !== 'All Museums') {
      list = list.filter((b) => b.museumName === selectedMuseum);
    }

    const needle = query.trim().toLowerCase();
    if (!needle) return list;

    return list.filter((booking) => {
      return [
        booking.bookingId,
        booking.name,
        booking.email,
        booking.phone,
        booking.museumName,
        booking.museumLocation,
        booking.visitorType,
        booking.status,
        booking.paymentStatus
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [bookings, query, selectedMuseum]);

  const metrics = useMemo(() => {
    const confirmed = bookings.filter((booking) => booking.status === 'confirmed');
    const cancelled = bookings.filter((booking) => booking.status === 'cancelled');
    const revenue = confirmed.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);
    const tickets = confirmed.reduce((sum, booking) => sum + Number(booking.numberOfTickets || 0), 0);
    const uniqueVisitors = new Set(bookings.map((booking) => booking.email).filter(Boolean)).size;

    return {
      totalBookings: bookings.length,
      confirmedBookings: confirmed.length,
      cancelledBookings: cancelled.length,
      revenue,
      tickets,
      uniqueVisitors
    };
  }, [bookings]);

  const recentActivity = useMemo(() => {
    return bookings.slice(0, 5).map((booking) => ({
      id: booking._id,
      title: `${booking.bookingId} ${booking.status}`,
      detail: `${booking.name || 'Guest'} - ${booking.museumName || 'Museum ticket'}`,
      time: formatDate(booking.createdAt)
    }));
  }, [bookings]);

  const dashboardStats = useMemo(() => [
    {
      title: 'Total bookings',
      value: String(metrics.totalBookings),
      change: `${metrics.confirmedBookings} live`,
      changeType: 'positive' as const,
      icon: Ticket,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Confirmed revenue',
      value: formatCurrency(metrics.revenue),
      change: 'verified',
      changeType: 'positive' as const,
      icon: IndianRupee,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Tickets issued',
      value: String(metrics.tickets),
      change: `${metrics.cancelledBookings} void`,
      changeType: metrics.cancelledBookings > 0 ? 'negative' as const : 'positive' as const,
      icon: CalendarClock,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10'
    },
    {
      title: 'Visitors',
      value: String(metrics.uniqueVisitors),
      change: 'unique',
      changeType: 'positive' as const,
      icon: Users,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10'
    }
  ], [metrics]);

  const refreshDashboard = () => {
    void loadBookings('refresh');
    void checkHealth();
  };

  const updateStatus = async (booking: Booking, nextStatus: string) => {
    try {
      const response = await fetch(`/api/bookings/${booking._id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Unable to update booking');
      }

      setBookings((current) =>
        current.map((item) => item._id === booking._id ? { ...item, status: nextStatus } : item)
      );
    } catch (err) {
      setError((err as Error).message || 'Unable to update booking');
    }
  };

  const deleteBooking = async (booking: Booking) => {
    const ok = window.confirm(`Delete booking ${booking.bookingId}?`);
    if (!ok) return;

    try {
      const response = await fetch(`/api/bookings/${booking._id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Unable to delete booking');
      }

      setBookings((current) => current.filter((item) => item._id !== booking._id));
    } catch (err) {
      setError((err as Error).message || 'Unable to delete booking');
    }
  };

  const exportCsv = () => {
    const headers = [
      'Booking ID',
      'Name',
      'Email',
      'Phone',
      'Museum',
      'Visit Date',
      'Time Slot',
      'Tickets',
      'Visitor Type',
      'Amount',
      'Status',
      'Payment'
    ];

    const rows = filteredBookings.map((booking) => [
      booking.bookingId,
      booking.name,
      booking.email,
      booking.phone,
      booking.museumName || '',
      booking.visitDate,
      booking.timeSlot,
      booking.numberOfTickets,
      booking.visitorType,
      booking.totalAmount,
      booking.status,
      booking.paymentStatus || ''
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bharat-museum-bookings-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-20">
        <section className="w-full rounded-lg border bg-background p-6 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/30">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with an account whose Firestore user role is set to admin to manage bookings and system data.
          </p>
          <div className="mt-5 flex gap-3">
            <Link href="/login" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
              Sign in
            </Link>
            <Link href="/" className="rounded-md border px-4 py-2 text-sm">
              Back home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <AdminSidebar />
      <SidebarInset className="min-h-screen bg-muted/20">
        <DashboardHeader
          searchQuery={query}
          onSearchChange={setQuery}
          onRefresh={refreshDashboard}
          onExport={exportCsv}
          isRefreshing={refreshing}
        />
        <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {/* ── Dashboard tab ── */}
          {activeSection === 'dashboard' && (
            <>
              <div className="rounded-lg border bg-background p-5 shadow-sm">
                <div>
                  <p className="text-sm text-muted-foreground">Admin Dashboard</p>
                  <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Bharat Museum Operations</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Manage bookings, monitor payments, and review ticketing activity.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {dashboardStats.map((stat, index) => (
                  <DashboardCard key={stat.title} stat={stat} index={index} />
                ))}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <section className="rounded-lg border bg-background p-5 shadow-sm">
                  <h2 className="text-lg font-semibold mb-3">System Status</h2>
                  <div className="space-y-3 text-sm">
                    <StatusRow
                      icon={Activity}
                      label="Next API"
                      value={health === 'checking' ? 'Checking' : health === 'healthy' ? 'Healthy' : 'Needs attention'}
                      positive={health === 'healthy'}
                    />
                    <StatusRow
                      icon={CheckCircle2}
                      label="Firestore bookings"
                      value={error ? 'Unavailable' : 'Connected'}
                      positive={!error}
                    />
                    <StatusRow
                      icon={Ticket}
                      label="Active workload"
                      value={`${metrics.confirmedBookings} confirmed`}
                      positive
                    />
                  </div>
                </section>

                <section className="rounded-lg border bg-background p-5 shadow-sm">
                  <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
                  <div className="space-y-3">
                    {recentActivity.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No booking activity yet.</p>
                    ) : recentActivity.map((item) => (
                      <div key={item.id} className="rounded-md border p-3 text-sm">
                        <div className="font-medium">{item.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{item.detail}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{item.time}</div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}

          {/* ── Bookings tab ── */}
          {activeSection === 'bookings' && (
            <section id="bookings" className="rounded-lg border bg-background p-4 shadow-sm">
              <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-lg font-semibold">Bookings</h2>
                  <p className="text-sm text-muted-foreground">Search, update status, or remove ticket records.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={selectedMuseum}
                    onChange={(e) => setSelectedMuseum(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    {museumOptions.map((museum) => (
                      <option key={museum} value={museum}>
                        {museum}
                      </option>
                    ))}
                  </select>
                  <div className="relative w-full md:w-72">
                    <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search bookings"
                      className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Booking</th>
                      <th className="py-3 pr-4 font-medium">Visitor</th>
                      <th className="py-3 pr-4 font-medium">Museum</th>
                      <th className="py-3 pr-4 font-medium">Visit</th>
                      <th className="py-3 pr-4 font-medium">Amount</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 pr-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Loading bookings
                        </td>
                      </tr>
                    ) : filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                          No bookings found.
                        </td>
                      </tr>
                    ) : filteredBookings.map((booking) => (
                      <tr key={booking._id} className="border-b last:border-0">
                        <td className="py-3 pr-4 align-top">
                          <div className="font-medium">{booking.bookingId}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(booking.createdAt)}</div>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="font-medium">{booking.name || '-'}</div>
                          <div className="text-xs text-muted-foreground">{booking.email || '-'}</div>
                          <div className="text-xs text-muted-foreground">{booking.phone || '-'}</div>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="font-medium">{booking.museumName || 'Bharat Museum'}</div>
                          <div className="text-xs text-muted-foreground">{booking.museumLocation || booking.museumCategory || '-'}</div>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div>{formatDate(booking.visitDate)}</div>
                          <div className="text-xs text-muted-foreground">{booking.timeSlot}</div>
                          <div className="text-xs text-muted-foreground">{booking.numberOfTickets} x {booking.visitorType}</div>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="font-medium">{formatCurrency(booking.totalAmount)}</div>
                          <div className="text-xs text-muted-foreground">{booking.paymentStatus || 'pending'}</div>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${statusClass(booking.status)}`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="flex items-center gap-2">
                            <select
                              value={booking.status}
                              onChange={(event) => void updateStatus(booking, event.target.value)}
                              className="rounded-md border bg-background px-2 py-1 text-xs"
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void deleteBooking(booking)}
                              className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                              aria-label={`Delete booking ${booking.bookingId}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Museums tab ── */}
          {activeSection === 'museums' && (
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left Column: Register Form */}
              <div className="lg:col-span-5 space-y-6">
                {/* AI Extractor Card */}
                <div className="relative overflow-hidden rounded-2xl border bg-background p-5 shadow-lg dark:border-zinc-800 transition-all duration-300 hover:shadow-xl">
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-linear-to-br from-emerald-500/10 to-teal-500/10 blur-lg"></div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-emerald-500 animate-pulse" />
                    <h3 className="font-semibold text-lg text-foreground">AI Attribute Extractor</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Upload an image of a museum banner, informational board, or document to extract name, location, state, and other details.
                  </p>

                  <div className="group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/10 p-6 text-center hover:bg-muted/20 transition-all duration-200 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageAnalyze}
                      disabled={analyzingImage || museumsLoading}
                      className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
                      aria-label="Upload museum image for AI parsing"
                    />
                    {analyzingImage ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                        <span className="text-sm font-medium text-foreground">Extracting attributes...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Upload className="h-8 w-8 text-muted-foreground group-hover:text-emerald-500 transition-colors duration-200" />
                        <span className="text-sm font-semibold text-foreground">Click to upload image</span>
                        <span className="text-xs text-muted-foreground">PNG, JPG or WEBP up to 5MB</span>
                      </div>
                    )}
                  </div>

                </div>

                {/* Form Card */}
                <div className="rounded-2xl border bg-background p-5 shadow-lg dark:border-zinc-800">
                  <div className="flex items-center gap-2 mb-4 border-b pb-3 border-border/80" id="museum-details-form-header">
                    <Landmark className="h-5 w-5 text-emerald-500" />
                    <h3 className="font-semibold text-lg text-foreground">
                      {formMode === 'edit' ? 'Edit Museum Details' : 'Museum Details Form'}
                    </h3>
                  </div>

                  {museumsError && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-950/20 dark:bg-red-950/20 dark:text-red-300">
                      {museumsError}
                    </div>
                  )}
                  {museumsSuccess && (
                    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-950/20 dark:bg-emerald-950/20 dark:text-emerald-300">
                      {museumsSuccess}
                    </div>
                  )}

                  <form onSubmit={formMode === 'edit' ? handleUpdateMuseum : handleRegisterMuseum} className="space-y-4">
                    <div>
                      <label htmlFor="form-museum-name" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Museum Name *
                      </label>
                      <input
                        id="form-museum-name"
                        type="text"
                        required
                        value={museumName}
                        onChange={(e) => setMuseumName(e.target.value)}
                        placeholder="e.g. National Space Center"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="form-museum-location" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          City / Location *
                        </label>
                        <input
                          id="form-museum-location"
                          type="text"
                          required
                          value={museumLocation}
                          onChange={(e) => setMuseumLocation(e.target.value)}
                          placeholder="e.g. New Delhi"
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div>
                        <label htmlFor="form-museum-state" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          State *
                        </label>
                        <input
                          id="form-museum-state"
                          type="text"
                          required
                          value={museumState}
                          onChange={(e) => setMuseumState(e.target.value)}
                          placeholder="e.g. Delhi"
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="form-museum-category" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Category
                      </label>
                      <input
                        id="form-museum-category"
                        type="text"
                        value={museumCategory}
                        onChange={(e) => setMuseumCategory(e.target.value)}
                        placeholder="e.g. Science / Art"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    {/* Category Pricing Section */}
                    <div className="rounded-xl border p-4 bg-muted/20 space-y-4">
                      <div className="flex items-center gap-1.5 border-b pb-2 border-border/80 mb-2">
                        <Sparkles className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Visitor Category Pricing (INR) *</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="price-adult" className="block text-[11px] font-semibold text-muted-foreground mb-1">Adult Price</label>
                          <input id="price-adult" type="number" min={0} required value={priceAdult} onChange={(e) => setPriceAdult(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20" />
                        </div>
                        <div>
                          <label htmlFor="price-child" className="block text-[11px] font-semibold text-muted-foreground mb-1">Child Price</label>
                          <input id="price-child" type="number" min={0} required value={priceChild} onChange={(e) => setPriceChild(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="price-senior" className="block text-[11px] font-semibold text-muted-foreground mb-1">Senior Citizen Price</label>
                          <input id="price-senior" type="number" min={0} required value={priceSenior} onChange={(e) => setPriceSenior(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20" />
                        </div>
                        <div>
                          <label htmlFor="price-student" className="block text-[11px] font-semibold text-muted-foreground mb-1">Student Price</label>
                          <input id="price-student" type="number" min={0} required value={priceStudent} onChange={(e) => setPriceStudent(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="price-professor" className="block text-[11px] font-semibold text-muted-foreground mb-1">Professor Price</label>
                          <input id="price-professor" type="number" min={0} required value={priceProfessor} onChange={(e) => setPriceProfessor(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20" />
                        </div>
                        <div>
                          <label htmlFor="price-researcher" className="block text-[11px] font-semibold text-muted-foreground mb-1">Researcher/Scientist Price</label>
                          <input id="price-researcher" type="number" min={0} required value={priceResearcher} onChange={(e) => setPriceResearcher(Number(e.target.value))} className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="form-museum-description" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Brief Description
                      </label>
                      <textarea
                        id="form-museum-description"
                        rows={2}
                        value={museumDescription}
                        onChange={(e) => setMuseumDescription(e.target.value)}
                        placeholder="A short description of the museum..."
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    <div>
                      <label htmlFor="form-museum-image-url" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Image URL (Optional)
                      </label>
                      <input
                        id="form-museum-image-url"
                        type="url"
                        value={museumImageUrl}
                        onChange={(e) => setMuseumImageUrl(e.target.value)}
                        placeholder="https://example.com/museum.jpg"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>

                    {/* Museum Login Credentials Section */}
                    <div className="rounded-xl border p-4 bg-muted/20 space-y-4">
                      <div className="flex items-center gap-1.5 border-b pb-2 border-border/80 mb-2">
                        <Users className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Museum Supervisor Credentials
                        </span>
                      </div>
                      
                      <div>
                        <label htmlFor="login-email" className="block text-xs font-semibold text-muted-foreground mb-1">
                          Login Email / User ID {formMode === 'register' ? '(Optional)' : ''}
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="login-email"
                            type="email"
                            value={loginEmail}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLoginEmail(val);
                              if (formMode === 'edit') {
                                setIsEmailVerified(val.trim().toLowerCase() === originalEmail.toLowerCase());
                              } else {
                                setIsEmailVerified(false);
                              }
                              setIsOtpSent(false);
                              setOtpSuccess('');
                              setOtpError('');
                            }}
                            placeholder="museum-admin@example.com"
                            className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                          />
                          {loginEmail.trim() && (
                            <button
                              type="button"
                              onClick={handleSendOtp}
                              disabled={isEmailVerified || otpLoading}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                                isEmailVerified
                                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'
                              }`}
                            >
                              {isEmailVerified ? 'Verified' : isOtpSent ? 'Resend' : 'Verify'}
                            </button>
                          )}
                        </div>

                        {otpError && (
                          <p className="text-[10px] text-red-500 mt-1 font-medium">{otpError}</p>
                        )}
                        {otpSuccess && (
                          <p className="text-[10px] text-emerald-600 mt-1 font-medium">{otpSuccess}</p>
                        )}

                        {/* OTP Verification Input Form */}
                        {isOtpSent && !isEmailVerified && (
                          <div className="mt-2.5 p-2.5 rounded-lg border border-emerald-500/10 bg-emerald-500/5 space-y-2">
                            <label htmlFor="otp-verification-code" className="block text-[10px] font-bold uppercase tracking-wider text-foreground">
                              Enter 6-Digit Code
                            </label>
                            <div className="flex gap-2">
                              <input
                                id="otp-verification-code"
                                type="text"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="123456"
                                className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                              />
                              <button
                                type="button"
                                onClick={handleVerifyOtp}
                                disabled={otpLoading || otpCode.length !== 6}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer transition-colors"
                              >
                                {otpLoading ? 'Verifying...' : 'Verify Code'}
                              </button>
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formMode === 'register' 
                            ? "Provide an email to automatically create a museum supervisor account." 
                            : "Updating this email will update the supervisor account login ID."}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="login-password" className="block text-xs font-semibold text-muted-foreground mb-1">
                            Password {formMode === 'edit' ? '(Leave blank to keep current)' : ''}
                          </label>
                          <div className="relative">
                            <input
                              id="login-password"
                              type={showAdminPassword ? "text" : "password"}
                              value={loginPassword}
                              onChange={(e) => setLoginPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full rounded-lg border bg-background pl-3 pr-8 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(!showAdminPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                              aria-label={showAdminPassword ? "Hide password" : "Show password"}
                            >
                              {showAdminPassword ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="confirm-password" className="block text-xs font-semibold text-muted-foreground mb-1">
                            Confirm Password
                          </label>
                          <div className="relative">
                            <input
                              id="confirm-password"
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full rounded-lg border bg-background pl-3 pr-8 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      {formMode === 'edit' && (
                        <button
                          type="button"
                          onClick={resetMuseumForm}
                          className="flex-1 rounded-lg border border-border/80 bg-background hover:bg-muted py-2.5 text-sm font-semibold transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={museumsLoading}
                        className="flex-2 w-full flex justify-center items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {museumsLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : formMode === 'edit' ? (
                          <span>Update Museum</span>
                        ) : (
                          <span>Register Museum</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right Column: Custom Registered Museums List */}
              <div className="lg:col-span-7 space-y-6">
                <div className="rounded-2xl border bg-background p-5 shadow-lg dark:border-zinc-800" data-bmt-no-translate>
                  <div className="flex justify-between items-center mb-4 border-b pb-3 border-border/80">
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">Custom Registered Museums</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Custom entries stored in Firestore</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-full">
                      {museumsList.filter((m) => m.museum_id?.startsWith('custom_')).length} Custom Entries
                    </span>
                  </div>

                  {museumsLoading && museumsList.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500 mb-2" />
                      <span>Loading registered museums...</span>
                    </div>
                  ) : museumsList.filter((m) => m.museum_id?.startsWith('custom_')).length === 0 ? (
                    <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                      <Landmark className="mx-auto h-12 w-12 text-muted-foreground/30 mb-2" />
                      <p className="font-medium">No custom museums registered yet</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        Use the AI attributes extractor or the details form to add new custom museums to the ticketing system.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {museumsList
                        .filter((m) => m.museum_id?.startsWith('custom_'))
                        .map((museum) => (
                          <div
                            key={museum.id || museum.museum_id}
                            className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-muted/10 p-4 transition-all duration-200 hover:border-emerald-500/30 hover:bg-muted/20"
                          >
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-semibold text-foreground text-sm line-clamp-1 group-hover:text-emerald-500 transition-colors">
                                  {museum.name}
                                </h4>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => loadMuseumToForm(museum)}
                                    className="rounded-lg p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                                    title={`Edit ${museum.name}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMuseum(museum.id, museum.name)}
                                    className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                    title={`Delete ${museum.name}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {museum.description || 'No description provided.'}
                              </p>

                              <div className="flex flex-wrap gap-1.5 mt-3">
                                <span className="text-[10px] font-semibold px-2 py-0.5 bg-background rounded-full border">
                                  {museum.location}, {museum.state}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full">
                                  {museum.category}
                                </span>
                              </div>

                              {museum.loginEmail && (
                                <div className="mt-2 text-[10px] font-medium text-muted-foreground bg-emerald-500/5 px-2 py-1 rounded-md border border-emerald-500/10">
                                  Login ID: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{museum.loginEmail}</span>
                                </div>
                              )}

                              {/* Category Prices Grid */}
                              <div className="mt-3 grid grid-cols-3 gap-1 text-[10px] bg-muted/30 p-2 rounded-lg border border-border/40 font-medium">
                                <div className="text-muted-foreground">Adult: <span className="font-semibold text-foreground">₹{museum.prices?.Adult ?? museum.price}</span></div>
                                <div className="text-muted-foreground">Child: <span className="font-semibold text-foreground">₹{museum.prices?.Child ?? Math.round(museum.price * 0.5)}</span></div>
                                <div className="text-muted-foreground">Senior: <span className="font-semibold text-foreground">₹{museum.prices?.['Senior Citizen'] ?? Math.round(museum.price * 0.75)}</span></div>
                                <div className="text-muted-foreground">Student: <span className="font-semibold text-foreground">₹{museum.prices?.Student ?? Math.round(museum.price * 0.6)}</span></div>
                                <div className="text-muted-foreground">Prof: <span className="font-semibold text-foreground">₹{museum.prices?.Professor ?? Math.round(museum.price * 0.9)}</span></div>
                                <div className="text-muted-foreground font-semibold">Sci: <span className="font-semibold text-foreground">₹{museum.prices?.['Researcher/Scientist'] ?? Math.round(museum.price * 0.9)}</span></div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-4 border-t pt-2 border-border/60">
                              <span className="text-[10px] text-muted-foreground font-mono">
                                ID: {museum.museum_id}
                              </span>
                              <span className="text-sm font-bold text-foreground">
                                Base: ₹{museum.price}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── User Management tab ── */}
          {activeSection === 'users' && (
            <section id="users" className="rounded-lg border bg-background p-4 shadow-sm">
              <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-lg font-semibold">User Management</h2>
                  <p className="text-sm text-muted-foreground">View, search, and manage all registered users.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {allUsers.length} total user{allUsers.length !== 1 ? 's' : ''}
                  </span>
                  <div className="relative w-full md:w-72">
                    <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <input
                      value={userQuery}
                      onChange={(event) => setUserQuery(event.target.value)}
                      placeholder="Search users"
                      className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>

              {usersError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {usersError}
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">User</th>
                      <th className="py-3 pr-4 font-medium">Contact</th>
                      <th className="py-3 pr-4 font-medium">Role</th>
                      <th className="py-3 pr-4 font-medium">Provider</th>
                      <th className="py-3 pr-4 font-medium">Profile</th>
                      <th className="py-3 pr-4 font-medium">Joined</th>
                      <th className="py-3 pr-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          Loading users
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                          No users found.
                        </td>
                      </tr>
                    ) : filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 align-top">
                          <div className="flex items-center gap-3">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt={u.name} className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                                {(u.name || u.email || '?').charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{u.name || '-'}</div>
                              <div className="text-xs text-muted-foreground">{u.email || '-'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="text-sm">{u.phone || '-'}</div>
                          {u.address ? <div className="text-xs text-muted-foreground">{u.address}</div> : null}
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${
                              u.role === 'admin'
                                ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300'
                                : u.role === 'museum'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
                                : u.role === 'controller'
                                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                                : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300'
                            }`}
                          >
                            {u.role === 'admin' ? <Shield className="h-3 w-3" /> : null}
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${
                            u.authProvider === 'google'
                              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300'
                              : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                          }`}>
                            {u.authProvider === 'google' ? 'Google' : 'Email'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${
                            u.profileCompleted
                              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-300'
                              : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'
                          }`}>
                            {u.profileCompleted ? 'Complete' : 'Incomplete'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="text-sm">{formatDate(u.createdAt)}</div>
                        </td>
                        <td className="py-3 pr-4 align-top">
                          <div className="flex items-center gap-2">
                            <select
                              value={u.role}
                              onChange={(event) => void updateUserRole(u.id, event.target.value)}
                              className="rounded-md border bg-background px-2 py-1 text-xs"
                            >
                              <option value="user">user</option>
                              <option value="admin">admin</option>
                              <option value="museum">museum</option>
                              <option value="controller">controller</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => void deleteUser(u)}
                              className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                              aria-label={`Delete user ${u.name || u.email}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Analytics tab ── */}
          {activeSection === 'analytics' && (
            <section id="analytics" className="rounded-lg border bg-background p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Financial & Ticketing Analytics</h2>
              <RevenueChart />
            </section>
          )}

          {/* ── Visitors tab ── */}
          {activeSection === 'visitors' && (
            <section id="visitors" className="rounded-lg border bg-background p-6 shadow-sm">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-semibold">Unique Visitors</h2>
                  <p className="text-sm text-muted-foreground">Browse history and ticket tallies per visitor email.</p>
                </div>
                <span className="text-xs text-muted-foreground font-semibold">
                  {visitorStats.length} Unique Visitor{visitorStats.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground font-medium">
                      <th className="py-3 pr-4">Visitor</th>
                      <th className="py-3 pr-4">Contact</th>
                      <th className="py-3 pr-4 text-center">Tickets Purchased</th>
                      <th className="py-3 pr-4 text-right">Total Spent</th>
                      <th className="py-3 pr-4 text-right">Last Visit Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitorStats.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-muted-foreground">
                          No visitors registered yet.
                        </td>
                      </tr>
                    ) : (
                      visitorStats.map((visitor) => (
                        <tr key={visitor.email} className="border-b last:border-0 hover:bg-muted/10">
                          <td className="py-3.5 pr-4 align-top">
                            <div className="font-semibold text-foreground">{visitor.name}</div>
                            <div className="text-xs text-muted-foreground">{visitor.email}</div>
                          </td>
                          <td className="py-3.5 pr-4 align-top text-xs text-muted-foreground">
                            {visitor.phone}
                          </td>
                          <td className="py-3.5 pr-4 align-top text-center font-medium">
                            {visitor.totalTickets}
                          </td>
                          <td className="py-3.5 pr-4 align-top text-right font-medium text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(visitor.totalSpent)}
                          </td>
                          <td className="py-3.5 pr-4 align-top text-right text-xs text-muted-foreground">
                            {formatDate(visitor.lastVisit)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── Activity tab ── */}
          {activeSection === 'activity' && (
            <section id="activity" className="rounded-lg border bg-background p-6 shadow-sm">
              <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <h2 className="text-lg font-semibold">System & User Activity Audit Trail</h2>
                  <p className="text-sm text-muted-foreground">Real-time log of user registrations, check-ins, purchases, chatbot interactions, and access events.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={selectedActivityCategory}
                    onChange={(e) => setSelectedActivityCategory(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                  >
                    <option value="All Categories">All Categories</option>
                    <option value="Auth">Auth</option>
                    <option value="Profile">Profile</option>
                    <option value="Booking">Booking</option>
                    <option value="Payment">Payment</option>
                    <option value="Chat">Chat</option>
                    <option value="Scan">Scan</option>
                    <option value="Navigation">Navigation</option>
                    <option value="Interaction">Interaction</option>
                  </select>
                  <select
                    value={selectedActivityEmail}
                    onChange={(e) => setSelectedActivityEmail(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring cursor-pointer sm:w-64"
                    aria-label="Filter activities by user email"
                  >
                    <option value="All Users">All Users</option>
                    {activityEmailOptions.map((email) => (
                      <option key={email} value={email}>
                        {email}
                      </option>
                    ))}
                  </select>
                  <div className="relative w-full md:w-60">
                    <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <input
                      value={activityQuery}
                      onChange={(event) => setActivityQuery(event.target.value)}
                      placeholder="Search activities"
                      className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <button
                    onClick={() => void loadUserActivity()}
                    disabled={userActivityLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    <RefreshCw className={`h-4 w-4 ${userActivityLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground font-medium">
                      <th className="py-3 pr-4">Timestamp</th>
                      <th className="py-3 pr-4">User Email</th>
                      <th className="py-3 pr-4">Category</th>
                      <th className="py-3 pr-4">Action</th>
                      <th className="py-3 pr-4">Activity Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userActivityLoading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          <Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-500 mb-2" />
                          Loading activities...
                        </td>
                      </tr>
                    ) : filteredUserActivity.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-muted-foreground">
                          No matching activities found.
                        </td>
                      </tr>
                    ) : (
                      filteredUserActivity.map((log) => (
                        <tr key={log.id} className="border-b last:border-0 hover:bg-muted/10">
                          <td className="py-3.5 pr-4 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {formatDateTime(log.timestamp)}
                          </td>
                          <td className="py-3.5 pr-4 font-medium text-foreground">
                            {log.email}
                          </td>
                          <td className="py-3.5 pr-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${activityCategoryClass(
                                log.category
                              )}`}
                            >
                              {log.category}
                            </span>
                          </td>
                          <td className="py-3.5 pr-4 font-mono text-xs text-muted-foreground">
                            {log.action}
                          </td>
                          <td className="py-3.5 pr-4 text-xs text-muted-foreground max-w-md break-words" title={log.details}>
                            {log.details}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>
      </SidebarInset>
    </SidebarProvider>
  );
}

function StatusRow({
  icon: Icon,
  label,
  value,
  positive
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
      </div>
      <span className={positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
        {value}
      </span>
    </div>
  );
}
