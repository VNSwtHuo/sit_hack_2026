export type Lane = 'left' | 'center' | 'right';
export type GameState = 'MENU' | 'CALIBRATION' | 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'GAME_OVER';
export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';
export type ObstacleType = 'JUMP' | 'DUCK' | 'DODGE_LEFT' | 'DODGE_RIGHT' | 'SIX_SEVEN';
export type MultiplayerRole = 'zombie' | 'survivor';
export type MultiplayerPhase = 'LOBBY' | 'ROLE_REVEAL' | 'RUNNING' | 'FINISHED';

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
  duckDetected: boolean;
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
  boostUntil: number | null;
}

export interface MultiplayerPlayer {
  socketId: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  role: MultiplayerRole | null;
  speed: number;
  sixtySevenCount: number;
  obstacleResolved: boolean;
  obstaclePenaltyUntil: number | null;
  lastSixtySevenCount: number;
  connected: boolean;
  boostUntil: number | null;
  /** Metres this player has accumulated by running. */
  distance: number;
}

export interface PublicMultiplayerRoom {
  code: string;
  hostSocketId: string;
  /** Distance (m) the survivor must reach to win. */
  targetDistance: number;
  /** Survivor's starting lead (m). The chase bar is "full" while gap >= this. */
  headStart: number;
  phase: MultiplayerPhase;
  players: MultiplayerPlayer[];
  /** survivorDistance + headStart - zombieDistance. gap <= 0 means caught. */
  gap: number;
  startedAt: number | null;
  roleRevealEndsAt: number | null;
  currentObstacle: Obstacle | null;
  winnerRole: MultiplayerRole | null;
  winnerSocketId: string | null;
  finishReason: 'caught' | 'reached' | 'abandoned' | null;
  /** Server clock at broadcast time, so clients can correct for clock skew. */
  serverNow: number;
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
  duckDetected: false,
  lane: 'center',
  sixtySevenCount: 0,
  confidence: 0,
  timestamp: Date.now(),
};
