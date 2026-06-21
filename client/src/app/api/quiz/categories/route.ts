import { NextRequest } from 'next/server';
import { getFirebaseFirestore } from '../../../../lib/config/firebaseAdmin';
import { jsonSuccess, jsonError } from '../../../../lib/utils/apiResponse';
import { requireFirebaseUser } from '../../../../lib/middleware/auth';
import { ensureQuizData } from '../../../../lib/services/seedQuiz';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await ensureQuizData();
    const db = getFirebaseFirestore();
    const categoriesSnapshot = await db.collection('quizCategories').get();
    
    const categories = categoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return jsonSuccess({ success: true, categories }, 200, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' }
    });
  } catch (error) {
    console.error('Error fetching quiz categories:', error);
    return jsonError('Failed to fetch categories', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireFirebaseUser(req);
    if (user.role !== 'admin') {
      return jsonError('Admin access denied', 403);
    }
    
    const body = await req.json();
    const { name, icon, description, color, difficulty, ageGroup } = body;
    
    if (!name || !icon) {
      return jsonError('Category Name and Icon are required', 400);
    }
    
    const db = getFirebaseFirestore();
    const catId = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    
    const newCategory = {
      id: catId,
      name,
      icon,
      description: description || '',
      color: color || 'from-zinc-400 to-zinc-600',
      difficulty: difficulty || 'Easy',
      ageGroup: ageGroup || 'All'
    };
    
    await db.collection('quizCategories').doc(catId).set(newCategory);
    return jsonSuccess({ success: true, category: newCategory }, 201);
  } catch (error) {
    console.error('Error creating quiz category:', error);
    return jsonError('Failed to create category', 500);
  }
}
