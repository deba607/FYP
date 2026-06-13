"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { buttonVariants } from '../ui/button';
import { cn } from '../../lib/utils';
import { createRazorpayOrder, verifyRazorpayPayment } from '../../lib/api';
import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import { User, Mail, Phone, Calendar, Clock, Users, Search, MapPin, Plus, Minus } from 'lucide-react';
import Listbox from '../ui/listbox';
import { translate } from '../../lib/i18n';
import { useLanguage } from '../../hooks/use-language';

const TIME_SLOTS = ['Morning (9 AM-12 PM)', 'Afternoon (12 PM-3 PM)', 'Evening (3 PM-6 PM)'];
type MuseumOption = {
  museum_id: string;
  name: string;
  location: string;
  state?: string;
  category: string;
  price: number;
  prices?: Record<string, number>;
};

const VISITOR_TYPES = [
  { value: 'Student', label: 'Student', price: 120 },
  { value: 'Professor', label: 'Professor', price: 180 },
  { value: 'Senior Citizen', label: 'Senior Citizen', price: 150 },
  { value: 'Researcher/Scientist', label: 'Researcher/Scientist', price: 180 },
  { value: 'Child', label: 'Children', price: 100 },
  { value: 'Adult', label: 'Adult', price: 200 }
] as const;

const VISITOR_CATEGORIES = [
  { name: 'Adult', price: 200, emoji: '🧑' },
  { name: 'Child', price: 100, emoji: '👶' },
  { name: 'Senior Citizen', price: 150, emoji: '👴' },
  { name: 'Student', price: 120, emoji: '🎓' },
  { name: 'Professor', price: 180, emoji: '📚' },
  { name: 'Researcher/Scientist', price: 180, emoji: '🔬' }
];

const MAX_TICKETS = 6;

function readBookingProfile() {
  if (typeof window === 'undefined') {
    return { name: '', email: '', phone: '' };
  }

  const raw = localStorage.getItem('museum_auth_user');
  let stored: any = null;

  if (raw) {
    try {
      stored = JSON.parse(raw);
    } catch {
      stored = null;
    }
  }

  const firebaseUser = getFirebaseClientAuth().currentUser as any | null;

  return {
    name: stored?.name || firebaseUser?.displayName || '',
    email: stored?.email || firebaseUser?.email || '',
    phone: stored?.phone || ''
  };
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}


