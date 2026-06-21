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
    const { name, icon, description, color, difficulty, ageGroup } = body;

    const db = getFirebaseFirestore();
    const catRef = db.collection('quizCategories').doc(id);
    const catDoc = await catRef.get();

    if (!catDoc.exists) {
      return jsonError('Category not found', 404);
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (icon !== undefined) updates.icon = icon;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (difficulty !== undefined) updates.difficulty = difficulty;
    if (ageGroup !== undefined) updates.ageGroup = ageGroup;

    await catRef.update(updates);
    
    return jsonSuccess({ success: true, message: 'Category updated successfully' }, 200);
  } catch (error) {
    console.error('Error updating quiz category:', error);
    return jsonError('Failed to update category', 500);
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
    
    // Check if category exists
    const catRef = db.collection('quizCategories').doc(id);
    const catDoc = await catRef.get();
    if (!catDoc.exists) {
      return jsonError('Category not found', 404);
    }

    // Delete category
    await catRef.delete();

    // Optionally delete related questions
    const questionsSnapshot = await db
      .collection('quizQuestions')
      .where('category_id', '==', id)
      .get();
      
    const batch = db.batch();
    questionsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return jsonSuccess({ success: true, message: 'Category and its questions deleted successfully' }, 200);
  } catch (error) {
    console.error('Error deleting quiz category:', error);
    return jsonError('Failed to delete category', 500);
  }
}
