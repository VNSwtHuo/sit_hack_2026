import { useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  DEFAULT_MOTION,
  POSE,
  type CalibrationProfile,
  type MotionPayload,
  type Obstacle,
  type PoseLandmark,
} from "./motionTypes";
import { getTorsoSample } from "./calibration";

const RUN_HISTORY_SIZE = 8;
const SEND_HISTORY_SIZE = 4;
const KNEE_SPEED_DEADZONE = 0.18;
const KNEE_SPEED_FULL_RUN = 1.25;
const MIN_KNEE_VERTICAL_RANGE = 0.035;
const SIXTY_SEVEN_ALTERNATIONS_REQUIRED = 15;
const JUMP_TASK_HEIGHT_MULTIPLIER = 0.08;
const DUCK_TORSO_HEIGHT_DROP_MULTIPLIER = 0.18;

interface MotionFrame {
  leftKneeRelativeY: number;
  rightKneeRelativeY: number;
  torsoY: number;
  time: number;
}

type WristPhase = "unknown" | "leftGreater" | "rightGreater";

export function useMotionDetection(
  landmarks: PoseLandmark[],
  calibration: CalibrationProfile | null,
  activeObstacle: Obstacle | null,
) {
  const [motion, setMotion] = useState<MotionPayload>(DEFAULT_MOTION);
  const framesRef = useRef<MotionFrame[]>([]);
  const smoothSpeedRef = useRef<number[]>([]);
  const jumpObstacleIdRef = useRef<string | null>(null);
  const jumpBaselineTorsoYRef = useRef<number | null>(null);
  const duckObstacleIdRef = useRef<string | null>(null);
  const duckBaselineTorsoHeightRef = useRef<number | null>(null);
  const wristPhaseRef = useRef<WristPhase>("unknown");
  const wristAlternationCountRef = useRef(0);
  const sixtySevenCountRef = useRef(0);

  useEffect(() => {
    if (!calibration || landmarks.length === 0) {
      return;
    }

    const sample = getTorsoSample(landmarks);
    const leftKnee = landmarks[POSE.leftKnee];
    const rightKnee = landmarks[POSE.rightKnee];
    const leftWrist = landmarks[POSE.leftWrist];
    const rightWrist = landmarks[POSE.rightWrist];

    if (!sample || !leftKnee || !rightKnee || !leftWrist || !rightWrist) {
      return;
    }

    const now = Date.now();
    const nextFrame: MotionFrame = {
      leftKneeRelativeY: leftKnee.y - sample.centerY,
      rightKneeRelativeY: rightKnee.y - sample.centerY,
      torsoY: sample.centerY,
      time: now,
    };

    framesRef.current.push(nextFrame);
    if (framesRef.current.length > RUN_HISTORY_SIZE) {
      framesRef.current.shift();
    }

    const runningIntensity = detectRunning(
      framesRef.current,
      calibration.bodyScale,
    );
    smoothSpeedRef.current.push(runningIntensity);
    if (smoothSpeedRef.current.length > SEND_HISTORY_SIZE) {
      smoothSpeedRef.current.shift();
    }

    const playerSpeed =
      smoothSpeedRef.current.reduce((sum, value) => sum + value, 0) /
      smoothSpeedRef.current.length;
    const isRunning = playerSpeed > 0.16;
    const lane = detectLane(sample.centerX, calibration);
    const jumpDetected = detectJump(
      nextFrame.torsoY,
      calibration,
      activeObstacle,
      jumpObstacleIdRef,
      jumpBaselineTorsoYRef,
    );
    const duckDetected = detectDuck(
      Math.abs(sample.hipY - sample.shoulderY),
      activeObstacle,
      duckObstacleIdRef,
      duckBaselineTorsoHeightRef,
    );
    updateSixtySeven(
      leftWrist.y,
      rightWrist.y,
      wristPhaseRef,
      wristAlternationCountRef,
      sixtySevenCountRef,
    );

    setMotion({
      runningIntensity,
      playerSpeed,
      isRunning,
      jumpDetected,
      duckDetected,
      lane,
      sixtySevenCount: sixtySevenCountRef.current,
      confidence: sample.confidence,
      timestamp: now,
    });
  }, [landmarks, calibration, activeObstacle]);

  return motion;
}

