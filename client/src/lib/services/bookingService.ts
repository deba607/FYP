import { getFirebaseFirestore } from '@/lib/config/firebaseAdmin';
import { ApiError } from '@/lib/utils/errors';

const TICKET_PRICES = {
  Adult: 200,
  Child: 100,
  Senior: 150,
  Student: 120
} as const;

type VisitorType = keyof typeof TICKET_PRICES;
type BookingStatus = 'pending' | 'confirmed' | 'cancelled';

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
    status: String(data.status || 'confirmed') as BookingStatus,
    createdAt: toDateString(data.createdAt),
    updatedAt: toDateString(data.updatedAt)
  };
}

export async function createBooking(input: CreateBookingInput) {
  const firestore = getFirebaseFirestore();

  const pricePerTicket = TICKET_PRICES[input.visitorType] || 0;
  const totalAmount = pricePerTicket * input.numberOfTickets;

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
    totalAmount,
    status: 'confirmed' as BookingStatus,
    createdAt: now,
    updatedAt: now
  };

  await bookingDoc.set(payload);
  const booking = toBookingResponse(bookingDoc.id, payload);

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
