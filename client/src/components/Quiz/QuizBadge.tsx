"use client";

import { motion } from 'framer-motion';
import { Award, Lock } from 'lucide-react';
import { QuizBadge as BadgeType } from '../../lib/quiz';

interface QuizBadgeProps {
  badges: BadgeType[];
  earnedBadgeIds: string[];
}

export default function QuizBadge({ badges, earnedBadgeIds }: QuizBadgeProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-6">
        <Award className="w-6 h-6 text-amber-400" />
        <h3 className="text-lg font-bold text-white uppercase tracking-wider">
          Explorer Badges & Rewards
        </h3>
      </div>

      {badges.length === 0 ? (
        <div className="text-sm text-zinc-500 text-center py-6">Loading badges list...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {badges.map((badge) => {
            const isEarned = earnedBadgeIds.includes(badge.id);

            return (
              <motion.div
                key={badge.id}
                whileHover={{ scale: isEarned ? 1.05 : 1 }}
                className={`relative flex flex-col items-center p-5 rounded-2xl border text-center transition-all ${
                  isEarned
                    ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 shadow-md'
                    : 'bg-zinc-900/40 border-zinc-800/60 opacity-60'
                }`}
              >
                {/* Lock icon overlay if not earned */}
                {!isEarned && (
                  <div className="absolute top-2 right-2 p-1 bg-zinc-850 border border-zinc-800 rounded-full text-zinc-600">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                )}

                {/* Badge Image */}
                <span className={`text-4xl mb-3 ${isEarned ? 'animate-pulse' : 'grayscale filter'}`}>
                  {badge.image}
                </span>

                {/* Title */}
                <h4 className="text-sm font-bold text-white mb-1 leading-snug">
                  {badge.title}
                </h4>

                {/* Description */}
                <p className="text-[11px] text-zinc-400 leading-tight">
                  {badge.description}
                </p>

                {/* Criteria */}
                {!isEarned && (
                  <span className="mt-2 text-[9px] text-amber-500/80 font-bold uppercase tracking-wider">
                    Score {badge.minimumScore}%+
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
