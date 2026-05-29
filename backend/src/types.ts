export type GameState = 'MENU' | 'CALIBRATION' | 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'GAME_OVER';
export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';
export type Lane = 'left' | 'center' | 'right';
export type ObstacleType = 'JUMP' | 'DODGE_LEFT' | 'DODGE_RIGHT' | 'SIX_SEVEN';

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

export interface GameSession {
  sessionId: string;
  playerName: string;
  gameState: GameState;
  difficulty: Difficulty;
  playerSpeed: number;
  runningIntensity: number;
  zombieDistance: number;
  stamina: number;
  comboCount: number;
  survivalTime: number;
  currentObstacle: Obstacle | null;
  lastMotion: MotionPayload | null;
  lastSixtySevenCount: number;
  nextObstacleAt: number;
  countdownEndsAt: number | null;
  lastGameUpdate: number;
  score: number;
  boostUntil: number | null;
  // Emission bookkeeping so one-shot events fire exactly once per occurrence.
  lastEmittedObstacleId: string | null;
  boostAnnouncedCombo: number;
  gameOverEmitted: boolean;
}

export interface PublicGameState {
  sessionId: string;
  gameState: GameState;
  difficulty: Difficulty;
  playerSpeed: number;
  runningIntensity: number;
  zombieDistance: number;
  stamina: number;
  comboCount: number;
  survivalTime: number;
  currentObstacle: Obstacle | null;
  score: number;
  countdownEndsAt: number | null;
  boostUntil: number | null;
}
