import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { Hud } from '../components/Hud';
import { Landing } from '../components/Landing';
import { ObstaclePrompt } from '../components/ObstaclePrompt';
import { ZombieLayer } from '../components/ZombieLayer';
import {
  BoostFlash,
  CalibratingOverlay,
  CountdownOverlay,
  GameOverOverlay,
  GetInFrameOverlay,
  PausedOverlay,
} from '../components/Overlays';
import { useZombieGame } from '../game/useZombieGame';
import type { Difficulty } from '../motion/motionTypes';

const CALIBRATION_CONFIDENCE_GATE = 0.45;

export function GamePage() {
  const game = useZombieGame();
  const {
    videoRef,
    canvasRef,
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
    chooseDifficulty,
    confirmCalibration,
    pause,
    resume,
    restart,
  } = game;

  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [wantsCalibration, setWantsCalibration] = useState(false);

  const gs = gameState?.gameState ?? 'MENU';
  const boostActive = Boolean(gameState?.boostUntil && gameState.boostUntil > now);

  const selectDifficulty = useCallback(
    (next: Difficulty) => {
      setDifficulty(next);
      chooseDifficulty(next);
    },
    [chooseDifficulty],
  );

  const handleStart = useCallback(() => {
    chooseDifficulty(difficulty);
    setWantsCalibration(true);
    void startCamera();
  }, [chooseDifficulty, difficulty, startCamera]);

  const handleCalibrateNow = useCallback(() => {
    setWantsCalibration(false);
    beginCalibrationFlow();
  }, [beginCalibrationFlow]);

  // Auto-begin calibration once the camera is up and the player is in frame.
  useEffect(() => {
    if (
      wantsCalibration &&
      gs === 'MENU' &&
      cameraOn &&
      confidence >= CALIBRATION_CONFIDENCE_GATE &&
      calibration.status === 'idle'
    ) {
      setWantsCalibration(false);
      beginCalibrationFlow();
    }
  }, [wantsCalibration, gs, cameraOn, confidence, calibration.status, beginCalibrationFlow]);

  const handlePauseToggle = useCallback(() => {
    if (gs === 'PAUSED') {
      resume();
    } else {
      pause();
    }
  }, [gs, pause, resume]);

  // Replay reuses the existing calibration profile and jumps straight to the countdown.
  const handlePlayAgain = useCallback(() => {
    restart();
    chooseDifficulty(difficulty);
    confirmCalibration();
  }, [restart, chooseDifficulty, difficulty, confirmCalibration]);

  const handleMenu = useCallback(() => {
    restart();
    resetCalibration();
    setWantsCalibration(false);
  }, [restart, resetCalibration]);

  const countdown =
    gameState?.countdownEndsAt && gameState.countdownEndsAt > now
      ? Math.ceil((gameState.countdownEndsAt - now) / 1000)
      : 0;

  const showLanding = gs === 'MENU' && !wantsCalibration;

  return (
    <main className="relative min-h-screen bg-neutral-950 text-neutral-100">
      {/* Video element stays mounted for the whole session so MediaPipe keeps streaming. */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {showLanding ? (
        <Landing
          difficulty={difficulty}
          connected={connected}
          onSelectDifficulty={selectDifficulty}
          onStart={handleStart}
        />
      ) : (
        <div className="relative mx-auto grid min-h-screen max-w-5xl place-items-center p-2 sm:p-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-[0_0_60px_-20px_rgba(132,204,22,0.5)]">
            {/* Live mirrored webcam + pose skeleton */}
            <canvas ref={canvasRef} className="h-full w-full -scale-x-100 object-cover" />

            {/* Horde + danger compositing (only while in play) */}
            {(gs === 'RUNNING' || gs === 'PAUSED') && gameState ? (
              <ZombieLayer zombieDistance={gameState.zombieDistance} boostActive={boostActive} />
            ) : null}

            {/* HUD */}
            {(gs === 'RUNNING' || gs === 'PAUSED') && gameState ? (
              <Hud
                state={gameState}
                running={gs === 'RUNNING'}
                paused={gs === 'PAUSED'}
                onPauseToggle={handlePauseToggle}
              />
            ) : null}

            {/* Obstacle prompt */}
            {gs === 'RUNNING' ? (
              <div className="pointer-events-none absolute inset-x-0 top-1/4 z-10 flex justify-center">
                <ObstaclePrompt obstacle={gameState?.currentObstacle ?? null} now={now} />
              </div>
            ) : null}

            {/* Brain-rot boost flash */}
            <AnimatePresence>
              {boostMessage && (gs === 'RUNNING' || gs === 'PAUSED') ? (
                <BoostFlash message={boostMessage} />
              ) : null}
            </AnimatePresence>

            {/* State overlays */}
            {gs === 'MENU' && wantsCalibration ? (
              <GetInFrameOverlay
                cameraOn={cameraOn}
                confidence={confidence}
                error={cameraError}
                onCalibrate={handleCalibrateNow}
              />
            ) : null}

            {gs === 'CALIBRATION' ? (
              <CalibratingOverlay progress={calibration.progress} samples={calibration.sampleCount} />
            ) : null}

            {gs === 'COUNTDOWN' ? <CountdownOverlay value={countdown} /> : null}

            {gs === 'PAUSED' ? <PausedOverlay onResume={resume} /> : null}

            {gs === 'GAME_OVER' && gameState ? (
              <GameOverOverlay
                score={gameState.score}
                survivalTime={gameState.survivalTime}
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
