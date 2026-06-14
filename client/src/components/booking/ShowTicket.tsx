"use client";

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { getBookingByBookingId } from '../../lib/api';

import { Search } from 'lucide-react';

type BookingLookupResult = {
  bookingId: string;
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
  status: string;
  paymentStatus?: string;
  createdAt: string;
};

export default function ShowTicket() {
  const [id, setId] = useState('');
  const [result, setResult] = useState<BookingLookupResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let active = true;

    if (!result?.bookingId) {
      setQrDataUrl('');
      return;
    }

    QRCode.toDataURL(result.bookingId, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
      color: {
        dark: '#111827',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });

    return () => {
      active = false;
    };
  }, [result?.bookingId]);

  const lookup = async () => {
    setError('');
    setResult(null);

    if (!id.trim()) {
      setError('Please enter a booking ID.');
      return;
    }

    setLoading(true);

    try {
      const response = await getBookingByBookingId(id.trim());
      const found = response.booking;
      setResult({
        bookingId: found.bookingId,
        name: found.name,
        email: found.email,
        phone: found.phone,
        visitDate: found.visitDate,
        timeSlot: found.timeSlot,
        numberOfTickets: found.numberOfTickets,
        visitorType: found.visitorType,
        totalAmount: found.totalAmount,
        museumName: found.museumName,
        museumLocation: found.museumLocation,
        museumCategory: found.museumCategory,
        status: found.status,
        paymentStatus: found.paymentStatus,
        createdAt: found.createdAt
      });
    } catch (err) {
      setError((err as Error).message || 'Unable to fetch booking.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full px-4">
       {/* Spacer for fixed header - matches dark header background */}
            <div className="h-10 bg-white dark:bg-black"></div>
      <h3 className="mb-4 text-2xl font-semibold text-center h-15">Find your ticket</h3>

      <div className="mb-4 flex flex-col sm:flex-row gap-2 items-center max-w-lg mx-auto w-full">
        <div className="relative flex-1 w-full">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"><Search className="h-4 w-4" /></div>
          <input value={id} onChange={(e) => setId(e.target.value)} placeholder="Enter booking ID (e.g. BM123...)" className="w-full rounded border px-3 py-2 pl-10" />
        </div>
        <button onClick={lookup} className="rounded bg-primary px-4 py-2 text-primary-foreground w-full sm:w-auto" disabled={loading}>{loading ? 'Looking up…' : 'Lookup'}</button>
      </div>

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800 max-w-lg mx-auto">{error}</div>}

      {result && (
        <div className="rounded border bg-background p-4 max-w-lg mx-auto">
          <div className="mb-2 text-sm text-muted-foreground">Booking ID</div>
          <div className="mb-2 font-mono font-semibold">{result.bookingId}</div>
          <div className="mb-4 rounded-md border bg-muted/40 p-3">
            <div className="text-lg font-semibold">{result.museumName || 'Museum ticket'}</div>
            <div className="text-sm text-muted-foreground">{result.museumLocation || 'Location not available'}</div>
            {result.museumCategory ? (
              <div className="mt-1 text-xs text-muted-foreground">Category: {result.museumCategory}</div>
            ) : null}
          </div>

          {qrDataUrl && (
            <div className="mb-4 rounded-lg border bg-white p-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`QR code for booking ${result.bookingId}`}
                className="mx-auto h-44 w-44"
              />
              <div className="mt-2 text-xs font-medium text-slate-700">Scan this QR at the museum gate</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Name</div>
              <div className="font-medium">{result.name}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Email</div>
              <div className="font-medium">{result.email}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Phone</div>
              <div className="font-medium">{result.phone || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Date</div>
              <div className="font-medium">{new Date(result.visitDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Time</div>
              <div className="font-medium">{result.timeSlot}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Tickets</div>
              <div className="font-medium">{result.numberOfTickets} x {result.visitorType}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Amount</div>
              <div className="font-medium">INR {result.totalAmount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Booking Status</div>
              <div className="font-medium">{result.status}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Payment</div>
              <div className="font-medium">{result.paymentStatus || '-'}</div>
            </div>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">Created</div>
          <div className="text-xs">{new Date(result.createdAt).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
