import { motion } from 'framer-motion';

interface LandingProps {
  connected: boolean;
  onStart: () => void;
}

export function Landing({ connected, onStart }: LandingProps) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-neutral-950 px-4 text-neutral-100">
      <div className="scanlines pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(132,204,22,0.18),transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-8 py-10 text-center"
      >
        <div className="flex flex-col items-center gap-3">
          <span className="rounded-full border border-lime-500/40 bg-lime-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-lime-300">
            Outbreak Protocol · Subject {Math.floor(Math.random() * 900 + 100)}
          </span>
          <h1 className="glitch text-6xl font-black uppercase tracking-tight sm:text-8xl" data-text="ZOMBIE RUN">
            ZOMBIE RUN
          </h1>
          <p className="max-w-xl text-sm text-neutral-400 sm:text-base">
            Your webcam is the controller. <span className="text-lime-300">Run in place</span> to outpace the horde,
            dodge, jump and throw the viral <span className="text-pink-400 font-semibold">6&nbsp;7</span> to survive.
          </p>
        </div>

        <div className="w-full rounded-xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex flex-col items-center gap-2 text-sm text-neutral-400 sm:flex-row sm:justify-center">
            <span className="text-3xl">🧟</span>
            <span>
              The horde starts slow, then gets faster the longer you survive.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={!connected}
          className="relative w-full max-w-sm rounded-xl bg-lime-400 px-8 py-4 text-lg font-black uppercase tracking-widest text-neutral-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {connected ? 'Enter the Apocalypse' : 'Connecting to server…'}
        </button>

        <p className="text-xs text-neutral-600">
          Camera + pose tracking run entirely in your browser. Allow webcam access when prompted.
        </p>
      </motion.div>
    </div>
  );
}
