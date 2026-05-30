import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import type {
  VersusPublicPlayer,
  VersusPublicState,
  VersusRole,
} from "../motion/motionTypes";

const ZOMBIE_FONT = "Zombie";

function roleLabel(role: VersusRole) {
  return role === "ZOMBIE" ? "🧟 Zombie" : "🏃 Human";
}

// ---------------------------------------------------------------------------
// Lobby — create or join a match by code.
// ---------------------------------------------------------------------------
export function VersusLobby({
  connected,
  error,
  onCreate,
  onJoin,
  onBack,
}: {
  connected: boolean;
  error: string | null;
  onCreate: (name: string, role: VersusRole) => void;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<VersusRole>("HUMAN");
  const [code, setCode] = useState("");

  const safeName = name.trim() || "Player";

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden px-4 py-12 text-neutral-100"
      style={{
        backgroundImage: "url('/bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-neutral-950/70" />

      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-4 z-30 rounded-lg border border-neutral-700 px-4 py-2 text-xs uppercase tracking-widest text-neutral-300 hover:border-neutral-500"
      >
        ← Back
      </button>

      <h1
        className="zombie-title relative z-10 text-center text-[64px] leading-none sm:text-[88px]"
        style={{ fontFamily: ZOMBIE_FONT }}
      >
        2-PLAYER VERSUS
      </h1>
      <p className="relative z-10 -mt-4 max-w-md text-center text-sm text-neutral-300">
        One zombie, one human — both run in place. Run faster and miss fewer
        obstacles than your rival to win.
      </p>

      <div className="relative z-10 grid w-full max-w-3xl gap-6 md:grid-cols-2">
        {/* Create */}
        <Panel title="Host a match">
          <label className="text-xs uppercase tracking-widest text-neutral-400">
            Your name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player"
            maxLength={20}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-neutral-100 outline-none focus:border-[#17b978]"
          />
          <label className="mt-2 text-xs uppercase tracking-widest text-neutral-400">
            Play as
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(["HUMAN", "ZOMBIE"] as VersusRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-lg border-2 px-3 py-2 text-sm font-bold uppercase tracking-widest transition ${
                  role === r
                    ? "border-[#a7ff83] bg-[#17b978]/20 text-[#a7ff83]"
                    : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                }`}
              >
                {roleLabel(r)}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!connected}
            onClick={() => onCreate(safeName, role)}
            className="mt-2 rounded-xl bg-[#17b978] px-6 py-3 font-bold uppercase tracking-widest text-[#04201f] transition hover:bg-[#a7ff83] disabled:opacity-40"
          >
            {connected ? "Create match" : "Connecting…"}
          </button>
        </Panel>

        {/* Join */}
        <Panel title="Join a match">
          <label className="text-xs uppercase tracking-widest text-neutral-400">
            Your name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Player"
            maxLength={20}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-neutral-100 outline-none focus:border-[#17b978]"
          />
          <label className="mt-2 text-xs uppercase tracking-widest text-neutral-400">
            Match code
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD"
            maxLength={4}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-2 text-center text-2xl font-black tracking-[0.5em] text-neutral-100 outline-none focus:border-[#17b978]"
          />
          <button
            type="button"
            disabled={!connected || code.trim().length < 4}
            onClick={() => onJoin(code.trim(), safeName)}
            className="mt-2 rounded-xl border-2 border-[#17b978] px-6 py-3 font-bold uppercase tracking-widest text-[#a7ff83] transition hover:bg-[#17b978]/20 disabled:opacity-40"
          >
            Join match
          </button>
        </Panel>
      </div>

      {error ? (
        <p className="relative z-10 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-[#17b978]/40 bg-[#04201f]/90 p-6 shadow-[0_0_40px_-12px_rgba(23,185,120,0.6)]">
      <h2
        className="mb-1 text-2xl"
        style={{ fontFamily: ZOMBIE_FONT, color: "#a7ff83" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Waiting room — match created/joined, waiting for the other player / ready.
// ---------------------------------------------------------------------------
export function VersusWaiting({
  state,
  myRole,
  cameraOn,
  confidence,
  cameraError,
  onCalibrate,
  onLeave,
}: {
  state: VersusPublicState;
  myRole: VersusRole;
  cameraOn: boolean;
  confidence: number;
  cameraError: string | null;
  onCalibrate: () => void;
  onLeave: () => void;
}) {
  const players = Object.values(state.players);
  const bothPresent = players.length === 2;
  const me = state.players[myRole];
  const opponent = state.players[myRole === "HUMAN" ? "ZOMBIE" : "HUMAN"];

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-neutral-950/85 px-6 text-center backdrop-blur">
      <div className="flex w-full max-w-lg flex-col items-center gap-5">
        <button
          type="button"
          onClick={onLeave}
          className="absolute left-4 top-4 rounded-lg border border-neutral-700 px-4 py-2 text-xs uppercase tracking-widest text-neutral-300 hover:border-neutral-500"
        >
          ← Leave
        </button>

        <div className="text-xs uppercase tracking-[0.4em] text-neutral-400">
          Match code
        </div>
        <div
          className="rounded-2xl border-2 border-[#17b978] bg-[#04201f] px-8 py-4 text-6xl font-black tracking-[0.4em] text-[#a7ff83]"
          style={{ fontFamily: ZOMBIE_FONT }}
        >
          {state.code}
        </div>
        <p className="text-sm text-neutral-400">
          You are{" "}
          <span className="font-bold text-[#a7ff83]">{roleLabel(myRole)}</span>
        </p>

        <div className="grid w-full grid-cols-2 gap-3">
          <PlayerSlot label="You" player={me} />
          <PlayerSlot label="Opponent" player={opponent} />
        </div>

        {!bothPresent ? (
          <p className="text-sm text-neutral-300">
            Share the code above. Waiting for an opponent to join…
          </p>
        ) : me?.ready ? (
          <p className="text-sm text-[#a7ff83]">
            You're ready. Waiting for your opponent to calibrate…
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {cameraError ? (
              <p className="text-sm text-red-400">{cameraError}</p>
            ) : (
              <p className="text-sm text-neutral-300">
                Step back so your{" "}
                <span className="text-[#0fa067]">whole body</span> is visible,
                then calibrate.
              </p>
            )}
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-500">
              <span
                className={`h-2 w-2 rounded-full ${
                  cameraOn ? "bg-[#0fa067]" : "bg-yellow-400 animate-pulse"
                }`}
              />
              {cameraOn
                ? `Pose confidence ${(confidence * 100).toFixed(0)}%`
                : "Starting camera…"}
            </div>
            <button
              type="button"
              onClick={onCalibrate}
              disabled={!cameraOn}
              className="rounded-xl bg-[#98d47b] px-6 py-3 font-bold uppercase tracking-widest text-neutral-950 transition hover:bg-[#a8e48b] disabled:opacity-40"
            >
              Calibrate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerSlot({
  label,
  player,
}: {
  label: string;
  player: VersusPublicPlayer | undefined;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">
        {label}
      </div>
      {player ? (
        <>
          <div className="truncate text-lg font-bold text-neutral-100">
            {player.name}
          </div>
          <div className="text-xs text-neutral-400">{roleLabel(player.role)}</div>
          <div
            className={`mt-1 text-xs font-bold uppercase tracking-widest ${
              player.ready ? "text-[#a7ff83]" : "text-yellow-400"
            }`}
          >
            {player.ready ? "Ready" : "Calibrating…"}
          </div>
        </>
      ) : (
        <div className="py-2 text-sm text-neutral-600">— empty —</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// In-game HUD — gap meter, escape timer, both players' live stats.
// ---------------------------------------------------------------------------
export function VersusHud({
  state,
  myRole,
}: {
  state: VersusPublicState;
  myRole: VersusRole;
}) {
  const gapPct = Math.max(0, Math.min(100, (state.gap / state.maxGap) * 100));
  const gapColor = gapPct > 55 ? "#84cc16" : gapPct > 28 ? "#facc15" : "#ef4444";
  const remaining = Math.max(0, state.escapeTime - state.elapsed);
  const human = state.players.HUMAN;
  const zombie = state.players.ZOMBIE;

  return (
    <>
      {/* Escape timer */}
      <div className="absolute inset-x-0 top-0 flex justify-center p-4">
        <div className="flex flex-col items-center rounded-xl bg-neutral-950/70 px-6 py-2 backdrop-blur">
          <span className="text-3xl font-black tabular-nums text-lime-300">
            {remaining.toFixed(1)}s
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-neutral-500">
            until human escapes
          </span>
        </div>
      </div>

      {/* Player stat cards */}
      <div className="absolute left-4 top-20 flex flex-col gap-2">
        <StatCard player={zombie} you={myRole === "ZOMBIE"} />
      </div>
      <div className="absolute right-4 top-20 flex flex-col items-end gap-2">
        <StatCard player={human} you={myRole === "HUMAN"} alignRight />
      </div>

      {/* Gap meter */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧟</span>
          <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-neutral-800/80">
            <div
              className="h-full rounded-full transition-[width] duration-150 ease-out"
              style={{ width: `${gapPct}%`, backgroundColor: gapColor }}
            />
          </div>
          <span className="text-2xl">🏁</span>
        </div>
        <p className="text-center text-xs uppercase tracking-[0.3em] text-neutral-500">
          {myRole === "ZOMBIE"
            ? "Close the gap to catch your prey"
            : "Keep the gap open to escape"}
        </p>
      </div>
    </>
  );
}

function StatCard({
  player,
  you,
  alignRight,
}: {
  player: VersusPublicPlayer | undefined;
  you: boolean;
  alignRight?: boolean;
}) {
  if (!player) return null;
  const speedPct = Math.max(0, Math.min(100, player.speed * 100));
  return (
    <div
      className={`min-w-[10rem] rounded-xl border bg-neutral-950/70 px-3 py-2 backdrop-blur ${
        you ? "border-[#a7ff83]" : "border-neutral-700"
      } ${alignRight ? "text-right" : ""}`}
    >
      <div className="flex items-center gap-1 text-sm font-bold text-neutral-100">
        {alignRight ? null : <span>{roleLabel(player.role).split(" ")[0]}</span>}
        <span className="truncate">{player.name}</span>
        {alignRight ? <span>{roleLabel(player.role).split(" ")[0]}</span> : null}
        {you ? (
          <span className="rounded bg-[#17b978] px-1 text-[9px] font-black text-[#04201f]">
            YOU
          </span>
        ) : null}
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-sky-400 transition-[width] duration-150"
          style={{ width: `${speedPct}%` }}
        />
      </div>
      <div
        className={`mt-1 flex gap-3 text-[11px] text-neutral-400 ${
          alignRight ? "justify-end" : ""
        }`}
      >
        <span className="text-[#a7ff83]">✓ {player.hits}</span>
        <span className="text-red-400">✗ {player.misses}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result overlay.
// ---------------------------------------------------------------------------
export function VersusResult({
  state,
  myRole,
  onRematch,
  onLeave,
}: {
  state: VersusPublicState;
  myRole: VersusRole;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const won = state.winner === myRole;
  const human = state.players.HUMAN;
  const zombie = state.players.ZOMBIE;

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-neutral-950/85 px-6 text-center backdrop-blur">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex w-full max-w-md flex-col items-center gap-5"
      >
        <span className="text-7xl">{won ? "🏆" : "💀"}</span>
        <h2
          className="text-5xl font-black uppercase tracking-widest"
          style={{ color: won ? "#a7ff83" : "#ef4444" }}
        >
          {won ? "You win!" : "You lose"}
        </h2>
        <p className="text-sm text-neutral-300">{state.endReason}</p>

        <div className="grid w-full grid-cols-2 gap-3">
          <ResultStat
            label={`🏃 ${human?.name ?? "Human"}`}
            value={`✓${human?.hits ?? 0} ✗${human?.misses ?? 0}`}
            highlight={state.winner === "HUMAN"}
          />
          <ResultStat
            label={`🧟 ${zombie?.name ?? "Zombie"}`}
            value={`✓${zombie?.hits ?? 0} ✗${zombie?.misses ?? 0}`}
            highlight={state.winner === "ZOMBIE"}
          />
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onRematch}
            className="flex-1 rounded-xl bg-lime-400 px-6 py-3 font-bold uppercase tracking-widest text-neutral-950 transition hover:bg-lime-300"
          >
            Rematch
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="flex-1 rounded-xl border border-neutral-700 px-6 py-3 font-bold uppercase tracking-widest text-neutral-300 transition hover:border-neutral-500"
          >
            Leave
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ResultStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        highlight
          ? "border-[#a7ff83] bg-[#17b978]/15"
          : "border-neutral-800 bg-neutral-900/70"
      }`}
    >
      <div className="truncate text-sm font-bold text-neutral-100">{label}</div>
      <div className="font-mono text-xs text-neutral-400">{value}</div>
      {highlight ? (
        <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-[#a7ff83]">
          Winner
        </div>
      ) : null}
    </div>
  );
}
