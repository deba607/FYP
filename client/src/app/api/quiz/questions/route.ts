import { NextRequest } from 'next/server';
import { getFirebaseFirestore } from '../../../../lib/config/firebaseAdmin';
import { jsonSuccess, jsonError } from '../../../../lib/utils/apiResponse';
import { requireFirebaseUser } from '../../../../lib/middleware/auth';

export const runtime = 'nodejs';

const QUESTION_TYPES = new Set(['multiple-choice', 'true-false', 'image-guess']);
const DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);

function normalizeQuestion(value: unknown) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('category');
    const limitParam = searchParams.get('limit');
    const adminParam = searchParams.get('admin') === 'true';
    
    if (!categoryId) {
      return jsonError('Category ID is required', 400);
    }

    // Auth check if requesting admin view (with answers)
    let showAnswers = false;
    if (adminParam) {
      try {
        const user = await requireFirebaseUser(req);
        if (user.role === 'admin') {
          showAnswers = true;
        }
      } catch (e) {
        // Fallback to guest rules (no answers)
      }
    }

    const db = getFirebaseFirestore();
    const query = db.collection('quizQuestions').where('category_id', '==', categoryId);
    const questionsSnapshot = await query.get();

    if (questionsSnapshot.empty) {
      return jsonSuccess({ success: true, questions: [] }, 200, {
        headers: { 'Cache-Control': showAnswers ? 'private, no-store' : 'public, max-age=30, stale-while-revalidate=120' }
      });
    }

    let questions = questionsSnapshot.docs.map(doc => {
      const data = doc.data();
      const q: Record<string, any> = {
        id: doc.id,
        category_id: data.category_id,
        museum_id: data.museum_id || null,
        museum_name: data.museum_name || null,
        question: data.question,
        options: data.options,
        imageUrl: data.imageUrl || null,
        difficulty: data.difficulty,
        points: data.points || 10,
        type: data.type || 'multiple-choice',
        status: data.status || 'active',
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
      };

      if (showAnswers) {
        q.correctAnswer = data.correctAnswer;
        q.explanation = data.explanation || '';
      }

      return q;
    }).filter((question) => showAnswers || question.status !== 'inactive');

    // Randomize the order of questions for standard players only
    if (!showAnswers) {
      questions = questions.sort(() => 0.5 - Math.random());
    }

    // Apply limit if specified
    if (limitParam) {
      const limit = parseInt(limitParam, 10);
      if (!isNaN(limit) && limit > 0) {
        questions = questions.slice(0, limit);
      }
    }

    return jsonSuccess({ success: true, questions }, 200, {
      headers: { 'Cache-Control': showAnswers ? 'private, no-store' : 'public, max-age=30, stale-while-revalidate=120' }
    });
  } catch (error) {
    console.error('Error fetching quiz questions:', error);
    return jsonError('Failed to fetch questions', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireFirebaseUser(req);
    if (user.role !== 'admin') {
      return jsonError('Admin access denied', 403);
    }

    const body = await req.json();
    const { category_id, question, options, correctAnswer, explanation, imageUrl, difficulty, points, type, museum_id, museum_name, status } = body;
    const cleanQuestion = normalizeQuestion(question);
    const cleanOptions = Array.isArray(options)
      ? [...new Set(options.map(normalizeQuestion).filter(Boolean))]
      : [];
    const cleanCorrectAnswer = normalizeQuestion(correctAnswer);
    const questionType = QUESTION_TYPES.has(type) ? type : 'multiple-choice';
    const questionStatus = status === 'inactive' ? 'inactive' : 'active';
    
    if (!category_id || !cleanQuestion || !cleanCorrectAnswer) {
      return jsonError('Required fields: category_id, question, options, correctAnswer', 400);
    }

    if (cleanOptions.length < 2) {
      return jsonError('A question must have at least two unique answer options', 400);
    }

    if (!cleanOptions.some((option) => option.toLowerCase() === cleanCorrectAnswer.toLowerCase())) {
      return jsonError('The correct answer must match one of the answer options', 400);
    }

    if (questionType === 'image-guess' && !normalizeQuestion(imageUrl)) {
      return jsonError('An image URL is required for image questions', 400);
    }

    const db = getFirebaseFirestore();

    const categoryDoc = await db.collection('quizCategories').doc(String(category_id)).get();
    if (!categoryDoc.exists) {
      return jsonError('The selected quiz category does not exist', 400);
    }

    const categoryQuestions = await db.collection('quizQuestions')
      .where('category_id', '==', String(category_id))
      .get();
    const normalizedQuestion = cleanQuestion.toLowerCase();
    const duplicate = categoryQuestions.docs.some((doc) => {
      const data = doc.data();
      return String(data.normalizedQuestion || normalizeQuestion(data.question).toLowerCase()) === normalizedQuestion;
    });
    if (duplicate) {
      return jsonError('This question already exists in the selected category', 409);
    }

    const questionRef = db.collection('quizQuestions').doc();
    const now = new Date().toISOString();
    
    const newQuestion = {
      id: questionRef.id,
      category_id: String(category_id),
      museum_id: museum_id || null,
      museum_name: normalizeQuestion(museum_name),
      question: cleanQuestion,
      normalizedQuestion,
      options: cleanOptions,
      correctAnswer: cleanCorrectAnswer,
      explanation: normalizeQuestion(explanation),
      imageUrl: imageUrl || null,
      difficulty: DIFFICULTIES.has(difficulty) ? difficulty : 'Easy',
      points: Math.min(100, Math.max(1, Number(points) || 10)),
      type: questionType,
      status: questionStatus,
      createdAt: now,
      updatedAt: now
    };

    await questionRef.set(newQuestion);
    return jsonSuccess({ success: true, question: newQuestion }, 201);
  } catch (error) {
    console.error('Error creating quiz question:', error);
    return jsonError('Failed to create question', 500);
  }
}
