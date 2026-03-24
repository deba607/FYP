import { connectToDatabase } from '@/lib/db/mongoose';
import { getFirebaseFirestore } from '@/lib/config/firebaseAdmin';
import { BookingModel } from '@/models/Booking';
import { ApiError } from '@/lib/utils/errors';

const TICKET_PRICES = {
  Adult: 200,
  Child: 100,
  Senior: 150,
  Student: 120
} as const;

type VisitorType = keyof typeof TICKET_PRICES;

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

async function syncToFirestore(payload: Record<string, unknown>) {
  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection('bookings').doc(String(payload.bookingId)).set({
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } catch {
    // Keep MongoDB as source of truth when Firestore is unavailable.
  }
}

export async function createBooking(input: CreateBookingInput) {
  await connectToDatabase();

  const pricePerTicket = TICKET_PRICES[input.visitorType] || 0;
  const totalAmount = pricePerTicket * input.numberOfTickets;

  const bookingId = generateBookingId();

  const booking = await BookingModel.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    visitDate: input.visitDate,
    timeSlot: input.timeSlot,
    numberOfTickets: input.numberOfTickets,
    visitorType: input.visitorType,
    totalAmount,
    bookingId,
    userId: input.userId || null,
    status: 'confirmed'
  });

  await syncToFirestore({
    bookingId,
    userId: input.userId || null,
    userEmail: input.email,
    userName: input.name,
    visitDate: input.visitDate,
    timeSlot: input.timeSlot,
    numberOfTickets: input.numberOfTickets,
    visitorType: input.visitorType,
    totalAmount,
    status: 'confirmed'
  });

  return {
    success: true,
    message: 'Booking created successfully',
    booking
  };
}

export async function getAllBookings() {
  await connectToDatabase();

  const bookings = await BookingModel.find().sort({ createdAt: -1 }).lean();

  return {
    success: true,
    count: bookings.length,
    bookings
  };
}

export async function getBookingById(id: string) {
  await connectToDatabase();

  const booking = await BookingModel.findById(id).lean();

  if (!booking) {
    throw new ApiError('Booking not found', 404);
  }

  return {
    success: true,
    booking
  };
}

export async function getBookingByBookingId(bookingId: string) {
  await connectToDatabase();

  const booking = await BookingModel.findOne({ bookingId }).lean();

  if (!booking) {
    throw new ApiError('Booking not found', 404);
  }

  return {
    success: true,
    booking
  };
}

export async function getBookingsForUser(userId: string) {
  await connectToDatabase();

  const bookings = await BookingModel.find({ userId }).sort({ createdAt: -1 }).lean();

  return {
    success: true,
    count: bookings.length,
    bookings
  };
}

export async function updateBookingStatus(id: string, status: 'pending' | 'confirmed' | 'cancelled') {
  await connectToDatabase();

  const booking = await BookingModel.findByIdAndUpdate(id, { status }, { new: true }).lean();

  if (!booking) {
    throw new ApiError('Booking not found', 404);
  }

  return {
    success: true,
    message: 'Booking status updated',
    booking
  };
}

export async function deleteBooking(id: string) {
  await connectToDatabase();

  const booking = await BookingModel.findByIdAndDelete(id).lean();

  if (!booking) {
    throw new ApiError('Booking not found', 404);
  }

  return {
    success: true,
    message: 'Booking deleted successfully'
  };
}

export async function checkAvailability(input: { visitDate: string; timeSlot: string }) {
  await connectToDatabase();

  const bookings = await BookingModel.find({
    visitDate: new Date(input.visitDate),
    timeSlot: input.timeSlot,
    status: 'confirmed'
  }).lean();

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
