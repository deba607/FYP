"use client";

import { Sparkles } from 'lucide-react';
import { QuizCategory } from '../../lib/quiz';
import { prefetchQuizQuestions } from '../../lib/quizAPI';
import QuizCard from './QuizCard';

interface QuizRecommendationProps {
  recommendations: QuizCategory[];
  onPlay: (categoryId: string) => void;
  reason?: string;
}

export default function QuizRecommendation({ recommendations, onPlay, reason }: QuizRecommendationProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="w-full bg-zinc-950/20 border border-zinc-800/80 rounded-2xl p-6 shadow-sm mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400 fill-amber-400/20" />
          <h3 className="text-lg font-bold text-white uppercase tracking-wider">
            Quizzes Recommended For You
          </h3>
        </div>
        {reason && (
          <span className="text-xs text-zinc-500 font-medium">
            {reason}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {recommendations.slice(0, 3).map((category) => (
          <QuizCard
            key={category.id}
            category={category}
            onWarmup={() => prefetchQuizQuestions(category.id)}
            onPlay={() => onPlay(category.id)}
          />
        ))}
      </div>
    </div>
  );
}
