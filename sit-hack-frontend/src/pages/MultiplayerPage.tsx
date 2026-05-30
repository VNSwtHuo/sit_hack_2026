import { motion } from "framer-motion";
import { ArrowLeft, Copy, LogOut, Play, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  beginCalibration,
  createCalibrationState,
  updateCalibration,
  type CalibrationSample,
} from "../motion/calibration";
import type { CalibrationState, MultiplayerPlayer } from "../motion/motionTypes";
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
  const motion = useMotionDetection(landmarks, calibration.profile, null);

  const self = room?.players.find((player) => player.socketId === socketId);
  const opponent = room?.players.find((player) => player.socketId !== socketId);
  const isHost = Boolean(self?.isHost);
  const allPlayersReady =
    room?.players.length === 2 && room.players.every((player) => player.ready);
  const remainingSeconds =
    room?.endsAt && room.phase === "RUNNING"
      ? Math.max(0, Math.ceil((room.endsAt - now) / 1000))
      : room?.durationSeconds ?? durationSeconds;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
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
    if (calibration.status !== "complete") {
      return;
    }
    setReady(Boolean(calibration.profile));
  }, [calibration.status, calibration.profile, setReady]);

  useEffect(() => {
    const sentAt = Date.now();
    if (
      room?.phase !== "RUNNING" ||
      !calibration.profile ||
      sentAt - lastMotionSentRef.current < MOTION_SEND_INTERVAL_MS
    ) {
      return;
    }
    lastMotionSentRef.current = sentAt;
    sendMotion(motion);
  }, [room?.phase, calibration.profile, motion, sendMotion]);

  const startCameraAndCalibration = useCallback(() => {
    void start();
    calibrationSamplesRef.current = [];
    setCalibration(beginCalibration());
    setReady(false);
  }, [start, setReady]);

  const handleCreateRoom = useCallback(() => {
    createRoom({ playerName, durationSeconds });
    void start();
  }, [createRoom, durationSeconds, playerName, start]);

  const handleJoinRoom = useCallback(() => {
    joinRoom({ roomCode: joinCode, playerName });
    void start();
  }, [joinCode, joinRoom, playerName, start]);

  const handleDurationChange = (nextDuration: number) => {
    const clamped = Math.min(300, Math.max(30, nextDuration));
    setDurationSeconds(clamped);
    if (isHost) {
      setDuration(clamped);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <video ref={videoRef} className="hidden" playsInline muted />

      <div className="relative min-h-screen overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-neutral-950/75" />

        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5">
          <header className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#17b978]/40 bg-[#083339]/80 text-[#a7ff83] transition hover:border-[#17b978]"
              title="Back"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="text-right">
              <h1 className="font-zombie text-4xl text-[#a7ff83]">
                Two Player
              </h1>
              <p className="text-xs uppercase tracking-widest text-neutral-500">
                {connected ? "LAN lobby online" : "Connecting"}
              </p>
            </div>
          </header>

          {!room ? (
            <SetupPanel
              playerName={playerName}
              joinCode={joinCode}
              durationSeconds={durationSeconds}
              connected={connected}
              error={error}
              onPlayerNameChange={setPlayerName}
              onJoinCodeChange={setJoinCode}
              onDurationChange={handleDurationChange}
              onCreate={handleCreateRoom}
              onJoin={handleJoinRoom}
            />
          ) : (
            <div className="grid flex-1 items-stretch gap-4 py-6 lg:grid-cols-[360px_1fr]">
              <LobbyPanel
                roomCode={room.code}
                players={room.players}
                self={self}
                durationSeconds={room.durationSeconds}
                isHost={isHost}
                allPlayersReady={Boolean(allPlayersReady)}
                cameraOn={cameraOn}
                cameraError={cameraError}
                confidence={confidence}
                calibration={calibration}
                error={error}
                onDurationChange={handleDurationChange}
                onCalibrate={startCameraAndCalibration}
                onStart={startRoom}
                onLeave={leaveRoom}
              />

              <ArenaPanel
                phase={room.phase}
                self={self}
                opponent={opponent}
                gap={room.gap}
                maxGap={room.maxGap}
                remainingSeconds={remainingSeconds}
                revealEndsAt={room.roleRevealEndsAt}
                winnerSocketId={room.winnerSocketId}
                winnerRole={room.winnerRole}
                finishReason={room.finishReason}
                now={now}
                selfSpeed={motion.playerSpeed}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SetupPanel({
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
    <section className="grid flex-1 items-center gap-4 py-6 lg:grid-cols-2">
      <div className="rounded-lg border border-[#17b978]/30 bg-[#04201f]/85 p-5 shadow-[0_0_40px_-12px_rgba(23,185,120,0.7)]">
        <div className="mb-5 flex items-center gap-3">
          <Users className="text-[#a7ff83]" />
          <h2 className="text-lg font-black uppercase tracking-widest">
            Host room
          </h2>
        </div>
        <FormFields
          playerName={playerName}
          durationSeconds={durationSeconds}
          onPlayerNameChange={onPlayerNameChange}
          onDurationChange={onDurationChange}
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={!connected}
          className="mt-5 w-full rounded-lg bg-[#17b978] px-5 py-3 font-black uppercase tracking-widest text-[#04201f] transition hover:bg-[#a7ff83] disabled:opacity-40"
        >
          Create room
        </button>
      </div>

      <div className="rounded-lg border border-orange-300/30 bg-neutral-950/80 p-5">
        <div className="mb-5 flex items-center gap-3">
          <Copy className="text-orange-300" />
          <h2 className="text-lg font-black uppercase tracking-widest">
            Join room
          </h2>
        </div>
        <label className="mb-3 block text-xs font-bold uppercase tracking-widest text-neutral-400">
          Player name
          <input
            value={playerName}
            onChange={(event) => onPlayerNameChange(event.target.value)}
            className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-base text-neutral-100 outline-none focus:border-orange-300"
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400">
          Room code
          <input
            value={joinCode}
            onChange={(event) =>
              onJoinCodeChange(event.target.value.toUpperCase())
            }
            maxLength={4}
            className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-center font-mono text-3xl font-black uppercase tracking-[0.35em] text-orange-200 outline-none focus:border-orange-300"
          />
        </label>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        <button
          type="button"
          onClick={onJoin}
          disabled={!connected || joinCode.trim().length < 4}
          className="mt-5 w-full rounded-lg bg-orange-300 px-5 py-3 font-black uppercase tracking-widest text-neutral-950 transition hover:bg-orange-200 disabled:opacity-40"
        >
          Join room
        </button>
      </div>
    </section>
  );
}

function FormFields({
  playerName,
  durationSeconds,
  onPlayerNameChange,
  onDurationChange,
}: {
  playerName: string;
  durationSeconds: number;
  onPlayerNameChange: (value: string) => void;
  onDurationChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-3">
      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400">
        Player name
        <input
          value={playerName}
          onChange={(event) => onPlayerNameChange(event.target.value)}
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-base text-neutral-100 outline-none focus:border-[#17b978]"
        />
      </label>
      <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400">
        Timer
        <input
          type="number"
          min={30}
          max={300}
          step={15}
          value={durationSeconds}
          onChange={(event) => onDurationChange(Number(event.target.value))}
          className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-base text-neutral-100 outline-none focus:border-[#17b978]"
        />
      </label>
    </div>
  );
}

function LobbyPanel({
  roomCode,
  players,
  self,
  durationSeconds,
  isHost,
  allPlayersReady,
  cameraOn,
  cameraError,
  confidence,
  calibration,
  error,
  onDurationChange,
  onCalibrate,
  onStart,
  onLeave,
}: {
  roomCode: string;
  players: MultiplayerPlayer[];
  self: MultiplayerPlayer | undefined;
  durationSeconds: number;
  isHost: boolean;
  allPlayersReady: boolean;
  cameraOn: boolean;
  cameraError: string | null;
  confidence: number;
  calibration: CalibrationState;
  error: string | null;
  onDurationChange: (value: number) => void;
  onCalibrate: () => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  return (
    <aside className="flex flex-col gap-4 rounded-lg border border-[#17b978]/30 bg-[#04201f]/90 p-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">
          Room code
        </div>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(roomCode)}
          className="mt-2 flex w-full items-center justify-between rounded-lg border border-[#17b978]/40 bg-neutral-950/70 px-4 py-3"
        >
          <span className="font-mono text-4xl font-black tracking-[0.28em] text-[#a7ff83]">
            {roomCode}
          </span>
          <Copy size={18} className="text-[#17b978]" />
        </button>
      </div>

      <div className="grid gap-2">
        {players.map((player) => (
          <div
            key={player.socketId}
            className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-3"
          >
            <div>
              <div className="font-bold">{player.name}</div>
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
        ))}
      </div>

      {isHost ? (
        <label className="block text-xs font-bold uppercase tracking-widest text-neutral-400">
          Timer
          <input
            type="number"
            min={30}
            max={300}
            step={15}
            value={durationSeconds}
            onChange={(event) => onDurationChange(Number(event.target.value))}
            className="mt-2 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-base text-neutral-100 outline-none focus:border-[#17b978]"
          />
        </label>
      ) : null}

      <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-neutral-500">
          <span>Camera</span>
          <span>{cameraOn ? `${Math.round(confidence * 100)}%` : "Off"}</span>
        </div>
        {cameraError ? <p className="mb-2 text-sm text-red-300">{cameraError}</p> : null}
        <button
          type="button"
          onClick={onCalibrate}
          className="w-full rounded-lg border border-[#17b978]/50 px-4 py-3 font-black uppercase tracking-widest text-[#a7ff83] transition hover:border-[#17b978]"
        >
          {calibration.status === "collecting"
            ? `${Math.round(calibration.progress * 100)}%`
            : self?.ready
              ? "Recalibrate"
              : "Calibrate"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!allPlayersReady}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#17b978] px-5 py-3 font-black uppercase tracking-widest text-[#04201f] transition hover:bg-[#a7ff83] disabled:opacity-40"
        >
          <Play size={18} />
          Start game
        </button>
      ) : null}

      <button
        type="button"
        onClick={onLeave}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-700 px-5 py-3 font-black uppercase tracking-widest text-neutral-300 transition hover:border-neutral-500"
      >
        <LogOut size={18} />
        Leave
      </button>
    </aside>
  );
}

function ArenaPanel({
  phase,
  self,
  opponent,
  gap,
  maxGap,
  remainingSeconds,
  revealEndsAt,
  winnerSocketId,
  winnerRole,
  finishReason,
  now,
  selfSpeed,
}: {
  phase: string;
  self: MultiplayerPlayer | undefined;
  opponent: MultiplayerPlayer | undefined;
  gap: number;
  maxGap: number;
  remainingSeconds: number;
  revealEndsAt: number | null;
  winnerSocketId: string | null;
  winnerRole: string | null;
  finishReason: string | null;
  now: number;
  selfSpeed: number;
}) {
  const gapRatio = Math.max(0, Math.min(1, gap / maxGap));
  const revealRemaining = revealEndsAt ? Math.max(0, revealEndsAt - now) : 0;

  if (phase === "ROLE_REVEAL") {
    return (
      <section className="grid place-items-center rounded-lg border border-orange-300/30 bg-neutral-950/80 p-6">
        <div className="w-full max-w-2xl text-center">
          <div className="mb-5 text-xs font-black uppercase tracking-[0.4em] text-orange-200">
            Role draw
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <RoleReel name={self?.name ?? "You"} role={self?.role} />
            <RoleReel name={opponent?.name ?? "Opponent"} role={opponent?.role} />
          </div>
          <div className="mt-6 font-mono text-2xl font-black text-neutral-400">
            {(revealRemaining / 1000).toFixed(1)}
          </div>
        </div>
      </section>
    );
  }

  if (phase === "RUNNING") {
    return (
      <section className="flex flex-col justify-between rounded-lg border border-[#17b978]/30 bg-neutral-950/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Stat label="Your role" value={self?.role ?? "-"} />
          <Stat label="Time" value={`${remainingSeconds}s`} />
          <Stat label="Your speed" value={selfSpeed.toFixed(2)} />
          <Stat label="Opponent" value={opponent?.speed.toFixed(2) ?? "0.00"} />
        </div>

        <div className="my-8">
          <div className="mb-3 flex justify-between text-xs font-black uppercase tracking-widest text-neutral-500">
            <span>Zombie</span>
            <span>Survivor gap {gap.toFixed(1)}</span>
            <span>Survivor</span>
          </div>
          <div className="relative h-12 overflow-hidden rounded-full bg-red-500/25">
            <div
              className="h-full rounded-full bg-[#17b978] transition-[width] duration-100"
              style={{ width: `${gapRatio * 100}%` }}
            />
            <motion.div
              animate={{ left: `${gapRatio * 100}%` }}
              transition={{ duration: 0.1 }}
              className="absolute top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-neutral-950 bg-orange-300 shadow-[0_0_30px_rgba(251,146,60,0.8)]"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <PlayerRunCard player={self} title="You" />
          <PlayerRunCard player={opponent} title="Rival" />
        </div>
      </section>
    );
  }

  if (phase === "FINISHED") {
    const youWon = self?.socketId === winnerSocketId;
    return (
      <section className="grid place-items-center rounded-lg border border-[#17b978]/30 bg-neutral-950/80 p-6 text-center">
        <div>
          <div className="font-zombie text-7xl text-[#a7ff83]">
            {youWon ? "YOU WIN" : "YOU LOSE"}
          </div>
          <p className="mt-3 text-sm uppercase tracking-widest text-neutral-400">
            {finishReason === "caught"
              ? "The zombie caught the survivor"
              : finishReason === "timeout"
                ? "The survivor lasted the timer"
                : "Room ended"}
          </p>
          <div className="mt-6">
            <Stat label="Winner" value={winnerRole ?? "-"} />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="grid place-items-center rounded-lg border border-neutral-800 bg-neutral-950/70 p-6 text-center">
      <div>
        <div className="font-zombie text-6xl text-[#a7ff83]">Lobby</div>
        <p className="mt-2 text-sm uppercase tracking-widest text-neutral-500">
          Waiting for two ready players
        </p>
      </div>
    </section>
  );
}

function RoleReel({
  name,
  role,
}: {
  name: string;
  role: string | null | undefined;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-orange-300/40 bg-neutral-900">
      <div className="border-b border-neutral-800 px-4 py-3 text-xs font-black uppercase tracking-widest text-neutral-500">
        {name}
      </div>
      <motion.div
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        className="px-4 py-8 font-zombie text-6xl uppercase text-orange-200"
      >
        {role ?? "???"}
      </motion.div>
    </div>
  );
}

function PlayerRunCard({
  player,
  title,
}: {
  player: MultiplayerPlayer | undefined;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4">
      <div className="mb-1 text-xs font-black uppercase tracking-widest text-neutral-500">
        {title}
      </div>
      <div className="text-xl font-black">{player?.name ?? "-"}</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-[#17b978]"
          style={{ width: `${Math.round((player?.speed ?? 0) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-4 py-3">
      <div className="text-[0.65rem] font-black uppercase tracking-widest text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black uppercase text-neutral-100">
        {value}
      </div>
    </div>
  );
}
