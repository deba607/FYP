"use client";

import { motion } from 'framer-motion';
import { Sparkles, Gamepad2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function QuizHomeBanner() {
  const previewCards = [
    { name: 'Dinosaur Quiz', icon: '🦖', color: 'from-emerald-400 to-green-600', questions: '5 Qs', diff: 'Easy' },
    { name: 'Ancient India', icon: '🏺', color: 'from-amber-400 to-orange-650', questions: '5 Qs', diff: 'Medium' },
    { name: 'Space Gallery', icon: '🚀', color: 'from-blue-500 to-indigo-750', questions: '5 Qs', diff: 'Medium' },
  ];

  return (
    <section className="py-12 bg-black relative overflow-hidden border-t border-zinc-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/4 w-72 h-72 bg-blue-500/5 rounded-full filter blur-3xl -translate-y-1/2" />
        <div className="absolute top-1/2 right-1/4 w-72 h-72 bg-purple-500/5 rounded-full filter blur-3xl -translate-y-1/2" />

        <div className="relative bg-zinc-950 border border-zinc-900 rounded-3xl p-8 md:p-12 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-8">
          
          {/* Left Text */}
          <div className="max-w-md text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5 fill-blue-400/20" /> New Kids Feature
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">
              🧩 Interactive Quiz for Kids
            </h2>
            <p className="text-zinc-400 text-base leading-relaxed mb-6">
              Learn about famous artifacts, dinosaurs, space, and history through exciting games. Become a Museum Explorer and earn exclusive badges for your profile!
            </p>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-2xl text-sm transition-all hover:scale-103 shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              <Gamepad2 className="w-4 h-4" /> Start Playing Now <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Right Cards Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:max-w-lg">
            {previewCards.map((card, idx) => (
              <motion.div
                key={card.name}
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl text-center flex flex-col items-center shadow-sm"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-2xl shadow-inner mb-3`}>
                  {card.icon}
                </div>
                <h4 className="text-sm font-bold text-white mb-1.5 leading-tight">{card.name}</h4>
                <div className="flex gap-2 text-[10px] text-zinc-500 font-bold uppercase">
                  <span>{card.questions}</span>
                  <span>•</span>
                  <span className="text-amber-500">{card.diff}</span>
                </div>
              </motion.div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}
