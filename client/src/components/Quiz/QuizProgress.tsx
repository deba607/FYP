"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';

interface QuizProgressProps {
  current: number;
  total: number;
  lives: number;
}

export default function QuizProgress({ current, total, lives }: QuizProgressProps) {
  const percentage = (current / total) * 100;

  return (
    <div className="w-full">
      {/* Top Labels */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-muted-foreground">
          Question <span className="text-white font-bold">{current}</span> of <span className="text-white font-bold">{total}</span>
        </span>
        
        {/* Lives Counter */}
        <div className="flex items-center gap-1" aria-label={`Lives remaining: ${lives}`}>
          <AnimatePresence>
            {Array.from({ length: 3 }).map((_, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={idx < lives ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0.3 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <Heart
                  className={`w-5 h-5 ${idx < lives ? 'fill-red-500 text-red-500' : 'text-zinc-600'}`}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
