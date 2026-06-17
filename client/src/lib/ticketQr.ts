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
  return `BMT:${booking.bookingId}`;
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

  if (trimmed.toUpperCase().startsWith('BMT:')) {
    return trimmed.slice(4).trim();
  }

  return trimmed;
}
