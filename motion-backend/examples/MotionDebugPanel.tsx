import { useMotionSocket } from "./useMotionSocket";

export function MotionDebugPanel() {
  const { motion, connected } = useMotionSocket();

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-white">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Motion</h2>
        <span className={connected ? "text-emerald-400" : "text-red-400"}>
          {connected ? "connected" : "offline"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>Speed</div>
        <div className="text-right font-mono">{motion.speed.toFixed(2)}</div>
        <div>Running</div>
        <div className="text-right font-mono">{String(motion.isRunning)}</div>
        <div>Jump</div>
        <div className="text-right font-mono">{String(motion.jump)}</div>
        <div>Lane</div>
        <div className="text-right font-mono">{motion.lane}</div>
        <div>67 reps</div>
        <div className="text-right font-mono">{motion.sixtySevenCount}</div>
        <div>Confidence</div>
        <div className="text-right font-mono">{motion.confidence.toFixed(2)}</div>
      </div>
    </div>
  );
}
