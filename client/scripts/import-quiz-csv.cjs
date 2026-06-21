const fs = require('node:fs');
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

loadEnvConfig(process.cwd());

const CATEGORY_ALIASES = {
  'art-and-paintings': 'paintings',
  'dinosaur-quiz': 'dinosaur',
  science: 'science',
  'science-museum': 'science',
  space: 'space',
  'space-gallery': 'space',
  wildlife: 'wildlife',
  'wildlife-explorer': 'wildlife'
};

const CATEGORY_ICONS = {
  'ancient-india': '🏺',
  dinosaur: '🦖',
  'indian-culture': '🇮🇳',
  'museum-history': '🏛️',
  paintings: '🎨',
  science: '🔬',
  space: '🚀',
  wildlife: '🦁'
};

function clean(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function slugify(value) {
  return clean(value).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseCsv(text) {
  const table = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\r' || character === '\n') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) table.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  row.push(field.trim());
  if (row.some(Boolean)) table.push(row);

  const headers = table[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  return table.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [
    header,
    index === headers.length - 1 ? values.slice(index).join(', ') : values[index] || ''
  ])));
}

async function main() {
  const fileArgument = process.argv[2];
  const commit = process.argv.includes('--commit');
  if (!fileArgument) throw new Error('Usage: node scripts/import-quiz-csv.cjs <csv-path> [--commit]');

  const csvPath = path.resolve(process.cwd(), fileArgument);
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  if (!rows.length) throw new Error('No CSV question rows found');
  if (rows.length > 200) throw new Error('Import supports a maximum of 200 rows');

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin environment variables are incomplete');

  const app = getApps()[0] || initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
    databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
  });
  const databaseId = process.env.FIREBASE_DATABASE_ID?.trim();
  const db = databaseId && databaseId !== '(default)' ? getFirestore(app, databaseId) : getFirestore(app);

  const [categorySnapshot, museumSnapshot] = await Promise.all([
    db.collection('quizCategories').get(),
    db.collection('museums').get()
  ]);
  const categoryIds = new Set(categorySnapshot.docs.map((doc) => doc.id));
  const categoryIdByName = new Map(categorySnapshot.docs.map((doc) => [slugify(doc.data().name), doc.id]));
  const museumsByName = new Map(museumSnapshot.docs.map((doc) => {
    const data = doc.data();
    return [clean(data.name).toLowerCase(), { id: clean(data.museum_id) || doc.id, name: clean(data.name) }];
  }));

  const categoryIdsForRows = new Set(rows.map((row) => {
    const slug = slugify(row.Category);
    return CATEGORY_ALIASES[slug] || categoryIdByName.get(slug) || slug;
  }).filter(Boolean));
  const existing = new Map();
  await Promise.all([...categoryIdsForRows].map(async (categoryId) => {
    const snapshot = await db.collection('quizQuestions').where('category_id', '==', categoryId).get();
    existing.set(categoryId, new Set(snapshot.docs.map((doc) => clean(doc.data().normalizedQuestion || doc.data().question).toLowerCase())));
  }));

  const batch = db.batch();
  const categoriesCreated = new Set();
  const now = new Date().toISOString();
  const errors = [];
  const warnings = [];
  let imported = 0;
  let skipped = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const categoryName = clean(row.Category);
    const categorySlug = slugify(categoryName);
    const categoryId = CATEGORY_ALIASES[categorySlug] || categoryIdByName.get(categorySlug) || categorySlug;
    const question = clean(row.Question);
    const normalizedQuestion = question.toLowerCase();
    const options = [...new Set([row.Option1, row.Option2, row.Option3, row.Option4].map(clean).filter(Boolean))];
    const correctAnswer = clean(row.CorrectAnswer);

    if (!categoryId || !question || options.length < 2 || !options.some((option) => option.toLowerCase() === correctAnswer.toLowerCase())) {
      errors.push(`row ${rowNumber}`);
      return;
    }
    const known = existing.get(categoryId) || new Set();
    if (known.has(normalizedQuestion)) {
      skipped += 1;
      return;
    }
    known.add(normalizedQuestion);
    existing.set(categoryId, known);

    if (!categoryIds.has(categoryId) && !categoriesCreated.has(categoryId)) {
      batch.set(db.collection('quizCategories').doc(categoryId), {
        id: categoryId,
        name: categoryName,
        description: `${categoryName} quiz questions`,
        icon: CATEGORY_ICONS[categoryId] || '🧠',
        color: 'from-emerald-400 to-teal-600',
        difficulty: ['Easy', 'Medium', 'Hard'].includes(clean(row.Difficulty)) ? clean(row.Difficulty) : 'Easy',
        ageGroup: 'All',
        createdAt: now
      });
      categoriesCreated.add(categoryId);
    }

    const museumText = clean(row.Museum);
    const museum = museumText && museumText.toLowerCase() !== 'no museum link' ? museumsByName.get(museumText.toLowerCase()) : null;
    if (museumText && museumText.toLowerCase() !== 'no museum link' && !museum) warnings.push(`row ${rowNumber}: ${museumText}`);
    const questionRef = db.collection('quizQuestions').doc();
    batch.set(questionRef, {
      id: questionRef.id,
      category_id: categoryId,
      museum_id: museum?.id || null,
      museum_name: museum?.name || (museumText.toLowerCase() === 'no museum link' ? '' : museumText),
      question,
      normalizedQuestion,
      options,
      correctAnswer,
      explanation: clean(row.Explanation),
      imageUrl: null,
      difficulty: ['Easy', 'Medium', 'Hard'].includes(clean(row.Difficulty)) ? clean(row.Difficulty) : 'Easy',
      points: Math.min(100, Math.max(1, Number(row.Points) || 10)),
      type: 'multiple-choice',
      status: clean(row.Status).toLowerCase() === 'inactive' ? 'inactive' : 'active',
      createdAt: now,
      updatedAt: now
    });
    imported += 1;
  });

  if (!commit) {
    console.log(JSON.stringify({ mode: 'dry-run', rows: rows.length, wouldImport: imported, duplicates: skipped, invalid: errors.length, categoriesToCreate: [...categoriesCreated], unlinkedMuseums: warnings.length }, null, 2));
    await app.delete();
    return;
  }
  if (errors.length) throw new Error(`CSV validation failed for ${errors.join(', ')}`);
  if (imported || categoriesCreated.size) await batch.commit();
  console.log(JSON.stringify({ mode: 'committed', rows: rows.length, imported, duplicates: skipped, categoriesCreated: [...categoriesCreated], unlinkedMuseums: warnings.length }, null, 2));
  await app.delete();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
