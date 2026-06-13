"use client";

import type { ReactNode } from 'react';
import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  CheckCircle2,
  Loader2,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  Trash2,
  Tv,
  Wifi,
  WifiOff,
  History,
  TrendingUp,
  AlertCircle,
  Ticket,
  Users,
  IndianRupee,
  X
} from 'lucide-react';
import Header2 from '../../components/mvpblocks/header-2';
import { getFirebaseClientRealtimeDatabase, getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import { ref, onValue, query as databaseQuery, orderByChild } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { subscribeToFirestoreUser } from '../../lib/firestoreUser';

type ControllerDevice = {
  id: string;
  name: string;
  museumId: string;
  status: 'active' | 'offline' | 'maintenance';
  lastActive: string;
  createdAt: string;
};

type ScanLog = {
  id: string;
  ticketId: string;
  deviceId: string;
  deviceName: string;
  scannedAt: string;
  outcome: 'granted' | 'denied';
  message: string;
};

type Booking = {
  _id: string;
  bookingId: string;
  name: string;
  email: string;
  phone: string;
  visitDate: string;
  timeSlot: string;
  numberOfTickets: number;
  visitorType: string;
  visitorCombo: Record<string, number> | null;
  totalAmount: number;
  museumId: string | null;
  museumName: string | null;
  museumLocation: string | null;
  museumCategory: string | null;
  paymentStatus: string;
  status: string;
  createdAt: string;
};

type MuseumRecord = {
  id: string;
  museum_id: string;
  name: string;
  location: string;
  state?: string;
  loginEmail?: string;
};

type VisitorStat = {
  email: string;
  name: string;
  phone: string;
  totalBookings: number;
  totalTickets: number;
  totalSpent: number;
  lastVisit: string;
};

type DetailModalKind = 'controllers' | 'activeDevices' | 'bookings' | 'visitors' | 'revenue' | 'scans' | 'approvalRate';

type DetailModalContent = {
  title: string;
  subtitle: string;
  body: ReactNode;
};

type StoredUser = {
  name?: string;
  email?: string;
  role?: string;
};

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function toBooking(id: string, val: any): Booking {
  return {
    _id: id,
    bookingId: String(val.bookingId || id),
    name: String(val.name || ''),
    email: String(val.email || ''),
    phone: String(val.phone || ''),
    visitDate: String(val.visitDate || ''),
    timeSlot: String(val.timeSlot || ''),
    numberOfTickets: Number(val.numberOfTickets || 0),
    visitorType: String(val.visitorType || 'Adult'),
    visitorCombo: val.visitorCombo && typeof val.visitorCombo === 'object' ? val.visitorCombo : null,
    totalAmount: Number(val.totalAmount || 0),
    museumId: val.museumId ? String(val.museumId) : null,
    museumName: val.museumName ? String(val.museumName) : null,
    museumLocation: val.museumLocation ? String(val.museumLocation) : null,
    museumCategory: val.museumCategory ? String(val.museumCategory) : null,
    paymentStatus: String(val.paymentStatus || 'pending'),
    status: String(val.status || 'confirmed'),
    createdAt: String(val.createdAt || '')
  };
}

function formatVisitorBreakdown(booking: Booking) {
  if (booking.visitorCombo && Object.keys(booking.visitorCombo).length > 0) {
    return Object.entries(booking.visitorCombo)
      .filter(([, count]) => Number(count) > 0)
      .map(([type, count]) => `${count} x ${type}`)
      .join(', ');
  }

  return `${booking.numberOfTickets} x ${booking.visitorType}`;
}

export default function MuseumDashboardPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);

  // States
  const [controllers, setControllers] = useState<ControllerDevice[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [museums, setMuseums] = useState<MuseumRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [museumsLoading, setMuseumsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'visitors' | 'controllers' | 'logs'>('overview');
  const [detailModal, setDetailModal] = useState<DetailModalKind | null>(null);

  // Register Form State
  const [deviceName, setDeviceName] = useState('');
  const [deviceStatus, setDeviceStatus] = useState<'active' | 'offline' | 'maintenance'>('active');

  // Search/Filter State
  const [searchQuery, setSearchQuery] = useState('');

  const isAuthorized = user?.role === 'admin' || user?.role === 'museum';
  const signedInEmail = user?.email?.trim().toLowerCase() || '';
  const currentMuseum = useMemo(() => {
    if (!signedInEmail) return null;
    return museums.find((museum) => museum.loginEmail?.trim().toLowerCase() === signedInEmail) || null;
  }, [museums, signedInEmail]);
  const shouldRestrictToCurrentMuseum = user?.role === 'museum';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('museum_auth_user');
        if (raw) {
          setUser(JSON.parse(raw) as StoredUser);
        }
      } catch (err) {
        console.error('Failed to read auth user:', err);
      }
      setAuthChecked(true);
    }

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
              id: firebaseUser.uid,
              name: data.name || firebaseUser.displayName || '',
              email: data.email || firebaseUser.email || '',
              phone: data.phone || '',
              dateOfBirth: data.dateOfBirth || '',
              address: data.address || '',
              photoURL: data.photoURL || firebaseUser.photoURL || '',
              profileCompleted: !!data.profileCompleted,
              role: data.role || 'user',
            };
            localStorage.setItem('museum_auth_user', JSON.stringify(updatedUser));
            setUser(updatedUser);
          },
          (err) => {
            console.error("Museum Dashboard Firestore user listener error:", err);
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
    if (!authChecked || !isAuthorized || !firebaseAuthReady) return;

    let mounted = true;
    setMuseumsLoading(true);
    fetch('/api/museums')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load museums');
        }
        return response.json();
      })
      .then((payload) => {
        if (!mounted) return;
        setMuseums(Array.isArray(payload?.museums) ? payload.museums : []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError((err as Error).message || 'Unable to load museum profile.');
      })
      .finally(() => {
        if (mounted) setMuseumsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [authChecked, isAuthorized, firebaseAuthReady]);

  const fetchData = useCallback(async () => {
    setSuccess('Real-time sync active. Data is up to date.');
    setTimeout(() => setSuccess(''), 3000);
  }, []);

  useEffect(() => {
    if (!authChecked || !isAuthorized || !firebaseAuthReady) return;

    setLoading(true);
    const db = getFirebaseClientRealtimeDatabase();

    // Set up controllers listener
    const controllersRef = databaseQuery(ref(db, 'controllers'), orderByChild('createdAt'));
    const unsubscribeControllers = onValue(controllersRef, (snapshot) => {
      const list: ControllerDevice[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        list.push({
          id: child.key || '',
          name: String(val.name || ''),
          museumId: String(val.museumId || ''),
          status: String(val.status || 'offline') as ControllerDevice['status'],
          lastActive: String(val.lastActive || ''),
          createdAt: String(val.createdAt || '')
        });
      });
      // Sort descending by createdAt
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setControllers(list);
      setLoading(false);
    }, (err) => {
      setError('Failed to subscribe to controllers updates: ' + err.message);
      setLoading(false);
    });

    // Set up scan logs listener
    const logsRef = databaseQuery(ref(db, 'scan_logs'), orderByChild('scannedAt'));
    const unsubscribeLogs = onValue(logsRef, (snapshot) => {
      const list: ScanLog[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        list.push({
          id: child.key || '',
          ticketId: String(val.ticketId || ''),
          deviceId: String(val.deviceId || ''),
          deviceName: String(val.deviceName || ''),
          scannedAt: String(val.scannedAt || ''),
          outcome: String(val.outcome || 'denied') as ScanLog['outcome'],
          message: String(val.message || '')
        });
      });
      // Sort descending by scannedAt
      list.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
      setScanLogs(list);
    }, (err) => {
      setError('Failed to subscribe to scan logs updates: ' + err.message);
    });

    // Set up bookings listener
    const bookingsRef = databaseQuery(ref(db, 'bookings'), orderByChild('createdAt'));
    const unsubscribeBookings = onValue(bookingsRef, (snapshot) => {
      const list: Booking[] = [];
      snapshot.forEach((child) => {
        list.push(toBooking(child.key || '', child.val()));
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBookings(list);
    }, (err) => {
      setError('Failed to subscribe to bookings updates: ' + err.message);
    });

    return () => {
      unsubscribeControllers();
      unsubscribeLogs();
      unsubscribeBookings();
    };
  }, [authChecked, isAuthorized, firebaseAuthReady]);

  // Handle register controller
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!deviceName.trim()) {
      setError('Device name cannot be blank.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/controllers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: deviceName, status: deviceStatus })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to register controller');
      }

      setSuccess(`Controller "${deviceName}" registered successfully!`);
      setDeviceName('');
      setDeviceStatus('active');
      void fetchData();
    } catch (err) {
      setError((err as Error).message || 'Failed to register controller.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle status update
  const handleStatusChange = async (id: string, status: 'active' | 'offline' | 'maintenance') => {
    setError('');
    try {
      const res = await fetch(`/api/controllers/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to update status');
      }

      setControllers((current) =>
        current.map((c) => (c.id === id ? { ...c, status, lastActive: new Date().toISOString() } : c))
      );
    } catch (err) {
      setError((err as Error).message || 'Failed to update status.');
    }
  };

  // Handle delete
  const handleDelete = async (id: string, name: string) => {
    const ok = window.confirm(`Are you sure you want to delete controller "${name}"?`);
    if (!ok) return;

    setError('');
    try {
      const res = await fetch(`/api/controllers/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Failed to delete controller');
      }

      setControllers((current) => current.filter((c) => c.id !== id));
    } catch (err) {
      setError((err as Error).message || 'Failed to delete controller.');
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const totalDevices = controllers.length;
    const activeDevices = controllers.filter((c) => c.status === 'active').length;
    const maintenanceDevices = controllers.filter((c) => c.status === 'maintenance').length;
    const totalScans = scanLogs.length;
    const successfulScans = scanLogs.filter((l) => l.outcome === 'granted').length;
    const failedScans = scanLogs.filter((l) => l.outcome === 'denied').length;
    const passRate = totalScans > 0 ? Math.round((successfulScans / totalScans) * 100) : 0;

    return {
      totalDevices,
      activeDevices,
      maintenanceDevices,
      totalScans,
      successfulScans,
      failedScans,
      passRate
    };
  }, [controllers, scanLogs]);

  // Filters
  const filteredControllers = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return controllers;
    return controllers.filter((c) =>
      c.name.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle)
    );
  }, [controllers, searchQuery]);

  const filteredLogs = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return scanLogs;
    return scanLogs.filter(
      (l) =>
        l.ticketId.toLowerCase().includes(needle) ||
        l.deviceName.toLowerCase().includes(needle) ||
        l.message.toLowerCase().includes(needle) ||
        l.outcome.toLowerCase().includes(needle)
    );
  }, [scanLogs, searchQuery]);

  const scopedBookings = useMemo(() => {
    if (!shouldRestrictToCurrentMuseum) {
      return bookings;
    }

    if (!currentMuseum) {
      return [];
    }

    const museumIds = new Set(
      [currentMuseum.id, currentMuseum.museum_id]
        .filter(Boolean)
        .map((value) => value.toLowerCase())
    );
    const museumName = currentMuseum.name.trim().toLowerCase();
    const museumLocation = currentMuseum.location.trim().toLowerCase();

    return bookings.filter((booking) => {
      const bookingMuseumId = booking.museumId?.trim().toLowerCase() || '';
      if (bookingMuseumId && museumIds.has(bookingMuseumId)) {
        return true;
      }

      const bookingMuseumName = booking.museumName?.trim().toLowerCase() || '';
      const bookingMuseumLocation = booking.museumLocation?.trim().toLowerCase() || '';
      return Boolean(
        museumName &&
        bookingMuseumName === museumName &&
        (!museumLocation || !bookingMuseumLocation || bookingMuseumLocation === museumLocation)
      );
    });
  }, [bookings, currentMuseum, shouldRestrictToCurrentMuseum]);

  const filteredBookings = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return scopedBookings;
    return scopedBookings.filter((booking) =>
      [
        booking.bookingId,
        booking.name,
        booking.email,
        booking.phone,
        booking.museumName || '',
        booking.museumLocation || '',
        booking.visitorType,
        booking.status,
        booking.paymentStatus
      ].some((value) => value.toLowerCase().includes(needle))
    );
  }, [scopedBookings, searchQuery]);

  const visitorStats = useMemo<VisitorStat[]>(() => {
    const stats = new Map<string, VisitorStat>();

    scopedBookings.forEach((booking) => {
      const emailKey = booking.email.trim().toLowerCase() || `guest-${booking.bookingId}`;
      const existing = stats.get(emailKey);
      if (existing) {
        existing.totalBookings += 1;
        existing.totalTickets += Number(booking.numberOfTickets || 0);
        existing.totalSpent += Number(booking.totalAmount || 0);
        if (new Date(booking.visitDate) > new Date(existing.lastVisit)) {
          existing.lastVisit = booking.visitDate;
        }
        return;
      }

      stats.set(emailKey, {
        email: booking.email || 'Guest visitor',
        name: booking.name || 'Guest',
        phone: booking.phone || '-',
        totalBookings: 1,
        totalTickets: Number(booking.numberOfTickets || 0),
        totalSpent: Number(booking.totalAmount || 0),
        lastVisit: booking.visitDate || booking.createdAt || '-'
      });
    });

    return Array.from(stats.values()).sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());
  }, [scopedBookings]);

  const filteredVisitors = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return visitorStats;
    return visitorStats.filter((visitor) =>
      [visitor.name, visitor.email, visitor.phone].some((value) => value.toLowerCase().includes(needle))
    );
  }, [visitorStats, searchQuery]);

  const bookingMetrics = useMemo(() => {
    const confirmed = scopedBookings.filter((booking) => booking.status === 'confirmed');
    return {
      totalBookings: scopedBookings.length,
      confirmedBookings: confirmed.length,
      totalTickets: confirmed.reduce((sum, booking) => sum + Number(booking.numberOfTickets || 0), 0),
      revenue: confirmed.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0),
      uniqueVisitors: visitorStats.length
    };
  }, [scopedBookings, visitorStats]);

  const detailModalContent = useMemo<DetailModalContent | null>(() => {
    if (!detailModal) return null;

    const empty = (message: string) => (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        {message}
      </div>
    );

    const controllerList = (items: ControllerDevice[]) => (
      items.length === 0 ? empty('No controllers found.') : (
        <div className="space-y-2">
          {items.map((device) => (
            <div key={device.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-foreground">{device.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground font-mono">{device.id}</div>
                </div>
                <span className="rounded-full border px-2 py-0.5 text-xs capitalize">{device.status}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Museum ref: {device.museumId || '-'}</div>
              <div className="mt-1 text-xs text-muted-foreground">Last sync: {formatDate(device.lastActive)}</div>
            </div>
          ))}
        </div>
      )
    );

    const bookingList = (items: Booking[]) => (
      items.length === 0 ? empty('No bookings found for this museum.') : (
        <div className="space-y-2">
          {items.map((booking) => (
            <div key={booking._id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-foreground">{booking.bookingId}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{booking.name || 'Guest'} · {booking.email || '-'}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(booking.totalAmount)}</div>
                  <div className="text-xs text-muted-foreground">{booking.status}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{formatDate(booking.visitDate)} · {booking.timeSlot}</div>
              <div className="mt-1 text-xs text-muted-foreground">{formatVisitorBreakdown(booking)}</div>
            </div>
          ))}
        </div>
      )
    );

    const visitorList = (items: VisitorStat[]) => (
      items.length === 0 ? empty('No visitors found for this museum.') : (
        <div className="space-y-2">
          {items.map((visitor) => (
            <div key={visitor.email} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-foreground">{visitor.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{visitor.email}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{visitor.phone}</div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{visitor.totalBookings} booking{visitor.totalBookings !== 1 ? 's' : ''}</div>
                  <div>{visitor.totalTickets} ticket{visitor.totalTickets !== 1 ? 's' : ''}</div>
                  <div className="font-semibold text-foreground">{formatCurrency(visitor.totalSpent)}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Last visit: {formatDate(visitor.lastVisit)}</div>
            </div>
          ))}
        </div>
      )
    );

    const scanList = (items: ScanLog[]) => (
      items.length === 0 ? empty('No scan logs found.') : (
        <div className="space-y-2">
          {items.map((log) => (
            <div key={log.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-foreground">{log.ticketId}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{log.deviceName || log.deviceId}</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  log.outcome === 'granted'
                    ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                }`}>
                  {log.outcome}
                </span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{formatDate(log.scannedAt)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{log.message || '-'}</div>
            </div>
          ))}
        </div>
      )
    );

    switch (detailModal) {
      case 'controllers':
        return {
          title: 'Total Controllers',
          subtitle: `${controllers.length} registered gate device${controllers.length !== 1 ? 's' : ''}`,
          body: controllerList(controllers)
        };
      case 'activeDevices': {
        const activeDevices = controllers.filter((device) => device.status === 'active');
        return {
          title: 'Active Devices',
          subtitle: `${activeDevices.length} online controller${activeDevices.length !== 1 ? 's' : ''}`,
          body: controllerList(activeDevices)
        };
      }
      case 'bookings':
        return {
          title: 'Bookings',
          subtitle: `${bookingMetrics.confirmedBookings} confirmed of ${bookingMetrics.totalBookings} total`,
          body: bookingList(scopedBookings)
        };
      case 'visitors':
        return {
          title: 'Visitors',
          subtitle: `${visitorStats.length} unique visitor${visitorStats.length !== 1 ? 's' : ''}`,
          body: visitorList(visitorStats)
        };
      case 'revenue': {
        const confirmedBookings = scopedBookings.filter((booking) => booking.status === 'confirmed');
        return {
          title: 'Revenue',
          subtitle: `${formatCurrency(bookingMetrics.revenue)} from confirmed bookings`,
          body: bookingList(confirmedBookings)
        };
      }
      case 'scans':
        return {
          title: 'Gate Scans Today',
          subtitle: `${metrics.successfulScans} approved | ${metrics.failedScans} rejected`,
          body: scanList(scanLogs)
        };
      case 'approvalRate':
        return {
          title: 'Approval Rate',
          subtitle: `${metrics.passRate}% granted across ${metrics.totalScans} scan${metrics.totalScans !== 1 ? 's' : ''}`,
          body: scanList(scanLogs)
        };
      default:
        return null;
    }
  }, [bookingMetrics, controllers, detailModal, metrics, scanLogs, scopedBookings, visitorStats]);

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <>
        <Header2 />
        <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-20">
          <section className="w-full rounded-2xl border border-red-200/50 bg-background p-6 shadow-xl dark:border-red-900/50">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Access Restricted</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You must be logged in as a Museum Administrator or Super Admin to access this dashboard.
            </p>
            <div className="mt-5 flex gap-3">
              <Link href="/login" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/95">
                Sign in
              </Link>
              <Link href="/" className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
                Back home
              </Link>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Header2 />
      <div className="min-h-screen bg-muted/10 pt-20 pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          
          {/* Header Card */}
          <div className="relative mb-8 overflow-hidden rounded-2xl border bg-background p-6 shadow-sm">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 h-36 w-36 rounded-full bg-linear-to-br from-emerald-500/10 to-teal-500/10 blur-xl"></div>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Supervisor Portal</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl mt-0.5">Museum Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage IoT ticket validation controllers, inspect real-time entry logs, and configure device states.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => void fetchData()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-xs hover:bg-muted"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <Link
                  href="/controller-dashboard"
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-teal-700"
                >
                  <Tv className="h-4 w-4" />
                  Simulator View
                </Link>
              </div>
            </div>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-950/20 dark:bg-emerald-950/20 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>{success}</span>
            </div>
          )}
          {shouldRestrictToCurrentMuseum && !museumsLoading && !currentMuseum && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>No Firestore museum is linked with {signedInEmail || 'this account'}. Add this email to the museum document `loginEmail` field to show its bookings and visitors.</span>
            </div>
          )}

          <AnimatePresence>
            {detailModalContent && (
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="metric-detail-title"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setDetailModal(null);
                  }
                }}
              >
                <motion.div
                  className="max-h-[86vh] w-full max-w-2xl overflow-hidden rounded-xl border bg-background shadow-2xl"
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 18, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                >
                  <div className="flex items-start justify-between gap-4 border-b p-5">
                    <div>
                      <h2 id="metric-detail-title" className="text-xl font-bold text-foreground">
                        {detailModalContent.title}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">{detailModalContent.subtitle}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailModal(null)}
                      className="rounded-lg border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      aria-label="Close details"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-[64vh] overflow-y-auto p-5">
                    {detailModalContent.body}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Navigation */}
          <div className="mb-6 border-b border-border/80 flex items-center justify-between">
            <div className="flex gap-4">
              {(['overview', 'bookings', 'visitors', 'controllers', 'logs'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setSearchQuery('');
                  }}
                  className={`pb-3 text-sm font-medium capitalize border-b-2 transition-all relative ${
                    activeTab === tab
                      ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            {/* Search Input for Controllers/Logs tab */}
            {activeTab !== 'overview' && (
              <div className="relative mb-2 w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'controllers'
                      ? 'Search devices...'
                      : activeTab === 'logs'
                      ? 'Search scans...'
                      : activeTab === 'visitors'
                      ? 'Search visitors...'
                      : 'Search bookings...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border bg-background py-1.5 pl-9 pr-3 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            )}
          </div>

          {/* Tab Contents */}
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Stats Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                  <button
                    type="button"
                    onClick={() => setDetailModal('controllers')}
                    className="rounded-xl border bg-background p-5 text-left shadow-xs transition hover:border-emerald-500/40 hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Controllers</span>
                      <Sliders className="h-5 w-5 text-emerald-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{metrics.totalDevices}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Registered gate devices</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModal('activeDevices')}
                    className="rounded-xl border bg-background p-5 text-left shadow-xs transition hover:border-emerald-500/40 hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Devices</span>
                      <Wifi className="h-5 w-5 text-emerald-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      {metrics.activeDevices}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Online and verifying QR codes</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModal('bookings')}
                    className="rounded-xl border bg-background p-5 text-left shadow-xs transition hover:border-blue-500/40 hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Bookings</span>
                      <Ticket className="h-5 w-5 text-blue-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{bookingMetrics.totalBookings}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{bookingMetrics.confirmedBookings} confirmed</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModal('visitors')}
                    className="rounded-xl border bg-background p-5 text-left shadow-xs transition hover:border-blue-500/40 hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Visitors</span>
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{bookingMetrics.uniqueVisitors}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{bookingMetrics.totalTickets} tickets sold</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModal('revenue')}
                    className="rounded-xl border bg-background p-5 text-left shadow-xs transition hover:border-emerald-500/40 hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Revenue</span>
                      <IndianRupee className="h-5 w-5 text-emerald-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{formatCurrency(bookingMetrics.revenue)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Confirmed bookings only</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModal('scans')}
                    className="rounded-xl border bg-background p-5 text-left shadow-xs transition hover:border-teal-500/40 hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Gate Scans Today</span>
                      <History className="h-5 w-5 text-teal-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{metrics.totalScans}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {metrics.successfulScans} approved | {metrics.failedScans} rejected
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModal('approvalRate')}
                    className="rounded-xl border bg-background p-5 text-left shadow-xs transition hover:border-teal-500/40 hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Approval Rate</span>
                      <TrendingUp className="h-5 w-5 text-teal-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{metrics.passRate}%</p>
                    <p className="mt-1 text-xs text-muted-foreground">Scans with Granted outcome</p>
                  </button>
                </div>

                <div className="grid gap-6 md:grid-cols-[1fr_360px]">
                  {/* Recent Activity Mini Log */}
                  <div className="rounded-xl border bg-background p-5 shadow-xs">
                    <h2 className="text-lg font-bold text-foreground mb-4">Live Entry Stream</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground font-medium">
                            <th className="pb-2">Time</th>
                            <th className="pb-2">Ticket ID</th>
                            <th className="pb-2">Gate</th>
                            <th className="pb-2">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading ? (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-muted-foreground">
                                <Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-500" />
                              </td>
                            </tr>
                          ) : scanLogs.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-muted-foreground">
                                No entry scans logged yet.
                              </td>
                            </tr>
                          ) : (
                            scanLogs.slice(0, 7).map((log) => (
                              <tr key={log.id} className="border-b last:border-0 hover:bg-muted/10">
                                <td className="py-2.5 text-xs text-muted-foreground">{formatDate(log.scannedAt)}</td>
                                <td className="py-2.5 font-medium">{log.ticketId}</td>
                                <td className="py-2.5 text-xs">{log.deviceName}</td>
                                <td className="py-2.5">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      log.outcome === 'granted'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                                        : 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                                    }`}
                                  >
                                    {log.outcome}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Simulator Shortcut Panel */}
                  <div className="flex flex-col justify-between rounded-xl border border-emerald-200/50 bg-linear-to-br from-emerald-500/5 to-teal-500/5 p-6 shadow-xs dark:border-emerald-900/20">
                    <div>
                      <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">Test Entry Simulator</h3>
                      <p className="mt-2 text-sm text-emerald-700/80 dark:text-emerald-400/80">
                        Launch the simulated gate controller interface. Perfect for testing QR scan responses, checking duplicate ticket alerts, and confirming audio indicators.
                      </p>
                    </div>
                    <div className="mt-6">
                      <Link
                        href="/controller-dashboard"
                        className="flex w-full justify-center items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
                      >
                        <Tv className="h-5 w-5" />
                        Go to Simulator
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'bookings' && (
              <motion.div
                key="bookings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border bg-background p-5 shadow-xs"
              >
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Museum Bookings</h3>
                    <p className="text-sm text-muted-foreground">
                      {currentMuseum ? `${currentMuseum.name} bookings only` : shouldRestrictToCurrentMuseum ? 'Link this account to a Firestore museum to show bookings' : 'All museum bookings'}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {scopedBookings.length} booking{scopedBookings.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground font-medium">
                        <th className="pb-3 pr-3">Booking</th>
                        <th className="pb-3 pr-3">Visitor</th>
                        <th className="pb-3 pr-3">Museum</th>
                        <th className="pb-3 pr-3">Visit</th>
                        <th className="pb-3 pr-3">Tickets</th>
                        <th className="pb-3 pr-3">Amount</th>
                        <th className="pb-3 pr-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-16 text-center text-muted-foreground">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                          </td>
                        </tr>
                      ) : filteredBookings.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-16 text-center text-muted-foreground">
                            No bookings found for this museum.
                          </td>
                        </tr>
                      ) : (
                        filteredBookings.map((booking) => (
                          <tr key={booking._id} className="border-b last:border-0 hover:bg-muted/10">
                            <td className="py-3.5 pr-3">
                              <div className="font-semibold text-foreground">{booking.bookingId}</div>
                              <div className="text-xs text-muted-foreground">{formatDate(booking.createdAt)}</div>
                            </td>
                            <td className="py-3.5 pr-3">
                              <div className="font-medium">{booking.name || '-'}</div>
                              <div className="text-xs text-muted-foreground">{booking.email || '-'}</div>
                              <div className="text-xs text-muted-foreground">{booking.phone || '-'}</div>
                            </td>
                            <td className="py-3.5 pr-3">
                              <div className="font-medium">{booking.museumName || currentMuseum?.name || '-'}</div>
                              <div className="text-xs text-muted-foreground">{booking.museumLocation || currentMuseum?.location || '-'}</div>
                            </td>
                            <td className="py-3.5 pr-3">
                              <div>{formatDate(booking.visitDate)}</div>
                              <div className="text-xs text-muted-foreground">{booking.timeSlot}</div>
                            </td>
                            <td className="py-3.5 pr-3">
                              <div className="font-medium">{booking.numberOfTickets}</div>
                              <div className="max-w-[220px] text-xs text-muted-foreground">{formatVisitorBreakdown(booking)}</div>
                            </td>
                            <td className="py-3.5 pr-3">
                              <div className="font-semibold">{formatCurrency(booking.totalAmount)}</div>
                              <div className="text-xs text-muted-foreground">{booking.paymentStatus}</div>
                            </td>
                            <td className="py-3.5 pr-3">
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                booking.status === 'confirmed'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                                  : booking.status === 'cancelled'
                                  ? 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                              }`}>
                                {booking.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'visitors' && (
              <motion.div
                key="visitors"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border bg-background p-5 shadow-xs"
              >
                <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Museum Visitors</h3>
                    <p className="text-sm text-muted-foreground">
                      Unique visitors calculated from this museum's bookings.
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {visitorStats.length} visitor{visitorStats.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground font-medium">
                        <th className="pb-3 pr-3">Visitor</th>
                        <th className="pb-3 pr-3">Phone</th>
                        <th className="pb-3 pr-3">Bookings</th>
                        <th className="pb-3 pr-3">Tickets</th>
                        <th className="pb-3 pr-3">Spent</th>
                        <th className="pb-3 pr-3">Last Visit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-muted-foreground">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                          </td>
                        </tr>
                      ) : filteredVisitors.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-16 text-center text-muted-foreground">
                            No visitors found for this museum.
                          </td>
                        </tr>
                      ) : (
                        filteredVisitors.map((visitor) => (
                          <tr key={visitor.email} className="border-b last:border-0 hover:bg-muted/10">
                            <td className="py-3.5 pr-3">
                              <div className="font-semibold text-foreground">{visitor.name}</div>
                              <div className="text-xs text-muted-foreground">{visitor.email}</div>
                            </td>
                            <td className="py-3.5 pr-3 text-muted-foreground">{visitor.phone}</td>
                            <td className="py-3.5 pr-3 font-medium">{visitor.totalBookings}</td>
                            <td className="py-3.5 pr-3 font-medium">{visitor.totalTickets}</td>
                            <td className="py-3.5 pr-3 font-semibold">{formatCurrency(visitor.totalSpent)}</td>
                            <td className="py-3.5 pr-3 text-muted-foreground">{formatDate(visitor.lastVisit)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'controllers' && (
              <motion.div
                key="controllers"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="grid gap-6 md:grid-cols-[280px_1fr]"
              >
                {/* Registration Form Panel */}
                <div className="rounded-xl border bg-background p-5 shadow-xs h-fit">
                  <h3 className="text-md font-bold text-foreground mb-4 flex items-center gap-2">
                    <PlusCircle className="h-5 w-5 text-emerald-500" />
                    Register Gate
                  </h3>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Device / Gate Name
                      </label>
                      <input
                        type="text"
                        required
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        placeholder="e.g. North Gate Turnstile"
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Initial Status
                      </label>
                      <select
                        value={deviceStatus}
                        onChange={(e) => setDeviceStatus(e.target.value as any)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="active">Active (Online)</option>
                        <option value="offline">Offline</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex justify-center items-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {submitting ? 'Registering...' : 'Register Device'}
                    </button>
                  </form>
                </div>

                {/* Controllers List */}
                <div className="rounded-xl border bg-background p-5 shadow-xs">
                  <h3 className="text-lg font-bold text-foreground mb-4">Device Controller List</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground font-medium">
                          <th className="pb-2.5">Device</th>
                          <th className="pb-2.5">Museum Ref</th>
                          <th className="pb-2.5">Status</th>
                          <th className="pb-2.5">Last Sync</th>
                          <th className="pb-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-muted-foreground">
                              <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                            </td>
                          </tr>
                        ) : filteredControllers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-muted-foreground">
                              No controller devices found matching criteria.
                            </td>
                          </tr>
                        ) : (
                          filteredControllers.map((device) => (
                            <tr key={device.id} className="border-b last:border-0 hover:bg-muted/10">
                              <td className="py-4 pr-3">
                                <div className="font-semibold text-foreground">{device.name}</div>
                                <div className="text-xs text-muted-foreground font-mono mt-0.5">{device.id}</div>
                              </td>
                              <td className="py-4 pr-3 text-xs text-muted-foreground">
                                {device.museumId}
                              </td>
                              <td className="py-4 pr-3">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    device.status === 'active'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                                      : device.status === 'maintenance'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                                  }`}
                                >
                                  {device.status === 'active' ? (
                                    <Wifi className="h-3 w-3" />
                                  ) : (
                                    <WifiOff className="h-3 w-3" />
                                  )}
                                  {device.status}
                                </span>
                              </td>
                              <td className="py-4 pr-3 text-xs text-muted-foreground">
                                {formatDate(device.lastActive)}
                              </td>
                              <td className="py-4 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <select
                                    value={device.status}
                                    onChange={(e) => void handleStatusChange(device.id, e.target.value as any)}
                                    className="rounded-md border bg-background px-2 py-1 text-xs"
                                  >
                                    <option value="active">Active</option>
                                    <option value="offline">Offline</option>
                                    <option value="maintenance">Maint.</option>
                                  </select>
                                  <button
                                    onClick={() => void handleDelete(device.id, device.name)}
                                    className="rounded-md border border-red-200 p-1 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/20"
                                    title="Delete Device"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'logs' && (
              <motion.div
                key="logs"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border bg-background p-5 shadow-xs"
              >
                <h3 className="text-lg font-bold text-foreground mb-4">Complete Validation Audit Trail</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground font-medium">
                        <th className="pb-3 pr-3">Timestamp</th>
                        <th className="pb-3 pr-3">Ticket ID</th>
                        <th className="pb-3 pr-3">Verification Point</th>
                        <th className="pb-3 pr-3">Outcome</th>
                        <th className="pb-3 pr-3">Detailed Status Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="py-16 text-center text-muted-foreground">
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" />
                          </td>
                        </tr>
                      ) : filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-16 text-center text-muted-foreground">
                            No validation logs recorded.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => (
                          <tr key={log.id} className="border-b last:border-0 hover:bg-muted/10">
                            <td className="py-3.5 pr-3 text-xs text-muted-foreground font-mono">
                              {formatDate(log.scannedAt)}
                            </td>
                            <td className="py-3.5 pr-3 font-semibold text-foreground">
                              {log.ticketId}
                            </td>
                            <td className="py-3.5 pr-3">
                              <div className="text-sm font-medium">{log.deviceName}</div>
                              <div className="text-xs text-muted-foreground font-mono">{log.deviceId}</div>
                            </td>
                            <td className="py-3.5 pr-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  log.outcome === 'granted'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-300'
                                    : 'bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-300'
                                }`}
                              >
                                {log.outcome === 'granted' ? 'GRANTED' : 'DENIED'}
                              </span>
                            </td>
                            <td className="py-3.5 pr-3 text-xs text-muted-foreground max-w-xs truncate" title={log.message}>
                              {log.message}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </>
  );
}
