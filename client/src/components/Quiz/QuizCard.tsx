"use client";

import { motion } from 'framer-motion';
import { Star, Clock, Sparkles } from 'lucide-react';
import { QuizCategory } from '../../lib/quiz';

interface QuizCardProps {
  category: QuizCategory;
  onPlay: () => void;
  onWarmup?: () => void;
}

export default function QuizCard({ category, onPlay, onWarmup }: QuizCardProps) {
  // Map difficulty level to stars
  const renderStars = (difficulty: string) => {
    const count = difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 2 : 3;
    return (
      <div className="flex gap-0.5" aria-label={`Difficulty: ${difficulty}`}>
        {Array.from({ length: 3 }).map((_, idx) => (
          <Star
            key={idx}
            className={`w-3.5 h-3.5 ${
              idx < count ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      onMouseEnter={onWarmup}
      onFocusCapture={onWarmup}
      onTouchStart={onWarmup}
      className={`group relative rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-zinc-700 flex flex-col p-6 shadow-md transition-all h-full`}
    >
      {/* Decorative gradient overlay */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 transition-opacity group-hover:opacity-[0.02]`}
      />

      {/* Top row: Emoji Icon & Difficulty */}
      <div className="flex justify-between items-start mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${category.color} flex items-center justify-center text-2xl shadow-inner`}>
          {category.icon}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">Difficulty</span>
          {renderStars(category.difficulty)}
        </div>
      </div>

      {/* Text Info */}
      <div className="flex-grow">
        <h3 className="text-lg font-bold text-white mb-2 leading-tight group-hover:text-blue-400 transition-colors">
          {category.name}
        </h3>
        <p className="text-zinc-400 text-sm leading-relaxed mb-4">
          {category.description}
        </p>
      </div>

      {/* Meta Row: Questions + Est. Time */}
      <div className="flex items-center gap-4 py-3 border-y border-zinc-800/60 mb-5 text-xs text-zinc-500 font-medium">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          5 Questions
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          3 Minutes
        </span>
      </div>

      {/* Play Button */}
      <button
        type="button"
        onClick={onPlay}
        className={`w-full py-3 px-4 rounded-xl font-extrabold text-sm text-center bg-zinc-800 hover:bg-gradient-to-r group-hover:${category.color} text-white group-hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 hover:scale-101 cursor-pointer`}
      >
        ▶ Play Quiz
      </button>
    </motion.div>
  );
}
