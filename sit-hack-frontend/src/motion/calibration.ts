import { POSE, type CalibrationProfile, type CalibrationState, type PoseLandmark } from './motionTypes';

const CALIBRATION_MS = 3000;

export interface CalibrationSample {
  centerX: number;
  centerY: number;
  shoulderY: number;
  hipY: number;
  bodyScale: number;
  confidence: number;
}

export function createCalibrationState(): CalibrationState {
  return {
    status: 'idle',
    progress: 0,
    profile: null,
    startedAt: null,
    sampleCount: 0,
  };
}

export function beginCalibration(): CalibrationState {
  return {
    status: 'collecting',
    progress: 0,
    profile: null,
    startedAt: Date.now(),
    sampleCount: 0,
  };
}

export function getTorsoSample(landmarks: PoseLandmark[]): CalibrationSample | null {
  const leftShoulder = landmarks[POSE.leftShoulder];
  const rightShoulder = landmarks[POSE.rightShoulder];
  const leftHip = landmarks[POSE.leftHip];
  const rightHip = landmarks[POSE.rightHip];

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return null;
  }

  const confidence = averageVisibility([leftShoulder, rightShoulder, leftHip, rightHip]);
  if (confidence < 0.45) {
    return null;
  }

  const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipX = (leftHip.x + rightHip.x) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const torsoHeight = Math.abs(hipY - shoulderY);
  const bodyScale = Math.max(0.08, shoulderWidth + torsoHeight);

  return {
    centerX: (shoulderX + hipX) / 2,
    centerY: (shoulderY + hipY) / 2,
    shoulderY,
    hipY,
    bodyScale,
    confidence,
  };
}

export function buildCalibrationProfile(samples: CalibrationSample[]): CalibrationProfile | null {
  if (samples.length < 12) {
    return null;
  }

  const centerX = median(samples.map((sample) => sample.centerX));
  const centerY = median(samples.map((sample) => sample.centerY));
  const shoulderY = median(samples.map((sample) => sample.shoulderY));
  const hipY = median(samples.map((sample) => sample.hipY));
  const bodyScale = median(samples.map((sample) => sample.bodyScale));
  const confidence = samples.reduce((sum, sample) => sum + sample.confidence, 0) / samples.length;

  return {
    centerX,
    centerY,
    shoulderY,
    hipY,
    bodyScale,
    laneThreshold: Math.max(0.09, bodyScale * 0.32),
    jumpThreshold: Math.max(0.045, bodyScale * 0.18),
    wristHighY: shoulderY - bodyScale * 0.12,
    wristLowY: hipY + bodyScale * 0.05,
    confidence,
    createdAt: Date.now(),
  };
}

export function updateCalibration(
  state: CalibrationState,
  samples: CalibrationSample[],
  landmarks: PoseLandmark[],
): CalibrationState {
  if (state.status !== 'collecting' || !state.startedAt) {
    return state;
  }

  const sample = getTorsoSample(landmarks);
  if (sample) {
    samples.push(sample);
  }

  const elapsed = Date.now() - state.startedAt;
  const progress = Math.min(1, elapsed / CALIBRATION_MS);

  if (progress >= 1) {
    return {
      status: 'complete',
      progress: 1,
      profile: buildCalibrationProfile(samples),
      startedAt: state.startedAt,
      sampleCount: samples.length,
    };
  }

  return {
    ...state,
    progress,
    sampleCount: samples.length,
  };
}

function averageVisibility(landmarks: PoseLandmark[]) {
  return landmarks.reduce((sum, landmark) => sum + (landmark.visibility ?? 1), 0) / landmarks.length;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