function detectRunning(frames: MotionFrame[], bodyScale: number) {
  if (frames.length < 3) {
    return 0;
  }

  let totalKneeVelocity = 0;
  let sampleCount = 0;
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    const deltaSeconds = Math.max(0.001, (current.time - previous.time) / 1000);
    const leftVelocity =
      Math.abs(current.leftKneeRelativeY - previous.leftKneeRelativeY) /
      deltaSeconds;
    const rightVelocity =
      Math.abs(current.rightKneeRelativeY - previous.rightKneeRelativeY) /
      deltaSeconds;

    totalKneeVelocity += leftVelocity + rightVelocity;
    sampleCount += 2;
  }

  const leftRange = getRange(frames.map((frame) => frame.leftKneeRelativeY));
  const rightRange = getRange(frames.map((frame) => frame.rightKneeRelativeY));
  const normalizedRange =
    Math.max(leftRange, rightRange) / Math.max(0.08, bodyScale);
  const rangeMultiplier = clamp(
    normalizedRange / MIN_KNEE_VERTICAL_RANGE,
    0,
    1,
  );
  const normalizedVelocity =
    totalKneeVelocity / sampleCount / Math.max(0.08, bodyScale);
  const scaled =
    (normalizedVelocity - KNEE_SPEED_DEADZONE) /
    (KNEE_SPEED_FULL_RUN - KNEE_SPEED_DEADZONE);

  return clamp(scaled, 0, 1) * rangeMultiplier;
}

function getRange(values: number[]) {
  return Math.max(...values) - Math.min(...values);
}

function detectLane(centerX: number, calibration: CalibrationProfile) {
  const offset = centerX - calibration.centerX;
  if (offset < -calibration.laneThreshold) {
    return "left";
  }
  if (offset > calibration.laneThreshold) {
    return "right";
  }
  return "center";
}

function detectJump(
  torsoY: number,
  calibration: CalibrationProfile,
  activeObstacle: Obstacle | null,
  obstacleIdRef: MutableRefObject<string | null>,
  baselineTorsoYRef: MutableRefObject<number | null>,
) {
  if (activeObstacle?.type !== "JUMP") {
    obstacleIdRef.current = null;
    baselineTorsoYRef.current = null;
    return false;
  }

  if (obstacleIdRef.current !== activeObstacle.id) {
    obstacleIdRef.current = activeObstacle.id;
    baselineTorsoYRef.current = torsoY;
    return false;
  }

  const baselineTorsoY = baselineTorsoYRef.current ?? torsoY;
  const jumpHeight = baselineTorsoY - torsoY;
  const requiredHeight = Math.max(
    0.018,
    calibration.bodyScale * JUMP_TASK_HEIGHT_MULTIPLIER,
  );

  return jumpHeight > requiredHeight;
}

function detectDuck(
  torsoHeight: number,
  activeObstacle: Obstacle | null,
  obstacleIdRef: MutableRefObject<string | null>,
  baselineTorsoHeightRef: MutableRefObject<number | null>,
) {
  if (activeObstacle?.type !== "DUCK") {
    obstacleIdRef.current = null;
    baselineTorsoHeightRef.current = null;
    return false;
  }

  if (obstacleIdRef.current !== activeObstacle.id) {
    obstacleIdRef.current = activeObstacle.id;
    baselineTorsoHeightRef.current = torsoHeight;
    return false;
  }

  const baselineTorsoHeight = baselineTorsoHeightRef.current ?? torsoHeight;
  const torsoHeightDrop = baselineTorsoHeight - torsoHeight;
  const requiredDrop = Math.max(
    0.025,
    baselineTorsoHeight * DUCK_TORSO_HEIGHT_DROP_MULTIPLIER,
  );

  return torsoHeightDrop > requiredDrop;
}

function updateSixtySeven(
  leftWristY: number,
  rightWristY: number,
  phaseRef: MutableRefObject<WristPhase>,
  alternationCountRef: MutableRefObject<number>,
  countRef: MutableRefObject<number>,
) {
  const nextPhase: WristPhase =
    leftWristY > rightWristY ? "leftGreater" : "rightGreater";

  if (phaseRef.current !== "unknown" && nextPhase !== phaseRef.current) {
    alternationCountRef.current += 1;
  }

  if (alternationCountRef.current >= SIXTY_SEVEN_ALTERNATIONS_REQUIRED) {
    countRef.current += 1;
    alternationCountRef.current = 0;
  }

  phaseRef.current = nextPhase;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
