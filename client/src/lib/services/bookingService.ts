import { getFirebaseFirestore, getFirebaseRealtimeDatabase } from '../config/firebaseAdmin';
import { ApiError } from '../utils/errors';
import { sendBookingConfirmationEmail } from './emailService';

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
  visitorType: VisitorType;
  userId?: string;
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

export function calculateTicketPrice(visitorType: VisitorType, pricePerTicket?: number) {
  if (typeof pricePerTicket === 'number' && Number.isFinite(pricePerTicket) && pricePerTicket > 0) {
    return pricePerTicket;
  }

  return TICKET_PRICES[visitorType] || 0;
}

export function calculateBookingTotal(input: Pick<CreateBookingInput, 'visitorType' | 'numberOfTickets'> & MuseumInfo) {
  const pricePerTicket = calculateTicketPrice(input.visitorType, input.pricePerTicket);
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

async function mirrorBookingToRealtimeDatabase(booking: Record<string, unknown>) {
  const database = getFirebaseRealtimeDatabase();
  const bookingId = String(booking.bookingId || '');
  const userId = booking.userId ? String(booking.userId) : null;

  if (!bookingId) {
    return;
  }

  const realtimePayload = Object.fromEntries(
    Object.entries(booking).map(([key, value]) => [key, toRealtimeValue(value)])
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
    updatedAt: toDateString(data.updatedAt)
  };
}

export async function createBooking(input: CreateBookingInput & MuseumInfo & Partial<BookingPaymentInfo> & { status?: BookingStatus }) {
  const firestore = getFirebaseFirestore();

  // Determine price per ticket: prefer museum-specific price if provided,
  // otherwise fall back to visitor-type pricing.
  const { pricePerTicket, totalAmount } = calculateBookingTotal(input);

  const bookingId = generateBookingId();
  const now = new Date();
  const bookingDoc = firestore.collection('bookings').doc();

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
    // Museum reference fields
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
    createdAt: now,
    updatedAt: now
  };

  await bookingDoc.set(payload);
  await mirrorBookingToRealtimeDatabase({
    ...payload,
    firestoreDocumentId: bookingDoc.id
  });
  const booking = toBookingResponse(bookingDoc.id, payload);

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
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore.collection('bookings').get();

  const bookings = snapshot.docs
    .map((doc) => toBookingResponse(doc.id, doc.data()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    success: true,
    count: bookings.length,
    bookings
  };
}

export async function getBookingById(id: string) {
  const firestore = getFirebaseFirestore();
  const doc = await firestore.collection('bookings').doc(id).get();

  if (!doc.exists) {
    throw new ApiError('Booking not found', 404);
  }

  const booking = toBookingResponse(doc.id, doc.data() as Record<string, unknown>);

  return {
    success: true,
    booking
  };
}

export async function getBookingByBookingId(bookingId: string) {
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore
    .collection('bookings')
    .where('bookingId', '==', bookingId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new ApiError('Booking not found', 404);
  }

  const doc = snapshot.docs[0]!;
  const booking = toBookingResponse(doc.id, doc.data());

  return {
    success: true,
    booking
  };
}

export async function getBookingsForUser(userId: string) {
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore.collection('bookings').where('userId', '==', userId).get();

  const bookings = snapshot.docs
    .map((doc) => toBookingResponse(doc.id, doc.data()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    success: true,
    count: bookings.length,
    bookings
  };
}

export async function updateBookingStatus(id: string, status: 'pending' | 'confirmed' | 'cancelled') {
  const firestore = getFirebaseFirestore();
  const docRef = firestore.collection('bookings').doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new ApiError('Booking not found', 404);
  }

  await docRef.update({
    status,
    updatedAt: new Date()
  });

  const updatedDoc = await docRef.get();
  const booking = toBookingResponse(updatedDoc.id, updatedDoc.data() as Record<string, unknown>);

  return {
    success: true,
    message: 'Booking status updated',
    booking
  };
}

export async function deleteBooking(id: string) {
  const firestore = getFirebaseFirestore();
  const docRef = firestore.collection('bookings').doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new ApiError('Booking not found', 404);
  }

  await docRef.delete();

  return {
    success: true,
    message: 'Booking deleted successfully'
  };
}

export async function checkAvailability(input: { visitDate: string; timeSlot: string }) {
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore
    .collection('bookings')
    .where('timeSlot', '==', input.timeSlot)
    .where('status', '==', 'confirmed')
    .get();

  const bookings = snapshot.docs
    .map((doc) => toBookingResponse(doc.id, doc.data()))
    .filter((booking) => booking.visitDate === input.visitDate);

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
