"use client";

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, RotateCcw, Ticket } from 'lucide-react';
import { createBooking, resetChatSession, sendChatMessage } from '../../lib/api';
import { encodeRtdbKey } from '../../lib/utils/firebaseKey';
import { translate } from '../../lib/i18n';
import { useLanguage } from '../../hooks/use-language';

type ChatMessage = {
  from: 'user' | 'bot';
  text: string;
  timestamp: string;
  museumOptions?: MuseumOption[];
  genericOptions?: GenericOption[];
  bookMuseumName?: string;
};

type MuseumOption = {
  label: string;
  value: string;
};

type GenericOption = {
  label: string;
  value: string;
};

type BookingData = {
  date?: string;
  time_slot?: string;
  tickets?: number;
  visitor_type?: string;
  visitor_combo?: Record<string, number>;
  primary_visitor_type?: 'Adult' | 'Child' | 'Senior Citizen' | 'Student' | 'Professor' | 'Researcher/Scientist';
  visitor_combo_remaining?: number;
  ready_to_confirm?: boolean;
  museumName?: string;
  museumLocation?: string;
  museumCategory?: string;
  museumId?: string;
  pricePerTicket?: number;
};

const CHAT_SESSION_KEY = 'bharat_museum_chat_session_id';
const AUTH_USER_KEY = 'museum_auth_user';

