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
  ShieldAlert,
  Ticket,
  Trash2,
  Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminSidebar } from '../../components/ui/admin-sidebar';
import { DashboardCard } from '../../components/ui/dashboard-card';
import { DashboardHeader } from '../../components/ui/dashboard-header';
import { RevenueChart } from '../../components/ui/revenue-chart';
import { SidebarInset, SidebarProvider } from '../../components/ui/sidebar';

type Booking = {
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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<HealthState>('checking');
  const [user, setUser] = useState<StoredUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    setUser(readStoredUser());
    setAuthChecked(true);
  }, []);

  const loadBookings = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError('');

    try {
      const response = await fetch('/api/bookings', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || 'Unable to load bookings');
      }

      setBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch (err) {
      setError((err as Error).message || 'Unable to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  useEffect(() => {
    if (!authChecked || !isAdmin) return;
    void loadBookings();
    void checkHealth();
  }, [authChecked, checkHealth, isAdmin, loadBookings]);

  const filteredBookings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return bookings;

    return bookings.filter((booking) => {
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
  }, [bookings, query]);

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
        <section id="dashboard" className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-lg border bg-background p-5 shadow-sm">
          <div>
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">Bharat Museum Operations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage bookings, monitor payments, and review ticketing activity.
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardStats.map((stat, index) => (
            <DashboardCard key={stat.title} stat={stat} index={index} />
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <section id="bookings" className="rounded-lg border bg-background p-4 shadow-sm">
            <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h2 className="text-lg font-semibold">Bookings</h2>
                <p className="text-sm text-muted-foreground">Search, update status, or remove ticket records.</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search bookings"
                  className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
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

          <aside className="space-y-4">
            <section className="rounded-lg border bg-background p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">System Status</h2>
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

            <section className="rounded-lg border bg-background p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
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
          </aside>
        </div>
        <section id="analytics">
          <RevenueChart />
        </section>
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
