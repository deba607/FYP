"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2, RefreshCw, Search, Ticket, X } from 'lucide-react';
import { getMyTicketHistory, type TicketHistoryItem } from '../../lib/api';
import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import { buildTicketQrPayload } from '../../lib/ticketQr';

const AUTH_USER_KEY = 'museum_auth_user';

function storedEmail() {
  try {
    const user = JSON.parse(window.localStorage.getItem(AUTH_USER_KEY) || '{}') as { email?: string };
    return user.email?.trim() || '';
  } catch {
    return '';
  }
}

function displayDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function ShowTicket() {
  const [email, setEmail] = useState('');
  const [tickets, setTickets] = useState<TicketHistoryItem[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTickets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tickets;

    return tickets.filter((ticket) => [
      ticket.bookingId,
      ticket.museumName,
      ticket.museumLocation,
      ticket.userLocation
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [searchQuery, tickets]);

  const loadTickets = async () => {
    const user = getFirebaseClientAuth().currentUser;
    if (!user) {
      setTickets([]);
      setError('Please sign in to view tickets associated with your email address.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const mailId = (user.email || storedEmail()).trim().toLowerCase();
      const token = await user.getIdToken();
      const result = await getMyTicketHistory(token, mailId);
      setEmail(mailId);
      setTickets(result.tickets);

      const generated = await Promise.all(result.tickets.map(async (ticket) => [
        ticket.bookingId,
        await QRCode.toDataURL(buildTicketQrPayload(ticket), {
          errorCorrectionLevel: 'M', margin: 2, width: 280
        })
      ] as const));
      setQrCodes(Object.fromEntries(generated));
    } catch (loadError) {
      setTickets([]);
      setQrCodes({});
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your tickets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseClientAuth(), () => {
      setAuthReady(true);
      void loadTickets();
    });
    return unsubscribe;
  }, []);

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-5xl px-4 pb-12 pt-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Show Tickets</p>
          <h1 className="text-3xl font-bold">Your ticket history</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {email ? `All tickets associated with ${email}` : 'Tickets are securely matched to your signed-in email.'}
          </p>
        </div>
        {authReady && getFirebaseClientAuth().currentUser ? (
          <button type="button" onClick={() => void loadTickets()} disabled={loading} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        ) : null}
      </div>

      {!loading && !error && tickets.length > 0 ? (
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by ticket ID, museum name, or location..."
            aria-label="Search your tickets"
            className="h-12 w-full rounded-xl border bg-background pl-12 pr-12 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear ticket search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-52 items-center justify-center rounded-xl border"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {error} <Link href="/login" className="ml-2 font-semibold underline">Sign in</Link>
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border p-8 text-center text-muted-foreground">
          <Ticket className="mx-auto mb-3 h-9 w-9" /> No tickets were found for {email || 'this email address'}.
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="rounded-xl border p-8 text-center text-muted-foreground">
          <Search className="mx-auto mb-3 h-9 w-9" /> No tickets match “{searchQuery.trim()}”.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredTickets.map((ticket) => (
            <article key={ticket.bookingId} className="rounded-2xl border bg-background p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-sm font-bold">{ticket.bookingId}</div>
                  <h2 className="mt-1 text-lg font-semibold">{ticket.museumName || 'Museum ticket'}</h2>
                  <p className="text-sm text-muted-foreground">{ticket.museumLocation || 'Location unavailable'}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ticket.expired ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {ticket.expired ? 'Expired' : 'Active'}
                </span>
              </div>

              {qrCodes[ticket.bookingId] ? (
                <div className="my-4 rounded-lg border bg-white p-3 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCodes[ticket.bookingId]} alt={`QR code for ${ticket.bookingId}`} className="mx-auto h-52 w-52" />
                  <p className="mt-1 text-xs font-medium text-slate-700">Gate QR</p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><span className="text-muted-foreground">Visitor:</span><br />{ticket.name || '-'}</div>
                <div><span className="text-muted-foreground">Email:</span><br />{ticket.email || '-'}</div>
                <div><span className="text-muted-foreground">Visit date:</span><br />{displayDate(ticket.visitDate)}</div>
                <div><span className="text-muted-foreground">Time:</span><br />{ticket.timeSlot || '-'}</div>
                <div><span className="text-muted-foreground">Tickets:</span><br />{ticket.numberOfTickets} × {ticket.visitorType}</div>
                <div><span className="text-muted-foreground">Amount:</span><br />INR {ticket.totalAmount || 0}</div>
                <div><span className="text-muted-foreground">Booking:</span><br />{ticket.status || '-'}</div>
                <div><span className="text-muted-foreground">Payment:</span><br />{ticket.paymentStatus || '-'}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