function makeSessionId() {
  return `web-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function getStableSessionIdFromLogin() {
  if (typeof window === 'undefined') return '';

  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return '';

    const parsed = JSON.parse(raw) as { id?: string; email?: string };
    const userId = parsed?.id?.trim();
    const email = parsed?.email?.trim();

    if (userId) {
      return encodeRtdbKey(`user_${userId}`);
    }

    if (email) {
      return encodeRtdbKey(`email_${email.toLowerCase()}`);
    }

    return '';
  } catch {
    return '';
  }
}

function extractMuseumOptions(text: string) {
  return text
    .split('\n')
    .map((line) => line.match(/^\s*\d+\.\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((name): name is string => Boolean(name))
    .map((name) => ({
      label: name,
      value: name
    }));
}

function extractGenericOptions(text: string) {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const match = trimmed.match(/^\d+\.\s+(.+)$/);
      if (!match) return null;
      const label = match[1].trim();
      let value = label;
      if (label.includes('(')) {
        value = label.split('(')[0].trim();
      }
      return { label, value };
    })
    .filter((opt): opt is { label: string; value: string } => Boolean(opt));
}

function cleanMessageText(text: string) {
  return text
    .split('\n')
    .filter((line) => !line.trim().match(/^\d+\.\s+/))
    .join('\n')
    .trim();
}


function toApiTimeSlot(timeSlot?: string) {
  if (!timeSlot) {
    return 'Morning (9 AM-12 PM)' as const;
  }

  if (timeSlot.includes('4:00 PM')) {
    return 'Evening (3 PM-6 PM)' as const;
  }

  if (timeSlot.includes('12:00 PM') || timeSlot.includes('2:00 PM')) {
    return 'Afternoon (12 PM-3 PM)' as const;
  }

  return 'Morning (9 AM-12 PM)' as const;
}

export default function BookingWithChatBot() {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [bookingData, setBookingData] = useState<BookingData>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const canConfirm = useMemo(() => {
    const hasVisitorInfo = Boolean(
      bookingData.visitor_type ||
      (bookingData.visitor_combo && Object.values(bookingData.visitor_combo).some((v) => v > 0))
    );
    return Boolean(
      bookingData.ready_to_confirm &&
        bookingData.date &&
        bookingData.time_slot &&
        bookingData.tickets &&
        hasVisitorInfo
    );
  }, [bookingData]);

  useEffect(() => {
    const generated = encodeRtdbKey(makeSessionId());
    window.sessionStorage.setItem(CHAT_SESSION_KEY, generated);
    setSessionId(generated);
  }, []);

  // Initialize welcome message when session is ready.
  useEffect(() => {
    if (!sessionId) return;

    setMessages([
      {
        from: 'bot',
        text: translate(language, 'chat.welcome'),
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  }, [language, sessionId]);

  const sendMessage = async (displayText: string, apiText = displayText) => {
    if (!displayText.trim() || !sessionId) return;

    const msg = {
      from: 'user' as const,
      text: displayText.trim(),
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages((m) => [...m, msg]);
    setInput('');
    setSending(true);

    try {
      const response = await sendChatMessage(apiText.trim(), sessionId, language);
      const isSearchMuseums = response.intent === 'search_museums';
      const museumOptions = isSearchMuseums
        ? extractMuseumOptions(response.response || '')
        : [];
      const genericOptions = !isSearchMuseums
        ? extractGenericOptions(response.response || '')
        : [];
      const reply = {
        from: 'bot' as const,
        text: cleanMessageText(response.response || translate(language, 'chat.noResponse')),
        timestamp: new Date().toLocaleTimeString(),
        museumOptions: museumOptions.length > 0 ? museumOptions : undefined,
        genericOptions: genericOptions.length > 0 ? genericOptions : undefined
      };

      setMessages((m) => [...m, reply]);

      if (response.booking_data) {
        setBookingData((prev) => ({ ...prev, ...(response.booking_data as BookingData) }));
      }
    } catch (error) {
      setMessages((m) => [
        ...m,
        {
          from: 'bot',
          text: (error as Error).message || translate(language, 'chat.serviceUnavailable'),
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    await sendMessage(input.trim());
  };

  const chooseMuseum = (museumName: string) => {
    if (sending || confirming) return;

    setMessages((prev) => [
      ...prev,
      {
        from: 'user',
        text: museumName,
        timestamp: new Date().toLocaleTimeString()
      },
      {
        from: 'bot',
        text: museumName,
        timestamp: new Date().toLocaleTimeString(),
        bookMuseumName: museumName
      }
    ]);
  };

  const bookMuseumTickets = async (museumName: string) => {
    await sendMessage('Book Tickets', `Book tickets for ${museumName}`);
  };

  const reset = async () => {
    if (!sessionId) return;

    try {
      await resetChatSession(sessionId);
    } catch {
      // Keep client reset functional even if server reset fails.
    }

    const nextSession = makeSessionId();
    window.sessionStorage.setItem(CHAT_SESSION_KEY, nextSession);
    setSessionId(nextSession);
    setBookingData({});
    setName('');
    setEmail('');
    setPhone('');
    setMessages([
      {
          from: 'bot',
          text: translate(language, 'chat.newSession'),
          timestamp: new Date().toLocaleTimeString()
        }
    ]);
  };

  const confirmBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canConfirm) {
      return;
    }

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: translate(language, 'chat.nameRequired'),
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      return;
    }

    try {
      setConfirming(true);
      const created = await createBooking({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        visitDate: bookingData.date!,
        timeSlot: toApiTimeSlot(bookingData.time_slot),
        numberOfTickets: Number(bookingData.tickets),
        visitorType: (bookingData.primary_visitor_type || bookingData.visitor_type || 'Adult') as any,
        museumName: bookingData.museumName || (bookingData as any).museum_name || undefined,
        museumLocation: bookingData.museumLocation || (bookingData as any).museum_location || undefined,
        museumCategory: bookingData.museumCategory || (bookingData as any).museum_category || undefined,
        museumId: bookingData.museumId || (bookingData as any).museum_id || undefined,
        pricePerTicket: bookingData.pricePerTicket || (bookingData as any).price || undefined
      });

      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: translate(language, 'chat.bookingConfirmed', {
            bookingId: created.booking.bookingId,
            email: email.trim()
          }),
          timestamp: new Date().toLocaleTimeString()
        }
      ]);

      setBookingData((prev) => ({ ...prev, ready_to_confirm: false }));
      setName('');
      setEmail('');
      setPhone('');
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: (error as Error).message || translate(language, 'chat.confirmFailed'),
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <aside className="rounded-lg border bg-background p-4">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle />
          <h4 className="text-lg font-medium">{translate(language, 'chat.title')}</h4>
          <button
            type="button"
            className="ml-auto rounded border px-2 py-1 text-xs"
            onClick={reset}
            disabled={sending || confirming}
          >
            <span className="inline-flex items-center gap-1">
              <RotateCcw className="h-3 w-3" />
              {translate(language, 'chat.reset')}
            </span>
          </button>
        </div>

        <div className="mb-3 h-105 overflow-auto rounded border p-3">
          {messages.map((m, i) => (
            <div key={i} className={`mb-2 max-w-[85%] ${m.from === 'bot' ? 'text-sm text-muted-foreground' : 'ml-auto text-right'}`}>
              <div className={`inline-block whitespace-pre-line rounded px-3 py-1 ${m.from === 'bot' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                {m.text}
              </div>
              {m.museumOptions && (
                <div className="mt-2 w-full max-w-xs">
                  <select
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        chooseMuseum(e.target.value);
                      }
                    }}
                    disabled={sending || confirming}
                  >
                    <option value="" disabled>Select a museum...</option>
                    {m.museumOptions.map((museum) => (
                      <option key={museum.value} value={museum.value}>
                        {museum.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {m.genericOptions && (
                <div className="mt-2 w-full max-w-xs">
                  <select
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        sendMessage(e.target.value);
                      }
                    }}
                    disabled={sending || confirming}
                  >
                    <option value="" disabled>Select an option...</option>
                    {m.genericOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {m.bookMuseumName && (
                <div className="mt-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                    onClick={() => bookMuseumTickets(m.bookMuseumName!)}
                    disabled={sending || confirming}
                  >
                    <Ticket className="h-3.5 w-3.5" />
                    Book Tickets
                  </button>
                </div>
              )}
              <div className="mt-1 text-[10px] opacity-60">{m.timestamp}</div>
            </div>
          ))}
          {sending && <div className="text-xs text-muted-foreground">{translate(language, 'chat.typing')}</div>}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !sending && send()}
            placeholder={translate(language, 'chat.placeholder')}
            className="flex-1 rounded border px-3 py-2"
            disabled={sending}
          />
          <button onClick={send} className="rounded bg-primary px-4 py-2 text-primary-foreground" disabled={sending}>
            {sending ? translate(language, 'chat.sending') : translate(language, 'chat.send')}
          </button>
        </div>

        {canConfirm && (
          <form onSubmit={confirmBooking} className="mt-4 rounded border p-3">
            <h5 className="mb-3 text-sm font-semibold">{translate(language, 'chat.confirmDetails')}</h5>
            <div className="mb-2 grid gap-2 md:grid-cols-2">
              <input
                className="rounded border px-3 py-2 text-sm"
                placeholder={translate(language, 'booking.fullName')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={confirming}
              />
              <input
                className="rounded border px-3 py-2 text-sm"
                placeholder={translate(language, 'booking.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={confirming}
              />
            </div>
            <input
              className="mb-3 w-full rounded border px-3 py-2 text-sm"
              placeholder={translate(language, 'booking.phone')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={confirming}
            />

            <div className="mb-3 rounded bg-muted p-2 text-xs" data-bmt-no-translate>
              <div>{translate(language, 'booking.date')}: {bookingData.date}</div>
              <div>{translate(language, 'booking.time')}: {bookingData.time_slot}</div>
              <div>{translate(language, 'booking.ticketCount')}: {bookingData.tickets}</div>
              {bookingData.visitor_combo && Object.keys(bookingData.visitor_combo).length > 0 ? (
                <div>
                  <div className="mt-1 font-semibold">{translate(language, 'booking.visitorCategory')}:</div>
                  {Object.entries(bookingData.visitor_combo).map(([vtype, count]) => (
                    count > 0 ? (
                      <div key={vtype} className="ml-2">{count}× {vtype}</div>
                    ) : null
                  ))}
                </div>
              ) : (
                <div>{translate(language, 'booking.visitorCategory')}: {bookingData.visitor_type}</div>
              )}
            </div>

            <button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
              disabled={confirming}
            >
              {confirming ? translate(language, 'chat.confirming') : translate(language, 'chat.confirm')}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}


