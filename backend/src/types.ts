export type GameState = 'MENU' | 'CALIBRATION' | 'COUNTDOWN' | 'RUNNING' | 'PAUSED' | 'GAME_OVER';
export type Difficulty = 'EASY' | 'NORMAL' | 'HARD';
export type Lane = 'left' | 'center' | 'right';
export type ObstacleType = 'JUMP' | 'DUCK' | 'DODGE_LEFT' | 'DODGE_RIGHT' | 'SIX_SEVEN';

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

export interface GameSession {
  sessionId: string;
  playerName: string;
  gameState: GameState;
  difficulty: Difficulty;
  speedMultiplier: number;
  playerSpeed: number;
  runningIntensity: number;
  zombieDistance: number;
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

// ---------------------------------------------------------------------------
// Two-player (LAN) multiplayer
// ---------------------------------------------------------------------------

export type MultiplayerRole = 'zombie' | 'survivor';
export type MultiplayerPhase = 'LOBBY' | 'ROLE_REVEAL' | 'RUNNING' | 'FINISHED';
export type MultiplayerFinishReason = 'caught' | 'timeout' | 'abandoned';

/** Player fields that are safe to broadcast to both clients. */
export interface MultiplayerPlayerPublic {
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
}

/** Server-only player state (never broadcast). */
export interface MultiplayerPlayerInternal extends MultiplayerPlayerPublic {
  lastMotionAt: number;
  comboCount: number;
}

export interface PublicMultiplayerRoom {
  code: string;
  hostSocketId: string;
  durationSeconds: number;
  phase: MultiplayerPhase;
  players: MultiplayerPlayerPublic[];
  gap: number;
  initialGap: number;
  maxGap: number;
  startedAt: number | null;
  endsAt: number | null;
  roleRevealEndsAt: number | null;
  currentObstacle: Obstacle | null;
  winnerRole: MultiplayerRole | null;
  winnerSocketId: string | null;
  finishReason: MultiplayerFinishReason | null;
  /** Server clock at broadcast time, so clients can correct for clock skew. */
  serverNow: number;
}

export interface MultiplayerRoom {
  code: string;
  hostSocketId: string;
  durationSeconds: number;
  phase: MultiplayerPhase;
  players: MultiplayerPlayerInternal[];
  gap: number;
  initialGap: number;
  maxGap: number;
  startedAt: number | null;
  endsAt: number | null;
  roleRevealEndsAt: number | null;
  currentObstacle: Obstacle | null;
  nextObstacleAt: number;
  lastUpdate: number;
  winnerRole: MultiplayerRole | null;
  winnerSocketId: string | null;
  finishReason: MultiplayerFinishReason | null;
}
