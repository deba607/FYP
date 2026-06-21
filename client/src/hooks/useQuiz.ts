import { useState, useCallback } from 'react';
import { QuizCategory, QuizQuestion, QuizResultResponse } from '../lib/quiz';
import { fetchQuizQuestions, submitQuizAnswers } from '../lib/quizAPI';

export type QuizStatus = 'idle' | 'instructions' | 'playing' | 'submitting' | 'results' | 'error';

interface UseQuizOptions {
  categoryId: string;
  limit?: number;
  userId?: string;
  username?: string;
}

export function useQuiz({ categoryId, limit = 5, userId, username }: UseQuizOptions) {
  const [status, setStatus] = useState<QuizStatus>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [qId: string]: string }>({});
  const [lives, setLives] = useState(3); // Start with 3 lives
  const [hintsUsed, setHintsUsed] = useState<{ [qId: string]: boolean }>({});
  const [result, setResult] = useState<QuizResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState(categoryId);

  // Load questions and transition to instructions
  const loadQuiz = useCallback(async (targetCategoryId?: string) => {
    const activeCatId = targetCategoryId || categoryId;
    if (!activeCatId) {
      setError('Category ID is required to start a quiz.');
      setStatus('error');
      return;
    }
    setActiveCategoryId(activeCatId);
    setStatus('submitting');
    setError(null);
    try {
      const data = await fetchQuizQuestions(activeCatId, limit);
      if (data.length === 0) {
        setQuestions([]);
        setError('No active questions are available for this quiz yet. An admin can add them from Quiz Management.');
        setStatus('error');
        return;
      }
      setQuestions(data);
      setCurrentIndex(0);
      setAnswers({});
      setLives(3);
      setHintsUsed({});
      setResult(null);
      setStatus('instructions');
    } catch (err) {
      console.error(err);
      setError('Could not load quiz questions. Please try again.');
      setStatus('error');
    }
  }, [categoryId, limit]);

  // Start the actual gameplay
  const startQuiz = useCallback(() => {
    setStatus('playing');
  }, []);

  // Use a hint for the current question
  const useHint = useCallback(() => {
    if (questions[currentIndex]) {
      const qId = questions[currentIndex].id;
      setHintsUsed(prev => ({ ...prev, [qId]: true }));
    }
  }, [questions, currentIndex]);

  // Select an option
  const selectOption = useCallback((option: string) => {
    if (status !== 'playing') return;
    
    const qId = questions[currentIndex].id;
    setAnswers(prev => ({ ...prev, [qId]: option }));
  }, [questions, currentIndex, status]);

  // Submit the quiz to the backend API for scoring and badges
  const finishQuiz = useCallback(async (currentAnswers = answers) => {
    setStatus('submitting');
    setError(null);
    try {
      const data = await submitQuizAnswers(
        {
          categoryId: activeCategoryId,
          answers: currentAnswers,
          questionIds: questions.map((question) => question.id)
        },
        userId,
        username
      );
      setResult(data);
      setStatus('results');
    } catch (err) {
      console.error(err);
      setError('Failed to submit quiz results. Please try again.');
      setStatus('error');
    }
  }, [activeCategoryId, answers, questions, userId, username]);

  // Go to next question or submit if it was the last one
  const nextQuestion = useCallback((selectedOption?: string) => {
    const finalAnswers = { ...answers };
    if (selectedOption) {
      const qId = questions[currentIndex].id;
      finalAnswers[qId] = selectedOption;
      setAnswers(finalAnswers);
    }

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      finishQuiz(finalAnswers);
    }
  }, [questions, currentIndex, answers, finishQuiz]);

  // Handle wrong answer locally (deduct life)
  const loseLife = useCallback(() => {
    setLives(prev => {
      const nextLives = prev - 1;
      if (nextLives <= 0) {
        // Trigger automatic submit when lives run out
        finishQuiz();
      }
      return nextLives;
    });
  }, [finishQuiz]);

  // Reset the quiz state
  const resetQuiz = useCallback(() => {
    setStatus('idle');
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers({});
    setLives(3);
    setHintsUsed({});
    setResult(null);
    setError(null);
  }, []);

  return {
    status,
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex] || null,
    answers,
    lives,
    hintsUsed,
    result,
    error,
    loadQuiz,
    startQuiz,
    selectOption,
    useHint,
    nextQuestion,
    loseLife,
    finishQuiz,
    resetQuiz
  };
}
