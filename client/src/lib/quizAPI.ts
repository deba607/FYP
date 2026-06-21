import { 
  QuizCategory, 
  QuizQuestion, 
  QuizSubmission, 
  QuizResultResponse,
  QuizScore,
  QuizBadge
} from './quiz';

const BASE_URL = '/api/quiz';
const DASHBOARD_CACHE_MS = 2 * 60 * 1000;
const QUESTION_CACHE_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const requestCache = new Map<string, CacheEntry<unknown>>();

function cachedRequest<T>(key: string, ttlMs: number, request: () => Promise<T>): Promise<T> {
  const cached = requestCache.get(key) as CacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = request().catch((error) => {
    requestCache.delete(key);
    throw error;
  });
  requestCache.set(key, { expiresAt: Date.now() + ttlMs, promise });
  return promise;
}

export async function fetchQuizCategories(): Promise<QuizCategory[]> {
  return cachedRequest('categories', DASHBOARD_CACHE_MS, async () => {
    const response = await fetch(`${BASE_URL}/categories`);
    if (!response.ok) throw new Error('Failed to fetch quiz categories');
    const data = await response.json();
    return data.categories || [];
  });
}

export async function fetchQuizQuestions(categoryId: string, limit = 5): Promise<QuizQuestion[]> {
  const key = `questions:${categoryId}:${limit}`;
  return cachedRequest(key, QUESTION_CACHE_MS, async () => {
    const response = await fetch(`${BASE_URL}/questions?category=${encodeURIComponent(categoryId)}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch quiz questions');
    const data = await response.json();
    return data.questions || [];
  });
}

export function prefetchQuizQuestions(categoryId: string, limit = 5) {
  void fetchQuizQuestions(categoryId, limit).catch(() => undefined);
}

export async function submitQuizAnswers(
  submission: QuizSubmission,
  userId?: string,
  username?: string
): Promise<QuizResultResponse> {
  const response = await fetch(`${BASE_URL}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      categoryId: submission.categoryId,
      answers: submission.answers,
      questionIds: submission.questionIds,
      userId,
      username
    })
  });
  
  if (!response.ok) throw new Error('Failed to submit quiz answers');
  const result = await response.json();
  requestCache.delete('leaderboard');
  return result;
}

export async function fetchQuizLeaderboard(): Promise<QuizScore[]> {
  return cachedRequest('leaderboard', DASHBOARD_CACHE_MS, async () => {
    const response = await fetch(`${BASE_URL}/leaderboard`);
    if (!response.ok) throw new Error('Failed to fetch leaderboard');
    const data = await response.json();
    return data.leaderboard || [];
  });
}

export async function fetchQuizBadges(): Promise<QuizBadge[]> {
  return cachedRequest('badges', DASHBOARD_CACHE_MS, async () => {
    const response = await fetch(`${BASE_URL}/badges`);
    if (!response.ok) throw new Error('Failed to fetch quiz badges');
    const data = await response.json();
    return data.badges || [];
  });
}

export async function fetchQuizRecommendations(userId?: string): Promise<QuizCategory[]> {
  const query = userId ? `?userId=${userId}` : '';
  return cachedRequest(`recommendations:${userId || 'guest'}`, DASHBOARD_CACHE_MS, async () => {
    const response = await fetch(`${BASE_URL}/recommendations${query}`);
    if (!response.ok) throw new Error('Failed to fetch recommendations');
    const data = await response.json();
    return data.recommendations || [];
  });
}
