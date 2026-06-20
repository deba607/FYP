"use client";

import type { FormEvent, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserQRCodeReader } from '@zxing/browser';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  History,
  Loader2,
  Lock,
  QrCode,
  ShieldAlert,
  StopCircle,
  Tv,
  Unlock,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
  XCircle
} from 'lucide-react';
import Header2 from '../../components/mvpblocks/header-2';
import { getFirebaseClientRealtimeDatabase, getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import { ref, onValue, query as databaseQuery, orderByChild, limitToLast } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { subscribeToFirestoreUser } from '../../lib/firestoreUser';
import CrowdInsightsPanel from '../../components/crowd/CrowdInsightsPanel';

type GateAction = 'entry' | 'exit';

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
  museumId: string;
  scannedAt: string;
  outcome: 'granted' | 'denied';
  gateAction: GateAction;
  message: string;
};

type MuseumRecord = {
  id: string;
  museum_id: string;
  name: string;
  location: string;
  loginEmail?: string;
};

type StoredUser = {
  name?: string;
  email?: string;
  role?: string;
};

type ValidationResult = {
  status: 'idle' | 'success' | 'failed';
  message: string;
  bookingDetails?: any;
};

type CameraSession = {
  gateAction: GateAction;
  status: 'starting' | 'active';
  error: string;
} | null;

function waitForVideoElement(videoRef: RefObject<HTMLVideoElement | null>) {
  return new Promise<HTMLVideoElement | null>((resolve) => {
    const startedAt = Date.now();

    const check = () => {
      if (videoRef.current) {
        resolve(videoRef.current);
        return;
      }

      if (Date.now() - startedAt > 1500) {
        resolve(null);
        return;
      }

      window.requestAnimationFrame(check);
    };

    check();
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

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

function gateLabel(action: GateAction) {
  return action === 'entry' ? 'Entry' : 'Exit';
}

function gateAccent(action: GateAction) {
  return action === 'entry'
    ? {
      text: 'text-blue-300',
      border: 'border-blue-500/30',
      bg: 'bg-blue-500/10',
      button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
    }
    : {
      text: 'text-violet-300',
      border: 'border-violet-500/30',
      bg: 'bg-violet-500/10',
      button: 'bg-violet-600 hover:bg-violet-700 shadow-violet-600/20'
    };
}

function cameraErrorMessage(error: unknown) {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as any).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission denied. Allow camera access in the browser and try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera is already in use by another app or browser tab. Close it and retry.';
  }
  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return 'The selected camera could not satisfy the requested settings. Retry scanner or use manual input.';
  }
  if (name === 'SecurityError') {
    return 'Camera access is blocked by browser security settings.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Camera scanning requires HTTPS or localhost. Open this page on localhost or a secure HTTPS address.';
  }
  if (typeof navigator !== 'undefined' && !navigator.mediaDevices?.getUserMedia) {
    return 'This browser does not support camera scanning. Use manual ticket input.';
  }
  return 'Unable to start camera scanner. Use manual input or retry.';
}

function isExpectedQrDecodeMiss(error: unknown) {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as any).name) : '';
  return name === 'NotFoundException' || name === 'ChecksumException' || name === 'FormatException';
}

