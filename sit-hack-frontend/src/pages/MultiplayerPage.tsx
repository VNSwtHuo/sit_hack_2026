import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Copy, LogOut, Play, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  beginCalibration,
  createCalibrationState,
  updateCalibration,
  type CalibrationSample,
} from "../motion/calibration";
import type {
  CalibrationState,
  MultiplayerPlayer,
  MultiplayerRole,
  Obstacle,
  PublicMultiplayerRoom,
} from "../motion/motionTypes";
import { ZombieLayer } from "../components/ZombieLayer";
import { ObstaclePrompt } from "../components/ObstaclePrompt";
import { loadCustomizations } from "../game/customizations";
import { useMotionDetection } from "../motion/useMotionDetection";
import { useMultiplayerRoom } from "../motion/useMultiplayerRoom";
import { usePoseTracker } from "../motion/usePoseTracker";

const MOTION_SEND_INTERVAL_MS = 66;
const DEFAULT_DURATION_SECONDS = 60;

export function MultiplayerPage() {
  const {
    socketId,
    connected,
    room,
    error,
    createRoom,
    joinRoom,
    setDuration,
    setReady,
    startRoom,
    sendMotion,
    leaveRoom,
  } = useMultiplayerRoom();
  const {
    videoRef,
    canvasRef,
    landmarks,
    confidence,
    isRunning: cameraOn,
    error: cameraError,
    start,
  } = usePoseTracker();

  const [playerName, setPlayerName] = useState("Runner");
  const [joinCode, setJoinCode] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(
    DEFAULT_DURATION_SECONDS,
  );
  const [calibration, setCalibration] = useState<CalibrationState>(() =>
    createCalibrationState(),
  );
  const [now, setNow] = useState(() => Date.now());
  const calibrationSamplesRef = useRef<CalibrationSample[]>([]);
  const lastMotionSentRef = useRef(0);
  const clockOffsetRef = useRef(0);
  const customizations = useMemo(() => loadCustomizations(), []);

  const phase = room?.phase;
  const self = room?.players.find((player) => player.socketId === socketId);
  const opponent = room?.players.find((player) => player.socketId !== socketId);
  const isHost = Boolean(self?.isHost);
  const role = self?.role ?? null;
  const bothReady =
    room?.players.length === 2 && room.players.every((player) => player.ready);
  const activeObstacle = self?.obstacleResolved
    ? null
    : (room?.currentObstacle ?? null);

  const motion = useMotionDetection(
    landmarks,
    calibration.profile,
    activeObstacle,
  );

  // Correct for clock differences between the two laptops.
  useEffect(() => {
    if (room?.serverNow) {
      clockOffsetRef.current = room.serverNow - Date.now();
    }
  }, [room?.serverNow]);
  const serverNow = now + clockOffsetRef.current;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  // Reset local calibration whenever we drop back out of a room.
  useEffect(() => {
    if (!room) {
      setCalibration(createCalibrationState());
    }
  }, [room]);

  useEffect(() => {
    if (calibration.status !== "collecting") {
      return;
    }
    setCalibration((current) =>
      updateCalibration(current, calibrationSamplesRef.current, landmarks),
    );
  }, [landmarks, calibration.status]);

  useEffect(() => {
    if (calibration.status !== "complete") {
      return;
    }
    setReady(Boolean(calibration.profile));
  }, [calibration.status, calibration.profile, setReady]);

  useEffect(() => {
    const sentAt = Date.now();
    if (
      phase !== "RUNNING" ||
      !calibration.profile ||
      sentAt - lastMotionSentRef.current < MOTION_SEND_INTERVAL_MS
    ) {
      return;
    }
    lastMotionSentRef.current = sentAt;
    sendMotion(motion);
  }, [phase, calibration.profile, motion, sendMotion]);

  const startCalibration = useCallback(() => {
    void start();
    calibrationSamplesRef.current = [];
    setCalibration(beginCalibration());
    setReady(false);
  }, [start, setReady]);

  const handleCreate = useCallback(() => {
    createRoom({ playerName, durationSeconds });
    void start();
  }, [createRoom, playerName, durationSeconds, start]);

  const handleJoin = useCallback(() => {
    joinRoom({ roomCode: joinCode, playerName });
    void start();
  }, [joinRoom, joinCode, playerName, start]);

  const handleDurationChange = (next: number) => {
    const clamped = Math.min(300, Math.max(30, next));
    setDurationSeconds(clamped);
    if (isHost) {
      setDuration(clamped);
    }
  };

  const remainingSeconds =
    room?.endsAt && phase === "RUNNING"
      ? Math.max(0, Math.ceil((room.endsAt - serverNow) / 1000))
      : (room?.durationSeconds ?? durationSeconds);
  const revealRemaining = room?.roleRevealEndsAt
    ? Math.max(0, room.roleRevealEndsAt - serverNow)
    : 0;

  return (
    <main className="relative min-h-screen bg-neutral-950 text-neutral-100">
      {/* Always-mounted camera feed so MediaPipe keeps streaming across screens. */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {!room ? (
        <LobbySetup
          playerName={playerName}
          joinCode={joinCode}
          durationSeconds={durationSeconds}
          connected={connected}
          error={error}
          onPlayerNameChange={setPlayerName}
          onJoinCodeChange={setJoinCode}
          onDurationChange={handleDurationChange}
          onCreate={handleCreate}
          onJoin={handleJoin}
        />
      ) : phase === "LOBBY" ? (
        <CalibrationLobby
          roomCode={room.code}
          players={room.players}
          self={self}
          isHost={isHost}
          bothReady={Boolean(bothReady)}
          durationSeconds={room.durationSeconds}
          calibration={calibration}
          cameraOn={cameraOn}
          confidence={confidence}
          cameraError={cameraError}
          error={error}
          onCalibrate={startCalibration}
          onDurationChange={handleDurationChange}
          onStart={startRoom}
          onLeave={leaveRoom}
        />
      ) : (
        <GameStage
          canvasRef={canvasRef}
          room={room}
          self={self}
          opponent={opponent}
          role={role}
          serverNow={serverNow}
          remainingSeconds={remainingSeconds}
          revealRemaining={revealRemaining}
          obstacle={activeObstacle}
          selfSpeed={motion.playerSpeed}
          customizations={customizations}
          onLeave={leaveRoom}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Lobby setup (create / join)
// ---------------------------------------------------------------------------

function LobbyBackground({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage: "url('/bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-neutral-950/72" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6">
        {children}
      </div>
    </div>
  );
}

function LobbySetup({
  playerName,
  joinCode,
  durationSeconds,
  connected,
  error,
  onPlayerNameChange,
  onJoinCodeChange,
  onDurationChange,
  onCreate,
  onJoin,
}: {
  playerName: string;
  joinCode: string;
  durationSeconds: number;
  connected: boolean;
  error: string | null;
  onPlayerNameChange: (value: string) => void;
  onJoinCodeChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onCreate: () => void;
  onJoin: () => void;
}) {
  return (
    <LobbyBackground>
      <Link
        to="/"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#17b978]/40 bg-[#083339]/80 text-[#a7ff83] transition hover:border-[#17b978]"
        title="Back"
      >
        <ArrowLeft size={18} />
      </Link>

      {/* Title centered above the two blocks */}
      <div className="mt-6 mb-8 text-center">
        <h1 className="font-zombie text-5xl sm:text-6xl">Two Players</h1>
        <p className="mt-2 text-sm uppercase tracking-[0.3em] text-neutral-300">
          {connected ? "LAN lobby online" : "Connecting…"}
        </p>
      </div>

      {/* Host + Join blocks, equal size, side by side */}
      <div className="grid gap-5 md:grid-cols-2">
        <section className="flex h-full flex-col rounded-xl border border-[#17b978]/40 bg-[#04201f]/85 p-6 shadow-[0_0_40px_-12px_rgba(23,185,120,0.7)]">
          <div className="mb-5 flex items-center gap-3">
            <Users className="text-[#a7ff83]" />
            <h2 className="text-lg font-black uppercase tracking-widest">
              Host room
            </h2>
          </div>
          <div className="grid gap-3">
            <Field label="Player name">
              <input
                value={playerName}
                onChange={(event) => onPlayerNameChange(event.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-base text-neutral-100 outline-none focus:border-[#17b978]"
              />
            </Field>
            <Field label="Timer (seconds)">
              <input
                type="number"
                min={30}
                max={300}
                step={15}
                value={durationSeconds}
                onChange={(event) =>
                  onDurationChange(Number(event.target.value))
                }
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-base text-neutral-100 outline-none focus:border-[#17b978]"
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={onCreate}
            disabled={!connected}
            className="mt-5 w-full rounded-lg bg-[#17b978] px-5 py-3 font-black uppercase tracking-widest text-[#04201f] transition hover:bg-[#a7ff83] disabled:opacity-40"
          >
            Create room
          </button>
        </section>

        <section className="flex h-full flex-col rounded-xl border border-orange-300/40 bg-[#04201f]/85 p-6 shadow-[0_0_40px_-12px_rgba(251,146,60,0.6)]">
          <div className="mb-5 flex items-center gap-3">
            <Copy className="text-orange-300" />
            <h2 className="text-lg font-black uppercase tracking-widest">
              Join room
            </h2>
          </div>
          <div className="grid gap-3">
            <Field label="Player name">
              <input
                value={playerName}
                onChange={(event) => onPlayerNameChange(event.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-base text-neutral-100 outline-none focus:border-orange-300"
              />
            </Field>
            <Field label="Room code">
              <input
                value={joinCode}
                onChange={(event) =>
                  onJoinCodeChange(event.target.value.toUpperCase())
                }
                maxLength={4}
                placeholder="XXXX"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-base text-neutral-100 outline-none focus:border-[#17b978]"
              />
            </Field>
          </div>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          <button
            type="button"
            onClick={onJoin}
            disabled={!connected || joinCode.trim().length < 4}
            className="mt-5 w-full rounded-lg bg-orange-300 px-5 py-3 font-black uppercase tracking-widest text-neutral-950 transition hover:bg-orange-200 disabled:opacity-40"
          >
            Join room
          </button>
        </section>
      </div>
    </LobbyBackground>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Calibration lobby (after a room exists) — centered, no side camera region
// ---------------------------------------------------------------------------

function CalibrationLobby({
  roomCode,
  players,
  self,
  isHost,
  bothReady,
  durationSeconds,
  calibration,
  cameraOn,
  confidence,
  cameraError,
  error,
  onCalibrate,
  onDurationChange,
  onStart,
  onLeave,
}: {
  roomCode: string;
  players: MultiplayerPlayer[];
  self: MultiplayerPlayer | undefined;
  isHost: boolean;
  bothReady: boolean;
  durationSeconds: number;
  calibration: CalibrationState;
  cameraOn: boolean;
  confidence: number;
  cameraError: string | null;
  error: string | null;
  onCalibrate: () => void;
  onDurationChange: (value: number) => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  const calibrating = calibration.status === "collecting";
  const inFrame = cameraOn && confidence > 0.4;

  return (
    <LobbyBackground>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="w-full max-w-xl rounded-2xl border border-[#17b978]/40 bg-[#082523]/90 p-6 shadow-[0_0_50px_-12px_rgba(23,185,120,0.7)]">
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">
              Room code
            </div>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(roomCode)}
              className="mx-auto mt-2 inline-flex items-center gap-3 rounded-lg border border-[#17b978]/40 bg-neutral-950/70 px-5 py-2"
              title="Copy code"
            >
              <span className="font-mono text-4xl font-black tracking-[0.3em] text-[#a7ff83]">
                {roomCode}
              </span>
              <Copy size={18} className="text-[#17b978]" />
            </button>
            <p className="mt-2 text-xs uppercase tracking-widest text-neutral-500">
              Share this code with the other player
            </p>
          </div>

          {/* Both players' calibration status */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[0, 1].map((slot) => {
              const player = players[slot];
              return (
                <PlayerSlot
                  key={player?.socketId ?? slot}
                  player={player}
                  isSelf={player?.socketId === self?.socketId}
                />
              );
            })}
          </div>

          {isHost ? (
            <div className="mt-5">
              <Field label="Timer (seconds)">
                <input
                  type="number"
                  min={30}
                  max={300}
                  step={15}
                  value={durationSeconds}
                  onChange={(event) =>
                    onDurationChange(Number(event.target.value))
                  }
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-base text-neutral-100 outline-none focus:border-[#17b978]"
                />
              </Field>
            </div>
          ) : null}

          {/* Calibrate */}
          <button
            type="button"
            onClick={onCalibrate}
            className="mt-5 w-full rounded-lg border border-[#17b978]/50 px-4 py-3 font-black uppercase tracking-widest text-[#a7ff83] transition hover:border-[#17b978]"
          >
            {calibrating
              ? `Calibrating ${Math.round(calibration.progress * 100)}%`
              : self?.ready
                ? "Recalibrate"
                : "Calibrate"}
          </button>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs uppercase tracking-widest text-neutral-500">
            <span
              className={`h-2 w-2 rounded-full ${
                inFrame ? "bg-[#17b978]" : "bg-yellow-400 animate-pulse"
              }`}
            />
            {cameraError
              ? cameraError
              : cameraOn
                ? `In frame ${Math.round(confidence * 100)}%`
                : "Camera starting…"}
          </div>

          {error ? (
            <p className="mt-3 text-center text-sm text-red-300">{error}</p>
          ) : null}

          {/* Host start button — only when both players are ready */}
          {isHost ? (
            <button
              type="button"
              onClick={onStart}
              disabled={!bothReady}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#98d57b] px-5 py-3 font-black uppercase tracking-widest text-[#04201f] transition hover:bg-[#a7ff83] disabled:opacity-40"
            >
              <Play size={18} />
              {bothReady ? "Start game" : "Waiting for both players"}
            </button>
          ) : (
            <p className="mt-5 text-center text-sm uppercase tracking-widest text-neutral-400">
              {bothReady ? "Waiting for host to start…" : "Get ready to start"}
            </p>
          )}

          <button
            type="button"
            onClick={onLeave}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-700 px-5 py-3 font-bold uppercase tracking-widest text-neutral-300 transition hover:border-neutral-500"
          >
            <LogOut size={18} />
            Leave room
          </button>
        </div>
      </div>
    </LobbyBackground>
  );
}

function PlayerSlot({
  player,
  isSelf,
}: {
  player: MultiplayerPlayer | undefined;
  isSelf: boolean;
}) {
  if (!player) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed border-neutral-700 bg-neutral-950/40 px-4 py-4 text-neutral-500">
        <span className="text-sm uppercase tracking-widest">
          Waiting for player…
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-4 py-4">
      <div>
        <div className="font-bold">
          {player.name}
          {isSelf ? (
            <span className="ml-2 text-xs uppercase tracking-widest text-[#a7ff83]">
              you
            </span>
          ) : null}
        </div>
        <div className="text-xs uppercase tracking-widest text-neutral-500">
          {player.isHost ? "Host" : "Guest"}
        </div>
      </div>
      <span
        className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest ${
          player.ready
            ? "bg-[#17b978] text-[#04201f]"
            : "bg-neutral-800 text-neutral-400"
        }`}
      >
        {player.ready ? "Ready" : "Not ready"}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// In-game stage (role reveal + running + finished)
// ---------------------------------------------------------------------------

function GameStage({
  canvasRef,
  room,
  self,
  opponent,
  role,
  serverNow,
  remainingSeconds,
  revealRemaining,
  obstacle,
  selfSpeed,
  customizations,
  onLeave,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  room: PublicMultiplayerRoom;
  self: MultiplayerPlayer | undefined;
  opponent: MultiplayerPlayer | undefined;
  role: MultiplayerRole | null;
  serverNow: number;
  remainingSeconds: number;
  revealRemaining: number;
  obstacle: Obstacle | null;
  selfSpeed: number;
  customizations: { zombieFace: string | null; headAvatar: string | null };
  onLeave: () => void;
}) {
  const phase = room.phase;
  const isSurvivor = role === "survivor";
  const gapPct = Math.max(0, Math.min(100, (room.gap / room.maxGap) * 100));
  const boostActive = Boolean(self?.boostUntil && self.boostUntil > serverNow);
  const penaltyActive = Boolean(
    self?.obstaclePenaltyUntil && self.obstaclePenaltyUntil > serverNow,
  );
  const youWon = self?.socketId === room.winnerSocketId;
  const distanceColor =
    gapPct > 55 ? "#84cc16" : gapPct > 28 ? "#facc15" : "#ef4444";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Player's own mirrored webcam */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${
          phase === "RUNNING" ? "opacity-100" : "opacity-40"
        }`}
      />

      {/* Survivor sees the chasing horde (with their customizations). The
          zombie sees no horde — they ARE the zombie. */}
      {phase === "RUNNING" && isSurvivor ? (
        <ZombieLayer
          zombieDistance={gapPct}
          boostActive={boostActive}
          zombieFace={customizations.zombieFace}
          headAvatar={customizations.headAvatar}
        />
      ) : null}

      {/* Obstacle prompt */}
      {phase === "RUNNING" ? (
        <div className="pointer-events-none absolute inset-x-0 top-1/4 z-10 flex justify-center">
          <ObstaclePrompt obstacle={obstacle} now={serverNow} />
        </div>
      ) : null}

      {/* Brain-rot boost flash */}
      <AnimatePresence>
        {phase === "RUNNING" && boostActive ? (
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.6, opacity: 0 }}
            className="pointer-events-none absolute left-1/2 top-1/3 z-30 -translate-x-1/2 rounded-2xl border-4 border-pink-400 bg-pink-500/30 px-8 py-4 text-center backdrop-blur"
          >
            <div className="text-4xl">🧠🔥</div>
            <div className="text-2xl font-black uppercase tracking-widest text-pink-200">
              Brain Rot Boost
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* HUD */}
      {phase === "RUNNING" ? (
        <>
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
            <div className="rounded-xl bg-neutral-950/70 px-4 py-3 backdrop-blur">
              <div className="text-[0.65rem] font-black uppercase tracking-widest text-neutral-500">
                You are
              </div>
              <div
                className={`mt-1 text-3xl font-black uppercase ${
                  isSurvivor ? "text-[#a7ff83]" : "text-red-400"
                }`}
              >
                {isSurvivor ? "Survivor" : "Zombie 🧟"}
              </div>
              <div className="mt-1 text-xs uppercase tracking-widest text-neutral-400">
                vs {opponent?.name ?? "opponent"}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <div className="rounded-xl bg-neutral-950/70 px-4 py-3 text-right backdrop-blur">
                <div className="text-[0.65rem] font-black uppercase tracking-widest text-neutral-500">
                  Time left
                </div>
                <div className="mt-1 font-mono text-4xl font-black text-orange-200">
                  {remainingSeconds}s
                </div>
              </div>
              <button
                type="button"
                onClick={onLeave}
                className="grid h-11 w-11 place-items-center rounded-xl bg-neutral-950/70 text-neutral-200 backdrop-blur hover:bg-neutral-800"
                title="Leave"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-4">
            <div className="flex items-center gap-3">
              <span className="flex w-40 items-center gap-2 text-xs uppercase tracking-widest text-neutral-400">
                <span>🧟</span>
                {isSurvivor ? "Zombie distance" : "Distance to prey"}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-neutral-800/80">
                <div
                  className="h-full rounded-full transition-[width] duration-200 ease-out"
                  style={{
                    width: `${gapPct}%`,
                    backgroundColor: distanceColor,
                  }}
                />
              </div>
              <span className="w-12 text-right font-mono text-xs text-neutral-300">
                {gapPct.toFixed(0)}m
              </span>
            </div>
            {penaltyActive ? (
              <p className="text-center text-xs font-black uppercase tracking-[0.3em] text-red-300">
                Missed obstacle!
              </p>
            ) : (
              <p className="text-center text-xs uppercase tracking-[0.3em] text-neutral-500">
                {isSurvivor ? "Run to stay ahead" : "Run to catch the survivor"}{" "}
                · speed {selfSpeed.toFixed(2)}
              </p>
            )}
          </div>
        </>
      ) : null}

      {/* Role reveal */}
      <AnimatePresence>
        {phase === "ROLE_REVEAL" ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 grid place-items-center bg-neutral-950/80 px-6 text-center backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="text-xs font-black uppercase tracking-[0.4em] text-neutral-400">
                Your role
              </div>
              <div className="text-8xl">{isSurvivor ? "🏃" : "🧟"}</div>
              <div
                className={`font-zombie text-7xl ${
                  isSurvivor ? "text-[#a7ff83]" : "text-red-400"
                }`}
              >
                {isSurvivor ? "Survivor" : "Zombie"}
              </div>
              <p className="max-w-sm text-sm uppercase tracking-widest text-neutral-300">
                {isSurvivor
                  ? "Outrun the zombie until the timer ends"
                  : "Catch the survivor before time runs out"}
              </p>
              <div className="font-mono text-2xl font-black text-neutral-500">
                {(revealRemaining / 1000).toFixed(1)}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Finished */}
      {phase === "FINISHED" ? (
        <div className="absolute inset-0 z-30 grid place-items-center bg-neutral-950/80 px-6 text-center backdrop-blur-sm">
          <div className="flex max-w-lg flex-col items-center gap-4">
            <div className="text-7xl">{youWon ? "🏆" : "💀"}</div>
            <div
              className={`font-zombie text-7xl ${
                youWon ? "text-[#a7ff83]" : "text-red-500"
              }`}
            >
              {youWon ? "You win" : "You lose"}
            </div>
            <p className="text-sm uppercase tracking-widest text-neutral-300">
              {room.finishReason === "caught"
                ? "The zombie caught the survivor"
                : room.finishReason === "timeout"
                  ? "The survivor outlasted the timer"
                  : "Opponent left the game"}
            </p>
            <div className="inline-flex rounded-lg border border-neutral-700 bg-neutral-900/90 px-4 py-3">
              <span className="text-xs font-black uppercase tracking-widest text-neutral-500">
                Winner&nbsp;
              </span>
              <span className="font-black uppercase text-orange-200">
                {room.winnerRole ?? "-"}
              </span>
            </div>
            <button
              type="button"
              onClick={onLeave}
              className="mt-2 w-full rounded-lg bg-[#17b978] px-5 py-3 font-black uppercase tracking-widest text-[#04201f] transition hover:bg-[#a7ff83]"
            >
              Back to lobby
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
