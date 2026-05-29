import { AnimatePresence, motion } from 'framer-motion';

interface ZombieLayerProps {
  /** 0 (caught) … 100 (safe) */
  zombieDistance: number;
  boostActive: boolean;
}

const ZOMBIES = ['🧟', '🧟‍♂️', '🧟‍♀️', '🧟', '🧟‍♂️'];

/**
 * Composites a 2D horde behind/over the player. As the backend zombieDistance
 * shrinks, the zombies scale up, climb toward the player and the danger
 * vignette intensifies.
 */
export function ZombieLayer({ zombieDistance, boostActive }: ZombieLayerProps) {
  const proximity = Math.min(1, Math.max(0, 1 - zombieDistance / 100));
  const danger = Math.pow(proximity, 1.6);
  const scale = 0.55 + proximity * 1.7;
  const rise = (1 - proximity) * 42; // % from bottom they sit further away

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Red proximity vignette */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: danger,
          background:
            'radial-gradient(circle at 50% 75%, rgba(220,38,38,0.0) 30%, rgba(220,38,38,0.55) 100%)',
        }}
      />

      {/* Horde */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-2 sm:gap-6">
        {ZOMBIES.map((zombie, index) => {
          const lane = index - (ZOMBIES.length - 1) / 2;
          const wobble = boostActive ? 1.5 : 6 - proximity * 3;
          return (
            <motion.span
              key={index}
              className="origin-bottom select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
              style={{
                fontSize: `${(3 + Math.abs(lane) * 0.2) * scale}rem`,
                marginBottom: `${rise + Math.abs(lane) * 4}%`,
                opacity: 0.4 + proximity * 0.6,
                filter: boostActive ? 'grayscale(0.6) brightness(0.7)' : 'none',
              }}
              animate={{ y: [0, -wobble, 0], rotate: [0, lane * 1.5, 0] }}
              transition={{ duration: 0.5 + Math.abs(lane) * 0.08, repeat: Infinity, ease: 'easeInOut' }}
            >
              {zombie}
            </motion.span>
          );
        })}
      </div>

      {/* "They are close" warning */}
      <AnimatePresence>
        {proximity > 0.7 && !boostActive ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-red-500 bg-red-500/20 px-4 py-1 text-sm font-bold uppercase tracking-widest text-red-300"
          >
            They&apos;re right behind you!
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
