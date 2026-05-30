import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

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

export function GameOverOverlay({
  score,
  survivalTime,
  faceSnapshot,
  onPlayAgain,
  onMenu,
}: {
  score: number;
  survivalTime: number;
  faceSnapshot: string | null;
  onPlayAgain: () => void;
  onMenu: () => void;
}) {
  return (
    <Backdrop>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex w-full max-w-md flex-col items-center gap-5"
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
