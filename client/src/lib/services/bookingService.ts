import { getFirebaseFirestore, getFirebaseRealtimeDatabase } from '../config/firebaseAdmin';
import { ApiError } from '../utils/errors';
import { sendBookingConfirmationEmail } from './emailService';
import { logUserActivity } from './activityService';

const TICKET_PRICES = {
  Adult: 200,
  Child: 100,
  'Senior Citizen': 150,
  Student: 120,
  Professor: 180,
  'Researcher/Scientist': 180
} as const;

type VisitorType = keyof typeof TICKET_PRICES;
type BookingStatus = 'pending' | 'confirmed' | 'cancelled';
type PaymentStatus = 'pending' | 'paid' | 'failed';

export type CreateBookingInput = {
  name: string;
  email: string;
  phone: string;
  visitDate: string;
  timeSlot: 'Morning (9 AM-12 PM)' | 'Afternoon (12 PM-3 PM)' | 'Evening (3 PM-6 PM)';
  numberOfTickets: number;
  visitorType: string;
  userId?: string;
  visitorCombo?: Record<string, number> | null;
};

export type MuseumInfo = {
  museumId?: string;
  museumName?: string;
  museumLocation?: string;
  museumCategory?: string;
  pricePerTicket?: number;
};

export type BookingPaymentInfo = {
  paymentStatus?: PaymentStatus;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  razorpaySignature?: string | null;
  paymentProvider?: 'razorpay';
};

export function calculateTicketPrice(visitorType: string, pricePerTicket?: number) {
  if (typeof pricePerTicket === 'number' && Number.isFinite(pricePerTicket) && pricePerTicket > 0) {
    return pricePerTicket;
  }

  return TICKET_PRICES[visitorType as VisitorType] || 0;
}

export function calculateBookingTotal(
  input: Pick<CreateBookingInput, 'visitorType' | 'numberOfTickets'> & MuseumInfo & { visitorCombo?: Record<string, number> | null },
  customPrices?: Record<string, number> | null
) {
  if (input.visitorCombo && Object.keys(input.visitorCombo).length > 0) {
    let totalAmount = 0;
    for (const [vType, count] of Object.entries(input.visitorCombo)) {
      let price: number = TICKET_PRICES[vType as VisitorType] || 200;
      if (customPrices && typeof customPrices[vType] === 'number') {
        price = customPrices[vType];
      } else if (input.pricePerTicket && input.pricePerTicket > 0) {
        const base = input.pricePerTicket;
        if (vType === 'Adult') price = base;
        else if (vType === 'Child') price = Math.round(base * 0.5);
        else if (vType === 'Senior Citizen') price = Math.round(base * 0.75);
        else if (vType === 'Student') price = Math.round(base * 0.6);
        else if (vType === 'Professor') price = Math.round(base * 0.9);
        else if (vType === 'Researcher/Scientist') price = Math.round(base * 0.9);
      }
      totalAmount += price * count;
    }
    const nonZeroTypes = Object.entries(input.visitorCombo).filter(([_, count]) => count > 0);
    const representativeType = nonZeroTypes.length > 0 ? nonZeroTypes[0][0] : 'Adult';
    let pricePerTicket: number = TICKET_PRICES[representativeType as VisitorType] || 200;
    if (customPrices && typeof customPrices[representativeType] === 'number') {
      pricePerTicket = customPrices[representativeType];
    } else if (input.pricePerTicket && input.pricePerTicket > 0) {
      const base = input.pricePerTicket;
      if (representativeType === 'Adult') pricePerTicket = base;
      else if (representativeType === 'Child') pricePerTicket = Math.round(base * 0.5);
      else if (representativeType === 'Senior Citizen') pricePerTicket = Math.round(base * 0.75);
      else if (representativeType === 'Student') pricePerTicket = Math.round(base * 0.6);
      else if (representativeType === 'Professor') pricePerTicket = Math.round(base * 0.9);
      else if (representativeType === 'Researcher/Scientist') pricePerTicket = Math.round(base * 0.9);
    }
    if (customPrices && typeof customPrices[representativeType] === 'number') {
      pricePerTicket = customPrices[representativeType];
    } else if (input.pricePerTicket && input.pricePerTicket > 0) {
      const base = input.pricePerTicket;
      if (representativeType === 'Adult') pricePerTicket = base;
      else if (representativeType === 'Child') pricePerTicket = Math.round(base * 0.5);
      else if (representativeType === 'Senior Citizen') pricePerTicket = Math.round(base * 0.75);
      else if (representativeType === 'Student') pricePerTicket = Math.round(base * 0.6);
      else if (representativeType === 'Professor') pricePerTicket = Math.round(base * 0.9);
      else if (representativeType === 'Researcher/Scientist') pricePerTicket = Math.round(base * 0.9);
    }
    return {
      pricePerTicket,
      totalAmount
    };
  }

  let pricePerTicket = calculateTicketPrice(input.visitorType, input.pricePerTicket);
  if (customPrices && typeof customPrices[input.visitorType] === 'number') {
    pricePerTicket = customPrices[input.visitorType];
  } else if (input.pricePerTicket && input.pricePerTicket > 0) {
    const base = input.pricePerTicket;
    if (input.visitorType === 'Adult') pricePerTicket = base;
    else if (input.visitorType === 'Child') pricePerTicket = Math.round(base * 0.5);
    else if (input.visitorType === 'Senior Citizen') pricePerTicket = Math.round(base * 0.75);
    else if (input.visitorType === 'Student') pricePerTicket = Math.round(base * 0.6);
    else if (input.visitorType === 'Professor') pricePerTicket = Math.round(base * 0.9);
    else if (input.visitorType === 'Researcher/Scientist') pricePerTicket = Math.round(base * 0.9);
  }
  return {
    pricePerTicket,
    totalAmount: pricePerTicket * input.numberOfTickets
  };
}

