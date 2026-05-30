import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';

function Backdrop({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-neutral-950/75 px-6 text-center backdrop-blur-sm">
      {children}
    </div>
  );
}

export function CountdownOverlay({ value }: { value: number }) {
  return (
    <Backdrop>
      <motion.span
        key={value}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-[10rem] font-black leading-none text-lime-300 drop-shadow-[0_0_30px_rgba(132,204,22,0.8)]"
      >
        {value > 0 ? value : 'RUN!'}
      </motion.span>
    </Backdrop>
  );
}

export function GetInFrameOverlay({
  cameraOn,
  confidence,
  error,
  onCalibrate,
}: {
  cameraOn: boolean;
  confidence: number;
  error: string | null;
  onCalibrate: () => void;
}) {
  return (
    <Backdrop>
      <div className="flex max-w-md flex-col items-center gap-4">
        <span className="text-5xl">📸</span>
        <h2 className="text-2xl font-black uppercase tracking-widest text-neutral-100">Get in frame</h2>
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <p className="text-sm text-neutral-400">
            Step back so your <span className="text-lime-300">whole body</span> is visible, then hold still for a moment.
          </p>
        )}
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-500">
          <span className={`h-2 w-2 rounded-full ${cameraOn ? 'bg-lime-400' : 'bg-yellow-400 animate-pulse'}`} />
          {cameraOn ? `Pose confidence ${(confidence * 100).toFixed(0)}%` : 'Starting camera…'}
        </div>
        <button
          type="button"
          onClick={onCalibrate}
          disabled={!cameraOn}
          className="rounded-xl bg-lime-400 px-6 py-3 font-bold uppercase tracking-widest text-neutral-950 transition hover:bg-lime-300 disabled:opacity-40"
        >
          Calibrate
        </button>
      </div>
    </Backdrop>
  );
}

export function CalibratingOverlay({ progress, samples }: { progress: number; samples: number }) {
  return (
    <Backdrop>
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <span className="text-5xl">🤖</span>
        <h2 className="text-2xl font-black uppercase tracking-widest text-lime-300">Calibrating</h2>
        <p className="text-sm text-neutral-400">Hold your running stance. Reading your body…</p>
        <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full rounded-full bg-lime-400 transition-[width] duration-100"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className="font-mono text-xs text-neutral-500">{samples} samples captured</span>
      </div>
    </Backdrop>
  );
}

export function PausedOverlay({ onResume }: { onResume: () => void }) {
  return (
    <Backdrop>
      <div className="flex flex-col items-center gap-5">
        <h2 className="text-4xl font-black uppercase tracking-widest text-neutral-100">Paused</h2>
        <button
          type="button"
          onClick={onResume}
          className="rounded-xl bg-lime-400 px-8 py-3 font-bold uppercase tracking-widest text-neutral-950 transition hover:bg-lime-300"
        >
          Resume
        </button>
      </div>
    </Backdrop>
  );
}

export function LevelTransitionOverlay({
  currentLevel,
  secondsRemaining,
}: {
  currentLevel: number;
  secondsRemaining: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24, scale: 0.96 }}
      className="pointer-events-none absolute left-1/2 top-4 z-40 flex w-[min(92vw,44rem)] -translate-x-1/2 items-center justify-between gap-4 rounded-xl border-2 border-red-500 bg-neutral-950/85 px-5 py-3 text-left shadow-[0_0_34px_rgba(239,68,68,0.35)] backdrop-blur"
    >
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.35em] text-lime-300">Level {currentLevel} cleared</div>
        <div className="text-lg font-black uppercase tracking-widest text-neutral-100 sm:text-2xl">
          Moving to next stage in
        </div>
      </div>
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 border-red-500 bg-red-500/20 text-3xl font-black tabular-nums text-red-200">
        {Math.max(1, secondsRemaining)}
      </div>
    </motion.div>
  );
}

