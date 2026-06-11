"use client";

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
  AlertCircle
} from 'lucide-react';
import Header2 from '../../components/mvpblocks/header-2';

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

export default function MuseumDashboardPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // States
  const [controllers, setControllers] = useState<ControllerDevice[]>([]);
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'controllers' | 'logs'>('overview');

  // Register Form State
  const [deviceName, setDeviceName] = useState('');
  const [deviceStatus, setDeviceStatus] = useState<'active' | 'offline' | 'maintenance'>('active');

  // Search/Filter State
  const [searchQuery, setSearchQuery] = useState('');

  const isAuthorized = user?.role === 'admin' || user?.role === 'museum';

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
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [controllersRes, logsRes] = await Promise.all([
        fetch('/api/controllers', { cache: 'no-store' }),
        fetch('/api/scan-logs', { cache: 'no-store' })
      ]);

      const controllersData = await controllersRes.json().catch(() => ({}));
      const logsData = await logsRes.json().catch(() => ({}));

      if (controllersRes.ok && controllersData?.success) {
        setControllers(controllersData.controllers || []);
      } else {
        throw new Error(controllersData?.message || 'Failed to fetch controllers');
      }

      if (logsRes.ok && logsData?.success) {
        setScanLogs(logsData.logs || []);
      } else {
        throw new Error(logsData?.message || 'Failed to fetch scan logs');
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred while loading data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked && isAuthorized) {
      void fetchData();
    }
  }, [authChecked, isAuthorized, fetchData]);

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

          {/* Tab Navigation */}
          <div className="mb-6 border-b border-border/80 flex items-center justify-between">
            <div className="flex gap-4">
              {(['overview', 'controllers', 'logs'] as const).map((tab) => (
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
                  placeholder={activeTab === 'controllers' ? 'Search devices...' : 'Search scans...'}
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border bg-background p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Controllers</span>
                      <Sliders className="h-5 w-5 text-emerald-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{metrics.totalDevices}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Registered gate devices</p>
                  </div>
                  <div className="rounded-xl border bg-background p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Devices</span>
                      <Wifi className="h-5 w-5 text-emerald-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                      {metrics.activeDevices}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Online and verifying QR codes</p>
                  </div>
                  <div className="rounded-xl border bg-background p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Gate Scans Today</span>
                      <History className="h-5 w-5 text-teal-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{metrics.totalScans}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {metrics.successfulScans} approved | {metrics.failedScans} rejected
                    </p>
                  </div>
                  <div className="rounded-xl border bg-background p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Approval Rate</span>
                      <TrendingUp className="h-5 w-5 text-teal-500" />
                    </div>
                    <p className="mt-2 text-3xl font-bold">{metrics.passRate}%</p>
                    <p className="mt-1 text-xs text-muted-foreground">Scans with Granted outcome</p>
                  </div>
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
