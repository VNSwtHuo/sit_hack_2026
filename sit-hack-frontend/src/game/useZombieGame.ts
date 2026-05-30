import { useCallback, useEffect, useRef, useState } from 'react';
import {
  beginCalibration,
  createCalibrationState,
  updateCalibration,
  type CalibrationSample,
} from '../motion/calibration';
import type { CalibrationState } from '../motion/motionTypes';
import { useGameSocket } from '../motion/useGameSocket';
import { useMotionDetection } from '../motion/useMotionDetection';
import { usePoseTracker } from '../motion/usePoseTracker';

const MOTION_SEND_INTERVAL_MS = 66;

/**
 * Central orchestrator for the Zombie Run experience. It keeps the camera,
 * pose tracker, local motion detection, calibration state machine and the
 * Socket.IO game connection alive across every screen so the video element is
 * never remounted mid-game.
 */
export function useZombieGame() {
  const {
    videoRef,
    canvasRef,
    landmarks,
    fps,
    confidence,
    isRunning: cameraOn,
    error: cameraError,
    start,
    stop,
  } = usePoseTracker();

  const game = useGameSocket();
  const { startCalibration, confirmCalibration } = game;

  const [calibration, setCalibration] = useState<CalibrationState>(() => createCalibrationState());
  const calibrationSamplesRef = useRef<CalibrationSample[]>([]);
  const motion = useMotionDetection(landmarks, calibration.profile, game.gameState?.currentObstacle ?? null);
  const lastMotionSentRef = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  // Lightweight clock used for countdowns and obstacle timers.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  // Feed pose frames into the calibration accumulator while collecting.
  useEffect(() => {
    if (calibration.status !== 'collecting') {
      return;
    }
    setCalibration((current) => updateCalibration(current, calibrationSamplesRef.current, landmarks));
  }, [landmarks, calibration.status]);

  // When calibration produces a usable profile, tell the backend to start the
  // countdown. If too few samples were captured, retry automatically.
  useEffect(() => {
    if (calibration.status !== 'complete') {
      return;
    }
    if (calibration.profile) {
      confirmCalibration();
    } else {
      calibrationSamplesRef.current = [];
      setCalibration(beginCalibration());
    }
  }, [calibration.status, calibration.profile, confirmCalibration]);

  // Stream compact motion payloads to the backend (throttled).
  useEffect(() => {
    const sentAt = Date.now();
    if (!calibration.profile || sentAt - lastMotionSentRef.current < MOTION_SEND_INTERVAL_MS) {
      return;
    }
    lastMotionSentRef.current = sentAt;
    game.emitMotion(motion);
  }, [motion, calibration.profile, game]);

  const beginCalibrationFlow = useCallback(() => {
    calibrationSamplesRef.current = [];
    setCalibration(beginCalibration());
    startCalibration();
  }, [startCalibration]);

  const resetCalibration = useCallback(() => {
    calibrationSamplesRef.current = [];
    setCalibration(createCalibrationState());
  }, []);

  return {
    // camera + pose
    videoRef,
    canvasRef,
    landmarks,
    fps,
    confidence,
    cameraOn,
    cameraError,
    startCamera: start,
    stopCamera: stop,
    // calibration
    calibration,
    beginCalibrationFlow,
    resetCalibration,
    // motion + clock
    motion,
    now,
    // backend game state + actions
    connected: game.connected,
    gameState: game.gameState,
    boostMessage: game.boostMessage,
    confirmCalibration: game.confirmCalibration,
    pause: game.pause,
    resume: game.resume,
    restart: game.restart,
  };
}

export type ZombieGame = ReturnType<typeof useZombieGame>;