export default function ControllerDashboardPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [firebaseAuthReady, setFirebaseAuthReady] = useState(false);

  const [controllers, setControllers] = useState<ControllerDevice[]>([]);
  const [localLogs, setLocalLogs] = useState<ScanLog[]>([]);
  const [museums, setMuseums] = useState<MuseumRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedGateIds, setSelectedGateIds] = useState<Record<GateAction, string>>({
    entry: '',
    exit: ''
  });
  const [ticketInputs, setTicketInputs] = useState<Record<GateAction, string>>({
    entry: '',
    exit: ''
  });
  const [scanningAction, setScanningAction] = useState<GateAction | null>(null);
  const [cameraSession, setCameraSession] = useState<CameraSession>(null);

  const [validationResults, setValidationResults] = useState<Record<GateAction, ValidationResult>>({
    entry: { status: 'idle', message: '' },
    exit: { status: 'idle', message: '' }
  });

  const [soundEnabled, setSoundEnabled] = useState(false);
  const [gateOpenCountdown, setGateOpenCountdown] = useState<Record<GateAction, number>>({
    entry: 0,
    exit: 0
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerControlsRef = useRef<{ stop: () => void } | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const isAuthorized = user?.role === 'museum' || user?.role === 'controller';
  const signedInEmail = user?.email?.trim().toLowerCase() || '';
  const currentMuseum = useMemo(() => {
    if (!signedInEmail) return null;
    return museums.find((museum) => museum.loginEmail?.trim().toLowerCase() === signedInEmail) || null;
  }, [museums, signedInEmail]);
  // Only admins may see the global controller/crowd view. Museum and controller
  // accounts must be linked to a registered museum by loginEmail.
  const shouldRestrictToCurrentMuseum = user?.role !== 'admin';

  const scopedControllers = useMemo(() => {
    if (!shouldRestrictToCurrentMuseum) {
      return controllers;
    }

    if (!currentMuseum) {
      return [];
    }

    const museumIds = new Set(
      [currentMuseum.museum_id, currentMuseum.id]
        .filter(Boolean)
        .map((id) => id.trim().toLowerCase())
    );
    return controllers.filter((controller) => museumIds.has(controller.museumId.trim().toLowerCase()));
  }, [controllers, currentMuseum, shouldRestrictToCurrentMuseum]);

  const selectedDevices = useMemo(() => {
    return {
      entry: scopedControllers.find((c) => c.id === selectedGateIds.entry) || null,
      exit: scopedControllers.find((c) => c.id === selectedGateIds.exit) || null
    };
  }, [scopedControllers, selectedGateIds]);

  const visibleLogs = useMemo(() => {
    const availableDeviceIds = new Set(scopedControllers.map((controller) => controller.id));
    const museumIds = new Set(
      currentMuseum
        ? [currentMuseum.id, currentMuseum.museum_id]
          .filter(Boolean)
          .map((value) => value.toLowerCase())
        : []
    );
    const scopedLogs = shouldRestrictToCurrentMuseum
      ? localLogs.filter((log) => {
        const logMuseumId = log.museumId.trim().toLowerCase();
        if (logMuseumId && museumIds.has(logMuseumId)) {
          return true;
        }
        return availableDeviceIds.has(log.deviceId);
      })
      : localLogs;
    const selected = new Set(Object.values(selectedGateIds).filter(Boolean));
    if (selected.size === 0) return scopedLogs;
    return scopedLogs.filter((log) => selected.has(log.deviceId));
  }, [currentMuseum, localLogs, scopedControllers, selectedGateIds, shouldRestrictToCurrentMuseum]);

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
            console.error('Controller Dashboard Firestore user listener error:', err);
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
        console.error('Failed to load museums for controller scoping:', err);
      });

    return () => {
      mounted = false;
    };
  }, [authChecked, isAuthorized, firebaseAuthReady]);

  useEffect(() => {
    if (!authChecked || !isAuthorized || !firebaseAuthReady) return;

    setLoading(true);
    const db = getFirebaseClientRealtimeDatabase();
    const controllersRef = databaseQuery(ref(db, 'controllers'), orderByChild('createdAt'));

    const unsubscribe = onValue(controllersRef, (snapshot) => {
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
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setControllers(list);
      setLoading(false);
    }, (err) => {
      console.error('Failed to subscribe to controllers:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authChecked, isAuthorized, firebaseAuthReady]);

  useEffect(() => {
    setSelectedGateIds((prev) => {
      if (scopedControllers.length === 0) return { entry: '', exit: '' };
      const first = scopedControllers[0]!.id;
      const second = scopedControllers[1]?.id || first;
      return {
        entry: prev.entry && scopedControllers.some((c) => c.id === prev.entry) ? prev.entry : first,
        exit: prev.exit && scopedControllers.some((c) => c.id === prev.exit) ? prev.exit : second
      };
    });
  }, [scopedControllers]);

  useEffect(() => {
    if (!firebaseAuthReady) return;

    const db = getFirebaseClientRealtimeDatabase();
    const logsRef = databaseQuery(ref(db, 'scan_logs'), orderByChild('scannedAt'), limitToLast(200));

    const unsubscribe = onValue(logsRef, (snapshot) => {
      const list: ScanLog[] = [];
      snapshot.forEach((child) => {
        const val = child.val();
        list.push({
          id: child.key || '',
          ticketId: String(val.ticketId || ''),
          deviceId: String(val.deviceId || ''),
          deviceName: String(val.deviceName || ''),
          museumId: String(val.museumId || ''),
          scannedAt: String(val.scannedAt || ''),
          outcome: String(val.outcome || 'denied') as ScanLog['outcome'],
          gateAction: String(val.gateAction || 'entry') as ScanLog['gateAction'],
          message: String(val.message || '')
        });
      });
      list.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
      setLocalLogs(list);
    }, (err) => {
      console.error('Failed to subscribe to scan logs:', err);
    });

    return () => unsubscribe();
  }, [firebaseAuthReady]);

  useEffect(() => {
    if (gateOpenCountdown.entry <= 0 && gateOpenCountdown.exit <= 0) return;
    const interval = setInterval(() => {
      setGateOpenCountdown((prev) => ({
        entry: Math.max(0, prev.entry - 1),
        exit: Math.max(0, prev.exit - 1)
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [gateOpenCountdown.entry, gateOpenCountdown.exit]);

  useEffect(() => {
    (['entry', 'exit'] as const).forEach((gateAction) => {
      if (gateOpenCountdown[gateAction] !== 0 || validationResults[gateAction].status !== 'success') {
        return;
      }

      setValidationResults((current) => ({
        ...current,
        [gateAction]: { status: 'idle', message: '' }
      }));
    });
  }, [gateOpenCountdown, validationResults]);

  useEffect(() => {
    return () => {
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
  }, []);

  const playSound = useCallback((type: 'success' | 'error') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = context.createOscillator();
      const gain = context.createGain();

      osc.connect(gain);
      gain.connect(context.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, context.currentTime);
        gain.gain.setValueAtTime(0.1, context.currentTime);
        osc.start();
        osc.stop(context.currentTime + 0.15);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, context.currentTime);
        gain.gain.setValueAtTime(0.15, context.currentTime);
        osc.start();
        osc.stop(context.currentTime + 0.35);
      }
    } catch (err) {
      console.error('Audio play error:', err);
    }
  }, [soundEnabled]);

  const stopCamera = useCallback((message = 'Scanner stopped.') => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setCameraSession((current) => current ? { ...current, error: message } : null);
  }, []);

  const handleDeviceStatusChange = async (deviceId: string, status: 'active' | 'offline' | 'maintenance') => {
    if (!deviceId) return;
    try {
      const res = await fetch(`/api/controllers/${deviceId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setControllers((current) =>
          current.map((c) => (c.id === deviceId ? { ...c, status } : c))
        );
      }
    } catch (err) {
      console.error('Failed to change device status:', err);
    }
  };

  const validateTicket = useCallback(async (gateAction: GateAction, ticketId: unknown, deviceId: string) => {
    const cleanInput = String(ticketId || '').trim();
    if (!cleanInput) return;

    setScanningAction(gateAction);
    setValidationResults((current) => ({
      ...current,
      [gateAction]: { status: 'idle', message: '' }
    }));

    try {
      const res = await fetch('/api/bookings/validate-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: cleanInput,
          deviceId,
          gateAction,
          operatorEmail: user?.email,
          operatorRole: user?.role
        })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && typeof data?.valid === 'boolean') {
        if (data.valid) {
          window.dispatchEvent(new Event('crowd-insights-updated'));
          setValidationResults((current) => ({
            ...current,
            [gateAction]: {
              status: 'success',
              message: data.message || `${gateLabel(gateAction)} verified successfully.`,
              bookingDetails: data.booking
            }
          }));
          playSound('success');
          setGateOpenCountdown((current) => ({ ...current, [gateAction]: 7 }));
          setTicketInputs((current) => ({ ...current, [gateAction]: '' }));
        } else {
          setValidationResults((current) => ({
            ...current,
            [gateAction]: {
              status: 'failed',
              message: data.message || `${gateLabel(gateAction)} denied - Invalid ticket.`
            }
          }));
          playSound('error');
        }
      } else {
        setValidationResults((current) => ({
          ...current,
          [gateAction]: {
            status: 'failed',
            message: data?.message || 'Verification system request error.'
          }
        }));
        playSound('error');
      }
    } catch (err) {
      setValidationResults((current) => ({
        ...current,
        [gateAction]: {
          status: 'failed',
          message: 'Network error occurred while validating.'
        }
      }));
      playSound('error');
    } finally {
      setScanningAction(null);
    }
  }, [playSound, user?.email, user?.role]);

  const startCamera = useCallback(async (gateAction: GateAction) => {
    const device = selectedDevices[gateAction];
    if (!device) {
      setCameraSession({ gateAction, status: 'active', error: 'Please select a gate device first.' });
      return;
    }
    if (device.status !== 'active') {
      setCameraSession({ gateAction, status: 'active', error: 'Selected gate is offline or under maintenance.' });
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setCameraSession({ gateAction, status: 'active', error: 'Camera scanning requires HTTPS or localhost. Open this page on localhost or a secure HTTPS address.' });
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraSession({ gateAction, status: 'active', error: 'This browser does not support camera scanning. Use manual ticket input.' });
      return;
    }

    stopCamera('');
    setCameraSession({ gateAction, status: 'starting', error: '' });

    window.setTimeout(async () => {
      const videoElement = await waitForVideoElement(videoRef);
      if (!videoElement) {
        setCameraSession({ gateAction, status: 'active', error: 'Camera preview could not be opened.' });
        return;
      }

      let resolved = false;
      try {
        const stream = await withTimeout(
          navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          }),
          15000,
          'Camera permission timed out. Allow camera access and retry.'
        );

        cameraStreamRef.current = stream;
        videoElement.srcObject = stream;
        videoElement.muted = true;
        videoElement.playsInline = true;
        await videoElement.play().catch(() => undefined);
        setCameraSession({ gateAction, status: 'active', error: '' });

        const reader = new BrowserQRCodeReader();
        let controls: { stop: () => void } | null = null;
        controls = await withTimeout(reader.decodeFromStream(stream, videoElement, (result, error, scannerControls) => {
          if (error && !isExpectedQrDecodeMiss(error)) {
            console.error('QR scanner decode error:', error);
          }
          const value = String(result?.getText() || '').trim();
          if (!value || resolved) return;
          resolved = true;
          scannerControls.stop();
          scannerControlsRef.current = null;
          setCameraSession(null);
          void validateTicket(gateAction, value, device.id);
        }), 8000, 'Camera opened, but QR scanner could not start. Retry scanner or use manual input.');
        scannerControlsRef.current = controls;
      } catch (error) {
        console.error('QR scanner start error:', error);
        scannerControlsRef.current = null;
        cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
        if (videoElement) {
          videoElement.pause();
          videoElement.srcObject = null;
        }
        setCameraSession({ gateAction, status: 'active', error: cameraErrorMessage(error) });
      }
    }, 0);
  }, [selectedDevices, stopCamera, validateTicket]);

  const handleManualSubmit = (gateAction: GateAction) => (e: FormEvent) => {
    e.preventDefault();
    const device = selectedDevices[gateAction];
    if (!device) {
      setValidationResults((current) => ({
        ...current,
        [gateAction]: { status: 'failed', message: 'Please select a gate device first.' }
      }));
      return;
    }
    void validateTicket(gateAction, ticketInputs[gateAction], device.id);
  };

  const renderDeviceSelector = (gateAction: GateAction) => {
    const device = selectedDevices[gateAction];
    return (
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              {gateLabel(gateAction)} Gate Device
            </label>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
            ) : scopedControllers.length === 0 ? (
              <div className="flex items-center gap-1.5 text-sm font-medium text-amber-400">
                <ShieldAlert className="h-4 w-4" />
                No controllers registered. Create one in the Museum supervisor view.
              </div>
            ) : (
              <select
                value={selectedGateIds[gateAction]}
                onChange={(e) => setSelectedGateIds((current) => ({ ...current, [gateAction]: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-hidden focus:ring-2 focus:ring-teal-500/20"
              >
                {scopedControllers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {device && (
            <div className="shrink-0">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Device State
              </span>
              <div className="flex rounded-lg border border-slate-700 bg-[#1f2937] p-1">
                {(['active', 'offline', 'maintenance'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => void handleDeviceStatusChange(device.id, st)}
                    className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${device.status === st
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
    );
  };

  const renderGatePanel = (gateAction: GateAction) => {
    const device = selectedDevices[gateAction];
    const result = validationResults[gateAction];
    const disabled = !device || device.status !== 'active';
    const accent = gateAccent(gateAction);
    const isScanning = scanningAction === gateAction;
    const title = gateAction === 'entry' ? 'Gate Entry Terminal' : 'Gate Exit Terminal';

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-5 py-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-slate-400" />
            <span className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              {title}
            </span>
          </div>
          {device && (
            <div className="flex items-center gap-1 text-xs font-medium">
              {device.status === 'active' ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-red-400" />
              )}
              <span className="text-slate-400">{device.name}</span>
            </div>
          )}
        </div>

        <div className="relative flex min-h-[250px] flex-col items-center justify-center border-b border-slate-800 px-6 py-10">
          <AnimatePresence mode="wait">
            {result.status === 'idle' && (
              <motion.div
                key={`${gateAction}-idle`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4 text-center"
              >
                <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border ${accent.border} ${accent.bg} ${accent.text}`}>
                  <Lock className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-300">{gateLabel(gateAction).toUpperCase()} READY</p>
                  <p className="mt-1 text-sm text-slate-500">Open camera or enter ticket ID manually</p>
                </div>
              </motion.div>
            )}

            {result.status === 'success' && (
              <motion.div
                key={`${gateAction}-success`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full space-y-4 text-center"
              >
                <div className="mx-auto flex h-20 w-20 animate-bounce items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <Unlock className="h-10 w-10" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black uppercase tracking-wider text-emerald-400">
                    {gateAction === 'entry' ? 'ENTRY GRANTED' : 'EXIT RECORDED'}
                  </h2>
                  <p className="text-sm font-semibold text-slate-300">{result.message}</p>

                  {result.bookingDetails && (
                    <div className="mx-auto mt-4 max-w-sm rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-left text-xs text-slate-300">
                      <p className="mb-1 text-sm font-semibold text-emerald-400">{result.bookingDetails.name}</p>
                      <p><span className="text-slate-500">Museum:</span> {result.bookingDetails.museumName || 'Bharat Museum'}</p>
                      <p><span className="text-slate-500">Tickets:</span> {result.bookingDetails.numberOfTickets} x {result.bookingDetails.visitorType}</p>
                      <p><span className="text-slate-500">Date:</span> {result.bookingDetails.visitDate} ({result.bookingDetails.timeSlot})</p>
                      <p><span className="text-slate-500">Gender:</span> {result.bookingDetails.gender || '-'}</p>
                      <p><span className="text-slate-500">Age:</span> {result.bookingDetails.age || '-'}</p>
                      <p><span className="text-slate-500">Location:</span> {result.bookingDetails.userLocation || '-'}</p>
                    </div>
                  )}
                </div>
                <span className="inline-block rounded-full bg-emerald-500/20 px-3 py-1 font-mono text-xs text-emerald-400">
                  Gate lock resets in {gateOpenCountdown[gateAction]}s
                </span>
              </motion.div>
            )}

            {result.status === 'failed' && (
              <motion.div
                key={`${gateAction}-failed`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full space-y-4 text-center"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400 shadow-lg shadow-red-500/10">
                  <XCircle className="h-10 w-10 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-black uppercase tracking-wider text-red-500">ACCESS DENIED</h2>
                  <p className="px-4 text-sm font-semibold text-slate-300">{result.message}</p>
                </div>
                <button
                  onClick={() => setValidationResults((current) => ({ ...current, [gateAction]: { status: 'idle', message: '' } }))}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs text-slate-300 hover:text-white"
                >
                  Reset Terminal
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4 bg-slate-900/30 p-5">
          <button
            type="button"
            disabled={isScanning}
            onClick={() => void startCamera(gateAction)}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-40 ${accent.button}`}
          >
            <Camera className="h-5 w-5" />
            Open {gateLabel(gateAction)} Camera
          </button>

          <form onSubmit={handleManualSubmit(gateAction)} className="flex gap-2">
            <div className="relative flex-1">
              <QrCode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                disabled={isScanning || disabled}
                value={ticketInputs[gateAction]}
                onChange={(e) => setTicketInputs((current) => ({ ...current, [gateAction]: e.target.value }))}
                placeholder={disabled ? 'Gate is unavailable' : `${gateLabel(gateAction)} ticket ID fallback`}
                className="w-full rounded-xl border border-slate-700 bg-[#0f172a] py-3.5 pl-11 pr-4 text-sm text-white placeholder-slate-500 outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={isScanning || disabled || !ticketInputs[gateAction].trim()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition-all hover:bg-teal-700 disabled:opacity-40"
            >
              {isScanning ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <>
                  Verify
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
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
              You must be registered as a museum supervisor or controller to open this scanner simulation page.
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
      <div className="min-h-screen bg-[#0b0f19] pb-12 pt-20 text-[#e2e8f0]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Tv className="h-5 w-5 text-teal-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-teal-400">Camera QR Gate Terminal</span>
              </div>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">Controller Dashboard</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-all ${soundEnabled
                    ? 'border-teal-500/30 bg-teal-500/10 text-teal-400'
                    : 'border-slate-700 bg-slate-800 text-slate-400'
                  }`}
                title={soundEnabled ? 'Disable alert buzzer' : 'Enable alert buzzer'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {soundEnabled ? 'Buzzer On' : 'Buzzer Off'}
              </button>
              {(user?.role === 'admin' || user?.role === 'museum') && (
                <Link
                  href="/museum-dashboard"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  Museum supervisor
                </Link>
              )}
            </div>
          </div>

          {shouldRestrictToCurrentMuseum && !currentMuseum && (
            <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-5 text-sm text-slate-300">
              No registered museum is linked with {signedInEmail || 'this account'}. Crowd, controller, and scan details are blank.
            </div>
          )}

          {(!shouldRestrictToCurrentMuseum || currentMuseum) && (
            <CrowdInsightsPanel
              museumId={shouldRestrictToCurrentMuseum ? (currentMuseum?.museum_id || currentMuseum?.id) : undefined}
              title="Gate Occupancy Monitor"
              description="Granted entry and exit scans update this occupancy count automatically."
              canConfigure={user?.role === 'admin' || user?.role === 'museum'}
              showDetails
              className="mb-6 border-slate-800 bg-[#111827]"
            />
          )}

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {renderDeviceSelector('entry')}
                {renderDeviceSelector('exit')}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                {renderGatePanel('entry')}
                {renderGatePanel('exit')}
              </div>
            </div>

            <div className="flex flex-col rounded-xl border border-slate-800 bg-[#111827] p-5 shadow-lg">
              <h3 className="mb-4 flex items-center gap-2 text-md font-bold text-white">
                <History className="h-5 w-5 text-slate-400" />
                Local Scan Logs
              </h3>

              <div className="max-h-[720px] flex-1 space-y-3 overflow-y-auto pr-1">
                {visibleLogs.length === 0 ? (
                  <p className="py-12 text-center text-xs text-slate-500">
                    No scans registered for the selected gates yet.
                  </p>
                ) : (
                  visibleLogs.slice(0, 30).map((log) => (
                    <div
                      key={log.id}
                      className={`rounded-lg border p-3 text-xs ${log.outcome === 'granted'
                          ? 'border-green-500/10 bg-green-500/5'
                          : 'border-red-500/10 bg-red-500/5'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-200">{log.ticketId}</span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${log.gateAction === 'entry'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-violet-500/20 text-violet-300'
                                }`}
                            >
                              {log.gateAction}
                            </span>
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase ${log.outcome === 'granted'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                                }`}
                            >
                              {log.outcome}
                            </span>
                          </div>
                          <p className="leading-normal text-slate-400">{log.message}</p>
                          <p className="text-[10px] text-slate-500">{log.deviceName}</p>
                        </div>
                        <span className="ml-2 whitespace-nowrap font-mono text-[10px] text-slate-500">
                          {formatDate(log.scannedAt)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {cameraSession && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] text-white shadow-2xl"
              initial={{ y: 24, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 24, scale: 0.98 }}
            >
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-teal-300">
                    <Camera className="h-4 w-4" />
                    {gateLabel(cameraSession.gateAction)} Camera Scanner
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Point the camera at the booking QR code.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera('Scanner stopped.');
                    setCameraSession(null);
                  }}
                  className="rounded-lg border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                  title="Close scanner"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-700 bg-black">
                  <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
                  {cameraSession.status === 'starting' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <Loader2 className="h-8 w-8 animate-spin text-teal-300" />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-teal-300/70" />
                </div>

                {cameraSession.error && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {cameraSession.error}
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera('Scanner stopped.');
                      setCameraSession(null);
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                  >
                    <StopCircle className="h-5 w-5" />
                    Stop Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => void startCamera(cameraSession.gateAction)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Retry Scanner
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
