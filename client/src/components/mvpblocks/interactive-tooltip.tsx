'use client';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useState } from 'react';
import Image from 'next/image';

const defaultItems = [
  {
    id: 1,
    name: 'Souvik Gon',
    designation: 'Frontend & App Developer',
    image: '/team/souvik.png',
  },
  {
    id: 2,
    name: 'Sulagna Ghosh',
    designation: 'UI/UX Designer',
    image: '/team/sulagna.png',
  },
  {
    id: 3,
    name: 'Soumita Gupta',
    designation: 'Backend Developer',
    image: '/team/soumita.png',
  },
  {
    id: 4,
    name: 'Debanjan Paul',
    designation: 'Backend Developer',
    image: '/team/debanjan.png',
  },
  {
    id: 5,
    name: 'Dipon Biswas',
    designation: 'Frontend Developer',
    image: '/team/dipon.png',
  },
];

export default function InteractiveTooltip({
  items = defaultItems,
}: {
  items?: {
    id: number;
    name: string;
    designation: string;
    image: string;
  }[];
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const springConfig = { stiffness: 100, damping: 5 };
  const x = useMotionValue(0); // going to set this value on mouse move
  // rotate the tooltip
  const rotate = useSpring(
    useTransform(x, [-100, 100], [-45, 45]),
    springConfig,
  );
  // translate the tooltip
  const translateX = useSpring(
    useTransform(x, [-100, 100], [-50, 50]),
    springConfig,
  );
  const handleMouseMove = (event: any) => {
    const halfWidth = event.target.offsetWidth / 2;
    x.set(event.nativeEvent.offsetX - halfWidth); // set the x value, which is then used in transform and rotate
  };

  return (
    <div className="flex items-center justify-center w-full py-10">
      {items.map((item) => (
        <div
          className="group relative -mr-4"
          key={item.name}
          onMouseEnter={() => setHoveredIndex(item.id)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence mode="popLayout">
            {hoveredIndex === item.id && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    type: 'spring',
                    stiffness: 260,
                    damping: 10,
                  },
                }}
                exit={{ opacity: 0, y: 20, scale: 0.6 }}
                style={{
                  translateX: translateX,
                  rotate: rotate,
                  whiteSpace: 'nowrap',
                }}
                className="bg-background/95 border-border absolute -top-16 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center justify-center rounded-lg border px-4 py-2 text-xs shadow-xl backdrop-blur-sm"
              >
                <div className="from-primary/5 to-primary/5 absolute inset-0 rounded-lg bg-gradient-to-b via-transparent" />
                <div className="via-primary absolute inset-x-10 -bottom-px z-30 h-px w-[20%] bg-gradient-to-r from-transparent to-transparent" />
                <div className="via-primary/60 absolute -bottom-px left-10 z-30 h-px w-[40%] bg-gradient-to-r from-transparent to-transparent" />
                <div className="text-foreground relative z-30 text-base font-bold">
                  {item.name}
                </div>
                <div className="text-muted-foreground text-xs">
                  {item.designation}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <Image
            onMouseMove={handleMouseMove}
            height={100}
            width={100}
            src={item.image}
            alt={item.name}
            className="border-background ring-primary/20 group-hover:ring-primary/40 relative !m-0 h-14 w-14 rounded-full border-2 object-cover object-top !p-0 ring-2 transition duration-500 group-hover:z-30 group-hover:scale-105"
          />
        </div>
      ))}
    </div>
  );
}
