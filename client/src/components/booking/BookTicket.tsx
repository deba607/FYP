"use client";

import React, { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createBooking } from '@/lib/api';
import { User, Mail, Phone, Calendar, Clock, Users } from 'lucide-react';

const TIME_SLOTS = ['Morning (9 AM-12 PM)', 'Afternoon (12 PM-3 PM)', 'Evening (3 PM-6 PM)'];
const PRICE_PER_TICKET = 200; // INR (₹)

function BookTicket() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState(TIME_SLOTS[0]);
  const [tickets, setTickets] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<null | { id: string; summary: string }>(null);

  const total = useMemo(() => tickets * PRICE_PER_TICKET, [tickets]);

  const validate = () => {
    const e: string[] = [];
    if (!fullName.trim()) e.push('Full name is required.');
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.push('A valid email is required.');
    if (!phone.trim()) e.push('Phone number is required.');
    if (!date) e.push('Please select a date.');
    else {
      const d = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) e.push('Date cannot be in the past.');
    }
    if (tickets < 1 || tickets > 10) e.push('Please select between 1 and 10 tickets.');
    setErrors(e);
    return e.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors([]);

    try {
      const response = await createBooking({
        name: fullName,
        email,
        phone,
        visitDate: date,
        timeSlot: time,
        numberOfTickets: tickets,
        visitorType: 'Adult'
      });

      const booked = response.booking;

      setSuccess({
        id: booked.bookingId,
        summary: `${booked.numberOfTickets} ticket(s) for ${new Date(booked.visitDate).toLocaleDateString()} at ${booked.timeSlot}`
      });

      try {
        const mod = await import('canvas-confetti');
        const confetti = (mod && (mod.default || mod)) as any;
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      } catch (err) {
        // ignore if confetti isn't available
      }

      setFullName('');
      setPhone('');
      setDate('');
      setTime(TIME_SLOTS[0]);
      setTickets(1);
    } catch (error) {
      setErrors([(error as Error).message || 'Booking failed. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto rounded-lg bg-background p-6 shadow-sm">
      <h3 className="mb-4 text-2xl font-semibold">Book Tickets</h3>

      {errors.length > 0 && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <ul>
            {errors.map((err, i) => (
              <li key={i}>• {err}</li>
            ))}
          </ul>
        </div>
      )}

      {success ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <div className="font-medium">Reservation confirmed — {success.id}</div>
          <div className="mt-1 text-sm text-muted-foreground">{success.summary}</div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div>
          <Label>Full name</Label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><User className="h-4 w-4" /></div>
            <Input className="pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
          </div>
        </div>

        <div>
          <Label>Email</Label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Mail className="h-4 w-4" /></div>
            <Input className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" />
          </div>
        </div>

        <div>
          <Label>Phone</Label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Phone className="h-4 w-4" /></div>
            <Input className="pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Date</Label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Calendar className="h-4 w-4" /></div>
              <Input className="pl-10" value={date} onChange={(e) => setDate(e.target.value)} type="date" />
            </div>
          </div>
          <div>
            <Label>Time</Label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Clock className="h-4 w-4" /></div>
              <select
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-transparent pl-10 pr-3 py-2 text-sm"
              >
                {TIME_SLOTS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <Label>Number of tickets</Label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Users className="h-4 w-4" /></div>
            <Input className="pl-10" value={tickets} onChange={(e) => setTickets(Number(e.target.value))} type="number" min={1} max={10} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <div className="text-sm text-muted-foreground">Price per ticket</div>
            <div className="text-lg font-semibold">₹{PRICE_PER_TICKET}</div>
          </div>

          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-lg font-semibold">₹{total}</div>
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            className={cn(buttonVariants({ variant: 'default' }), 'px-6 py-2')}
            disabled={loading}
          >
            {loading ? 'Booking…' : 'Book now'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BookTicket;