function generateBookingId() {
  return `BM${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function toDateString(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Date().toISOString();
}

function toRealtimeValue(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ?? null;
}

function sanitizeVisitorCombo(combo: Record<string, number> | null | undefined): Record<string, number> | null {
  if (!combo) return null;
  const sanitized: Record<string, number> = {};
  for (const [key, value] of Object.entries(combo)) {
    const safeKey = key.replace(/\//g, '-');
    sanitized[safeKey] = value;
  }
  return sanitized;
}

function desanitizeVisitorCombo(combo: Record<string, number> | null | undefined): Record<string, number> | null {
  if (!combo) return null;
  const desanitized: Record<string, number> = {};
  for (const [key, value] of Object.entries(combo)) {
    const originalKey = key.replace(/-/g, '/');
    desanitized[originalKey] = value;
  }
  return desanitized;
}

async function mirrorBookingToRealtimeDatabase(booking: Record<string, unknown>) {
  const database = getFirebaseRealtimeDatabase();
  const bookingId = String(booking.bookingId || '');
  const userId = booking.userId ? String(booking.userId) : null;

  if (!bookingId) {
    return;
  }

  const realtimePayload = Object.fromEntries(
    Object.entries(booking).map(([key, value]) => {
      if (key === 'visitorCombo') {
        return [key, sanitizeVisitorCombo(value as any)];
      }
      return [key, toRealtimeValue(value)];
    })
  );

  const updates: Record<string, unknown> = {
    [`bookings/${bookingId}`]: realtimePayload
  };

  if (userId) {
    updates[`bookingsByUser/${userId}/${bookingId}`] = realtimePayload;
  }

  await database.ref().update(updates);
}

function toBookingResponse(id: string, data: Record<string, unknown>) {
  return {
    _id: id,
    bookingId: String(data.bookingId || id),
    userId: data.userId ? String(data.userId) : null,
    name: String(data.name || ''),
    email: String(data.email || ''),
    phone: String(data.phone || ''),
    visitDate: String(data.visitDate || ''),
    timeSlot: String(data.timeSlot || ''),
    numberOfTickets: Number(data.numberOfTickets || 0),
    visitorType: String(data.visitorType || 'Adult'),
    totalAmount: Number(data.totalAmount || 0),
    museumId: data.museumId ? String(data.museumId) : null,
    museumName: data.museumName ? String(data.museumName) : null,
    museumLocation: data.museumLocation ? String(data.museumLocation) : null,
    museumCategory: data.museumCategory ? String(data.museumCategory) : null,
    pricePerTicket: Number(data.pricePerTicket || 0),
    paymentStatus: String(data.paymentStatus || 'pending'),
    paymentProvider: data.paymentProvider ? String(data.paymentProvider) : null,
    razorpayOrderId: data.razorpayOrderId ? String(data.razorpayOrderId) : null,
    razorpayPaymentId: data.razorpayPaymentId ? String(data.razorpayPaymentId) : null,
    status: String(data.status || 'confirmed') as BookingStatus,
    createdAt: toDateString(data.createdAt),
    updatedAt: toDateString(data.updatedAt),
    visitorCombo: desanitizeVisitorCombo(data.visitorCombo as Record<string, number>) || null
  };
}

type BookingResponseData = ReturnType<typeof toBookingResponse>;

function normalizeLookupValue(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function museumPriceCandidates(museum: Record<string, any>) {
  const values = new Set<number>();
  const basePrice = Number(museum.price || 0);
  if (basePrice > 0) values.add(basePrice);

  const prices = museum.prices && typeof museum.prices === 'object' ? museum.prices : {};
  Object.values(prices).forEach((value) => {
    const price = Number(value || 0);
    if (price > 0) values.add(price);
  });

  return values;
}

async function loadMuseumRecordsForEnrichment() {
  try {
    const firestore = getFirebaseFirestore();
    const snapshot = await firestore.collection('museums').get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Record<string, any>[];
  } catch (error) {
    console.error('Failed to load museums for booking enrichment:', error);
    return [];
  }
}

function findMuseumForBooking(booking: BookingResponseData, museums: Record<string, any>[]) {
  const bookingMuseumId = normalizeLookupValue(booking.museumId);
  const bookingMuseumName = normalizeLookupValue(booking.museumName);
  const bookingPrice = Number(booking.pricePerTicket || (booking.numberOfTickets ? booking.totalAmount / booking.numberOfTickets : 0));

  if (bookingMuseumId) {
    const byId = museums.find((museum) => {
      return [
        museum.id,
        museum.museum_id
      ].some((value) => normalizeLookupValue(value) === bookingMuseumId);
    });
    if (byId) return byId;
  }

  if (bookingMuseumName) {
    const byName = museums.find((museum) => normalizeLookupValue(museum.name) === bookingMuseumName);
    if (byName) return byName;
  }

  if (bookingPrice > 0) {
    const priceMatches = museums.filter((museum) => museumPriceCandidates(museum).has(bookingPrice));
    if (priceMatches.length === 1) {
      return priceMatches[0];
    }
  }

  return null;
}

async function enrichBookingWithMuseumInfo<T extends BookingResponseData>(booking: T, museums?: Record<string, any>[]): Promise<T> {
  if (booking.museumName && booking.museumLocation) {
    return booking;
  }

  const museumRecords = museums || await loadMuseumRecordsForEnrichment();
  const museum = findMuseumForBooking(booking, museumRecords);
  if (!museum) {
    return booking;
  }

  return {
    ...booking,
    museumId: booking.museumId || String(museum.museum_id || museum.id || ''),
    museumName: booking.museumName || String(museum.name || ''),
    museumLocation: booking.museumLocation || String(museum.location || ''),
    museumCategory: booking.museumCategory || String(museum.category || '')
  };
}

async function enrichBookingsWithMuseumInfo<T extends BookingResponseData>(bookings: T[]) {
  const needsEnrichment = bookings.some((booking) => !booking.museumName || !booking.museumLocation);
  if (!needsEnrichment) {
    return bookings;
  }

  const museums = await loadMuseumRecordsForEnrichment();
  return Promise.all(bookings.map((booking) => enrichBookingWithMuseumInfo(booking, museums)));
}

export async function createBooking(input: CreateBookingInput & MuseumInfo & Partial<BookingPaymentInfo> & { status?: BookingStatus }) {
  const firestore = getFirebaseFirestore();
  const database = getFirebaseRealtimeDatabase();

  if (!String(input.museumName || '').trim() || !String(input.museumLocation || '').trim()) {
    throw new ApiError('Please select a museum before booking. Museum name and location are required.', 400);
  }

  // Fetch custom prices if booking a custom registered museum
  let customPrices: Record<string, number> | null = null;
  if (input.museumId?.startsWith('custom_')) {
    try {
      const snap = await firestore
        .collection('museums')
        .where('museum_id', '==', input.museumId)
        .limit(1)
        .get();
      if (!snap.empty) {
        const mDoc = snap.docs[0].data();
        customPrices = mDoc.prices || null;
      }
    } catch (err) {
      console.error('Failed to retrieve custom museum prices on createBooking:', err);
    }
  }

  // Determine price per ticket: prefer museum-specific price if provided,
  // otherwise fall back to visitor-type pricing.
  const { pricePerTicket, totalAmount } = calculateBookingTotal(input, customPrices);

  const bookingId = generateBookingId();
  const now = new Date();

  const payload = {
    bookingId,
    userId: input.userId || null,
    name: input.name,
    email: input.email,
    phone: input.phone,
    visitDate: input.visitDate,
    timeSlot: input.timeSlot,
    numberOfTickets: input.numberOfTickets,
    visitorType: input.visitorType,
    visitorCombo: sanitizeVisitorCombo(input.visitorCombo),
    museumId: input.museumId || null,
    museumName: input.museumName || null,
    museumLocation: input.museumLocation || null,
    museumCategory: input.museumCategory || null,
    pricePerTicket,
    totalAmount,
    paymentStatus: input.paymentStatus || 'pending',
    paymentProvider: input.paymentProvider || null,
    razorpayOrderId: input.razorpayOrderId || null,
    razorpayPaymentId: input.razorpayPaymentId || null,
    razorpaySignature: input.razorpaySignature || null,
    status: input.status || 'confirmed' as BookingStatus,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  const updates: Record<string, any> = {
    [`bookings/${bookingId}`]: payload
  };
  if (payload.userId) {
    updates[`bookingsByUser/${payload.userId}/${bookingId}`] = payload;
  }
  await database.ref().update(updates);

  void logUserActivity(payload.userId, payload.email, 'Booking', 'booking_created', `Booking ${bookingId} created for ${payload.museumName || 'Bharat Museum'} on ${payload.visitDate} (${payload.timeSlot})`);

  const booking = await enrichBookingWithMuseumInfo(toBookingResponse(bookingId, payload));

  // Send booking confirmation email asynchronously (non-blocking)
  sendBookingConfirmationEmail(booking).catch((err) => {
    console.error('Failed to send booking confirmation email:', err);
  });

  return {
    success: true,
    message: 'Booking created successfully',
    booking
  };
}

export async function getAllBookings() {
  const database = getFirebaseRealtimeDatabase();
  const snapshot = await database.ref('bookings').once('value');

  const list: any[] = [];
  snapshot.forEach((child) => {
    list.push(toBookingResponse(child.key || '', child.val()));
  });

  // Sort descending
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const bookings = await enrichBookingsWithMuseumInfo(list);

  return {
    success: true,
    count: bookings.length,
    bookings
  };
}

export async function getBookingById(id: string) {
  const database = getFirebaseRealtimeDatabase();
  const snapshot = await database.ref(`bookings/${id}`).once('value');

  if (!snapshot.exists()) {
    throw new ApiError('Booking not found', 404);
  }

  const booking = await enrichBookingWithMuseumInfo(toBookingResponse(id, snapshot.val()));

  return {
    success: true,
    booking
  };
}

export async function getBookingByBookingId(bookingId: string) {
  const database = getFirebaseRealtimeDatabase();
  const snapshot = await database.ref(`bookings/${bookingId}`).once('value');

  if (!snapshot.exists()) {
    throw new ApiError('Booking not found', 404);
  }

  const booking = await enrichBookingWithMuseumInfo(toBookingResponse(bookingId, snapshot.val()));

  return {
    success: true,
    booking
  };
}

export async function getBookingsForUser(userId: string) {
  const database = getFirebaseRealtimeDatabase();
  const snapshot = await database.ref(`bookingsByUser/${userId}`).once('value');

  const list: any[] = [];
  snapshot.forEach((child) => {
    list.push(toBookingResponse(child.key || '', child.val()));
  });

  // Sort descending
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const bookings = await enrichBookingsWithMuseumInfo(list);

  return {
    success: true,
    count: bookings.length,
    bookings
  };
}

function toTicketScanAction(message: string, outcome: string, gateAction?: string) {
  if (gateAction === 'entry' || gateAction === 'exit') return gateAction;
  const lower = message.toLowerCase();
  if (lower.includes('exit')) return 'exit';
  if (outcome === 'granted') return 'entry';
  return 'denied';
}

function isTicketExpired(visitDate: string) {
  const todayInKolkata = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
  const todayStr = todayInKolkata.toISOString().split('T')[0];
  return Boolean(visitDate) && visitDate < todayStr;
}

export async function getTicketHistoryForUser(input: { userId: string; email?: string | null }) {
  const database = getFirebaseRealtimeDatabase();
  const normalizedEmail = String(input.email || '').trim().toLowerCase();
  const bookingsById = new Map<string, ReturnType<typeof toBookingResponse>>();

  if (input.userId) {
    const userSnapshot = await database.ref(`bookingsByUser/${input.userId}`).once('value');
    userSnapshot.forEach((child) => {
      const booking = toBookingResponse(child.key || '', child.val());
      bookingsById.set(booking.bookingId, booking);
    });
  }

  if (normalizedEmail) {
    const allSnapshot = await database.ref('bookings').once('value');
    allSnapshot.forEach((child) => {
      const val = child.val();
      if (String(val?.email || '').trim().toLowerCase() === normalizedEmail) {
        const booking = toBookingResponse(child.key || '', val);
        bookingsById.set(booking.bookingId, booking);
      }
    });
  }

  const scanLogsByTicket = new Map<string, any[]>();
  const scanSnapshot = await database.ref('scan_logs').once('value');
  scanSnapshot.forEach((child) => {
    const val = child.val();
    const ticketId = String(val?.ticketId || '').trim();
    if (!ticketId) return;

    const logs = scanLogsByTicket.get(ticketId) || [];
    logs.push({
      id: child.key || '',
      ticketId,
      deviceId: String(val?.deviceId || ''),
      deviceName: String(val?.deviceName || ''),
      scannedAt: toDateString(val?.scannedAt),
      outcome: String(val?.outcome || 'denied'),
      gateAction: String(val?.gateAction || ''),
      message: String(val?.message || '')
    });
    scanLogsByTicket.set(ticketId, logs);
  });

  const enrichedBookings = await enrichBookingsWithMuseumInfo(Array.from(bookingsById.values()));

  const tickets = enrichedBookings.map((booking) => {
    const scanLogs = (scanLogsByTicket.get(booking.bookingId) || [])
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
    const latestScan = scanLogs[0] || null;

    return {
      ...booking,
      expired: isTicketExpired(booking.visitDate),
      gateAction: latestScan ? toTicketScanAction(latestScan.message, latestScan.outcome, latestScan.gateAction) : 'not_scanned',
      latestScan,
      scanLogs
    };
  });

  tickets.sort((a, b) => new Date(b.visitDate || b.createdAt).getTime() - new Date(a.visitDate || a.createdAt).getTime());

  return {
    success: true,
    count: tickets.length,
    tickets
  };
}

export async function updateBookingStatus(id: string, status: 'pending' | 'confirmed' | 'cancelled') {
  const database = getFirebaseRealtimeDatabase();
  const bookingRef = database.ref(`bookings/${id}`);
  const snap = await bookingRef.once('value');

  if (!snap.exists()) {
    throw new ApiError('Booking not found', 404);
  }

  const bookingData = snap.val();
  const now = new Date();
  
  const updates: Record<string, any> = {
    [`bookings/${id}/status`]: status,
    [`bookings/${id}/updatedAt`]: now.toISOString()
  };

  if (bookingData.userId) {
    updates[`bookingsByUser/${bookingData.userId}/${id}/status`] = status;
    updates[`bookingsByUser/${bookingData.userId}/${id}/updatedAt`] = now.toISOString();
  }

  await database.ref().update(updates);

  const updatedSnap = await bookingRef.once('value');
  const booking = await enrichBookingWithMuseumInfo(toBookingResponse(id, updatedSnap.val()));
  void logUserActivity(booking.userId, booking.email, 'Booking', 'booking_updated', `Booking status for ${booking.bookingId} updated to ${status}`);

  return {
    success: true,
    message: 'Booking status updated',
    booking
  };
}

export async function deleteBooking(id: string) {
  const database = getFirebaseRealtimeDatabase();
  const bookingRef = database.ref(`bookings/${id}`);
  const snap = await bookingRef.once('value');

  if (!snap.exists()) {
    throw new ApiError('Booking not found', 404);
  }

  const bookingData = snap.val();
  const updates: Record<string, any> = {
    [`bookings/${id}`]: null
  };

  if (bookingData.userId) {
    updates[`bookingsByUser/${bookingData.userId}/${id}`] = null;
  }

  await database.ref().update(updates);

  return {
    success: true,
    message: 'Booking deleted successfully'
  };
}

export async function checkAvailability(input: { visitDate: string; timeSlot: string }) {
  const database = getFirebaseRealtimeDatabase();
  const snapshot = await database
    .ref('bookings')
    .orderByChild('timeSlot')
    .equalTo(input.timeSlot)
    .once('value');

  const list: any[] = [];
  snapshot.forEach((child) => {
    const val = child.val();
    if (val.visitDate === input.visitDate && val.status === 'confirmed') {
      list.push(toBookingResponse(child.key || '', val));
    }
  });

  const bookings = await enrichBookingsWithMuseumInfo(list);
  const totalTickets = bookings.reduce((sum, booking) => sum + Number(booking.numberOfTickets), 0);
  const maxCapacity = 100;
  const availableTickets = maxCapacity - totalTickets;

  return {
    success: true,
    available: availableTickets > 0,
    availableTickets,
    maxCapacity
  };
}
