const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

type ApiErrorShape = {
  message?: string;
  error?: string;
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    },
    cache: 'no-store'
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorData = data as ApiErrorShape;
    throw new Error(errorData.message || errorData.error || 'Request failed');
  }

  return data as T;
}

export type CreateBookingInput = {
  name: string;
  email: string;
  phone: string;
  visitDate: string;
  timeSlot: string;
  numberOfTickets: number;
  visitorType: string;
  userId?: string;
  museumId?: string;
  museumName?: string;
  museumLocation?: string;
  museumCategory?: string;
  pricePerTicket?: number;
  totalPrice?: number;
  visitorCombo?: Record<string, number>;
};

export type BookingResponse = {
  _id: string;
  bookingId: string;
  name: string;
  email: string;
  phone: string;
  visitDate: string;
  timeSlot: string;
  numberOfTickets: number;
  visitorType: string;
  museumId?: string | null;
  museumName?: string | null;
  museumLocation?: string | null;
  museumCategory?: string | null;
  pricePerTicket?: number;
  totalAmount: number;
  paymentStatus?: string;
  paymentProvider?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  status: string;
  createdAt: string;
};

export type RazorpayOrderResponse = {
  success: boolean;
  demoMode?: boolean;
  keyId: string;
  order: {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
  };
  amount: number;
  currency: string;
};

export async function createRazorpayOrder(payload: CreateBookingInput) {
  return apiFetch<RazorpayOrderResponse>(`${API_BASE_URL}/payments/razorpay/order`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function verifyRazorpayPayment(payload: {
  booking: CreateBookingInput;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  demoMode?: boolean;
}) {
  return apiFetch<{ success: boolean; message: string; booking: BookingResponse }>(
    `${API_BASE_URL}/payments/razorpay/verify`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function createBooking(payload: CreateBookingInput) {
  return apiFetch<{ success: boolean; message: string; booking: BookingResponse }>(
    `${API_BASE_URL}/bookings`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function getBookingByBookingId(bookingId: string) {
  return apiFetch<{ success: boolean; booking: BookingResponse }>(
    `${API_BASE_URL}/bookings/by-booking-id/${encodeURIComponent(bookingId)}`
  );
}

export async function sendChatMessage(message: string, sessionId?: string, language?: string) {
  return apiFetch<{
    success: boolean;
    response: string;
    intent?: string;
    booking_data?: Record<string, unknown>;
  }>(`${API_BASE_URL}/chat/message`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      session_id: sessionId,
      language
    })
  });
}

export async function resetChatSession(sessionId?: string) {
  return apiFetch<{ success: boolean; message: string }>(`${API_BASE_URL}/chat/reset`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId })
  });
}

export async function login(email: string, password: string) {
  return apiFetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function signup(payload: {
  name: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth?: string;
}) {
  return apiFetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function signupWithGoogle(idToken: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string;
      photoURL?: string;
      profileCompleted: boolean;
      role: 'user' | 'admin';
    };
  }>(`${API_BASE_URL}/auth/google`, {
    method: 'POST',
    body: JSON.stringify({ idToken })
  });
}

export async function completeProfile(
  payload: {
    name?: string;
    phone: string;
    dateOfBirth?: string;
    address?: string;
    photoURL?: string;
    password?: string;
  },
  firebaseIdToken: string
) {
  return apiFetch<{
    success: boolean;
    message: string;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string;
      dateOfBirth?: string;
      address?: string;
      photoURL?: string;
      profileCompleted: boolean;
      role: 'user' | 'admin';
    };
  }>(`${API_BASE_URL}/auth/profile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${firebaseIdToken}`
    },
    body: JSON.stringify(payload)
  });
}

export async function uploadProfileImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/uploads`, {
    method: 'POST',
    body: formData,
    cache: 'no-store'
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorData = data as ApiErrorShape;
    throw new Error(errorData.message || errorData.error || 'Image upload failed');
  }

  return data as {
    success: boolean;
    imageUrl: string;
    publicId: string;
    message: string;
  };
}

export async function sendOtp(email: string, purpose: 'registration' | 'forgot_password') {
  return apiFetch<{ success: boolean; message: string; email: string }>(`${API_BASE_URL}/auth/send-otp`, {
    method: 'POST',
    body: JSON.stringify({ email, purpose })
  });
}

export async function verifyOtp(email: string, otp: string) {
  return apiFetch<{ success: boolean; message: string }>(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    body: JSON.stringify({ email, otp })
  });
}

export async function resetPassword(email: string, otp: string, password: string) {
  return apiFetch<{ success: boolean; message: string }>(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ email, otp, password })
  });
}
