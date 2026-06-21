import { NextRequest } from 'next/server';
import { getFirebaseFirestore } from '../../../../lib/config/firebaseAdmin';
import { requireFirebaseUser } from '../../../../lib/middleware/auth';
import { jsonError, jsonSuccess } from '../../../../lib/utils/apiResponse';
import { ApiError } from '../../../../lib/utils/errors';

export const runtime = 'nodejs';

type CsvQuestionRow = {
  Category?: unknown;
  Museum?: unknown;
  Question?: unknown;
  Difficulty?: unknown;
  Points?: unknown;
  Status?: unknown;
  Option1?: unknown;
  Option2?: unknown;
  Option3?: unknown;
  Option4?: unknown;
  CorrectAnswer?: unknown;
  Explanation?: unknown;
};

const CATEGORY_ALIASES: Record<string, string> = {
  'art-and-paintings': 'paintings',
  'dinosaur-quiz': 'dinosaur',
  science: 'science',
  'science-museum': 'science',
  space: 'space',
  'space-gallery': 'space',
  wildlife: 'wildlife',
  'wildlife-explorer': 'wildlife'
};

const CATEGORY_ICONS: Record<string, string> = {
  'ancient-india': '🏺',
  dinosaur: '🦖',
  'indian-culture': '🇮🇳',
  'museum-history': '🏛️',
  paintings: '🎨',
  science: '🔬',
  space: '🚀',
  wildlife: '🦁'
};

function clean(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function slugify(value: unknown) {
  return clean(value).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireFirebaseUser(req);
    if (user.role !== 'admin') return jsonError('Admin access denied', 403);

    const body = await req.json();
    const rows = Array.isArray(body.rows) ? body.rows as CsvQuestionRow[] : [];
    if (rows.length === 0) return jsonError('The CSV contains no question rows', 400);
    if (rows.length > 200) return jsonError('Import a maximum of 200 questions at a time', 400);

    const db = getFirebaseFirestore();
    const [categorySnapshot, museumSnapshot] = await Promise.all([
      db.collection('quizCategories').get(),
      db.collection('museums').get()
    ]);

    const categoriesById = new Map<string, Record<string, unknown>>();
    const categoryIdByName = new Map<string, string>();
    categorySnapshot.docs.forEach((doc) => {
      const data = doc.data();
      categoriesById.set(doc.id, data);
      categoryIdByName.set(slugify(data.name), doc.id);
    });

    const museumsByName = new Map<string, { id: string; name: string }>();
    museumSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const name = clean(data.name);
      if (name) museumsByName.set(name.toLowerCase(), { id: clean(data.museum_id) || doc.id, name });
    });

    const requestedCategoryIds = new Set<string>();
    rows.forEach((row) => {
      const categorySlug = slugify(row.Category);
      const categoryId = CATEGORY_ALIASES[categorySlug]
        || categoryIdByName.get(categorySlug)
        || categorySlug;
      if (categoryId) requestedCategoryIds.add(categoryId);
    });

    const existingQuestionsByCategory = new Map<string, Set<string>>();
    await Promise.all([...requestedCategoryIds].map(async (categoryId) => {
      const snapshot = await db.collection('quizQuestions').where('category_id', '==', categoryId).get();
      existingQuestionsByCategory.set(categoryId, new Set(snapshot.docs.map((doc) => {
        const data = doc.data();
        return clean(data.normalizedQuestion || data.question).toLowerCase();
      })));
    }));

    const batch = db.batch();
    const now = new Date().toISOString();
    const errors: Array<{ row: number; message: string }> = [];
    const warnings: Array<{ row: number; message: string }> = [];
    const categoriesCreated = new Set<string>();
    let imported = 0;
    let skipped = 0;

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const categoryName = clean(row.Category);
      const categorySlug = slugify(categoryName);
      const categoryId = CATEGORY_ALIASES[categorySlug]
        || categoryIdByName.get(categorySlug)
        || categorySlug;
      const question = clean(row.Question);
      const normalizedQuestion = question.toLowerCase();
      const options = [...new Set([row.Option1, row.Option2, row.Option3, row.Option4].map(clean).filter(Boolean))];
      const correctAnswer = clean(row.CorrectAnswer);

      if (!categoryId || !categoryName) {
        errors.push({ row: rowNumber, message: 'Category is required' });
        return;
      }
      if (!question) {
        errors.push({ row: rowNumber, message: 'Question is required' });
        return;
      }
      if (options.length < 2) {
        errors.push({ row: rowNumber, message: 'At least two unique options are required' });
        return;
      }
      if (!options.some((option) => option.toLowerCase() === correctAnswer.toLowerCase())) {
        errors.push({ row: rowNumber, message: 'CorrectAnswer must match one of Option1–Option4' });
        return;
      }

      const knownQuestions = existingQuestionsByCategory.get(categoryId) || new Set<string>();
      if (knownQuestions.has(normalizedQuestion)) {
        skipped += 1;
        return;
      }
      knownQuestions.add(normalizedQuestion);
      existingQuestionsByCategory.set(categoryId, knownQuestions);

      if (!categoriesById.has(categoryId) && !categoriesCreated.has(categoryId)) {
        const difficulty = ['Easy', 'Medium', 'Hard'].includes(clean(row.Difficulty)) ? clean(row.Difficulty) : 'Easy';
        batch.set(db.collection('quizCategories').doc(categoryId), {
          id: categoryId,
          name: categoryName,
          description: `${categoryName} quiz questions`,
          icon: CATEGORY_ICONS[categoryId] || '🧠',
          color: 'from-emerald-400 to-teal-600',
          difficulty,
          ageGroup: 'All',
          createdAt: now
        });
        categoriesCreated.add(categoryId);
      }

      const museumText = clean(row.Museum);
      const linkedMuseum = museumText && museumText.toLowerCase() !== 'no museum link'
        ? museumsByName.get(museumText.toLowerCase())
        : undefined;
      if (museumText && museumText.toLowerCase() !== 'no museum link' && !linkedMuseum) {
        warnings.push({ row: rowNumber, message: `Museum "${museumText}" was not found; imported without a museum link` });
      }

      const difficulty = ['Easy', 'Medium', 'Hard'].includes(clean(row.Difficulty)) ? clean(row.Difficulty) : 'Easy';
      const status = clean(row.Status).toLowerCase() === 'inactive' ? 'inactive' : 'active';
      const points = Math.min(100, Math.max(1, Number(row.Points) || 10));
      const questionRef = db.collection('quizQuestions').doc();
      batch.set(questionRef, {
        id: questionRef.id,
        category_id: categoryId,
        museum_id: linkedMuseum?.id || null,
        museum_name: linkedMuseum?.name || (museumText.toLowerCase() === 'no museum link' ? '' : museumText),
        question,
        normalizedQuestion,
        options,
        correctAnswer,
        explanation: clean(row.Explanation),
        imageUrl: null,
        difficulty,
        points,
        type: 'multiple-choice',
        status,
        createdAt: now,
        updatedAt: now
      });
      imported += 1;
    });

    if (imported > 0 || categoriesCreated.size > 0) await batch.commit();

    return jsonSuccess({
      success: true,
      imported,
      skipped,
      failed: errors.length,
      categoriesCreated: [...categoriesCreated],
      errors,
      warnings
    });
  } catch (error) {
    console.error('Quiz CSV import failed:', error);
    if (error instanceof ApiError) return jsonError(error.message, error.statusCode);
    return jsonError('Failed to import quiz questions', 500);
  }
}
