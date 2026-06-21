"use client";

import { motion } from 'framer-motion';
import { Sparkles, Trophy, Award, Ticket, Video, Map } from 'lucide-react';

interface ChatbotQuizOptionsProps {
  categories: { id: string; name: string; icon: string; color: string }[];
  onSelect: (categoryName: string) => void;
}

export function ChatbotQuizCategories({ categories, onSelect }: ChatbotQuizOptionsProps) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 w-full max-w-xs" data-bmt-no-translate>
      {categories.map((cat) => (
        <motion.button
          key={cat.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(cat.name)}
          className={`flex items-center gap-2 p-3 rounded-xl border border-zinc-800 bg-zinc-900/90 text-left hover:border-zinc-700 transition-all text-xs font-bold text-white cursor-pointer`}
        >
          <span className="text-lg">{cat.icon}</span>
          <span>{cat.name}</span>
        </motion.button>
      ))}
    </div>
  );
}

interface ChatbotQuizResultProps {
  score: string; // e.g. "9/10"
  badgeTitle?: string;
  badgeImage?: string;
  onAction: (actionText: string) => void;
}

export function ChatbotQuizResult({ score, badgeTitle, badgeImage, onAction }: ChatbotQuizResultProps) {
  return (
    <div className="mt-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900 w-full max-w-sm" data-bmt-no-translate>
      <div className="text-center mb-3">
        <span className="text-3xl">🎉</span>
        <h4 className="text-sm font-bold text-white mt-1">Quiz Completed!</h4>
        <div className="flex items-center justify-center gap-1.5 mt-2 bg-zinc-850 px-3 py-1.5 rounded-lg border border-zinc-800 w-fit mx-auto">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-extrabold text-white">Score: {score}</span>
        </div>
      </div>

      {badgeTitle && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl mb-4 text-left">
          <span className="text-3xl animate-bounce">{badgeImage}</span>
          <div>
            <div className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider">New Badge Earned</div>
            <div className="text-xs font-bold text-white">{badgeTitle}</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => onAction('Play Again')}
          className="w-full p-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white text-center transition-all cursor-pointer"
        >
          🔁 Play Again
        </button>
        <button
          onClick={() => onAction('Choose Another Quiz')}
          className="w-full p-2.5 rounded-lg bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-xs font-bold text-zinc-300 text-center transition-all cursor-pointer"
        >
          🏛️ Choose Another Quiz
        </button>
        <div className="grid grid-cols-2 gap-1.5 mt-1 border-t border-zinc-850 pt-2">
          <button
            onClick={() => onAction('Book Museum Ticket')}
            className="flex items-center justify-center gap-1 p-2 rounded-lg bg-zinc-850 border border-zinc-800 hover:bg-zinc-800 text-[10px] font-bold text-zinc-300 transition-all cursor-pointer"
          >
            <Ticket className="w-3.5 h-3.5 text-emerald-400" /> Book Ticket
          </button>
          <button
            onClick={() => onAction('Explore Museum')}
            className="flex items-center justify-center gap-1 p-2 rounded-lg bg-zinc-850 border border-zinc-800 hover:bg-zinc-800 text-[10px] font-bold text-zinc-300 transition-all cursor-pointer"
          >
            <Map className="w-3.5 h-3.5 text-blue-400" /> Map Directions
          </button>
        </div>
      </div>
    </div>
  );
}