export function GameOverOverlay({
  score,
  survivalTime,
  faceSnapshot,
  sixtySevenReplayUrl,
  onPlayAgain,
  onMenu,
}: {
  score: number;
  survivalTime: number;
  faceSnapshot: string | null;
  sixtySevenReplayUrl: string | null;
  onPlayAgain: () => void;
  onMenu: () => void;
}) {
  return (
    <Backdrop>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex w-full max-w-3xl flex-col items-center gap-5"
      >
        {faceSnapshot ? (
          <img
            src={faceSnapshot}
            alt="Your face after the zombie attack"
            className="h-32 w-32 rounded-full border-4 border-red-500 object-cover"
          />
        ) : (
          <span className="text-7xl">💀</span>
        )}
        <h2 className="glitch text-5xl font-black uppercase tracking-widest text-red-500" data-text="CAUGHT!">
          CAUGHT!
        </h2>
        <p className="max-w-sm text-sm text-neutral-300">
          You got eaten alive by zombie... honestly, five-star meal presentation.
        </p>
        {sixtySevenReplayUrl ? (
          <div className="w-full rounded-xl border border-pink-400/50 bg-neutral-950/80 p-4 text-left">
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-pink-300">67 instant replay</div>
            <video
              src={sixtySevenReplayUrl}
              className="aspect-video max-h-[46vh] w-full rounded-lg bg-black object-cover"
              controls
              autoPlay
              muted
              loop
              playsInline
            />
          </div>
        ) : null}
        <div className="grid w-full grid-cols-2 gap-3">
          <Stat label="Final score" value={Math.round(score).toString()} />
          <Stat label="Survived" value={`${survivalTime.toFixed(1)}s`} />
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 rounded-xl bg-lime-400 px-6 py-3 font-bold uppercase tracking-widest text-neutral-950 transition hover:bg-lime-300"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onMenu}
            className="flex-1 rounded-xl border border-neutral-700 px-6 py-3 font-bold uppercase tracking-widest text-neutral-300 transition hover:border-neutral-500"
          >
            Main menu
          </button>
        </div>
      </motion.div>
    </Backdrop>
  );
}

const COMBO_MESSAGES: Array<{ combo: number; message: string; subtext: string }> = [
  { combo: 10, message: 'THE ZOMBIES ARE FILING A COMPLAINT', subtext: 'Unfair movement detected' },
  { combo: 7, message: 'BRAINROT MODE', subtext: 'Absolutely unreasonable behavior' },
  { combo: 5, message: 'ABSOLUTE CINEMA', subtext: 'The horde is watching in HD' },
  { combo: 3, message: 'COOKING', subtext: 'Keep the streak alive' },
];

export function ComboAnnouncer({ comboCount }: { comboCount: number }) {
  const [announcement, setAnnouncement] = useState<{ combo: number; message: string; subtext: string } | null>(null);
  const lastAnnouncedComboRef = useRef(0);

  useEffect(() => {
    const nextAnnouncement = COMBO_MESSAGES.find(({ combo }) => comboCount >= combo && lastAnnouncedComboRef.current < combo);
    if (!nextAnnouncement) {
      if (comboCount === 0) {
        lastAnnouncedComboRef.current = 0;
      }
      return;
    }

    lastAnnouncedComboRef.current = nextAnnouncement.combo;
    setAnnouncement(nextAnnouncement);
    const id = window.setTimeout(() => setAnnouncement(null), 1600);
    return () => window.clearTimeout(id);
  }, [comboCount]);

  if (!announcement) {
    return null;
  }

  return (
    <motion.div
      key={announcement.combo}
      initial={{ scale: 0.65, opacity: 0, y: 24 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 1.2, opacity: 0, y: -16 }}
      transition={{ type: 'spring', stiffness: 340, damping: 20 }}
      className="pointer-events-none absolute left-1/2 top-[18%] z-30 w-[min(92vw,34rem)] -translate-x-1/2 rounded-2xl border-4 border-lime-300 bg-neutral-950/80 px-6 py-4 text-center shadow-[0_0_45px_rgba(132,204,22,0.45)] backdrop-blur"
    >
      <div className="text-xs font-black uppercase tracking-[0.35em] text-lime-300">Combo x{comboCount}</div>
      <div className="mt-1 text-2xl font-black uppercase tracking-widest text-neutral-100 sm:text-4xl">{announcement.message}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-neutral-400">{announcement.subtext}</div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 px-4 py-3">
      <div className="text-2xl font-black tabular-nums text-neutral-100">{value}</div>
      <div className="text-xs uppercase tracking-widest text-neutral-500">{label}</div>
    </div>
  );
}

export function BoostFlash({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, rotate: -6 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      exit={{ scale: 1.6, opacity: 0 }}
      className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 rounded-2xl border-4 border-pink-400 bg-pink-500/30 px-8 py-4 text-center backdrop-blur"
    >
      <div className="text-4xl">🧠🔥</div>
      <div className="text-2xl font-black uppercase tracking-widest text-pink-200">{message}</div>
    </motion.div>
  );
}
