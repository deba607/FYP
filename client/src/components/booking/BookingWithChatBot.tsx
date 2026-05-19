"use client";

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, RotateCcw } from 'lucide-react';
import { createBooking, resetChatSession, sendChatMessage } from '../../lib/api';

type ChatMessage = {
  from: 'user' | 'bot';
  text: string;
  timestamp: string;
};

type BookingData = {
  date?: string;
  time_slot?: string;
  tickets?: number;
  visitor_type?: 'Adult' | 'Child' | 'Senior Citizen' | 'Student' | 'Professor' | 'Researcher/Scientist';
  ready_to_confirm?: boolean;
};

const CHAT_SESSION_KEY = 'bharat_museum_chat_session_id';

function makeSessionId() {
  return `web-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
    return Boolean(
      bookingData.ready_to_confirm &&
        bookingData.date &&
        bookingData.time_slot &&
        bookingData.tickets &&
        bookingData.visitor_type
    );
  }, [bookingData]);

  useEffect(() => {
    const existing = window.sessionStorage.getItem(CHAT_SESSION_KEY);
    if (existing) {
      setSessionId(existing);
      return;
    }

    const generated = makeSessionId();
    window.sessionStorage.setItem(CHAT_SESSION_KEY, generated);
    setSessionId(generated);
  }, []);

  // Initialize the first bot message on client-side only to avoid SSR/client
  // timestamp mismatches during hydration.
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          from: 'bot',
          text: 'Hi! I can help with museum info and full ticket booking. Tell me your date, time, number of tickets, and visitor category such as student, professor, senior citizen, researcher/scientist, or children to begin.',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    if (!input.trim() || !sessionId) return;

    const msg = {
      from: 'user' as const,
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages((m) => [...m, msg]);
    setInput('');
    setSending(true);

    try {
      const response = await sendChatMessage(msg.text, sessionId);
      const reply = {
        from: 'bot' as const,
        text: response.response || 'I could not generate a response.',
        timestamp: new Date().toLocaleTimeString()
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
          text: (error as Error).message || 'Chat service is unavailable right now.',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setSending(false);
    }
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
        text: 'New session started. I can help you book museum tickets end-to-end using the visitor categories.',
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
          text: 'Please provide your name, email, and phone to confirm the booking.',
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
        visitorType: bookingData.visitor_type!
      });

      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: `Booking confirmed. Your booking ID is ${created.booking.bookingId}. A confirmation has been sent to ${email.trim()}.`,
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
          text: (error as Error).message || 'Unable to confirm booking right now. Please try again.',
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
          <h4 className="text-lg font-medium">Chat with our assistant</h4>
          <button
            type="button"
            className="ml-auto rounded border px-2 py-1 text-xs"
            onClick={reset}
            disabled={sending || confirming}
          >
            <span className="inline-flex items-center gap-1">
              <RotateCcw className="h-3 w-3" />
              Reset
            </span>
          </button>
        </div>

        <div className="mb-3 h-105 overflow-auto rounded border p-3">
          {messages.map((m, i) => (
            <div key={i} className={`mb-2 max-w-[85%] ${m.from === 'bot' ? 'text-sm text-muted-foreground' : 'ml-auto text-right'}`}>
              <div className={`inline-block rounded px-3 py-1 ${m.from === 'bot' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                {m.text}
              </div>
              <div className="mt-1 text-[10px] opacity-60">{m.timestamp}</div>
            </div>
          ))}
          {sending && <div className="text-xs text-muted-foreground">Assistant is typing...</div>}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !sending && send()}
            placeholder="Ask me about tickets or schedules"
            className="flex-1 rounded border px-3 py-2"
            disabled={sending}
          />
          <button onClick={send} className="rounded bg-primary px-4 py-2 text-primary-foreground" disabled={sending}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>

        {canConfirm && (
          <form onSubmit={confirmBooking} className="mt-4 rounded border p-3">
            <h5 className="mb-3 text-sm font-semibold">Confirm Booking Details</h5>
            <div className="mb-2 grid gap-2 md:grid-cols-2">
              <input
                className="rounded border px-3 py-2 text-sm"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={confirming}
              />
              <input
                className="rounded border px-3 py-2 text-sm"
                placeholder="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={confirming}
              />
            </div>
            <input
              className="mb-3 w-full rounded border px-3 py-2 text-sm"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={confirming}
            />

            <div className="mb-3 rounded bg-muted p-2 text-xs">
              <div>Date: {bookingData.date}</div>
              <div>Time: {bookingData.time_slot}</div>
              <div>Tickets: {bookingData.tickets}</div>
              <div>Category: {bookingData.visitor_type}</div>
            </div>

            <button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
              disabled={confirming}
            >
              {confirming ? 'Confirming...' : 'Confirm Booking'}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}
