import { AnimatePresence, motion } from "framer-motion";

interface ZombieLayerProps {
  /** 0 (caught) … 100 (safe) */
  zombieDistance: number;
  boostActive: boolean;
  /** Uploaded image that replaces the FACE of the four side zombies. */
  zombieFace?: string | null;
  /** Preset avatar that replaces the WHOLE middle zombie. */
  headAvatar?: string | null;
}

const ZOMBIES = ["🧟", "🧟‍♂️", "🧟‍♀️", "🧟", "🧟‍♂️"];
const MIDDLE_INDEX = Math.floor(ZOMBIES.length / 2);

/**
 * Composites a 2D horde behind/over the player. As the backend zombieDistance
 * shrinks, the zombies scale up, climb toward the player and the danger
 * vignette intensifies. Players can optionally swap the side zombies' faces
 * (uploaded image) and the middle zombie (preset avatar).
 */
export function ZombieLayer({
  zombieDistance,
  boostActive,
  zombieFace,
  headAvatar,
}: ZombieLayerProps) {
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
            "radial-gradient(circle at 50% 75%, rgba(220,38,38,0.0) 30%, rgba(220,38,38,0.55) 100%)",
        }}
      />

      {/* Horde */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-2 sm:gap-6">
        {ZOMBIES.map((zombie, index) => {
          const lane = index - (ZOMBIES.length - 1) / 2;
          const wobble = boostActive ? 1.5 : 6 - proximity * 3;
          const isMiddle = index === MIDDLE_INDEX;
          const fontSizeRem = (4 + Math.abs(lane) * 0.4) * scale;
          const sharedStyle = {
            marginBottom: `${rise + Math.abs(lane) * 4}%`,
            opacity: 0.4 + proximity * 0.6,
            filter: boostActive ? "grayscale(0.6) brightness(0.7)" : "none",
          } as const;
          const animate = { y: [0, -wobble, 0], rotate: [0, lane * 1.5, 0] };
          const transition = {
            duration: 0.5 + Math.abs(lane) * 0.08,
            repeat: Infinity,
            ease: "easeInOut" as const,
          };

          // Middle zombie: replace the whole emoji with the preset avatar.
          if (isMiddle && headAvatar) {
            return (
              <motion.img
                key={index}
                src={headAvatar}
                alt="Custom head zombie"
                className="origin-bottom select-none object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
                style={{
                  width: `${fontSizeRem + 5}rem`,
                  height: `${fontSizeRem + 5}rem`,
                  ...sharedStyle,
                }}
                animate={animate}
                transition={transition}
              />
            );
          }

          return (
            <motion.span
              key={index}
              className="relative inline-block origin-bottom select-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
              style={{ fontSize: `${fontSizeRem}rem`, ...sharedStyle }}
              animate={animate}
              transition={transition}
            >
              {zombie}
              {/* Side zombies: overlay the uploaded image over the face only. */}
              {!isMiddle && zombieFace ? (
                <img
                  src={zombieFace}
                  alt=""
                  className="pointer-events-none absolute rounded-full object-cover"
                  style={{
                    width: "0.8em",
                    height: "0.8em",
                    left: "50%",
                    top: "0.2em",
                    transform: "translateX(-50%)",
                  }}
                />
              ) : null}
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
