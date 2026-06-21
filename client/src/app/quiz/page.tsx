"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Award, Sparkles, BookOpen, User, HelpCircle, ArrowLeft } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';

import { getFirebaseClientAuth } from '../../lib/config/firebaseClient';
import { QuizCategory, QuizScore, QuizBadge, QuizResultResponse } from '../../lib/quiz';
import { 
  fetchQuizCategories, 
  fetchQuizLeaderboard, 
  fetchQuizBadges, 
  fetchQuizRecommendations,
  prefetchQuizQuestions
} from '../../lib/quizAPI';
import { useQuiz } from '../../hooks/useQuiz';
import { useTimer } from '../../hooks/useTimer';

import QuizCard from '../../components/Quiz/QuizCard';
import QuizQuestion from '../../components/Quiz/QuizQuestion';
import QuizTimer from '../../components/Quiz/QuizTimer';
import QuizProgress from '../../components/Quiz/QuizProgress';
import QuizResult from '../../components/Quiz/QuizResult';
import QuizBadgeList from '../../components/Quiz/QuizBadge';
import QuizLeaderboard from '../../components/Quiz/QuizLeaderboard';
import QuizRecommendation from '../../components/Quiz/QuizRecommendation';

export default function QuizPage() {
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [recommendations, setRecommendations] = useState<QuizCategory[]>([]);
  const [leaderboard, setLeaderboard] = useState<QuizScore[]>([]);
  const [badges, setBadges] = useState<QuizBadge[]>([]);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<string[]>([]);
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Auth state
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [username, setUsername] = useState<string | undefined>(undefined);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Active Tab for dashboard
  const [activeTab, setActiveTab] = useState<'categories' | 'leaderboard' | 'badges'>('categories');

  // Monitor Auth
  useEffect(() => {
    const auth = getFirebaseClientAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setUsername(user.displayName || user.email?.split('@')[0] || 'Explorer');
        setIsLoggedIn(true);

        // Fetch user earned badges
        try {
          const { getFirestore, doc, getDoc } = await import('firebase/firestore');
          const db = getFirestore();
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setEarnedBadgeIds(userDoc.data().earnedBadges || []);
          }
        } catch (e) {
          console.warn('Failed to load user badges:', e);
        }
      } else {
        setUserId(undefined);
        setUsername(undefined);
        setIsLoggedIn(false);
        setEarnedBadgeIds([]);
      }
    });
    return unsubscribe;
  }, []);

  // Fetch initial dashboard data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Categories unlock the page, so do not make them wait for secondary tabs.
    fetchQuizCategories()
      .then((items) => {
        if (!cancelled) setCategories(items);
      })
      .catch((err) => console.error('Failed to load quiz categories:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    void fetchQuizLeaderboard().then((items) => {
      if (!cancelled) setLeaderboard(items);
    }).catch((err) => console.error('Failed to load quiz leaderboard:', err));

    void fetchQuizBadges().then((items) => {
      if (!cancelled) setBadges(items);
    }).catch((err) => console.error('Failed to load quiz badges:', err));

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchQuizRecommendations(userId).then((items) => {
      if (!cancelled) setRecommendations(items);
    }).catch((err) => console.error('Failed to load quiz recommendations:', err));
    return () => { cancelled = true; };
  }, [userId]);

  // Hook for Quiz Gameplay State
  const activeQuiz = useQuiz({
    categoryId: selectedCategoryId || '',
    limit: 5,
    userId,
    username
  });

  // Timer Hook (30 seconds per question)
  const timer = useTimer({
    initialSeconds: 30,
    onTimeUp: () => {
      // Lose life and move to next question if time runs out
      activeQuiz.loseLife();
      activeQuiz.nextQuestion(''); // submit empty response
    }
  });

  // Start timer when questions are loaded and gameplay starts
  useEffect(() => {
    if (activeQuiz.status === 'playing') {
      timer.reset(30);
      timer.start();
    } else {
      timer.pause();
    }
  }, [activeQuiz.status, activeQuiz.currentIndex]);

  const handlePlayCategory = (catId: string) => {
    setSelectedCategoryId(catId);
    activeQuiz.resetQuiz();
    activeQuiz.loadQuiz(catId);
  };

  const handleSelectAnswer = (option: string) => {
    activeQuiz.selectOption(option);
  };

  const handleNext = () => {
    activeQuiz.nextQuestion();
  };

  const handleSkip = () => {
    activeQuiz.nextQuestion('');
  };

  const handleRestart = () => {
    activeQuiz.loadQuiz(selectedCategoryId || undefined);
  };

  const handleExit = () => {
    setSelectedCategoryId(null);
    activeQuiz.resetQuiz();
    // Refresh leaderboard
    fetchQuizLeaderboard().then(setLeaderboard);
  };

  return (
    <div className="min-h-screen bg-black text-white py-12 px-4 sm:px-6 lg:px-8 mt-10">
      <div className="max-w-5xl mx-auto">
        
        {/* VIEW 1: DASHBOARD (idle) */}
        {!selectedCategoryId && (
          <div>
            {/* Title Section */}
            <div className="text-center mb-10">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 px-4 py-2 rounded-full text-blue-400 text-xs font-bold uppercase tracking-wider mb-4"
              >
                <Sparkles className="w-4 h-4" /> Learn While You Play
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-200 to-purple-400 bg-clip-text text-transparent mb-2"
              >
                🧩 Interactive Quiz for Kids
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-zinc-400 text-lg"
              >
                Become a Museum Explorer and earn premium rewards!
              </motion.p>
            </div>

            {/* Personalized Recommendations (if any) */}
            {!loading && recommendations.length > 0 && (
              <QuizRecommendation
                recommendations={recommendations}
                onPlay={handlePlayCategory}
                reason={isLoggedIn ? "Suggested based on your museum ticket bookings" : undefined}
              />
            )}

            {/* Tabs Selector */}
            <div className="flex border-b border-zinc-800 mb-8 gap-4 justify-center sm:justify-start">
              <button
                onClick={() => setActiveTab('categories')}
                className={`py-3.5 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'categories'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <BookOpen className="w-4 h-4" /> Quiz Categories
              </button>
              <button
                onClick={() => setActiveTab('badges')}
                className={`py-3.5 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'badges'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Award className="w-4 h-4" /> My Badges
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`py-3.5 px-6 font-bold text-sm border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'leaderboard'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Trophy className="w-4 h-4" /> Leaderboard
              </button>
            </div>

            {/* TAB CONTENTS */}
            <AnimatePresence mode="wait">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'categories' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {categories.map((cat) => (
                        <QuizCard
                          key={cat.id}
                          category={cat}
                          onWarmup={() => prefetchQuizQuestions(cat.id)}
                          onPlay={() => handlePlayCategory(cat.id)}
                        />
                      ))}
                    </div>
                  )}

                  {activeTab === 'badges' && (
                    <div className="bg-zinc-950/20 border border-zinc-800 rounded-2xl p-6 shadow-sm">
                      <QuizBadgeList
                        badges={badges}
                        earnedBadgeIds={earnedBadgeIds}
                      />
                    </div>
                  )}

                  {activeTab === 'leaderboard' && (
                    <QuizLeaderboard
                      scores={leaderboard}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* VIEW 2: GAMEPLAY CONTAINER */}
        {selectedCategoryId && (
          <div className="w-full">
            {/* Header: Exit Button */}
            <button
              onClick={handleExit}
              className="flex items-center gap-2 text-zinc-400 hover:text-white font-bold text-sm mb-6 transition-all focus:outline-none focus:ring-2 focus:ring-zinc-600 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-2 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Exit to Dashboard
            </button>

            {/* Glassmorphic Game Box */}
            <div className="w-full bg-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-10 shadow-2xl relative overflow-hidden">
              
              {/* Instructions Status */}
              {activeQuiz.status === 'instructions' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center py-6"
                >
                  <span className="text-6xl mb-4">🎯</span>
                  <h2 className="text-3xl font-extrabold text-white mb-2">Quiz Instructions</h2>
                  <p className="text-zinc-400 text-sm max-w-md mb-6 leading-relaxed">
                    Welcome, Explorer! Get ready to test your museum knowledge. Here are the rules of the challenge:
                  </p>
                  
                  <div className="text-left w-full max-w-sm space-y-4 bg-zinc-900 p-5 rounded-2xl border border-zinc-800 text-sm text-zinc-300 mb-8">
                    <div className="flex items-start gap-2.5">
                      <span className="text-base">🚀</span>
                      <span><strong>5 Fun Questions:</strong> Guess multiple-choice, true/false, or artifact images.</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-base">⏱️</span>
                      <span><strong>30s Timer:</strong> Answer each question before time runs out!</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-base">❤️</span>
                      <span><strong>3 Explorer Lives:</strong> Getting a wrong answer deducts a life. Keep them alive!</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="text-base">💡</span>
                      <span><strong>Clues Available:</strong> Click the hint button if you get stuck.</span>
                    </div>
                  </div>

                  <button
                    onClick={activeQuiz.startQuiz}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-500 font-extrabold rounded-2xl text-white shadow-lg shadow-blue-600/35 hover:scale-103 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                  >
                    Start the Challenge!
                  </button>
                </motion.div>
              )}

              {/* Submitting Status (Loading) */}
              {activeQuiz.status === 'submitting' && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-zinc-400 text-base font-semibold">Checking your answers with the Quiz Master...</p>
                </div>
              )}

              {/* Error Status */}
              {activeQuiz.status === 'error' && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <span className="text-4xl mb-3">⚠️</span>
                  <p className="text-red-400 font-semibold mb-4">{activeQuiz.error}</p>
                  <button
                    onClick={handleRestart}
                    className="px-6 py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-xl font-bold"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Playing Status */}
              {activeQuiz.status === 'playing' && activeQuiz.currentQuestion && (
                <div className="w-full">
                  {/* Top Bar: Progress and Circular Timer */}
                  <div className="flex justify-between items-center gap-6 border-b border-zinc-800/80 pb-6 mb-6">
                    <QuizProgress
                      current={activeQuiz.currentIndex + 1}
                      total={activeQuiz.questions.length}
                      lives={activeQuiz.lives}
                    />
                    <QuizTimer
                      duration={30}
                      timeLeft={timer.timeLeft}
                      isActive={timer.isActive}
                    />
                  </div>

                  {/* Question Section */}
                  <QuizQuestion
                    question={activeQuiz.currentQuestion}
                    selectedAnswer={activeQuiz.answers[activeQuiz.currentQuestion.id] || null}
                    onSelectAnswer={handleSelectAnswer}
                    onHint={activeQuiz.useHint}
                    hintUsed={activeQuiz.hintsUsed[activeQuiz.currentQuestion.id] || false}
                    onSkip={handleSkip}
                    onNext={handleNext}
                  />
                </div>
              )}

              {/* Results Status */}
              {activeQuiz.status === 'results' && activeQuiz.result && (
                <QuizResult
                  result={activeQuiz.result}
                  categoryName={categories.find(c => c.id === selectedCategoryId)?.name || ''}
                  onRestart={handleRestart}
                  onChooseOther={handleExit}
                  onViewLeaderboard={() => {
                    handleExit();
                    setActiveTab('leaderboard');
                  }}
                  isLoggedIn={isLoggedIn}
                />
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
