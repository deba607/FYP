"use client";

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Award, RotateCcw, BookOpen, MapPin, Eye, Trophy, Home } from 'lucide-react';
import { QuizResultResponse } from '../../lib/quiz';

interface QuizResultProps {
  result: QuizResultResponse;
  categoryName: string;
  onRestart: () => void;
  onChooseOther: () => void;
  onViewLeaderboard: () => void;
  isLoggedIn: boolean;
}

export default function QuizResult({
  result,
  categoryName,
  onRestart,
  onChooseOther,
  onViewLeaderboard,
  isLoggedIn
}: QuizResultProps) {
  
  // Fire confetti when component mounts!
  useEffect(() => {
    // Fire a big burst
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 }
    });

    // Fire fireworks for 3 seconds if score is good
    if (result.score >= 80) {
      const end = Date.now() + 2.5 * 1000;
      const interval = setInterval(() => {
        if (Date.now() > end) {
          return clearInterval(interval);
        }
        confetti({
          startVelocity: 30,
          spread: 360,
          ticks: 60,
          origin: { x: Math.random(), y: Math.random() - 0.2 }
        });
      }, 200);
    }
  }, [result.score]);

  // Determine feedback text
  const getFeedback = () => {
    if (result.score === 100) return { title: '🌟 PERFECT SCORE! 🌟', desc: 'You are a certified Museum Master explorer!', color: 'text-yellow-400' };
    if (result.score >= 80) return { title: '🎉 FANTASTIC JOB! 🎉', desc: 'Incredible score! You unlocked new badges.', color: 'text-amber-400' };
    if (result.score >= 50) return { title: '👍 GOOD TRY! 👍', desc: 'Great effort! Keep exploring to learn more.', color: 'text-blue-400' };
    return { title: '🦕 KEEP LEARNING! 🦕', desc: 'Try playing again to beat your high score!', color: 'text-zinc-400' };
  };

  const feedback = getFeedback();

  return (
    <div className="w-full flex flex-col items-center">
      {/* feedback message */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center mb-8"
      >
        <h2 className={`text-3xl font-extrabold mb-2 tracking-wide ${feedback.color}`}>
          {feedback.title}
        </h2>
        <p className="text-zinc-300 text-lg font-medium">{feedback.desc}</p>
      </motion.div>

      {/* Score Summary Box */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8" />
          <Trophy className="w-8 h-8 text-blue-400 mb-2" />
          <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Final Score</span>
          <span className="text-4xl font-extrabold text-white mt-1">{result.score}%</span>
          <span className="text-xs text-zinc-500 mt-1">({result.correctCount} / {result.totalQuestions} Correct)</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-8 -mt-8" />
          <Award className="w-8 h-8 text-amber-400 mb-2" />
          <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Points Gained</span>
          <span className="text-4xl font-extrabold text-white mt-1">+{result.pointsEarned}</span>
          <span className="text-xs text-zinc-500 mt-1">Added to profile</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -mr-8 -mt-8" />
          <span className="text-3xl mb-2">🏅</span>
          <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Badges Earned</span>
          <span className="text-4xl font-extrabold text-white mt-1">{result.badgesEarned.length}</span>
          <span className="text-xs text-zinc-500 mt-1">Unlocked rewards</span>
        </div>
      </div>

      {/* Badges Display */}
      {result.badgesEarned.length > 0 && (
        <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 mb-8 text-center shadow-md">
          <h3 className="text-base font-bold text-white mb-4 uppercase tracking-wider flex items-center justify-center gap-2">
            ✨ Badges Unlocked! ✨
          </h3>
          <div className="flex flex-wrap justify-center gap-6">
            {result.badgesEarned.map((badge) => (
              <motion.div
                key={badge.id}
                whileHover={{ scale: 1.05 }}
                className="flex flex-col items-center bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-4 rounded-xl w-32 shadow-sm"
              >
                <span className="text-4xl mb-2 animate-bounce">{badge.image}</span>
                <span className="text-sm font-bold text-white text-center leading-tight mb-1">{badge.title}</span>
                <span className="text-[10px] text-zinc-400 text-center leading-tight">{badge.description}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Guest warning */}
      {!isLoggedIn && (
        <div className="w-full bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm p-4 rounded-xl mb-8 flex justify-center items-center">
          <span>⚠️ You are playing as a guest. <strong>Sign in</strong> or <strong>Sign up</strong> to save your scores and show badges on your profile!</span>
        </div>
      )}

      {/* Main Buttons */}
      <div className="w-full flex flex-wrap justify-center gap-4 mb-8">
        <button
          onClick={onRestart}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all hover:scale-103 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-md shadow-blue-600/20"
        >
          <RotateCcw className="w-5 h-5" /> Play Again
        </button>

        <button
          onClick={onChooseOther}
          className="px-6 py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl flex items-center gap-2 transition-all hover:scale-103 focus:outline-none focus:ring-2 focus:ring-zinc-600"
        >
          <Home className="w-5 h-5" /> Choose Category
        </button>

        <button
          onClick={onViewLeaderboard}
          className="px-6 py-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl flex items-center gap-2 transition-all hover:scale-103 focus:outline-none focus:ring-2 focus:ring-zinc-600"
        >
          <Trophy className="w-5 h-5" /> View Leaderboard
        </button>
      </div>

      {/* Education Museum Ticket Integration */}
      <div className="w-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6 mb-8 shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">🎟️ Ready to see them in real life?</h3>
            <p className="text-zinc-300 text-sm">Now that you know your history and dinosaurs, book a ticket to explore real-life artifacts!</p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <a
              href="/booking/chatbot"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center gap-2 transition-all hover:scale-103 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              Book Museum Ticket
            </a>
            <a
              href="/booking/chat"
              className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-bold rounded-xl text-sm flex items-center gap-2 transition-all focus:outline-none"
            >
              <Eye className="w-4 h-4" /> Virtual Tour
            </a>
          </div>
        </div>
      </div>

      {/* Review Section */}
      <div className="w-full">
        <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400" /> Review and Explanations
        </h3>
        
        <div className="space-y-4">
          {result.results.map((item, index) => (
            <div
              key={item.questionId}
              className={`p-5 rounded-2xl border text-left flex flex-col gap-2 ${
                item.isCorrect
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-red-500/5 border-red-500/20'
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <span className="text-sm font-bold text-zinc-500 uppercase">Question {index + 1}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase ${
                  item.isCorrect ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {item.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </span>
              </div>
              
              <h4 className="text-white font-semibold text-base mb-1">{item.question}</h4>
              
              <div className="text-sm flex flex-col gap-1">
                <div className="text-zinc-300">
                  <span className="font-semibold text-zinc-500">Your Answer:</span> {item.userAnswer}
                </div>
                {!item.isCorrect && (
                  <div className="text-zinc-300">
                    <span className="font-semibold text-zinc-500">Correct Answer:</span> <span className="text-emerald-400 font-semibold">{item.correctAnswer}</span>
                  </div>
                )}
              </div>

              {item.explanation && (
                <div className="mt-2 pt-2 border-t border-zinc-800 text-xs text-zinc-400 italic">
                  <strong>Did you know?</strong> {item.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
