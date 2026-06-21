import { NextRequest } from 'next/server';
import { getFirebaseFirestore } from '../../../../lib/config/firebaseAdmin';
import { jsonSuccess, jsonError } from '../../../../lib/utils/apiResponse';
import { requireFirebaseUser } from '../../../../lib/middleware/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = getFirebaseFirestore();
    const badgesSnapshot = await db.collection('quizBadges').get();
    
    const badges = badgesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return jsonSuccess({ success: true, badges }, 200, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' }
    });
  } catch (error) {
    console.error('Error fetching quiz badges:', error);
    return jsonError('Failed to fetch badges', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireFirebaseUser(req);
    if (user.role !== 'admin') {
      return jsonError('Admin access denied', 403);
    }

    const body = await req.json();
    const { title, description, image, minimumScore } = body;

    if (!title || !description || !image || minimumScore === undefined) {
      return jsonError('Required fields: title, description, image, minimumScore', 400);
    }

    const db = getFirebaseFirestore();
    const badgeId = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');

    const newBadge = {
      id: badgeId,
      title,
      description,
      image,
      minimumScore: Number(minimumScore),
      createdAt: new Date().toISOString()
    };

    await db.collection('quizBadges').doc(badgeId).set(newBadge);

    return jsonSuccess({ success: true, badge: newBadge }, 201);
  } catch (error) {
    console.error('Error creating quiz badge:', error);
    return jsonError('Failed to create badge', 500);
  }
}
