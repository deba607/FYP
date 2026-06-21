import { NextRequest } from 'next/server';
import { getFirebaseFirestore } from '../../../../../lib/config/firebaseAdmin';
import { jsonSuccess, jsonError } from '../../../../../lib/utils/apiResponse';
import { requireFirebaseUser } from '../../../../../lib/middleware/auth';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireFirebaseUser(req);
    if (user.role !== 'admin') {
      return jsonError('Admin access denied', 403);
    }

    const { id } = await context.params;
    const body = await req.json();
    const { title, description, image, minimumScore } = body;

    const db = getFirebaseFirestore();
    const badgeRef = db.collection('quizBadges').doc(id);
    const badgeDoc = await badgeRef.get();

    if (!badgeDoc.exists) {
      return jsonError('Badge not found', 404);
    }

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (image !== undefined) updates.image = image;
    if (minimumScore !== undefined) updates.minimumScore = Number(minimumScore);

    updates.updatedAt = new Date().toISOString();

    await badgeRef.update(updates);

    return jsonSuccess({ success: true, message: 'Badge updated successfully' }, 200);
  } catch (error) {
    console.error('Error updating quiz badge:', error);
    return jsonError('Failed to update badge', 500);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireFirebaseUser(req);
    if (user.role !== 'admin') {
      return jsonError('Admin access denied', 403);
    }

    const { id } = await context.params;
    const db = getFirebaseFirestore();

    const badgeRef = db.collection('quizBadges').doc(id);
    const badgeDoc = await badgeRef.get();

    if (!badgeDoc.exists) {
      return jsonError('Badge not found', 404);
    }

    await badgeRef.delete();

    return jsonSuccess({ success: true, message: 'Badge deleted successfully' }, 200);
  } catch (error) {
    console.error('Error deleting quiz badge:', error);
    return jsonError('Failed to delete badge', 500);
  }
}
