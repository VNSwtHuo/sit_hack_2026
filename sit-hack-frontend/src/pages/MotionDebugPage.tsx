import {
  Activity,
  Camera,
  Pause,
  Play,
  RotateCcw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  beginCalibration,
  createCalibrationState,
  updateCalibration,
  type CalibrationSample,
} from "../motion/calibration";
import type { CalibrationState } from "../motion/motionTypes";
import { useGameSocket } from "../motion/useGameSocket";
import { useMotionDetection } from "../motion/useMotionDetection";
import { usePoseTracker } from "../motion/usePoseTracker";

export function MotionDebugPage() {
  const {
    videoRef,
    canvasRef,
    landmarks,
    fps,
    confidence,
    isRunning,
    error,
    start,
    stop,
  } = usePoseTracker();
  const {
    connected,
    gameState,
    boostMessage,
    startCalibration: emitStartCalibration,
    confirmCalibration,
    restart,
    pause,
    resume,
    emitMotion,
  } = useGameSocket();
  const [calibration, setCalibration] = useState<CalibrationState>(() =>
    createCalibrationState(),
  );
  const [now, setNow] = useState(() => Date.now());
  const calibrationSamplesRef = useRef<CalibrationSample[]>([]);
  const lastMotionSentRef = useRef(0);
  const motion = useMotionDetection(landmarks, calibration.profile);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (calibration.status !== "collecting") {
      return;
    }

    setCalibration((current) =>
      updateCalibration(current, calibrationSamplesRef.current, landmarks),
    );
  }, [landmarks, calibration.status]);

  useEffect(() => {
    if (calibration.status === "complete" && calibration.profile) {
      confirmCalibration();
    }
  }, [calibration.status, calibration.profile, confirmCalibration]);

  useEffect(() => {
    const sentAt = Date.now();
    if (!calibration.profile || sentAt - lastMotionSentRef.current < 66) {
      return;
    }

    lastMotionSentRef.current = sentAt;
    emitMotion(motion);
  }, [motion, calibration.profile, emitMotion]);

  const startCalibration = () => {
    calibrationSamplesRef.current = [];
    setCalibration(beginCalibration());
    emitStartCalibration();
  };

  const current = gameState;
  const countdown =
    current?.countdownEndsAt && current.countdownEndsAt > now
      ? Math.ceil((current.countdownEndsAt - now) / 1000)
      : null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-normal">
              Zombie Run Motion Debug
            </h1>
            <p className="text-sm text-neutral-400">
              Client-side MediaPipe Pose plus Socket.IO game-state engine.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="icon-button"
              onClick={isRunning ? stop : start}
              title="Toggle camera"
              type="button"
            >
              <Camera size={18} />
            </button>
            <button
              className="icon-button"
              onClick={startCalibration}
              title="Calibrate"
              type="button"
            >
              <Activity size={18} />
            </button>
            <button
              className="icon-button"
              onClick={current?.gameState === "PAUSED" ? resume : pause}
              title="Pause"
              type="button"
            >
              {current?.gameState === "PAUSED" ? (
                <Play size={18} />
              ) : (
                <Pause size={18} />
              )}
            </button>
            <button
              className="icon-button"
              onClick={restart}
              title="Restart"
              type="button"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <div className="relative overflow-hidden rounded border border-neutral-800 bg-black">
            <video ref={videoRef} className="hidden" playsInline muted />
            <canvas ref={canvasRef} className="h-auto w-full" />
            <div className="absolute left-3 top-3 rounded bg-black/70 px-3 py-2 text-sm">
              {error ? error : isRunning ? "Camera active" : "Camera stopped"}
            </div>
            {countdown ? (
              <div className="absolute inset-0 grid place-items-center bg-black/30 text-7xl font-black">
                {countdown}
              </div>
            ) : null}
          </div>

          <aside className="grid gap-3">
            <DebugCard title="Connection">
              <Metric
                label="WebSocket"
                value={connected ? "connected" : "offline"}
                icon={connected ? <Wifi size={16} /> : <WifiOff size={16} />}
              />
              <Metric
                label="Game state"
                value={current?.gameState ?? "loading"}
              />
              <Metric label="FPS" value={fps.toFixed(0)} />
              <Metric label="Pose confidence" value={confidence.toFixed(2)} />
            </DebugCard>

            <DebugCard title="Calibration">
              <Metric label="Status" value={calibration.status} />
              <Metric
                label="Progress"
                value={`${Math.round(calibration.progress * 100)}%`}
              />
              <Metric label="Samples" value={String(calibration.sampleCount)} />
              <Metric
                label="Body scale"
                value={calibration.profile?.bodyScale.toFixed(3) ?? "-"}
              />
            </DebugCard>

            <DebugCard title="Motion">
              <Metric
                label="Running intensity"
                value={motion.runningIntensity.toFixed(2)}
              />
              <Metric
                label="Player speed"
                value={motion.playerSpeed.toFixed(2)}
              />
              <Metric label="Running" value={motion.isRunning ? "yes" : "no"} />
              <Metric label="Lane" value={motion.lane} />
              <Metric
                label="Jump"
                value={motion.jumpDetected ? "detected" : "idle"}
              />
              <Metric label="67 count" value={String(motion.sixtySevenCount)} />
            </DebugCard>

            <DebugCard title="Backend Game">
              <Metric
                label="Stamina"
                value={current ? `${current.stamina}/100` : "-"}
              />
              <Metric
                label="Zombie distance"
                value={current?.zombieDistance.toFixed(1) ?? "-"}
              />
              <Metric
                label="Survival time"
                value={current ? `${current.survivalTime.toFixed(1)}s` : "-"}
              />
              <Metric label="Combo" value={String(current?.comboCount ?? 0)} />
              <Metric
                label="Obstacle"
                value={current?.currentObstacle?.type ?? "none"}
              />
              <Metric
                label="Score"
                value={String(Math.round(current?.score ?? 0))}
              />
            </DebugCard>

            {boostMessage ? (
              <div className="rounded border border-lime-400 bg-lime-400 px-3 py-2 text-center font-bold text-neutral-950">
                {boostMessage}
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function DebugCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-900 p-3">
      <h2 className="mb-2 text-sm font-semibold uppercase text-neutral-400">
        {title}
      </h2>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 rounded bg-neutral-950 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-neutral-400">
        {icon}
        {label}
      </span>
      <span className="font-mono text-neutral-100">{value}</span>
    </div>
  );
}
