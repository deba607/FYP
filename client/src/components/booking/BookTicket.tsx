"use client";

import React, { useMemo, useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { buttonVariants } from '../ui/button';
import { cn } from '../../lib/utils';
import { createBooking } from '../../lib/api';
import { User, Mail, Phone, Calendar, Clock, Users } from 'lucide-react';
import Listbox from '../ui/listbox';

const TIME_SLOTS = ['Morning (9 AM-12 PM)', 'Afternoon (12 PM-3 PM)', 'Evening (3 PM-6 PM)'];
// Sample museum list (will be replaced by API/data source later)
const MUSEUMS = [
  { museum_id: 'national_museum', name: 'National Museum', location: 'New Delhi', category: 'History/Art', price: 200 },
  { museum_id: 'indian_museum', name: 'Indian Museum', location: 'Kolkata', category: 'Multi-purpose', price: 180 },
  { museum_id: 'salar_jung', name: 'Salar Jung Museum', location: 'Hyderabad', category: 'Art/Antiques', price: 220 }
];

const VISITOR_TYPES = [
  { value: 'Student', label: 'Student', price: 120 },
  { value: 'Professor', label: 'Professor', price: 180 },
  { value: 'Senior Citizen', label: 'Senior Citizen', price: 150 },
  { value: 'Researcher/Scientist', label: 'Researcher/Scientist', price: 180 },
  { value: 'Child', label: 'Children', price: 100 },
  { value: 'Adult', label: 'Adult', price: 200 }
] as const;


function BookTicket() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [touchedFullName, setTouchedFullName] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPhone, setTouchedPhone] = useState(false);
  const [touchedDate, setTouchedDate] = useState(false);
  const [touchedTickets, setTouchedTickets] = useState(false);
  const [museums, setMuseums] = useState(MUSEUMS);
  const [selectedMuseumId, setSelectedMuseumId] = useState(MUSEUMS[0].museum_id);
  const [visitorType, setVisitorType] = useState<(typeof VISITOR_TYPES)[number]['value']>('Student');
  const [date, setDate] = useState('');
  const [time, setTime] = useState(TIME_SLOTS[0]);
  const [tickets, setTickets] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<null | { id: string; summary: string }>(null);

  const selectedMuseum = useMemo(() => {
    return museums.find((m) => m.museum_id === selectedMuseumId) || museums[0];
  }, [selectedMuseumId]);

  const selectedVisitor = useMemo(() => {
    return VISITOR_TYPES.find((item) => item.value === visitorType) || VISITOR_TYPES[0];
  }, [visitorType]);

  const total = useMemo(
    () => tickets * (selectedVisitor?.price || selectedMuseum?.price || 200),
    [tickets, selectedMuseum, selectedVisitor]
  );

  const validate = () => {
    const e: string[] = [];
    if (!fullName.trim()) e.push('Full name is required.');
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.push('A valid email is required.');
    if (!phone.trim()) e.push('Phone number is required.');
    if (!date) e.push('Please select a date.');
    else {
      const d = new Date(date + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) e.push('Date cannot be in the past.');
    }
    if (tickets < 1 || tickets > 10) e.push('Please select between 1 and 10 tickets.');
    setErrors(e);
    return e.length === 0;
  };

  const fullNameInvalid = !fullName.trim();
  const emailInvalid = !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  const phoneInvalid = !phone.trim();
  const dateInvalid = (() => {
    if (!date) return true;
    const d = new Date(date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  })();
  const ticketsInvalid = tickets < 1 || tickets > 10;

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
        visitorType: visitorType,
        museumId: selectedMuseum.museum_id,
        museumName: selectedMuseum.name,
        museumLocation: selectedMuseum.location,
        museumCategory: selectedMuseum.category,
        pricePerTicket: selectedVisitor.price,
        totalPrice: tickets * selectedVisitor.price,
      });

      const booked = response.booking;

      setSuccess({
        id: booked.bookingId,
        summary: `${booked.numberOfTickets} ticket(s) for ${selectedMuseum.name} on ${new Date(booked.visitDate).toLocaleDateString()} at ${booked.timeSlot} — ₹${booked.totalPrice}`
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
      setSelectedMuseumId(MUSEUMS[0].museum_id);
      setVisitorType('Student');
      setTickets(1);
    } catch (error) {
      setErrors([(error as Error).message || 'Booking failed. Please try again.']);
    } finally {
      setLoading(false);
    }
  };

  // Fetch museums list from public JSON (optional). Fall back to embedded list.
  React.useEffect(() => {
    let mounted = true;
    fetch('/museums.json')
      .then((r) => {
        if (!r.ok) throw new Error('No museums.json');
        return r.json();
      })
      .then((data) => {
        if (!mounted) return;
        if (Array.isArray(data) && data.length > 0) {
          setMuseums(data);
          setSelectedMuseumId((prev) => data.find((m: any) => m.museum_id === prev)?.museum_id || data[0].museum_id);
        }
      })
      .catch(() => {
        // ignore, keep default MUSEUMS
      });
    return () => { mounted = false };
  }, []);

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
            <Input aria-invalid={fullNameInvalid} onBlur={() => setTouchedFullName(true)} className="pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
          {touchedFullName && fullNameInvalid && <div className="mt-1 text-xs text-red-600">Full name is required.</div>}
          </div>
        </div>

        <div>
          <Label>Email</Label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Mail className="h-4 w-4" /></div>
            <Input aria-invalid={emailInvalid} onBlur={() => setTouchedEmail(true)} className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" />
          {touchedEmail && emailInvalid && <div className="mt-1 text-xs text-red-600">Please enter a valid email address.</div>}
          </div>
        </div>

        <div>
          <Label>Phone</Label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Phone className="h-4 w-4" /></div>
            <Input aria-invalid={phoneInvalid} onBlur={() => setTouchedPhone(true)} className="pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" />
          {touchedPhone && phoneInvalid && <div className="mt-1 text-xs text-red-600">Please provide a phone number.</div>}
          </div>
        </div>

        <div>
          <Label>Choose museum</Label>
          <div>
            <div className="mt-1">
              <Listbox
                items={MUSEUMS.map((m) => ({ value: m.museum_id, label: `${m.name} — ${m.location}` }))}
                value={selectedMuseumId}
                onChange={(v) => setSelectedMuseumId(v)}
              />
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <div>{selectedMuseum.name} • {selectedMuseum.location}</div>
              <div className="text-xs">Category: {selectedMuseum.category}</div>
            </div>
          </div>
        </div>

        <div>
          <Label>Visitor category</Label>
          <div>
            <div className="mt-1">
              <Listbox
                items={VISITOR_TYPES.map((type) => ({ value: type.value, label: `${type.label} (₹${type.price})` }))}
                value={visitorType}
                onChange={(v) => setVisitorType(v as (typeof VISITOR_TYPES)[number]['value'])}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Date</Label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Calendar className="h-4 w-4" /></div>
              <Input aria-invalid={dateInvalid} onBlur={() => setTouchedDate(true)} className="pl-10" value={date} onChange={(e) => setDate(e.target.value)} type="date" min={new Date().toISOString().split('T')[0]} />
              {touchedDate && dateInvalid && <div className="mt-1 text-xs text-red-600">Please select a valid date (today or later).</div>}
            </div>
          </div>
          <div>
            <Label>Time</Label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Clock className="h-4 w-4" /></div>
              <div className="mt-1">
                <Listbox
                  items={TIME_SLOTS.map((t) => ({ value: t, label: t }))}
                  value={time}
                  onChange={(v) => setTime(v)}
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <Label>Number of tickets</Label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Users className="h-4 w-4" /></div>
            <Input aria-invalid={ticketsInvalid} onBlur={() => setTouchedTickets(true)} className="pl-10" value={tickets} onChange={(e) => setTickets(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} type="number" min={1} max={10} />
            {touchedTickets && ticketsInvalid && <div className="mt-1 text-xs text-red-600">Select between 1 and 10 tickets.</div>}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            <div className="text-sm text-muted-foreground">Price per ticket</div>
            <div className="text-lg font-semibold">₹{selectedVisitor?.price ?? 200}</div>
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
