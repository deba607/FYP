"use client";

import { useCallback, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Tv,
  Wifi,
  WifiOff,
  History,
  QrCode,
  ArrowRight,
  ShieldAlert,
  Volume2,
  VolumeX,
  Lock,
  Unlock
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
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export default function ControllerDashboardPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Lists
  const [controllers, setControllers] = useState<ControllerDevice[]>([]);
  const [localLogs, setLocalLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Active States
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [ticketInput, setTicketInput] = useState('');
  const [scanning, setScanning] = useState(false);

  // Gate Status Feedback
  const [validationResult, setValidationResult] = useState<{
    status: 'idle' | 'success' | 'failed';
    message: string;
    bookingDetails?: any;
  }>({ status: 'idle', message: '' });

  // UI States
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [gateOpenCountdown, setGateOpenCountdown] = useState(0);

  const isAuthorized =
    user?.role === 'admin' || user?.role === 'museum' || user?.role === 'controller';

  const selectedDevice = useMemo(() => {
    return controllers.find((c) => c.id === selectedDeviceId) || null;
  }, [controllers, selectedDeviceId]);

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

  const fetchControllers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/controllers', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        const list: ControllerDevice[] = data.controllers || [];
        setControllers(list);
        if (list.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(list[0]!.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch controllers:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDeviceId]);

  const fetchLocalLogs = useCallback(async (devId: string) => {
    if (!devId) return;
    try {
      const res = await fetch(`/api/scan-logs?deviceId=${devId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setLocalLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch local logs:', err);
    }
  }, []);

  // Fetch controllers initially
  useEffect(() => {
    if (authChecked && isAuthorized) {
      void fetchControllers();
    }
  }, [authChecked, isAuthorized, fetchControllers]);

  // Fetch logs whenever the selected device changes
  useEffect(() => {
    if (selectedDeviceId) {
      void fetchLocalLogs(selectedDeviceId);
      setValidationResult({ status: 'idle', message: '' });
      setGateOpenCountdown(0);
    }
  }, [selectedDeviceId, fetchLocalLogs]);

  // Turnstile Gate Opening Countdown
  useEffect(() => {
    if (gateOpenCountdown <= 0) return;
    const interval = setInterval(() => {
      setGateOpenCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gateOpenCountdown]);

  // Sound triggers
  const playSound = (type: 'success' | 'error') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.connect(gain);
      gain.connect(context.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, context.currentTime); // High pitch A5
        gain.gain.setValueAtTime(0.1, context.currentTime);
        osc.start();
        osc.stop(context.currentTime + 0.15);
        // Play secondary chime note
        setTimeout(() => {
          const osc2 = context.createOscillator();
          const gain2 = context.createGain();
          osc2.connect(gain2);
          gain2.connect(context.destination);
          osc2.frequency.setValueAtTime(1318.5, context.currentTime); // E6
          gain2.gain.setValueAtTime(0.08, context.currentTime);
          osc2.start();
          osc2.stop(context.currentTime + 0.2);
        }, 120);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, context.currentTime); // Low buzz
        gain.gain.setValueAtTime(0.15, context.currentTime);
        osc.start();
        osc.stop(context.currentTime + 0.35);
      }
    } catch (err) {
      console.error('Audio play error:', err);
    }
  };

  // Change Device Status from simulator
  const handleDeviceStatusChange = async (status: 'active' | 'offline' | 'maintenance') => {
    if (!selectedDeviceId) return;
    try {
      const res = await fetch(`/api/controllers/${selectedDeviceId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setControllers((current) =>
          current.map((c) => (c.id === selectedDeviceId ? { ...c, status } : c))
        );
      }
    } catch (err) {
      console.error('Failed to change device status:', err);
    }
  };

  // Trigger Ticket Verification
  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeviceId) {
      alert('Please register and select a gate device first.');
      return;
    }
    const cleanInput = ticketInput.trim();
    if (!cleanInput) return;

    setScanning(true);
    setValidationResult({ status: 'idle', message: '' });

    try {
      const res = await fetch('/api/bookings/validate-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: cleanInput,
          deviceId: selectedDeviceId
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success) {
        const isValid = data.valid;
        if (isValid) {
          setValidationResult({
            status: 'success',
            message: data.message || 'Access granted - Ticket is valid.',
            bookingDetails: data.booking
          });
          playSound('success');
          setGateOpenCountdown(7); // Keep gate open for 7 seconds
          setTicketInput('');
        } else {
          setValidationResult({
            status: 'failed',
            message: data.message || 'Access denied - Invalid ticket.'
          });
          playSound('error');
        }
      } else {
        setValidationResult({
          status: 'failed',
          message: data?.message || 'Verification system request error.'
        });
        playSound('error');
      }
    } catch (err) {
      setValidationResult({
        status: 'failed',
        message: 'Network error occurred while validating.'
      });
      playSound('error');
    } finally {
      setScanning(false);
      void fetchLocalLogs(selectedDeviceId);
    }
  };

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
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
              You must be registered as a Supervisor, Operator, or Admin to open this scanner simulation page.
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
      <div className="min-h-screen bg-[#0b0f19] text-[#e2e8f0] pt-20 pb-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          
          {/* Dashboard Header */}
          <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Tv className="h-5 w-5 text-teal-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-teal-400">Simulated Hardware Terminal</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">Controller Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                  soundEnabled
                    ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
                title={soundEnabled ? 'Disable alert buzzer' : 'Enable alert buzzer'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {soundEnabled ? 'Buzzer On' : 'Buzzer Off'}
              </button>
              {(user?.role === 'admin' || user?.role === 'museum') && (
                <Link
                  href="/museum-dashboard"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
                >
                  Museum supervisor
                </Link>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* Main Validation Simulator */}
            <div className="space-y-6">
              
              {/* Select device & status control card */}
              <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 shadow-lg">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Selected Validation Device
                    </label>
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
                    ) : controllers.length === 0 ? (
                      <div className="text-sm text-amber-400 font-medium flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4" />
                        No active controllers registered. Create one in the Museum supervisor view.
                      </div>
                    ) : (
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => setSelectedDeviceId(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-hidden focus:ring-2 focus:ring-teal-500/20"
                      >
                        {controllers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.status})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  {selectedDevice && (
                    <div className="shrink-0">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Device State
                      </span>
                      <div className="flex rounded-lg border border-slate-700 bg-[#1f2937] p-1">
                        {(['active', 'offline', 'maintenance'] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => void handleDeviceStatusChange(st)}
                            className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${
                              selectedDevice.status === st
                                ? st === 'active'
                                  ? 'bg-emerald-600 text-white shadow-md'
                                  : st === 'maintenance'
                                  ? 'bg-amber-600 text-white shadow-md'
                                  : 'bg-slate-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Scanned / Validation Display Panel */}
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] shadow-xl">
                
                {/* Gate Physical Output Header */}
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-slate-400" />
                    <span className="text-sm font-semibold tracking-wider uppercase text-slate-300">
                      Gate Entry Terminal
                    </span>
                  </div>
                  {selectedDevice && (
                    <div className="flex items-center gap-1 text-xs font-medium">
                      <span className={`inline-block h-2 w-2 rounded-full ${selectedDevice.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                      <span className="text-slate-400">{selectedDevice.name}</span>
                    </div>
                  )}
                </div>

                {/* Big feedback screen */}
                <div className="relative flex flex-col items-center justify-center py-12 px-6 min-h-[260px] border-b border-slate-800">
                  <AnimatePresence mode="wait">
                    {validationResult.status === 'idle' && (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="text-center space-y-4"
                      >
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          <Lock className="h-8 w-8" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-slate-300">GATE SECURED</p>
                          <p className="text-sm text-slate-500 mt-1">Ready for ticket input scan</p>
                        </div>
                      </motion.div>
                    )}

                    {validationResult.status === 'success' && (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="text-center space-y-4 w-full"
                      >
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 animate-bounce">
                          <Unlock className="h-10 w-10" />
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-2xl font-black tracking-wider text-emerald-400 uppercase">ACCESS GRANTED</h2>
                          <p className="text-sm text-slate-300 font-semibold">{validationResult.message}</p>
                          
                          {validationResult.bookingDetails && (
                            <div className="mx-auto mt-4 max-w-sm rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-left text-xs text-slate-300">
                              <p className="font-semibold text-emerald-400 text-sm mb-1">{validationResult.bookingDetails.name}</p>
                              <p><span className="text-slate-500">Museum:</span> {validationResult.bookingDetails.museumName || 'Bharat Museum'}</p>
                              <p><span className="text-slate-500">Tickets:</span> {validationResult.bookingDetails.numberOfTickets} x {validationResult.bookingDetails.visitorType}</p>
                              <p><span className="text-slate-500">Date:</span> {validationResult.bookingDetails.visitDate} ({validationResult.bookingDetails.timeSlot})</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-4">
                          <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-mono text-emerald-400 animate-pulse">
                            Gate lock resets in {gateOpenCountdown}s
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {validationResult.status === 'failed' && (
                      <motion.div
                        key="failed"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="text-center space-y-4 w-full"
                      >
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-400 border border-red-500/30 shadow-lg shadow-red-500/10">
                          <XCircle className="h-10 w-10 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <h2 className="text-2xl font-black tracking-wider text-red-500 uppercase">ACCESS DENIED</h2>
                          <p className="text-sm text-slate-300 font-semibold px-4">{validationResult.message}</p>
                        </div>
                        <div className="mt-4">
                          <button
                            onClick={() => setValidationResult({ status: 'idle', message: '' })}
                            className="rounded-lg bg-slate-800 border border-slate-700 px-3.5 py-1.5 text-xs text-slate-300 hover:text-white"
                          >
                            Reset Terminal
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Input simulator barcode form */}
                <form onSubmit={handleScanSubmit} className="bg-slate-900/30 p-5">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <QrCode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        disabled={scanning || (selectedDevice && selectedDevice.status !== 'active')}
                        value={ticketInput}
                        onChange={(e) => setTicketInput(e.target.value)}
                        placeholder={
                          selectedDevice && selectedDevice.status !== 'active'
                            ? 'Device is OFFLINE / MAINTENANCE'
                            : 'Scan QR Code / Enter Ticket ID (e.g. BM...)'
                        }
                        className="w-full rounded-xl border border-slate-700 bg-[#0f172a] py-3.5 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={
                        scanning ||
                        !ticketInput.trim() ||
                        (selectedDevice && selectedDevice.status !== 'active')
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-40 transition-all shrink-0"
                    >
                      {scanning ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Verify
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

              </div>

            </div>

            {/* Local Scan Logs Feed */}
            <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 shadow-lg flex flex-col">
              <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-slate-400" />
                Local Scan Logs
              </h3>
              
              <div className="flex-1 max-h-[460px] overflow-y-auto space-y-3 pr-1">
                {localLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-12">
                    No scans registered for this device yet.
                  </p>
                ) : (
                  localLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`rounded-lg border p-3 text-xs flex justify-between items-start ${
                        log.outcome === 'granted'
                          ? 'border-green-500/10 bg-green-500/5'
                          : 'border-red-500/10 bg-red-500/5'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{log.ticketId}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.2 text-[9px] font-extrabold uppercase ${
                              log.outcome === 'granted'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {log.outcome}
                          </span>
                        </div>
                        <p className="text-slate-400 leading-normal">{log.message}</p>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap ml-2">
                        {formatDate(log.scannedAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </>
  );
}
