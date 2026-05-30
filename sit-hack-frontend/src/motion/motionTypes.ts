export type Lane = 'left' | 'center' | 'right';
export type GameState = 'MENU' | 'CALIBRATION' | 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'GAME_OVER';
export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';
export type ObstacleType = 'JUMP' | 'DODGE_LEFT' | 'DODGE_RIGHT' | 'SIX_SEVEN';

export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface CalibrationProfile {
  centerX: number;
  centerY: number;
  shoulderY: number;
  hipY: number;
  bodyScale: number;
  laneThreshold: number;
  jumpThreshold: number;
  wristHighY: number;
  wristLowY: number;
  confidence: number;
  createdAt: number;
}

export interface CalibrationState {
  status: 'idle' | 'collecting' | 'complete';
  progress: number;
  profile: CalibrationProfile | null;
  startedAt: number | null;
  sampleCount: number;
}

export interface MotionPayload {
  runningIntensity: number;
  playerSpeed: number;
  isRunning: boolean;
  jumpDetected: boolean;
  lane: Lane;
  sixtySevenCount: number;
  confidence: number;
  timestamp: number;
}

export interface Obstacle {
  id: string;
  type: ObstacleType;
  spawnAt: number;
  deadline: number;
  resolved: boolean;
}

export interface PublicGameState {
  sessionId: string;
  gameState: GameState;
  difficulty: Difficulty;
  speedMultiplier: number;
  playerSpeed: number;
  runningIntensity: number;
  zombieDistance: number;
  comboCount: number;
  survivalTime: number;
  currentObstacle: Obstacle | null;
  score: number;
  countdownEndsAt: number | null;
  swampActiveUntil: number | null;
  boostUntil: number | null;
}

// ---- Two-player versus mode ----
export type VersusRole = 'HUMAN' | 'ZOMBIE';
export type VersusState = 'LOBBY' | 'COUNTDOWN' | 'RUNNING' | 'FINISHED';

export interface VersusPublicPlayer {
  role: VersusRole;
  name: string;
  connected: boolean;
  ready: boolean;
  speed: number;
  hits: number;
  misses: number;
  currentObstacle: Obstacle | null;
}

export interface VersusPublicState {
  code: string;
  state: VersusState;
  gap: number;
  maxGap: number;
  elapsed: number;
  escapeTime: number;
  countdownEndsAt: number | null;
  winner: VersusRole | null;
  endReason: string | null;
  players: Partial<Record<VersusRole, VersusPublicPlayer>>;
}

export const POSE = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

export const DEFAULT_MOTION: MotionPayload = {
  runningIntensity: 0,
  playerSpeed: 0,
  isRunning: false,
  jumpDetected: false,
  lane: 'center',
  sixtySevenCount: 0,
  confidence: 0,
  timestamp: Date.now(),
};
