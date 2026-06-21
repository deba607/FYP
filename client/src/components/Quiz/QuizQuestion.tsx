"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Volume2, HelpCircle, ArrowRight } from 'lucide-react';
import { QuizQuestion as QuestionType } from '../../lib/quiz';

interface QuizQuestionProps {
  question: QuestionType;
  selectedAnswer: string | null;
  onSelectAnswer: (option: string) => void;
  onHint: () => void;
  hintUsed: boolean;
  onSkip: () => void;
  onNext: () => void;
}

export default function QuizQuestion({
  question,
  selectedAnswer,
  onSelectAnswer,
  onHint,
  hintUsed,
  onSkip,
  onNext
}: QuizQuestionProps) {
  const [hintText, setHintText] = useState<string | null>(null);

  // Stop speaking when question changes
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setHintText(null);
  }, [question]);

  const speakText = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterText = `${question.question}. Options are: ${question.options.join(', ')}`;
      const utterance = new SpeechSynthesisUtterance(utterText);
      utterance.rate = 0.95; // Slightly slower for kids
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleHintClick = () => {
    onHint();
    // Programmatic hint generator: remove one incorrect option or give a clue
    const hintOptions = question.options;
    if (hintOptions.length > 2) {
      // Find a wrong answer to rule out
      // Since we don't have correctAnswer on client, we rule out a random option index != 0 (assuming first index might be right? No, we don't know correct answer. Wait! How do we give a hint without the correct answer? We can state: 'Focus on your intuition, look at the options closely! Or: Try to search your memory.')
      // Wait, we can rule out the last option, or say 'This is related to museums/heritage.'
      // Better: we can generate a prompt like: "Hint: Try reading the options carefully. One of them is the correct answer!"
      // Or: "Clue: Think about what you read or saw in the museum gallery."
      setHintText("💡 Hint: Read the question carefully! It is one of the options listed below. Don't rush!");
    } else {
      setHintText("💡 Hint: It is a 50/50 choice! Think back to what you learned.");
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Speaker and Question Header */}
      <div className="w-full flex items-start justify-between gap-4 mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-white leading-snug">
          {question.question}
        </h2>
        <button
          onClick={speakText}
          className="p-3 bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded-full hover:scale-105 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
          title="Read question aloud"
          aria-label="Read question aloud"
        >
          <Volume2 className="w-6 h-6" />
        </button>
      </div>

      {/* Image if available */}
      {question.imageUrl && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md h-52 md:h-64 rounded-xl overflow-hidden mb-6 border border-zinc-700 relative shadow-lg"
        >
          <img
            src={question.imageUrl}
            alt="Quiz clue"
            className="w-full h-full object-cover"
          />
        </motion.div>
      )}

      {/* Options Grid */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === option;
          const letter = String.fromCharCode(65 + index); // A, B, C, D...
          
          return (
            <motion.button
              key={option}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSelectAnswer(option)}
              className={`p-4 md:p-5 rounded-xl border text-left flex items-center gap-4 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                isSelected
                  ? 'bg-blue-600/35 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.4)] text-white'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 text-zinc-300'
              }`}
              aria-label={`Option ${letter}: ${option}`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                isSelected ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}>
                {letter}
              </span>
              <span className="text-base font-semibold">{option}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Hint Alert */}
      {hintUsed && hintText && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-200 p-4 rounded-xl mb-6 text-sm flex items-center gap-3"
        >
          <HelpCircle className="w-5 h-5 flex-shrink-0 text-amber-400" />
          <span>{hintText}</span>
        </motion.div>
      )}

      {/* Footer Actions */}
      <div className="w-full flex items-center justify-between gap-4 mt-2">
        <button
          onClick={handleHintClick}
          disabled={hintUsed}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
            hintUsed
              ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-900'
              : 'bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
          }`}
        >
          💡 Need Hint
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onSkip}
            className="px-5 py-2.5 rounded-xl font-bold text-sm bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 transition-all focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            Skip
          </button>

          <button
            onClick={onNext}
            disabled={!selectedAnswer}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              selectedAnswer
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/35 hover:scale-103'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-900'
            }`}
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
