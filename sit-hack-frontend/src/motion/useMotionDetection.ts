import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  DEFAULT_MOTION,
  POSE,
  type CalibrationProfile,
  type MotionPayload,
  type PoseLandmark,
} from './motionTypes';
import { getTorsoSample } from './calibration';

const RUN_HISTORY_SIZE = 8;
const SEND_HISTORY_SIZE = 4;

interface MotionFrame {
  leftKneeY: number;
  rightKneeY: number;
  leftAnkleY: number;
  rightAnkleY: number;
  torsoY: number;
  time: number;
}

type WristPhase = 'unknown' | 'high' | 'low';

export function useMotionDetection(landmarks: PoseLandmark[], calibration: CalibrationProfile | null) {
  const [motion, setMotion] = useState<MotionPayload>(DEFAULT_MOTION);
  const framesRef = useRef<MotionFrame[]>([]);
  const smoothSpeedRef = useRef<number[]>([]);
  const jumpingRef = useRef(false);
  const jumpCooldownRef = useRef(0);
  const wristPhaseRef = useRef<WristPhase>('unknown');
  const sixtySevenCountRef = useRef(0);

  useEffect(() => {
    if (!calibration || landmarks.length === 0) {
      return;
    }

    const sample = getTorsoSample(landmarks);
    const leftKnee = landmarks[POSE.leftKnee];
    const rightKnee = landmarks[POSE.rightKnee];
    const leftAnkle = landmarks[POSE.leftAnkle];
    const rightAnkle = landmarks[POSE.rightAnkle];
    const leftWrist = landmarks[POSE.leftWrist];
    const rightWrist = landmarks[POSE.rightWrist];

    if (!sample || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle || !leftWrist || !rightWrist) {
      return;
    }

    const now = Date.now();
    const nextFrame: MotionFrame = {
      leftKneeY: leftKnee.y,
      rightKneeY: rightKnee.y,
      leftAnkleY: leftAnkle.y,
      rightAnkleY: rightAnkle.y,
      torsoY: sample.centerY,
      time: now,
    };

    framesRef.current.push(nextFrame);
    if (framesRef.current.length > RUN_HISTORY_SIZE) {
      framesRef.current.shift();
    }

    const runningIntensity = detectRunning(framesRef.current, calibration.bodyScale);
    smoothSpeedRef.current.push(runningIntensity);
    if (smoothSpeedRef.current.length > SEND_HISTORY_SIZE) {
      smoothSpeedRef.current.shift();
    }

    const playerSpeed = smoothSpeedRef.current.reduce((sum, value) => sum + value, 0) / smoothSpeedRef.current.length;
    const isRunning = playerSpeed > 0.22;
    const lane = detectLane(sample.centerX, calibration);
    const jumpDetected = detectJump(nextFrame.torsoY, calibration, now, jumpingRef, jumpCooldownRef);
    updateSixtySeven(leftWrist.y, rightWrist.y, calibration, wristPhaseRef, sixtySevenCountRef);

    setMotion({
      runningIntensity,
      playerSpeed,
      isRunning,
      jumpDetected,
      lane,
      sixtySevenCount: sixtySevenCountRef.current,
      confidence: sample.confidence,
      timestamp: now,
    });
  }, [landmarks, calibration]);

  return motion;
}

function detectRunning(frames: MotionFrame[], bodyScale: number) {
  if (frames.length < 3) {
    return 0;
  }

  let totalMotion = 0;
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    totalMotion += Math.abs(current.leftKneeY - previous.leftKneeY);
    totalMotion += Math.abs(current.rightKneeY - previous.rightKneeY);
    totalMotion += Math.abs(current.leftAnkleY - previous.leftAnkleY) * 0.8;
    totalMotion += Math.abs(current.rightAnkleY - previous.rightAnkleY) * 0.8;
  }

  const averageMotion = totalMotion / (frames.length - 1);
  const normalizedMotion = averageMotion / Math.max(0.08, bodyScale);
  const deadZone = 0.035;
  const scaled = (normalizedMotion - deadZone) / 0.22;
  return clamp(scaled, 0, 1);
}

function detectLane(centerX: number, calibration: CalibrationProfile) {
  const offset = centerX - calibration.centerX;
  if (offset < -calibration.laneThreshold) {
    return 'left';
  }
  if (offset > calibration.laneThreshold) {
    return 'right';
  }
  return 'center';
}

function detectJump(
  torsoY: number,
  calibration: CalibrationProfile,
  now: number,
  jumpingRef: MutableRefObject<boolean>,
  jumpCooldownRef: MutableRefObject<number>,
) {
  const upwardOffset = calibration.centerY - torsoY;
  const landed = upwardOffset < calibration.jumpThreshold * 0.35;

  if (jumpingRef.current && landed) {
    jumpingRef.current = false;
  }

  if (!jumpingRef.current && now > jumpCooldownRef.current && upwardOffset > calibration.jumpThreshold) {
    jumpingRef.current = true;
    jumpCooldownRef.current = now + 650;
    return true;
  }

  return false;
}

function updateSixtySeven(
  leftWristY: number,
  rightWristY: number,
  calibration: CalibrationProfile,
  phaseRef: MutableRefObject<WristPhase>,
  countRef: MutableRefObject<number>,
) {
  const bothHigh = leftWristY < calibration.wristHighY && rightWristY < calibration.wristHighY;
  const bothLow = leftWristY > calibration.wristLowY && rightWristY > calibration.wristLowY;
  const nextPhase: WristPhase = bothHigh ? 'high' : bothLow ? 'low' : phaseRef.current;

  if (phaseRef.current !== 'unknown' && nextPhase !== phaseRef.current) {
    countRef.current += 1;
  }

  phaseRef.current = nextPhase;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
