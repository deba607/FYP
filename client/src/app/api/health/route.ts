import { NextResponse } from 'next/server';
import { ensureQuizData } from '../../../lib/services/seedQuiz';

export const runtime = 'nodejs';

export async function GET() {
  // Run seeding asynchronously to not block the health response
  ensureQuizData().catch((err) => {
    console.error('Failed to seed quiz data in health check:', err);
  });

  return NextResponse.json({
    success: true,
    message: 'Next.js API route layer is healthy'
  });
}
