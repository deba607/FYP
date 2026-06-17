import { NextResponse } from 'next/server';

export function jsonSuccess<T>(data: T, status = 200, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, status });
}

export function jsonError(message: string, status = 500, meta?: Record<string, unknown>) {
  return NextResponse.json(
    {
      success: false,
      message,
      ...(meta || {})
    },
    { status }
  );
}
