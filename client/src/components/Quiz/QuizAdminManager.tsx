'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Loader2, 
  Gamepad2, 
  Award, 
  Tags, 
  Check, 
  X, 
  Search, 
  Image as ImageIcon, 
  HelpCircle, 
  Trophy, 
  Filter, 
  AlertTriangle,
  Upload
} from 'lucide-react';
import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import { QuizCategory, QuizQuestionBackend, QuizBadge } from '../../lib/quiz';

type TabType = 'questions' | 'categories' | 'badges';

type QuizCsvRow = Record<string, string>;

const CSV_COLUMNS = [
  'Category', 'Museum', 'Question', 'Difficulty', 'Points', 'Status',
  'Option1', 'Option2', 'Option3', 'Option4', 'CorrectAnswer', 'Explanation'
];

function parseCsv(text: string): QuizCsvRow[] {
  const table: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(field.trim());
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) table.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) table.push(row);

  if (table.length < 2) throw new Error('The CSV does not contain any question rows.');
  const headers = table[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  const missing = CSV_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) throw new Error(`Missing CSV columns: ${missing.join(', ')}`);

  return table.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [
      header,
      index === headers.length - 1 ? values.slice(index).join(', ') : values[index] || ''
    ])
  ));
}

export default function QuizAdminManager() {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabType>('questions');
  
  // Data States
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [questions, setQuestions] = useState<QuizQuestionBackend[]>([]);
  const [badges, setBadges] = useState<QuizBadge[]>([]);
  const [museums, setMuseums] = useState<{ id: string; name: string }[]>([]);
  
  // Loading States
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingQuest, setLoadingQuest] = useState(false);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<QuizCsvRow[] | null>(null);
  const [importFileName, setImportFileName] = useState('');
  
  // Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [questionSearch, setQuestionSearch] = useState<string>('');

  // Notification States
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Modal States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  
  // Edit Mode States
  const [editingCategory, setEditingCategory] = useState<QuizCategory | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestionBackend | null>(null);
  const [editingBadge, setEditingBadge] = useState<QuizBadge | null>(null);

  // Form Fields - Category
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catColor, setCatColor] = useState('from-emerald-400 to-green-600');
  const [catDifficulty, setCatDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
  const [catAgeGroup, setCatAgeGroup] = useState<'Kids' | 'Teens' | 'All'>('Kids');

  // Form Fields - Question
  const [qCategory, setQCategory] = useState('');
  const [qMuseum, setQMuseum] = useState('');
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState<'multiple-choice' | 'true-false' | 'image-guess'>('multiple-choice');
  const [qOptions, setQOptions] = useState<string[]>(['', '', '', '']);
  const [qCorrectAnswer, setQCorrectAnswer] = useState('');
  const [qExplanation, setQExplanation] = useState('');
  const [qImageUrl, setQImageUrl] = useState('');
  const [qDifficulty, setQDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
  const [qPoints, setQPoints] = useState<number>(10);
  const [qStatus, setQStatus] = useState<'active' | 'inactive'>('active');

  // Form Fields - Badge
  const [badgeTitle, setBadgeTitle] = useState('');
  const [badgeDesc, setBadgeDesc] = useState('');
  const [badgeImage, setBadgeImage] = useState('');
  const [badgeMinScore, setBadgeMinScore] = useState<number>(80);

  // Color options for categories helper
  const colorOptions = [
    { label: 'Green Emerald', value: 'from-emerald-400 to-green-600' },
    { label: 'Amber Orange', value: 'from-amber-400 to-orange-600' },
    { label: 'Blue Indigo', value: 'from-blue-500 to-indigo-700' },
    { label: 'Purple Pink', value: 'from-purple-500 to-pink-500' },
    { label: 'Orange Yellow', value: 'from-orange-400 to-yellow-500' },
    { label: 'Cyan Teal', value: 'from-cyan-400 to-teal-600' },
    { label: 'Red Rose', value: 'from-red-500 to-rose-600' }
  ];

  // Helper to show error
  const showError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg('');
    setTimeout(() => setErrorMsg(''), 5000);
  };

  // Helper to show success
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    setLoadingCats(true);
    try {
      const res = await fetch('/api/quiz/categories', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.categories)) {
        setCategories(data.categories || []);
        if (data.categories?.length > 0 && !selectedCategory) {
          setSelectedCategory(data.categories[0].id);
        }
      } else {
        showError(data.message || 'Failed to fetch quiz categories');
      }
    } catch (err) {
      console.error(err);
      showError('Error connecting to categories API');
    } finally {
      setLoadingCats(false);
    }
  }, [selectedCategory]);

  // Fetch Questions for a category
  const fetchQuestions = useCallback(async (catId: string) => {
    if (!catId) return;
    setLoadingQuest(true);
    try {
      const auth = getFirebaseClientAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        showError('Authentication token not found. Please re-login.');
        setLoadingQuest(false);
        return;
      }

      const res = await fetch(`/api/quiz/questions?category=${catId}&admin=true`, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.questions)) {
        setQuestions(data.questions || []);
      } else {
        showError(data.message || 'Failed to fetch questions');
      }
    } catch (err) {
      console.error(err);
      showError('Error connecting to questions API');
    } finally {
      setLoadingQuest(false);
    }
  }, []);

  // Fetch Badges
  const fetchBadges = useCallback(async () => {
    setLoadingBadges(true);
    try {
      const res = await fetch('/api/quiz/badges', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.badges)) {
        setBadges(data.badges || []);
      } else {
        showError(data.message || 'Failed to fetch badges');
      }
    } catch (err) {
      console.error(err);
      showError('Error connecting to badges API');
    } finally {
      setLoadingBadges(false);
    }
  }, []);

  // Fetch Museums list for selector
  const fetchMuseums = useCallback(async () => {
    try {
      const res = await fetch('/api/museums');
      const data = await res.json();
      if (res.ok && data.success) {
        setMuseums((data.museums || []).map((museum: { id?: string; museum_id?: string; name?: string }) => ({
          id: museum.museum_id || museum.id || '',
          name: museum.name || 'Unnamed Museum'
        })).filter((museum: { id: string }) => Boolean(museum.id)));
      }
    } catch (err) {
      console.error('Failed to load museums list:', err);
    }
  }, []);

  // Initial data loading
  useEffect(() => {
    fetchCategories();
    fetchBadges();
    fetchMuseums();
  }, [fetchCategories, fetchBadges, fetchMuseums]);

  // Load questions when selected category changes
  useEffect(() => {
    if (selectedCategory) {
      fetchQuestions(selectedCategory);
    } else {
      setQuestions([]);
    }
  }, [selectedCategory, fetchQuestions]);

  const handleCsvSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showError('Please select a CSV file.');
      return;
    }

    try {
      const rows = parseCsv(await file.text());
      setImportFileName(file.name);
      setPendingImport(rows);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not read the CSV file.');
    }
  };

  const handleCsvImport = async () => {
    if (!pendingImport?.length) return;
    setImporting(true);
    try {
      const token = await getFirebaseClientAuth().currentUser?.getIdToken();
      if (!token) {
        showError('Authentication token not found. Please sign in again.');
        return;
      }

      const response = await fetch('/api/quiz/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rows: pendingImport })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        showError(data.message || 'Failed to import quiz questions.');
        return;
      }

      setPendingImport(null);
      showSuccess(
        `Imported ${data.imported} question${data.imported === 1 ? '' : 's'}. `
        + `${data.skipped} duplicate${data.skipped === 1 ? '' : 's'} skipped`
        + `${data.failed ? `, ${data.failed} invalid row${data.failed === 1 ? '' : 's'}` : ''}.`
      );
      await fetchCategories();
      if (selectedCategory) await fetchQuestions(selectedCategory);
    } catch (error) {
      console.error(error);
      showError('Could not connect to the quiz import API.');
    } finally {
      setImporting(false);
    }
  };

  // Modals Open handlers
  const openCategoryModal = (cat: QuizCategory | null = null) => {
    setEditingCategory(cat);
    if (cat) {
      setCatName(cat.name);
      setCatIcon(cat.icon);
      setCatDesc(cat.description);
      setCatColor(cat.color);
      setCatDifficulty(cat.difficulty);
      setCatAgeGroup(cat.ageGroup);
    } else {
      setCatName('');
      setCatIcon('');
      setCatDesc('');
      setCatColor('from-emerald-400 to-green-600');
      setCatDifficulty('Easy');
      setCatAgeGroup('Kids');
    }
    setIsCategoryModalOpen(true);
  };

  const openQuestionModal = (q: QuizQuestionBackend | null = null) => {
    setEditingQuestion(q);
    if (q) {
      setQCategory(q.category_id);
      setQMuseum(q.museum_id || '');
      setQText(q.question);
      setQType(q.type);
      setQOptions(q.options && q.options.length > 0 ? [...q.options] : ['', '', '', '']);
      setQCorrectAnswer(q.correctAnswer);
      setQExplanation(q.explanation || '');
      setQImageUrl(q.imageUrl || '');
      setQDifficulty(q.difficulty);
      setQPoints(q.points);
      setQStatus(q.status || 'active');
    } else {
      setQCategory(selectedCategory || (categories[0]?.id || ''));
      setQMuseum('');
      setQText('');
      setQType('multiple-choice');
      setQOptions(['', '', '', '']);
      setQCorrectAnswer('');
      setQExplanation('');
      setQImageUrl('');
      setQDifficulty('Easy');
      setQPoints(10);
      setQStatus('active');
    }
    setIsQuestionModalOpen(true);
  };

  const openBadgeModal = (b: QuizBadge | null = null) => {
    setEditingBadge(b);
    if (b) {
      setBadgeTitle(b.title);
      setBadgeDesc(b.description);
      setBadgeImage(b.image);
      setBadgeMinScore(b.minimumScore);
    } else {
      setBadgeTitle('');
      setBadgeDesc('');
      setBadgeImage('');
      setBadgeMinScore(80);
    }
    setIsBadgeModalOpen(true);
  };

  // Adjust options length based on question type
  useEffect(() => {
    if (qType === 'true-false') {
      setQOptions(['True', 'False']);
      if (qCorrectAnswer !== 'True' && qCorrectAnswer !== 'False') {
        setQCorrectAnswer('True');
      }
    } else {
      if (qOptions.length !== 4) {
        setQOptions(['', '', '', '']);
      }
    }
  }, [qType, qCorrectAnswer, qOptions.length]);

  // Handle Category Submit
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName || !catIcon) {
      showError('Category name and icon are required.');
      return;
    }

    setSubmitting(true);
    try {
      const auth = getFirebaseClientAuth();
      const token = await auth.currentUser?.getIdToken();
      
      const payload = {
        name: catName,
        icon: catIcon,
        description: catDesc,
        color: catColor,
        difficulty: catDifficulty,
        ageGroup: catAgeGroup
      };

      let res;
      if (editingCategory) {
        res = await fetch(`/api/quiz/categories/${editingCategory.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/quiz/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(editingCategory ? 'Category updated successfully!' : 'Category created successfully!');
        setIsCategoryModalOpen(false);
        fetchCategories();
      } else {
        showError(data.message || 'Failed to save category');
      }
    } catch (err) {
      console.error(err);
      showError('Error connecting to categories API');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Question Submit
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qCategory || !qText || !qCorrectAnswer) {
      showError('Category, Question Text, and Correct Answer are required.');
      return;
    }

    // Filter out blank options
    const filteredOptions = qOptions.map(o => o.trim()).filter(Boolean);
    if (qType !== 'true-false' && filteredOptions.length < 2) {
      showError('Please provide at least 2 options.');
      return;
    }

    // Check if correct answer is in the options (or equal to True/False)
    if (qType === 'true-false') {
      if (qCorrectAnswer !== 'True' && qCorrectAnswer !== 'False') {
        showError('Correct answer must be True or False.');
        return;
      }
    } else {
      if (!filteredOptions.includes(qCorrectAnswer.trim())) {
        showError('Correct answer must match one of the provided options.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const auth = getFirebaseClientAuth();
      const token = await auth.currentUser?.getIdToken();

      const payload = {
        category_id: qCategory,
        museum_id: qMuseum || null,
        museum_name: museums.find((museum) => museum.id === qMuseum)?.name || null,
        question: qText,
        options: qType === 'true-false' ? ['True', 'False'] : filteredOptions,
        correctAnswer: qCorrectAnswer,
        explanation: qExplanation,
        imageUrl: qImageUrl || null,
        difficulty: qDifficulty,
        points: qPoints,
        type: qType,
        status: qStatus
      };

      let res;
      if (editingQuestion) {
        res = await fetch(`/api/quiz/questions/${editingQuestion.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/quiz/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(editingQuestion ? 'Question updated successfully!' : 'Question created successfully!');
        setIsQuestionModalOpen(false);
        if (qCategory === selectedCategory) {
          fetchQuestions(selectedCategory);
        } else {
          setSelectedCategory(qCategory);
        }
      } else {
        showError(data.message || 'Failed to save question');
      }
    } catch (err) {
      console.error(err);
      showError('Error connecting to questions API');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Badge Submit
  const handleBadgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeTitle || !badgeDesc || !badgeImage) {
      showError('Title, description, and badge image/emoji are required.');
      return;
    }

    setSubmitting(true);
    try {
      const auth = getFirebaseClientAuth();
      const token = await auth.currentUser?.getIdToken();

      const payload = {
        title: badgeTitle,
        description: badgeDesc,
        image: badgeImage,
        minimumScore: Number(badgeMinScore)
      };

      let res;
      if (editingBadge) {
        res = await fetch(`/api/quiz/badges/${editingBadge.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/quiz/badges', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess(editingBadge ? 'Badge updated successfully!' : 'Badge created successfully!');
        setIsBadgeModalOpen(false);
        fetchBadges();
      } else {
        showError(data.message || 'Failed to save badge');
      }
    } catch (err) {
      console.error(err);
      showError('Error connecting to badges API');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Handlers
  const handleDeleteCategory = async (id: string, name: string) => {
    const confirm = window.confirm(`Are you sure you want to delete category "${name}"? WARNING: This will also delete ALL questions in this category!`);
    if (!confirm) return;

    try {
      const auth = getFirebaseClientAuth();
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch(`/api/quiz/categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess('Category and associated questions deleted successfully!');
        if (selectedCategory === id) {
          setSelectedCategory('');
        }
        fetchCategories();
      } else {
        showError(data.message || 'Failed to delete category');
      }
    } catch (err) {
      console.error(err);
      showError('Error connecting to API to delete category');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    const confirm = window.confirm('Are you sure you want to delete this question?');
    if (!confirm) return;

    try {
      const auth = getFirebaseClientAuth();
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch(`/api/quiz/questions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess('Question deleted successfully!');
        fetchQuestions(selectedCategory);
      } else {
        showError(data.message || 'Failed to delete question');
      }
    } catch (err) {
      console.error(err);
      showError('Error connecting to API to delete question');
    }
  };

  const handleDeleteBadge = async (id: string, title: string) => {
    const confirm = window.confirm(`Are you sure you want to delete badge "${title}"?`);
    if (!confirm) return;

    try {
      const auth = getFirebaseClientAuth();
      const token = await auth.currentUser?.getIdToken();

      const res = await fetch(`/api/quiz/badges/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showSuccess('Badge deleted successfully!');
        fetchBadges();
      } else {
        showError(data.message || 'Failed to delete badge');
      }
    } catch (err) {
      console.error(err);
      showError('Error connecting to API to delete badge');
    }
  };

  // Filtered questions list
  const filteredQuestions = questions.filter(q => {
    const search = questionSearch.trim().toLowerCase();
    if (!search) return true;
    return q.question.toLowerCase().includes(search) || 
           (q.explanation && q.explanation.toLowerCase().includes(search));
  });

  return (
    <div className="space-y-6">
      {/* Messages */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-950/20 dark:bg-red-950/20 dark:text-red-300 animate-in fade-in duration-300">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-950/20 dark:bg-emerald-950/20 dark:text-emerald-300 animate-in fade-in duration-300">
          <Check className="h-5 w-5 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Console Header */}
      <div className="rounded-2xl border bg-background p-6 shadow-sm dark:border-zinc-800">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Gamepad2 className="h-4 w-4 text-emerald-500" />
              <span>Interactive Quiz Admin Console</span>
            </div>
            <h1 className="text-2xl font-bold tracking-normal sm:text-3xl mt-1">Quiz & Gamification Manager</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Add, update, or remove categories, questions, and badges. Manage gameplay mechanics for homepage and AI chatbot.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0">
            {activeTab === 'categories' && (
              <button
                onClick={() => openCategoryModal()}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Category</span>
              </button>
            )}
            {activeTab === 'questions' && (
              <>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvSelected}
                  className="hidden"
                  aria-label="Select quiz question CSV file"
                />
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-500 transition-colors hover:bg-emerald-500/20"
                >
                  <Upload className="h-4 w-4" />
                  <span>Import CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => openQuestionModal()}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={loadingCats || categories.length === 0}
                  title={categories.length === 0 ? 'Create a quiz category before adding questions' : 'Add a quiz question'}
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Question</span>
                </button>
              </>
            )}
            {activeTab === 'badges' && (
              <button
                onClick={() => openBadgeModal()}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Badge</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 mt-6 gap-6">
          <button
            onClick={() => setActiveTab('questions')}
            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'questions'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <HelpCircle className="h-4 w-4" />
            <span>Manage Questions</span>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'categories'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Tags className="h-4 w-4" />
            <span>Manage Categories</span>
          </button>
          <button
            onClick={() => setActiveTab('badges')}
            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'badges'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Manage Badges</span>
          </button>
        </div>
      </div>

      {/* Tab Contents: QUESTIONS */}
      {activeTab === 'questions' && (
        <div className="rounded-2xl border bg-background p-5 shadow-sm dark:border-zinc-800 space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4 dark:border-zinc-800">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="filter-category" className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Category:
              </label>
              <select
                id="filter-category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-md border bg-background px-3 py-1.5 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              >
                {categories.length === 0 ? (
                  <option value="">No Categories Available</option>
                ) : (
                  categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            
            <div className="relative w-full sm:w-72">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <input
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                placeholder="Search question text or details..."
                className="w-full rounded-md border bg-background py-1.5 pl-9 pr-3 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          {/* Questions List */}
          {loadingQuest ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500 mb-2" />
              <span>Loading questions...</span>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl dark:border-zinc-800">
              <HelpCircle className="mx-auto h-12 w-12 text-muted-foreground/30 mb-2" />
              <p className="font-medium">No questions found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {questionSearch ? 'Try adjusting your search query.' : 'Click "Add Question" to seed this category with trivia questions.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground font-medium dark:border-zinc-800">
                    <th className="py-3 pr-4">Question Text</th>
                    <th className="py-3 pr-4">Type</th>
                    <th className="py-3 pr-4">Difficulty</th>
                    <th className="py-3 pr-4">Points</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Correct Answer</th>
                    <th className="py-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((q) => (
                    <tr key={q.id} className="border-b last:border-0 hover:bg-muted/10 dark:border-zinc-800 transition-colors">
                      <td className="py-3.5 pr-4 align-top max-w-sm">
                        <div className="font-medium text-foreground">{q.question}</div>
                        {q.imageUrl && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <ImageIcon className="h-3.5 w-3.5 text-emerald-500" />
                            <a href={q.imageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">View Image</a>
                          </div>
                        )}
                        {q.museum_id && (
                          <div className="mt-1 text-[10px] bg-muted px-1.5 py-0.5 rounded inline-block text-muted-foreground font-mono">
                            Museum: {q.museum_name || q.museum_id}
                          </div>
                        )}
                        {!q.museum_id && q.museum_name && (
                          <div className="mt-1 text-[10px] bg-muted px-1.5 py-0.5 rounded inline-block text-muted-foreground">
                            Museum: {q.museum_name}
                          </div>
                        )}
                        {q.explanation && (
                          <div className="mt-1.5 text-xs text-muted-foreground bg-muted/40 p-2 rounded-md italic border-l-2 border-emerald-500">
                            <strong>Explanation:</strong> {q.explanation}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 align-top whitespace-nowrap">
                        <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground border dark:border-zinc-800">
                          {q.type}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 align-top">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          q.difficulty === 'Easy' 
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-950/20 dark:bg-emerald-950/20 dark:text-emerald-300'
                            : q.difficulty === 'Medium'
                            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-950/20 dark:bg-amber-950/20 dark:text-amber-300'
                            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-950/20 dark:bg-red-950/20 dark:text-red-300'
                        }`}>
                          {q.difficulty}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 align-top font-semibold text-foreground">
                        {q.points} pts
                      </td>
                      <td className="py-3.5 pr-4 align-top">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          q.status === 'inactive'
                            ? 'border-zinc-700 bg-zinc-800 text-zinc-400'
                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {q.status === 'inactive' ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 align-top">
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <Check className="h-4 w-4 shrink-0" />
                          <span>{q.correctAnswer}</span>
                        </div>
                        {q.type !== 'true-false' && (
                          <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[150px] truncate">
                            Options: {q.options?.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 align-top text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => openQuestionModal(q)}
                            className="rounded-lg p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                            title="Edit question"
                          >
                            <Edit className="h-4.5 w-4.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="rounded-lg p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete question"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="rounded-2xl border bg-background p-5 shadow-sm dark:border-zinc-800 space-y-4">
          {loadingCats ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500 mb-2" />
              <span>Loading categories...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl dark:border-zinc-800">
              <Tags className="mx-auto h-12 w-12 text-muted-foreground/30 mb-2" />
              <p className="font-medium">No quiz categories registered</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Category" to create a new trivia collection.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-muted/10 p-5 transition-all duration-200 hover:border-emerald-500/30 hover:bg-muted/20 dark:border-zinc-800"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br ${c.color} text-2xl text-white shadow-md`}>
                          {c.icon}
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground text-base group-hover:text-emerald-500 transition-colors">
                            {c.name}
                          </h4>
                          <span className="text-[10px] font-mono text-muted-foreground">ID: {c.id}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openCategoryModal(c)}
                          className="rounded-lg p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                          title="Edit category"
                        >
                          <Edit className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(c.id, c.name)}
                          className="rounded-lg p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete category"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                      {c.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-4 border-t pt-3 border-zinc-200 dark:border-zinc-800">
                    <div className="flex gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 bg-background rounded-full border dark:border-zinc-800">
                        Age: {c.ageGroup}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        c.difficulty === 'Easy' 
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-950/20 dark:bg-emerald-950/20'
                          : c.difficulty === 'Medium'
                          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-950/20 dark:bg-amber-950/20'
                          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-950/20 dark:bg-red-950/20'
                      }`}>
                        {c.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Contents: BADGES */}
      {activeTab === 'badges' && (
        <div className="rounded-2xl border bg-background p-5 shadow-sm dark:border-zinc-800 space-y-4">
          {loadingBadges ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-500 mb-2" />
              <span>Loading badges...</span>
            </div>
          ) : badges.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground border-2 border-dashed rounded-xl dark:border-zinc-800">
              <Trophy className="mx-auto h-12 w-12 text-muted-foreground/30 mb-2" />
              <p className="font-medium">No badges configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Badge" to create gamified awards for kids to unlock.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-muted/10 p-5 text-center transition-all duration-200 hover:border-emerald-500/30 hover:bg-muted/20 dark:border-zinc-800"
                >
                  <div className="absolute top-2 right-2 flex items-center gap-0.5">
                    <button
                      onClick={() => openBadgeModal(b)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                      title="Edit badge"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBadge(b.id, b.title)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete badge"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-yellow-300 to-amber-500 text-3xl shadow-lg border border-amber-200/50 mb-3 animate-pulse">
                      {b.image && b.image.length > 2 ? (
                        <img src={b.image} alt={b.title} className="h-10 w-10 object-contain rounded-full" />
                      ) : (
                        b.image || '🏆'
                      )}
                    </div>
                    <h4 className="font-bold text-foreground text-base mt-1">
                      {b.title}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-[200px]">
                      {b.description}
                    </p>
                  </div>

                  <div className="mt-4 border-t pt-3 border-zinc-200 dark:border-zinc-800 text-[11px] text-muted-foreground font-semibold flex items-center justify-center gap-1.5 bg-background/50 py-1 rounded-lg">
                    <span>Unlock Requirement:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{b.minimumScore}% Score</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CATEGORY DIALOG MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border bg-background p-6 shadow-xl dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-bold text-lg text-foreground border-b pb-3 flex items-center gap-2">
              <Tags className="h-5 w-5 text-emerald-500" />
              <span>{editingCategory ? 'Edit Quiz Category' : 'Create Quiz Category'}</span>
            </h3>

            <form onSubmit={handleCategorySubmit} className="space-y-4 mt-4">
              <div>
                <label htmlFor="cat-name-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Category Name *
                </label>
                <input
                  id="cat-name-input"
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. Space Odyssey"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label htmlFor="cat-icon-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Emoji Icon *
                </label>
                <input
                  id="cat-icon-input"
                  type="text"
                  required
                  value={catIcon}
                  onChange={(e) => setCatIcon(e.target.value)}
                  placeholder="e.g. 🚀 or 🦖"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label htmlFor="cat-desc-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Description
                </label>
                <textarea
                  id="cat-desc-input"
                  rows={3}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Summarize what players will learn..."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cat-difficulty-select" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Difficulty
                  </label>
                  <select
                    id="cat-difficulty-select"
                    value={catDifficulty}
                    onChange={(e) => setCatDifficulty(e.target.value as any)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="cat-age-select" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Age Group
                  </label>
                  <select
                    id="cat-age-select"
                    value={catAgeGroup}
                    onChange={(e) => setCatAgeGroup(e.target.value as any)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="Kids">Kids</option>
                    <option value="Teens">Teens</option>
                    <option value="All">All age groups</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="cat-color-select" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Card Gradient Color Theme
                </label>
                <select
                  id="cat-color-select"
                  value={catColor}
                  onChange={(e) => setCatColor(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                >
                  {colorOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="flex-1 rounded-lg border border-border/80 bg-background hover:bg-muted py-2.5 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV IMPORT PREVIEW */}
      {pendingImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border bg-background p-6 shadow-xl dark:border-zinc-800">
            <div className="flex items-start justify-between gap-4 border-b pb-4 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-lg font-bold">Import Quiz Questions</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {importFileName} · {pendingImport.length} question rows detected
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                disabled={importing}
                className="cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-50"
                aria-label="Close CSV import preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border dark:border-zinc-800">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Museum</th>
                    <th className="px-3 py-2">Question</th>
                    <th className="px-3 py-2">Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingImport.slice(0, 6).map((row, index) => (
                    <tr key={`${row.Question}-${index}`} className="border-t dark:border-zinc-800">
                      <td className="px-3 py-2 font-medium">{row.Category}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.Museum || 'No Museum Link'}</td>
                      <td className="max-w-sm px-3 py-2">{row.Question}</td>
                      <td className="px-3 py-2">{row.Difficulty || 'Easy'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pendingImport.length > 6 && (
              <p className="mt-2 text-xs text-muted-foreground">Previewing 6 of {pendingImport.length} rows.</p>
            )}

            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-300">
              Missing categories will be created automatically. Unknown museums are preserved by name and imported without a museum ID. Duplicate questions are skipped.
            </div>

            <div className="mt-5 flex justify-end gap-3 border-t pt-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                disabled={importing}
                className="rounded-lg border px-5 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCsvImport}
                disabled={importing}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {importing ? 'Importing...' : `Import ${pendingImport.length} Questions`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION DIALOG MODAL */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-2xl border bg-background p-6 shadow-xl dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsQuestionModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-bold text-lg text-foreground border-b pb-3 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-emerald-500" />
              <span>{editingQuestion ? 'Edit Quiz Question' : 'Create Quiz Question'}</span>
            </h3>

            <form onSubmit={handleQuestionSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="q-category-select" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Category *
                  </label>
                  <select
                    id="q-category-select"
                    required
                    value={qCategory}
                    onChange={(e) => setQCategory(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="q-museum-select" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Link to Museum (Optional)
                  </label>
                  <select
                    id="q-museum-select"
                    value={qMuseum}
                    onChange={(e) => setQMuseum(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="">No Museum Link</option>
                    {museums.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="q-text-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Question Text *
                </label>
                <textarea
                  id="q-text-input"
                  required
                  rows={2}
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="e.g. What is the tallest mountain in the solar system?"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <label htmlFor="q-type-select" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Question Type
                  </label>
                  <select
                    id="q-type-select"
                    value={qType}
                    onChange={(e) => setQType(e.target.value as any)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="true-false">True / False</option>
                    <option value="image-guess">Guess from Image</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="q-difficulty-select" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Difficulty
                  </label>
                  <select
                    id="q-difficulty-select"
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value as any)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="q-points-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Points Allocated
                  </label>
                  <input
                    id="q-points-input"
                    type="number"
                    min={5}
                    max={100}
                    value={qPoints}
                    onChange={(e) => setQPoints(Number(e.target.value))}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div>
                  <label htmlFor="q-status-select" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Status
                  </label>
                  <select
                    id="q-status-select"
                    value={qStatus}
                    onChange={(e) => setQStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {qType === 'image-guess' && (
                <div>
                  <label htmlFor="q-image-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Artifact Image URL *
                  </label>
                  <input
                    id="q-image-input"
                    type="url"
                    required
                    value={qImageUrl}
                    onChange={(e) => setQImageUrl(e.target.value)}
                    placeholder="https://example.com/artifact-image.jpg"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              )}

              {/* Options Section */}
              {qType !== 'true-false' ? (
                <div className="space-y-2">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Options List *</span>
                  <div className="grid grid-cols-2 gap-3">
                    {qOptions.map((opt, idx) => (
                      <div key={idx}>
                        <label htmlFor={`q-opt-input-${idx}`} className="sr-only">{`Option ${idx + 1}`}</label>
                        <input
                          id={`q-opt-input-${idx}`}
                          type="text"
                          required={idx < 2} // At least 2 options required
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...qOptions];
                            newOpts[idx] = e.target.value;
                            setQOptions(newOpts);
                          }}
                          placeholder={`Option ${idx + 1}`}
                          className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground border dark:border-zinc-800">
                  Options are fixed to <strong>True</strong> and <strong>False</strong> for true/false questions.
                </div>
              )}

              {/* Correct Answer Selector */}
              <div>
                <label htmlFor="q-correct-select" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Correct Answer Value *
                </label>
                {qType === 'true-false' ? (
                  <select
                    id="q-correct-select"
                    required
                    value={qCorrectAnswer}
                    onChange={(e) => setQCorrectAnswer(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="">Select Correct Option</option>
                    <option value="True">True</option>
                    <option value="False">False</option>
                  </select>
                ) : (
                  <select
                    id="q-correct-select"
                    required
                    value={qCorrectAnswer}
                    onChange={(e) => setQCorrectAnswer(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                  >
                    <option value="">Select Correct Option</option>
                    {qOptions.map((opt, idx) => opt.trim() && (
                      <option key={idx} value={opt.trim()}>
                        {opt.trim()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="q-explanation-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Educational Explanation / Hint details
                </label>
                <textarea
                  id="q-explanation-input"
                  rows={2}
                  value={qExplanation}
                  onChange={(e) => setQExplanation(e.target.value)}
                  placeholder="Explain why this option is correct to teach kids..."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="flex-1 rounded-lg border border-border/80 bg-background hover:bg-muted py-2.5 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingQuestion ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BADGE DIALOG MODAL */}
      {isBadgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border bg-background p-6 shadow-xl dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsBadgeModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="font-bold text-lg text-foreground border-b pb-3 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-emerald-500" />
              <span>{editingBadge ? 'Edit Badge Award' : 'Create Badge Award'}</span>
            </h3>

            <form onSubmit={handleBadgeSubmit} className="space-y-4 mt-4">
              <div>
                <label htmlFor="badge-title-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Badge Title *
                </label>
                <input
                  id="badge-title-input"
                  type="text"
                  required
                  value={badgeTitle}
                  onChange={(e) => setBadgeTitle(e.target.value)}
                  placeholder="e.g. Dinosaur Master"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label htmlFor="badge-image-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Badge Image (Emoji or Image URL) *
                </label>
                <input
                  id="badge-image-input"
                  type="text"
                  required
                  value={badgeImage}
                  onChange={(e) => setBadgeImage(e.target.value)}
                  placeholder="e.g. 🦖, 🏆 or URL"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label htmlFor="badge-desc-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Description / Milestone Goal *
                </label>
                <textarea
                  id="badge-desc-input"
                  required
                  rows={3}
                  value={badgeDesc}
                  onChange={(e) => setBadgeDesc(e.target.value)}
                  placeholder="Describe how kids can unlock this badge..."
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label htmlFor="badge-score-input" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Minimum Score Requirement (%) *
                </label>
                <input
                  id="badge-score-input"
                  type="number"
                  required
                  min={0}
                  max={100}
                  value={badgeMinScore}
                  onChange={(e) => setBadgeMinScore(Number(e.target.value))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsBadgeModalOpen(false)}
                  className="flex-1 rounded-lg border border-border/80 bg-background hover:bg-muted py-2.5 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingBadge ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
