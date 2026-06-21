"use client";

import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface QuizTimerProps {
  duration: number;
  timeLeft: number;
  isActive: boolean;
}

export default function QuizTimer({ duration, timeLeft, isActive }: QuizTimerProps) {
  const radius = 24;
  const stroke = 4;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (timeLeft / duration) * circumference;

  // Compute color based on time left
  const getColor = () => {
    const percentage = timeLeft / duration;
    if (percentage > 0.5) return 'stroke-emerald-400';
    if (percentage > 0.25) return 'stroke-amber-400';
    return 'stroke-red-500 animate-pulse';
  };

  return (
    <div className="relative flex items-center justify-center w-14 h-14" aria-label={`Time remaining: ${timeLeft} seconds`}>
      <svg className="w-full h-full transform -rotate-90">
        {/* Background Circle */}
        <circle
          className="stroke-muted/30"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Foreground Circle */}
        <motion.circle
          className={getColor()}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: 'linear' }}
        />
      </svg>
      <span className="absolute text-sm font-bold font-mono tracking-tighter text-white">
        {timeLeft}
      </span>
    </div>
  );
}
