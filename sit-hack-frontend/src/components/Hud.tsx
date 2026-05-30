import { Footprints, Pause, Play, Zap } from 'lucide-react';
import type { PublicGameState } from '../motion/motionTypes';

interface HudProps {
  state: PublicGameState;
  running: boolean;
  paused: boolean;
  onPauseToggle: () => void;
}

export function Hud({ state, running, paused, onPauseToggle }: HudProps) {
  const distancePct = Math.max(0, Math.min(100, state.zombieDistance));
  const distanceColor = distancePct > 55 ? '#84cc16' : distancePct > 28 ? '#facc15' : '#ef4444';

  return (
    <>
      {/* Top stats bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="flex flex-col gap-2 rounded-xl bg-neutral-950/70 px-4 py-3 backdrop-blur">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tabular-nums text-lime-300">{Math.round(state.score)}</span>
            <span className="text-xs uppercase tracking-widest text-neutral-500">score</span>
          </div>
          <div className="flex gap-4 text-xs text-neutral-400">
            <span>⏱ {state.survivalTime.toFixed(1)}s</span>
            <span className="text-neutral-300">Speed x{state.speedMultiplier.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {state.comboCount > 0 ? (
            <div className="flex items-center gap-1 rounded-xl bg-pink-500/20 px-3 py-2 text-pink-300">
              <Zap size={16} />
              <span className="font-bold tabular-nums">x{state.comboCount}</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onPauseToggle}
            className="grid h-11 w-11 place-items-center rounded-xl bg-neutral-950/70 text-neutral-200 backdrop-blur hover:bg-neutral-800"
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>
        </div>
      </div>

      {/* Bottom meters */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4">
        <Meter
          label="Zombie distance"
          icon={<span>🧟</span>}
          value={distancePct}
          color={distanceColor}
          valueLabel={`${distancePct.toFixed(0)}m`}
        />
        <Meter
          label="Stamina"
          icon={<Footprints size={14} />}
          value={state.stamina}
          color="#38bdf8"
          valueLabel={`${Math.round(state.stamina)}`}
        />
        {running ? (
          <p className="text-center text-xs uppercase tracking-[0.3em] text-neutral-500">
            Keep running in place
          </p>
        ) : null}
      </div>
    </>
  );
}

function Meter({
  label,
  icon,
  value,
  color,
  valueLabel,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  color: string;
  valueLabel: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex w-36 items-center gap-2 text-xs uppercase tracking-widest text-neutral-400">
        {icon}
        {label}
      </span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-800/80">
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-12 text-right font-mono text-xs text-neutral-300">{valueLabel}</span>
    </div>
  );
}
