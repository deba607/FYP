import { NextResponse } from 'next/server';

export function jsonSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
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
