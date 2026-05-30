import { AnimatePresence, motion } from 'framer-motion';
import type { Obstacle } from '../motion/motionTypes';
import { OBSTACLE_META } from '../game/obstacles';

interface ObstaclePromptProps {
  obstacle: Obstacle | null;
  now: number;
}

export function ObstaclePrompt({ obstacle, now }: ObstaclePromptProps) {
  return (
    <AnimatePresence mode="wait">
      {obstacle ? <PromptCard key={obstacle.id} obstacle={obstacle} now={now} /> : null}
    </AnimatePresence>
  );
}

function PromptCard({ obstacle, now }: { obstacle: Obstacle; now: number }) {
  const meta = OBSTACLE_META[obstacle.type];
  const total = Math.max(1, obstacle.deadline - obstacle.spawnAt);
  const remaining = Math.max(0, obstacle.deadline - now);
  const ratio = Math.min(1, remaining / total);

  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.4, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className="flex flex-col items-center gap-3"
    >
      <div
        className="flex flex-col items-center gap-1 rounded-2xl border-2 bg-neutral-950/80 px-10 py-5 backdrop-blur"
        style={{ borderColor: meta.accent, boxShadow: `0 0 40px -6px ${meta.accent}` }}
      >
        <span className="text-5xl">{meta.emoji}</span>
        <span className="text-3xl font-black uppercase tracking-widest" style={{ color: meta.accent }}>
          {meta.label}
        </span>
        <span className="text-xs uppercase tracking-widest text-neutral-400">{meta.hint}</span>
      </div>

      {/* deadline bar */}
      <div className="h-2 w-56 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full transition-[width] duration-100 ease-linear"
          style={{ width: `${ratio * 100}%`, backgroundColor: meta.accent }}
        />
      </div>
    </motion.div>
  );
}
