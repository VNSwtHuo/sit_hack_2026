import { useCallback, useEffect, useRef, useState } from 'react';
import {
  beginCalibration,
  createCalibrationState,
  updateCalibration,
  type CalibrationSample,
} from '../motion/calibration';
import type { CalibrationState } from '../motion/motionTypes';
import { useMotionDetection } from '../motion/useMotionDetection';
import { usePoseTracker } from '../motion/usePoseTracker';
import { useVersusSocket } from '../motion/useVersusSocket';

const MOTION_SEND_INTERVAL_MS = 66;

/**
 * Orchestrator for the two-player versus experience. Mirrors useZombieGame:
 * keeps the camera, pose tracker, calibration and motion detection alive, but
 * routes everything through the versus match socket. The "active obstacle"
 * fed to motion detection is this client's own obstacle from the broadcast
 * match state (each player gets independent prompts).
 */
export function useVersusGame() {
  const versus = useVersusSocket();
  const { role, versusState } = versus;

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
  } = usePoseTracker(false);

  const [calibration, setCalibration] = useState<CalibrationState>(() => createCalibrationState());
  const calibrationSamplesRef = useRef<CalibrationSample[]>([]);
  const sentReadyRef = useRef(false);

  const myObstacle = role ? versusState?.players?.[role]?.currentObstacle ?? null : null;
  const motion = useMotionDetection(landmarks, calibration.profile, myObstacle);
  const lastMotionSentRef = useRef(0);

  // Feed pose frames into the calibration accumulator while collecting.
  useEffect(() => {
    if (calibration.status !== 'collecting') {
      return;
    }
    setCalibration((current) => updateCalibration(current, calibrationSamplesRef.current, landmarks));
  }, [landmarks, calibration.status]);

  // When calibration produces a usable profile, signal ready to the match.
  // If too few samples were captured, retry automatically.
  useEffect(() => {
    if (calibration.status !== 'complete') {
      return;
    }
    if (calibration.profile) {
      if (!sentReadyRef.current) {
        sentReadyRef.current = true;
        versus.sendReady();
      }
    } else {
      calibrationSamplesRef.current = [];
      setCalibration(beginCalibration());
    }
  }, [calibration.status, calibration.profile, versus]);

  // Stream compact motion payloads to the match (throttled).
  useEffect(() => {
    if (!calibration.profile) {
      return;
    }
    const sentAt = Date.now();
    if (sentAt - lastMotionSentRef.current < MOTION_SEND_INTERVAL_MS) {
      return;
    }
    lastMotionSentRef.current = sentAt;
    versus.emitMotion(motion);
  }, [motion, calibration.profile, versus]);

  const beginCalibrationFlow = useCallback(() => {
    sentReadyRef.current = false;
    calibrationSamplesRef.current = [];
    setCalibration(beginCalibration());
  }, []);

  const resetCalibration = useCallback(() => {
    sentReadyRef.current = false;
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
    motion,
    myObstacle,
    // versus match state + actions
    ...versus,
  };
}

export type VersusGame = ReturnType<typeof useVersusGame>;
