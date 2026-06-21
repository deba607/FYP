import { NextResponse } from 'next/server';
import { getFirebaseFirestore } from '../../../../lib/config/firebaseAdmin';
import { jsonSuccess, jsonError } from '../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = getFirebaseFirestore();
    // Retrieve top 10 scores sorted descending.
    const scoresSnapshot = await db
      .collection('quizScores')
      .orderBy('score', 'desc')
      .limit(10)
      .get();

    const leaderboard = scoresSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return jsonSuccess({ leaderboard }, 200, {
      headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=60' }
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return jsonError('Failed to fetch leaderboard', 500);
  }
}
