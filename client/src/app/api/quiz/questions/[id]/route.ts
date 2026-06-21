import { NextRequest } from 'next/server';
import { getFirebaseFirestore } from '../../../../../lib/config/firebaseAdmin';
import { jsonSuccess, jsonError } from '../../../../../lib/utils/apiResponse';
import { requireFirebaseUser } from '../../../../../lib/middleware/auth';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

const QUESTION_TYPES = new Set(['multiple-choice', 'true-false', 'image-guess']);
const DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);

function normalizeQuestion(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const user = await requireFirebaseUser(req);
    if (user.role !== 'admin') {
      return jsonError('Admin access denied', 403);
    }

    const { id } = await context.params;
    const body = await req.json();
    const { category_id, question, options, correctAnswer, explanation, imageUrl, difficulty, points, type, museum_id, museum_name, status } = body;

    const db = getFirebaseFirestore();
    const questionRef = db.collection('quizQuestions').doc(id);
    const questionDoc = await questionRef.get();

    if (!questionDoc.exists) {
      return jsonError('Question not found', 404);
    }

    const current = questionDoc.data() || {};
    const nextCategoryId = String(category_id ?? current.category_id ?? '');
    const nextQuestion = normalizeQuestion(question ?? current.question);
    const nextOptions = Array.isArray(options)
      ? [...new Set(options.map(normalizeQuestion).filter(Boolean))]
      : (Array.isArray(current.options) ? current.options.map(normalizeQuestion).filter(Boolean) : []);
    const nextCorrectAnswer = normalizeQuestion(correctAnswer ?? current.correctAnswer);

    if (!nextCategoryId || !nextQuestion || nextOptions.length < 2 || !nextCorrectAnswer) {
      return jsonError('Category, question, at least two options, and a correct answer are required', 400);
    }
    if (!nextOptions.some((option: string) => option.toLowerCase() === nextCorrectAnswer.toLowerCase())) {
      return jsonError('The correct answer must match one of the answer options', 400);
    }

    const categoryDoc = await db.collection('quizCategories').doc(nextCategoryId).get();
    if (!categoryDoc.exists) {
      return jsonError('The selected quiz category does not exist', 400);
    }

    const categoryQuestions = await db.collection('quizQuestions')
      .where('category_id', '==', nextCategoryId)
      .get();
    const normalizedQuestion = nextQuestion.toLowerCase();
    const duplicate = categoryQuestions.docs.some((doc) => {
      if (doc.id === id) return false;
      const data = doc.data();
      return String(data.normalizedQuestion || normalizeQuestion(data.question).toLowerCase()) === normalizedQuestion;
    });
    if (duplicate) {
      return jsonError('This question already exists in the selected category', 409);
    }

    const nextType = type ?? current.type ?? 'multiple-choice';
    if (!QUESTION_TYPES.has(nextType)) {
      return jsonError('Unsupported question type', 400);
    }
    if (nextType === 'image-guess' && !normalizeQuestion(imageUrl ?? current.imageUrl)) {
      return jsonError('An image URL is required for image questions', 400);
    }

    const updates: Record<string, any> = {
      category_id: nextCategoryId,
      question: nextQuestion,
      normalizedQuestion,
      options: nextOptions,
      correctAnswer: nextCorrectAnswer
    };
    if (explanation !== undefined) updates.explanation = normalizeQuestion(explanation);
    if (imageUrl !== undefined) updates.imageUrl = imageUrl;
    if (difficulty !== undefined) updates.difficulty = DIFFICULTIES.has(difficulty) ? difficulty : current.difficulty || 'Easy';
    if (points !== undefined) updates.points = Math.min(100, Math.max(1, Number(points) || 10));
    if (type !== undefined) updates.type = nextType;
    if (museum_id !== undefined) updates.museum_id = museum_id;
    if (museum_name !== undefined) updates.museum_name = normalizeQuestion(museum_name);
    if (status !== undefined) updates.status = status === 'inactive' ? 'inactive' : 'active';

    updates.updatedAt = new Date().toISOString();

    await questionRef.update(updates);

    return jsonSuccess({ success: true, message: 'Question updated successfully' }, 200);
  } catch (error) {
    console.error('Error updating quiz question:', error);
    return jsonError('Failed to update question', 500);
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

    const questionRef = db.collection('quizQuestions').doc(id);
    const questionDoc = await questionRef.get();

    if (!questionDoc.exists) {
      return jsonError('Question not found', 404);
    }

    await questionRef.delete();

    return jsonSuccess({ success: true, message: 'Question deleted successfully' }, 200);
  } catch (error) {
    console.error('Error deleting quiz question:', error);
    return jsonError('Failed to delete question', 500);
  }
}
