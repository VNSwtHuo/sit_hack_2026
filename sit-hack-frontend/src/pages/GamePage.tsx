import { AnimatePresence } from "framer-motion";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { Hud } from "../components/Hud";
import { Landing } from "../components/Landing";
import { ObstaclePrompt } from "../components/ObstaclePrompt";
import { ZombieLayer } from "../components/ZombieLayer";
import {
  BoostFlash,
  CalibratingOverlay,
  ComboAnnouncer,
  CountdownOverlay,
  GameOverOverlay,
  GetInFrameOverlay,
  LevelTransitionOverlay,
  PausedOverlay,
} from "../components/Overlays";
import { useZombieGame } from "../game/useZombieGame";
import { POSE, type PoseLandmark } from "../motion/motionTypes";

const CALIBRATION_CONFIDENCE_GATE = 1.8;
const SIXTY_SEVEN_REPLAY_MAX_MS = 5200;
const GAME_MUSIC_URL = "/circuit-bloodrun.mp3";

export function GamePage() {
  const game = useZombieGame();
  const {
    videoRef,
    canvasRef,
    landmarks,
    confidence,
    cameraOn,
    cameraError,
    startCamera,
    calibration,
    beginCalibrationFlow,
    resetCalibration,
    now,
    connected,
    gameState,
    boostMessage,
    confirmCalibration,
    pause,
    resume,
    restart,
  } = game;

  const [wantsCalibration, setWantsCalibration] = useState(false);
  const [faceSnapshot, setFaceSnapshot] = useState<string | null>(null);
  const [sixtySevenReplayUrl, setSixtySevenReplayUrl] = useState<string | null>(
    null,
  );
  const recorderRef = useRef<MediaRecorder | null>(null);
  const replayChunksRef = useRef<Blob[]>([]);
  const recordingObstacleIdRef = useRef<string | null>(null);
  const replayStopTimerRef = useRef<number | null>(null);
  const replayUrlRef = useRef<string | null>(null);
  const gameMusicRef = useRef<HTMLAudioElement | null>(null);

  const gs = gameState?.gameState ?? "MENU";
  const boostActive = Boolean(
    gameState?.boostUntil && gameState.boostUntil > now,
  );

  const handleStart = useCallback(() => {
    if (!gameMusicRef.current) {
      gameMusicRef.current = createGameMusic();
    }
    setWantsCalibration(true);
    void startCamera();
  }, [startCamera]);

  const handleCalibrateNow = useCallback(() => {
    setWantsCalibration(false);
    beginCalibrationFlow();
  }, [beginCalibrationFlow]);

  // Auto-begin calibration once the camera is up and the player is in frame.
  useEffect(() => {
    if (
      wantsCalibration &&
      gs === "MENU" &&
      cameraOn &&
      confidence >= CALIBRATION_CONFIDENCE_GATE &&
      calibration.status === "idle"
    ) {
      setWantsCalibration(false);
      beginCalibrationFlow();
    }
  }, [
    wantsCalibration,
    gs,
    cameraOn,
    confidence,
    calibration.status,
    beginCalibrationFlow,
  ]);

  const handlePauseToggle = useCallback(() => {
    if (gs === "PAUSED") {
      resume();
    } else {
      pause();
    }
  }, [gs, pause, resume]);

  // Replay reuses the existing calibration profile and jumps straight to the countdown.
  const handlePlayAgain = useCallback(() => {
    setFaceSnapshot(null);
    clearReplayUrl(setSixtySevenReplayUrl, replayUrlRef);
    restart();
    confirmCalibration();
  }, [restart, confirmCalibration]);

  const handleMenu = useCallback(() => {
    setFaceSnapshot(null);
    clearReplayUrl(setSixtySevenReplayUrl, replayUrlRef);
    restart();
    resetCalibration();
    setWantsCalibration(false);
  }, [restart, resetCalibration]);

  useEffect(() => {
    if (gs !== "GAME_OVER" || faceSnapshot) {
      return;
    }

    const snapshot = captureUserFace(canvasRef.current, landmarks);
    if (snapshot) {
      setFaceSnapshot(snapshot);
    }
  }, [gs, faceSnapshot, canvasRef, landmarks]);

  useEffect(() => {
    const music = gameMusicRef.current;
    if (!music) {
      return;
    }

    if (gs === "RUNNING") {
      void music.play().catch(() => {
        // Browsers can still block delayed playback; the next user action can retry.
      });
      return;
    }

    music.pause();
    if (gs === "MENU" || gs === "GAME_OVER") {
      music.currentTime = 0;
    }
  }, [gs]);

  useEffect(() => {
    const obstacle = gameState?.currentObstacle;
    const isSixtySevenActive =
      gs === "RUNNING" && obstacle?.type === "SIX_SEVEN";

    if (isSixtySevenActive && obstacle.id !== recordingObstacleIdRef.current) {
      stopSixtySevenReplayRecording(recorderRef, replayStopTimerRef);
      startSixtySevenReplayRecording(
        canvasRef.current,
        obstacle.id,
        recorderRef,
        replayChunksRef,
        recordingObstacleIdRef,
        replayStopTimerRef,
        replayUrlRef,
        setSixtySevenReplayUrl,
      );
      return;
    }

    if (!isSixtySevenActive && recorderRef.current) {
      stopSixtySevenReplayRecording(recorderRef, replayStopTimerRef);
    }
  }, [gs, gameState?.currentObstacle, canvasRef]);

  useEffect(() => {
    return () => {
      stopSixtySevenReplayRecording(recorderRef, replayStopTimerRef);
      clearReplayUrl(setSixtySevenReplayUrl, replayUrlRef);
      gameMusicRef.current?.pause();
    };
  }, []);

  const countdown =
    gameState?.countdownEndsAt && gameState.countdownEndsAt > now
      ? Math.ceil((gameState.countdownEndsAt - now) / 1000)
      : 0;
  const levelTransitionCountdown =
    gameState?.nextLevelStartsAt && gameState.nextLevelStartsAt > now
      ? Math.ceil((gameState.nextLevelStartsAt - now) / 1000)
      : 0;

  const showLanding = gs === "MENU" && !wantsCalibration;

  return (
    <main className="relative min-h-screen bg-neutral-950 text-neutral-100">
      {/* Video element stays mounted for the whole session so MediaPipe keeps streaming. */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {showLanding ? (
        <Landing connected={connected} onStart={handleStart} />
      ) : (
        <div className="relative h-screen w-screen overflow-hidden bg-black">
          <div className="relative h-full w-full overflow-hidden">
            {/* Live mirrored webcam + pose skeleton */}
            <canvas
              ref={canvasRef}
              className="h-full w-full -scale-x-100 object-cover"
            />

            {/* Horde + danger compositing (only while in play) */}
            {(gs === "RUNNING" || gs === "PAUSED") && gameState ? (
              <ZombieLayer
                zombieDistance={gameState.zombieDistance}
                boostActive={boostActive}
              />
            ) : null}

            {/* HUD */}
            {(gs === "RUNNING" || gs === "PAUSED") && gameState ? (
              <Hud
                state={gameState}
                running={gs === "RUNNING"}
                paused={gs === "PAUSED"}
                onPauseToggle={handlePauseToggle}
              />
            ) : null}

            {/* Obstacle prompt */}
            {gs === "RUNNING" ? (
              <div className="pointer-events-none absolute inset-x-0 top-1/4 z-10 flex justify-center">
                <ObstaclePrompt
                  obstacle={gameState?.currentObstacle ?? null}
                  now={now}
                />
              </div>
            ) : null}

            {/* Brain-rot boost flash */}
            <AnimatePresence>
              {boostMessage && (gs === "RUNNING" || gs === "PAUSED") ? (
                <BoostFlash message={boostMessage} />
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {(gs === "RUNNING" || gs === "PAUSED") && gameState ? (
                <ComboAnnouncer comboCount={gameState.comboCount} />
              ) : null}
            </AnimatePresence>

            {/* State overlays */}
            {gs === "MENU" && wantsCalibration ? (
              <GetInFrameOverlay
                cameraOn={cameraOn}
                confidence={confidence}
                error={cameraError}
                onCalibrate={handleCalibrateNow}
              />
            ) : null}

            {gs === "CALIBRATION" ? (
              <CalibratingOverlay
                progress={calibration.progress}
                samples={calibration.sampleCount}
              />
            ) : null}

            {gs === "COUNTDOWN" ? <CountdownOverlay value={countdown} /> : null}

            {levelTransitionCountdown > 0 && gameState ? (
              <LevelTransitionOverlay
                currentLevel={Math.max(1, gameState.currentLevel - 1)}
                secondsRemaining={levelTransitionCountdown}
              />
            ) : null}

            {gs === "PAUSED" ? <PausedOverlay onResume={resume} /> : null}

            {gs === "GAME_OVER" && gameState ? (
              <GameOverOverlay
                score={gameState.score}
                survivalTime={gameState.survivalTime}
                faceSnapshot={faceSnapshot}
                sixtySevenReplayUrl={sixtySevenReplayUrl}
                onPlayAgain={handlePlayAgain}
                onMenu={handleMenu}
              />
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}

function createGameMusic() {
  const audio = new Audio(GAME_MUSIC_URL);
  audio.loop = true;
  audio.volume = 0.55;
  audio.preload = "auto";
  return audio;
}

function startSixtySevenReplayRecording(
  canvas: HTMLCanvasElement | null,
  obstacleId: string,
  recorderRef: MutableRefObject<MediaRecorder | null>,
  chunksRef: MutableRefObject<Blob[]>,
  obstacleIdRef: MutableRefObject<string | null>,
  stopTimerRef: MutableRefObject<number | null>,
  replayUrlRef: MutableRefObject<string | null>,
  setReplayUrl: Dispatch<SetStateAction<string | null>>,
) {
  if (
    !canvas ||
    typeof MediaRecorder === "undefined" ||
    !canvas.captureStream
  ) {
    return;
  }

  const stream = canvas.captureStream(24);
  const mimeType = getSupportedReplayMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );
  chunksRef.current = [];
  obstacleIdRef.current = obstacleId;

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunksRef.current.push(event.data);
    }
  };

  recorder.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    obstacleIdRef.current = null;

    if (chunksRef.current.length === 0) {
      return;
    }

    clearReplayUrl(setReplayUrl, replayUrlRef);
    const replayBlob = new Blob(chunksRef.current, {
      type: recorder.mimeType || "video/webm",
    });
    const nextUrl = URL.createObjectURL(replayBlob);
    replayUrlRef.current = nextUrl;
    setReplayUrl(nextUrl);
  };

  recorderRef.current = recorder;
  recorder.start();
  stopTimerRef.current = window.setTimeout(() => {
    stopSixtySevenReplayRecording(recorderRef, stopTimerRef);
  }, SIXTY_SEVEN_REPLAY_MAX_MS);
}

function stopSixtySevenReplayRecording(
  recorderRef: MutableRefObject<MediaRecorder | null>,
  stopTimerRef: MutableRefObject<number | null>,
) {
  if (stopTimerRef.current) {
    window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  }

  if (recorderRef.current?.state === "recording") {
    recorderRef.current.stop();
  }
}

function clearReplayUrl(
  setReplayUrl: Dispatch<SetStateAction<string | null>>,
  replayUrlRef: MutableRefObject<string | null>,
) {
  if (replayUrlRef.current) {
    URL.revokeObjectURL(replayUrlRef.current);
    replayUrlRef.current = null;
  }
  setReplayUrl(null);
}

function getSupportedReplayMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((candidate) =>
    MediaRecorder.isTypeSupported(candidate),
  );
}

function captureUserFace(
  canvas: HTMLCanvasElement | null,
  landmarks: PoseLandmark[],
) {
  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    return null;
  }

  const faceLandmarks = landmarks
    .slice(0, 11)
    .filter((landmark) => (landmark.visibility ?? 1) > 0.35);
  const cropBounds =
    faceLandmarks.length >= 2
      ? getExpandedBounds(faceLandmarks, canvas.width, canvas.height, 1.9)
      : getShoulderBasedHeadBounds(landmarks, canvas.width, canvas.height);

  if (!cropBounds) {
    return null;
  }

  const outputSize = 220;
  const output = document.createElement("canvas");
  output.width = outputSize;
  output.height = outputSize;
  const context = output.getContext("2d");
  if (!context) {
    return null;
  }

  context.translate(outputSize, 0);
  context.scale(-1, 1);
  context.drawImage(
    canvas,
    cropBounds.x,
    cropBounds.y,
    cropBounds.size,
    cropBounds.size,
    0,
    0,
    outputSize,
    outputSize,
  );

  return output.toDataURL("image/png");
}

function getExpandedBounds(
  landmarks: PoseLandmark[],
  canvasWidth: number,
  canvasHeight: number,
  multiplier: number,
) {
  const xs = landmarks.map((landmark) => landmark.x * canvasWidth);
  const ys = landmarks.map((landmark) => landmark.y * canvasHeight);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const size = Math.max(maxX - minX, maxY - minY, 60) * multiplier;

  return clampSquareBounds(centerX, centerY, size, canvasWidth, canvasHeight);
}

function getShoulderBasedHeadBounds(
  landmarks: PoseLandmark[],
  canvasWidth: number,
  canvasHeight: number,
) {
  const leftShoulder = landmarks[POSE.leftShoulder];
  const rightShoulder = landmarks[POSE.rightShoulder];
  if (!leftShoulder || !rightShoulder) {
    return null;
  }

  const shoulderCenterX =
    ((leftShoulder.x + rightShoulder.x) / 2) * canvasWidth;
  const shoulderCenterY =
    ((leftShoulder.y + rightShoulder.y) / 2) * canvasHeight;
  const shoulderWidth =
    Math.abs(leftShoulder.x - rightShoulder.x) * canvasWidth;
  const size = Math.max(shoulderWidth * 1.5, 90);

  return clampSquareBounds(
    shoulderCenterX,
    shoulderCenterY - size * 0.65,
    size,
    canvasWidth,
    canvasHeight,
  );
}

function clampSquareBounds(
  centerX: number,
  centerY: number,
  size: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const clampedSize = Math.min(size, canvasWidth, canvasHeight);
  const x = Math.min(
    Math.max(centerX - clampedSize / 2, 0),
    canvasWidth - clampedSize,
  );
  const y = Math.min(
    Math.max(centerY - clampedSize / 2, 0),
    canvasHeight - clampedSize,
  );

  return { x, y, size: clampedSize };
}
