export type TicketQrBooking = {
  bookingId: string;
  name?: string;
  email?: string;
  phone?: string;
  gender?: string | null;
  age?: number | null;
  userLocation?: string | null;
  visitDate?: string;
  timeSlot?: string;
  numberOfTickets?: number;
  visitorType?: string;
  visitorCombo?: Record<string, number> | null;
  museumId?: string | null;
  museumName?: string | null;
  museumLocation?: string | null;
  museumCategory?: string | null;
  pricePerTicket?: number;
  totalAmount?: number;
  paymentStatus?: string;
  status?: string;
  createdAt?: string;
  purchaseDateTime?: string;
};

export function buildTicketQrPayload(booking: TicketQrBooking) {
  return JSON.stringify({
    t: 'bmt',
    v: 1,
    b: booking.bookingId,
    u: {
      n: booking.name || '',
      e: booking.email || '',
      p: booking.phone || '',
      g: booking.gender || '',
      a: booking.age ?? null,
      l: booking.userLocation || ''
    },
    m: {
      i: booking.museumId || '',
      n: booking.museumName || '',
      l: booking.museumLocation || '',
      c: booking.museumCategory || ''
    },
    k: {
      d: booking.visitDate || '',
      s: booking.timeSlot || '',
      q: Number(booking.numberOfTickets || 0),
      vt: booking.visitorType || '',
      vc: booking.visitorCombo || null,
      pp: Number(booking.pricePerTicket || 0),
      ta: Number(booking.totalAmount || 0),
      ps: booking.paymentStatus || '',
      st: booking.status || '',
      pd: booking.purchaseDateTime || booking.createdAt || ''
    }
  });
}

export function extractBookingIdFromQrValue(value: string) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  try {
    const parsed = JSON.parse(trimmed);
    const candidates = [
      parsed?.b,
      parsed?.bookingId,
      parsed?.ticket?.bookingId,
      parsed?.id
    ];
    const found = candidates.find((candidate) => String(candidate || '').trim());
    if (found) return String(found).trim();
  } catch {
    // Old QR codes contain the booking ID directly.
  }

  return trimmed;
}