function BookTicket() {
  const { language } = useLanguage();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [touchedFullName, setTouchedFullName] = useState(false);
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPhone, setTouchedPhone] = useState(false);
  const [touchedDate, setTouchedDate] = useState(false);
  const [touchedTickets, setTouchedTickets] = useState(false);
  const [museums, setMuseums] = useState<MuseumOption[]>([]);
  const [selectedMuseumId, setSelectedMuseumId] = useState('');
  const [museumQuery, setMuseumQuery] = useState('');
  const [museumSearchOpen, setMuseumSearchOpen] = useState(false);
  const [visitorCombo, setVisitorCombo] = useState<Record<string, number>>({});
  const [date, setDate] = useState('');
  const [time, setTime] = useState(TIME_SLOTS[0]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<null | { id: string; summary: string }>(null);

  const uniqueMuseums = useMemo(() => {
    const seen = new Set<string>();
    return museums.filter((museum) => {
      if (seen.has(museum.museum_id)) {
        return false;
      }
      seen.add(museum.museum_id);
      return true;
    });
  }, [museums]);

  useEffect(() => {
    const loadProfile = () => {
      const profile = readBookingProfile();
      setFullName(profile.name);
      setEmail(profile.email);
      setPhone(profile.phone);
    };

    loadProfile();
    window.addEventListener('storage', loadProfile);
    window.addEventListener('focus', loadProfile);
    window.addEventListener('user_profile_updated', loadProfile as EventListener);
    return () => {
      window.removeEventListener('storage', loadProfile);
      window.removeEventListener('focus', loadProfile);
      window.removeEventListener('user_profile_updated', loadProfile as EventListener);
    };
  }, []);

  const selectedMuseum = useMemo(() => {
    return uniqueMuseums.find((m) => m.museum_id === selectedMuseumId) || uniqueMuseums[0];
  }, [selectedMuseumId, uniqueMuseums]);

  const filteredMuseums = useMemo(() => {
    const query = museumQuery.trim().toLowerCase();
    if (!query) {
      return uniqueMuseums.slice(0, 80);
    }

    return uniqueMuseums
      .filter((museum) =>
        [museum.name, museum.location, museum.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
      .slice(0, 80);
  }, [museumQuery, uniqueMuseums]);

  useEffect(() => {
    if (selectedMuseum && !museumSearchOpen) {
      setMuseumQuery(`${selectedMuseum.name} — ${selectedMuseum.location}`);
    }
  }, [museumSearchOpen, selectedMuseum]);

  const tickets = useMemo(() => {
    return Object.values(visitorCombo).reduce((a, b) => a + b, 0);
  }, [visitorCombo]);

  const visitorType = useMemo(() => {
    const parts = Object.entries(visitorCombo)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${count}× ${type}`);
    return parts.join(', ') || 'Adult';
  }, [visitorCombo]);

  const visitorCategories = useMemo(() => {
    const defaultCategories = [
      { name: 'Adult', price: 200, emoji: '🧑' },
      { name: 'Child', price: 100, emoji: '👶' },
      { name: 'Senior Citizen', price: 150, emoji: '👴' },
      { name: 'Student', price: 120, emoji: '🎓' },
      { name: 'Professor', price: 180, emoji: '📚' },
      { name: 'Researcher/Scientist', price: 180, emoji: '🔬' }
    ];

    if (!selectedMuseum) return defaultCategories;

    // Check if the museum has custom prices object
    if (selectedMuseum.prices && typeof selectedMuseum.prices === 'object') {
      return defaultCategories.map(cat => ({
        ...cat,
        price: Number(selectedMuseum.prices[cat.name] ?? selectedMuseum.prices[cat.name.toLowerCase()] ?? cat.price)
      }));
    }

    // Fallback if the museum only has a general base 'price'
    const basePrice = Number(selectedMuseum.price ?? 200);
    return [
      { name: 'Adult', price: basePrice, emoji: '🧑' },
      { name: 'Child', price: Math.round(basePrice * 0.5), emoji: '👶' },
      { name: 'Senior Citizen', price: Math.round(basePrice * 0.75), emoji: '👴' },
      { name: 'Student', price: Math.round(basePrice * 0.6), emoji: '🎓' },
      { name: 'Professor', price: Math.round(basePrice * 0.9), emoji: '📚' },
      { name: 'Researcher/Scientist', price: Math.round(basePrice * 0.9), emoji: '🔬' }
    ];
  }, [selectedMuseum]);

  const total = useMemo(() => {
    return Object.entries(visitorCombo).reduce((sum, [type, count]) => {
      const price = visitorCategories.find((v) => v.name === type)?.price || 200;
      return sum + price * count;
    }, 0);
  }, [visitorCombo, visitorCategories]);

  const validate = () => {
    const e: string[] = [];
    if (!selectedMuseum) e.push('No museums are available for booking.');
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
    if (tickets < 1 || tickets > MAX_TICKETS) {
      e.push(`Please select between 1 and ${MAX_TICKETS} tickets.`);
    }
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
  const ticketsInvalid = tickets < 1 || tickets > MAX_TICKETS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!selectedMuseum) return;
    const museum = selectedMuseum;
    setLoading(true);
    setErrors([]);

    try {
      const bookingPayload = {
        name: fullName,
        email,
        phone,
        visitDate: date,
        timeSlot: time,
        numberOfTickets: tickets,
        visitorType: visitorType,
        visitorCombo: visitorCombo,
        museumId: museum.museum_id,
        museumName: museum.name,
        museumLocation: museum.location,
        museumCategory: museum.category,
        pricePerTicket: total / (tickets || 1),
        totalPrice: total
      };

      const orderResponse = await createRazorpayOrder(bookingPayload);
      if (orderResponse.demoMode) {
        const demoPaymentId = `pay_demo_${Date.now()}`;
        const verified = await verifyRazorpayPayment({
          booking: bookingPayload,
          razorpayOrderId: orderResponse.order.id,
          razorpayPaymentId: demoPaymentId,
          razorpaySignature: 'demo_signature',
          demoMode: true
        });

        setSuccess({
          id: verified.booking.bookingId,
          summary: `${verified.booking.numberOfTickets} ticket(s) for ${verified.booking.museumName || museum.name} on ${new Date(verified.booking.visitDate).toLocaleDateString()} at ${verified.booking.timeSlot} â€” â‚¹${verified.booking.totalAmount} (demo payment)`
        });

        try {
          const mod = await import('canvas-confetti');
          const confetti = (mod && (mod.default || mod)) as any;
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        } catch {
          // ignore if confetti isn't available
        }

        const profile = readBookingProfile();
        setFullName(profile.name);
        setEmail(profile.email);
        setPhone(profile.phone);
        setDate('');
        setTime(TIME_SLOTS[0]);
        setSelectedMuseumId(uniqueMuseums[0]?.museum_id || '');
        setVisitorCombo({});
        setLoading(false);
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Unable to load Razorpay checkout. Please try again.');
      }

      const RazorpayCheckout = (window as any).Razorpay;
      if (!RazorpayCheckout) {
        throw new Error('Payment gateway is unavailable. Please refresh and try again.');
      }

      const payment = new RazorpayCheckout({
        key: orderResponse.keyId,
        amount: orderResponse.order.amount,
        currency: orderResponse.order.currency,
        name: 'Bharat Museum Tickets',
        description: `${museum.name} ticket booking`,
        order_id: orderResponse.order.id,
        prefill: {
          name: fullName,
          email,
          contact: phone
        },
        notes: {
          museumName: museum.name,
          museumLocation: museum.location,
          museumCategory: museum.category,
          visitorType,
          numberOfTickets: String(tickets)
        },
        theme: {
          color: '#111827'
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          }
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verified = await verifyRazorpayPayment({
              booking: bookingPayload,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });

            setSuccess({
              id: verified.booking.bookingId,
              summary: `${verified.booking.numberOfTickets} ticket(s) for ${verified.booking.museumName || museum.name} on ${new Date(verified.booking.visitDate).toLocaleDateString()} at ${verified.booking.timeSlot} — ₹${verified.booking.totalAmount}`
            });

            try {
              const mod = await import('canvas-confetti');
              const confetti = (mod && (mod.default || mod)) as any;
              confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            } catch {
              // ignore if confetti isn't available
            }

            const profile = readBookingProfile();
            setFullName(profile.name);
            setEmail(profile.email);
            setPhone(profile.phone);
            setDate('');
            setTime(TIME_SLOTS[0]);
            setSelectedMuseumId(uniqueMuseums[0]?.museum_id || '');
            setVisitorCombo({});
          } catch (paymentError) {
            setErrors([(paymentError as Error).message || 'Payment verification failed. Please contact support.']);
          } finally {
            setLoading(false);
          }
        }
      });

      payment.open();
    } catch (error) {
      setErrors([(error as Error).message || 'Booking failed. Please try again.']);
      setLoading(false);
    }
  };

  // Fetch the booking catalog from Firestore via the museums API.
  React.useEffect(() => {
    let mounted = true;
    fetch('/api/museums')
      .then((r) => {
        if (!r.ok) throw new Error('No museums API');
        return r.json();
      })
      .then((payload) => {
        if (!mounted) return;
        const data = payload?.museums;
        if (Array.isArray(data) && data.length > 0) {
          const dedupedData = data.filter((museum: any, index: number, self: any[]) =>
            index === self.findIndex((entry) => entry.museum_id === museum.museum_id)
          );
          setMuseums(dedupedData);
          setSelectedMuseumId((prev) => dedupedData.find((m: any) => m.museum_id === prev)?.museum_id || dedupedData[0].museum_id);
        } else {
          setMuseums([]);
          setSelectedMuseumId('');
          setMuseumQuery('');
        }
      })
      .catch(() => {
        setMuseums([]);
        setSelectedMuseumId('');
        setMuseumQuery('');
      });
    return () => { mounted = false };
  }, []);

  return (
    <div className="max-w-3xl mx-auto rounded-lg bg-background p-6 shadow-sm">
      <h3 className="mb-4 text-2xl font-semibold">{translate(language, 'booking.title')}</h3>

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
          <div className="font-medium">{translate(language, 'booking.confirmed')} — {success.id}</div>
          <div className="mt-1 text-sm text-muted-foreground">{success.summary}</div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div>
          <Label>{translate(language, 'booking.fullName')}</Label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><User className="h-4 w-4" /></div>
            <Input aria-invalid={fullNameInvalid} onBlur={() => setTouchedFullName(true)} className="pl-10" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
          {touchedFullName && fullNameInvalid && <div className="mt-1 text-xs text-red-600">Full name is required.</div>}
          </div>
        </div>

        <div>
          <Label>{translate(language, 'booking.email')}</Label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Mail className="h-4 w-4" /></div>
            <Input aria-invalid={emailInvalid} onBlur={() => setTouchedEmail(true)} className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" />
          {touchedEmail && emailInvalid && <div className="mt-1 text-xs text-red-600">Please enter a valid email address.</div>}
          </div>
        </div>

        <div>
          <Label>{translate(language, 'booking.phone')}</Label>
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Phone className="h-4 w-4" /></div>
            <Input aria-invalid={phoneInvalid} onBlur={() => setTouchedPhone(true)} className="pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" type="tel" />
          {touchedPhone && phoneInvalid && <div className="mt-1 text-xs text-red-600">Please provide a phone number.</div>}
          </div>
        </div>

        <div>
          <Label>{translate(language, 'booking.chooseMuseum')}</Label>
          <div className="relative">
            <div className="mt-1">
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                  <Search className="h-4 w-4" />
                </div>
                <Input
                  className="pl-10"
                  value={museumQuery}
                  onFocus={() => {
                    setMuseumSearchOpen(true);
                    setMuseumQuery('');
                  }}
                  onChange={(event) => {
                    setMuseumQuery(event.target.value);
                    setMuseumSearchOpen(true);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setMuseumSearchOpen(false), 120);
                  }}
                  placeholder={translate(language, 'booking.searchMuseum')}
                  role="combobox"
                  aria-expanded={museumSearchOpen}
                  aria-controls="museum-search-results"
                />
              </div>

              {museumSearchOpen ? (
                <div
                  id="museum-search-results"
                  className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-md border bg-background p-1 shadow-xl"
                >
                  {filteredMuseums.length > 0 ? (
                    filteredMuseums.map((museum) => (
                      <button
                        key={museum.museum_id}
                        type="button"
                        className={cn(
                          'flex w-full flex-col rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                          selectedMuseumId === museum.museum_id && 'bg-muted'
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSelectedMuseumId(museum.museum_id);
                          setMuseumQuery(`${museum.name} — ${museum.location}`);
                          setMuseumSearchOpen(false);
                        }}
                      >
                        <span className="font-medium">{museum.name}</span>
                        <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {museum.location || 'Location unavailable'}
                          {museum.category ? ` • ${museum.category}` : ''}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {translate(language, 'booking.noMuseums')}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            {selectedMuseum ? (
              <div className="mt-2 text-sm text-muted-foreground">
                <div>{selectedMuseum.name} • {selectedMuseum.location}</div>
                <div className="text-xs">Category: {selectedMuseum.category}</div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">
                No Firestore museums are available for booking.
              </div>
            )}
          </div>
        </div>

        <div data-bmt-no-translate>
          <Label>{translate(language, 'booking.visitorCategory')}</Label>
          <div
            className="mt-1 w-full rounded-lg border bg-[#1a1a2e] p-4 text-[#e0e0e0] shadow-md border-[#2a2a3e]"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* Header */}
            <div className="mb-3 flex items-center gap-2 border-b pb-2 border-[#2a2a3e]">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Select Visitors</span>
              <span className="ml-auto text-xs text-[#8888aa]">
                {tickets}/{MAX_TICKETS} tickets
              </span>
            </div>

            {/* Category rows */}
            <div className="grid gap-3">
              {visitorCategories.map((cat) => {
                const count = visitorCombo[cat.name] || 0;
                const canAdd = tickets < MAX_TICKETS;
                return (
                  <div
                    key={cat.name}
                    className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0 border-[#1e1e35]"
                  >
                    {/* Label + price */}
                    <div className="flex-1">
                      <div className={cn("text-sm transition-colors", count > 0 ? "text-white font-medium" : "text-[#8888aa]")}>
                        {cat.emoji} {cat.name}
                      </div>
                      <div className="text-xs text-[#666688]">₹{cat.price}/ticket</div>
                    </div>

                    {/* +/- controls */}
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setVisitorCombo((prev) => {
                            const curr = prev[cat.name] || 0;
                            if (curr <= 0) return prev;
                            const next = { ...prev, [cat.name]: curr - 1 };
                            if (next[cat.name] === 0) delete next[cat.name];
                            return next;
                          });
                        }}
                        disabled={loading || count === 0}
                        style={{
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: count > 0 ? '#2a2a4e' : '#1e1e35',
                          border: '1px solid #3a3a5e',
                          borderRadius: '6px 0 0 6px',
                          color: count > 0 ? '#ff6b6b' : '#444',
                          cursor: count > 0 && !loading ? 'pointer' : 'default',
                          fontSize: '16px',
                          fontWeight: 700,
                          transition: 'all 0.15s',
                        }}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <div
                        style={{
                          width: '36px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#16162a',
                          borderTop: '1px solid #3a3a5e',
                          borderBottom: '1px solid #3a3a5e',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: count > 0 ? '#ffffff' : '#555',
                        }}
                      >
                        {count}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (tickets >= MAX_TICKETS) return;
                          setVisitorCombo((prev) => ({ ...prev, [cat.name]: (prev[cat.name] || 0) + 1 }));
                        }}
                        disabled={loading || !canAdd}
                        style={{
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: canAdd ? '#2a2a4e' : '#1e1e35',
                          border: '1px solid #3a3a5e',
                          borderRadius: '0 6px 6px 0',
                          color: canAdd ? '#60a5fa' : '#444',
                          cursor: canAdd && !loading ? 'pointer' : 'default',
                          fontSize: '16px',
                          fontWeight: 700,
                          transition: 'all 0.15s',
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{translate(language, 'booking.date')}</Label>
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Calendar className="h-4 w-4" /></div>
              <Input aria-invalid={dateInvalid} onBlur={() => setTouchedDate(true)} className="pl-10" value={date} onChange={(e) => setDate(e.target.value)} type="date" min={new Date().toISOString().split('T')[0]} />
              {touchedDate && dateInvalid && <div className="mt-1 text-xs text-red-600">Please select a valid date (today or later).</div>}
            </div>
          </div>
          <div>
            <Label>{translate(language, 'booking.time')}</Label>
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

        <div className="flex items-center justify-end pt-2">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{translate(language, 'booking.total')}</div>
            <div className="text-xl font-semibold">₹{total}</div>
          </div>
        </div>

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            className={cn(buttonVariants({ variant: 'default' }), 'px-6 py-2 w-full sm:w-auto')}
            disabled={loading || tickets === 0}
          >
            {loading 
              ? translate(language, 'booking.openingPayment') 
              : tickets === 0 
                ? 'Select at least 1 visitor' 
                : translate(language, 'booking.pay')
            }
          </button>
        </div>
      </form>
    </div>
  );
}

export default BookTicket;
