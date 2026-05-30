import { motion } from "framer-motion";
import type { Difficulty } from "../motion/motionTypes";
import "../index.css";
// import titleBG from "../public/bg.png";

const DIFFICULTIES: Array<{
  id: Difficulty;
  label: string;
  blurb: string;
  skulls: string;
}> = [
  {
    id: "EASY",
    label: "TONG TONG TONG SAHUR",
    blurb: "Slow horde · forgiving timing",
    skulls: "🧟",
  },
  {
    id: "NORMAL",
    label: "TRALALERO TRALALA",
    blurb: "They are hungry · stay sharp",
    skulls: "🧟🧟",
  },
  {
    id: "HARD",
    label: "BALLERINA CAPPUCCINA",
    blurb: "Relentless swarm · sprint or die",
    skulls: "🧟🧟🧟",
  },
];

interface LandingProps {
  difficulty: Difficulty;
  connected: boolean;
  onSelectDifficulty: (difficulty: Difficulty) => void;
  onStart: () => void;
}

export function Landing({
  difficulty,
  connected,
  onSelectDifficulty,
  onStart,
}: LandingProps) {
  return (
    <div
      className="relative grid min-h-screen place-items-center overflow-hidden px-4 text-neutral-100"
      style={{
        backgroundImage: "url('/bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* <div className="scanlines pointer-events-none absolute inset-0 opacity-30" /> */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(132,204,22,0.18),transparent_60%)]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-8 py-10 text-center"
      >
        <div className="flex flex-col items-center gap-3">
          <span
            className="rounded-full border border-lime-500/40 bg-lime-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-lime-300

            -translate-y-4
            sm:-translate-y-20"
          >
            SIT HACK 2026
          </span>
          <h1
            className="zombie-title whitespace-nowrap text-8xl sm:text-8xl md:text-[120px] lg:text-[145px] -translate-y-4
            sm:-translate-y-10 md:-translate-y-20"
          >
            ZOMBIE RUN
          </h1>
          <p className="max-w-xl text-sm text-neutral-400 sm:text-base">
            Your webcam is the controller.{" "}
            <span className="text-lime-300">Run in place</span> to outpace the
            horde, dodge, jump and throw the viral{" "}
            <span className="text-red-400 font-semibold">6&nbsp;7</span> to
            survive.
          </p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-3">
          {DIFFICULTIES.map((option) => {
            const active = option.id === difficulty;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectDifficulty(option.id)}
                className={`group flex flex-col items-center gap-2 rounded-xl border p-5 transition ${
                  active
                    ? "border-lime-400 bg-lime-400/10 shadow-[0_0_30px_-8px_rgba(132,204,22,0.7)]"
                    : "border-neutral-800 bg-neutral-900/70 hover:border-neutral-600"
                }`}
              >
                {/* <span className="text-3xl transition group-hover:scale-110">
                  {option.skulls}
                </span> */}
                <span
                  className={`text-lg font-bold tracking-widest ${active ? "text-lime-300" : "text-neutral-200"}`}
                >
                  {option.label}
                </span>
                <span className="text-xs text-neutral-500">{option.blurb}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={!connected}
          className="
    flex items-center gap-3
    px-10 py-4 rounded-xl

    transition-all
    hover:scale-110
    active:scale-95

    disabled:cursor-not-allowed
    disabled:opacity-40
  "
          style={{
            background:
              "linear-gradient(180deg, #a7ff83 0%, #17b978 60%, #0d9460 100%)",
            boxShadow: "0 6px 0 #065e3f, 0 0 30px rgba(23,185,120,0.5)",
          }}
        >
          <span
            style={{
              fontFamily: "Zombie",
              fontSize: "2.5rem",
              color: "#083339",
              letterSpacing: "0.05em",
              lineHeight: 1,
            }}
          >
            {connected ? "START RUNNING" : "CONNECTING..."}
          </span>
        </button>

        {/* <p className="text-xs text-neutral-600">
          Camera + pose tracking run entirely in your browser. Allow webcam
          access when prompted.
        </p> */}
      </motion.div>
    </div>
  );
}
