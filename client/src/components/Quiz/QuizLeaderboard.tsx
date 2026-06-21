"use client";

import { motion } from 'framer-motion';
import { Trophy, Medal, Star, Calendar } from 'lucide-react';
import { QuizScore } from '../../lib/quiz';

interface QuizLeaderboardProps {
  scores: QuizScore[];
  loading?: boolean;
}

export default function QuizLeaderboard({ scores, loading = false }: QuizLeaderboardProps) {
  
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2: return <Medal className="w-5 h-5 text-slate-300" />;
      case 3: return <Medal className="w-5 h-5 text-amber-600" />;
      default: return <span className="font-mono text-zinc-500 font-bold text-sm w-5 text-center">{rank}</span>;
    }
  };

  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case 'dinosaur': return '🦖';
      case 'ancient-india': return '🏺';
      case 'space': return '🚀';
      case 'paintings': return '🎨';
      case 'wildlife': return '🦁';
      case 'science': return '🔬';
      default: return '🧩';
    }
  };

  return (
    <div className="w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-md">
      <div className="flex items-center gap-2 mb-6 justify-center">
        <Trophy className="w-6 h-6 text-yellow-400" />
        <h3 className="text-lg font-bold text-white uppercase tracking-wider">
          Explorer Hall of Fame
        </h3>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-14 bg-zinc-800/40 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : scores.length === 0 ? (
        <div className="text-sm text-zinc-500 text-center py-6">No scores recorded yet. Be the first to play!</div>
      ) : (
        <div className="flex flex-col gap-3">
          {scores.map((score, index) => {
            const rank = index + 1;
            const emoji = getCategoryEmoji(score.category);

            return (
              <motion.div
                key={score.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  rank === 1
                    ? 'bg-yellow-500/5 border-yellow-500/20'
                    : rank === 2
                    ? 'bg-zinc-300/5 border-zinc-300/10'
                    : rank === 3
                    ? 'bg-amber-600/5 border-amber-600/10'
                    : 'bg-zinc-900 border-zinc-850'
                }`}
              >
                {/* Left: Rank + Avatar + Name */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-850 border border-zinc-800">
                    {getRankBadge(rank)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">
                      {score.username}
                    </h4>
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" /> {new Date(score.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Right: Category + Score */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 bg-zinc-850 border border-zinc-800 px-3 py-1.5 rounded-lg">
                    <span className="text-lg">{emoji}</span>
                    <span className="text-xs font-semibold text-zinc-400 capitalize hidden sm:inline">
                      {score.category.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="text-right flex items-center gap-1">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-sm font-extrabold text-white">{score.score}%</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
