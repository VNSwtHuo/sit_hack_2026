import { v4 as uuidv4 } from 'uuid';
import type { Difficulty, GameSession, MotionPayload, ObstacleType, PublicGameState } from '../types.js';
import { DEFAULT_DIFFICULTY, DIFFICULTY_CONFIGS, MOTION_STALE_MS, OBSTACLE_TYPES } from './constants.js';
import { clamp, randomBetween } from './utils.js';

export function createSession(playerName = 'Runner'): GameSession {
  const difficulty = DEFAULT_DIFFICULTY;
  const config = DIFFICULTY_CONFIGS[difficulty];
  const now = Date.now();

  return {
    sessionId: uuidv4(),
    playerName,
    gameState: 'MENU',
    difficulty,
    playerSpeed: 0,
    runningIntensity: 0,
    zombieDistance: config.startingDistance,
    stamina: 100,
    comboCount: 0,
    survivalTime: 0,
    currentObstacle: null,
    lastMotion: null,
    lastSixtySevenCount: 0,
    nextObstacleAt: now + config.obstacleMinMs,
    countdownEndsAt: null,
    lastGameUpdate: now,
    score: 0,
    boostUntil: null,
    lastEmittedObstacleId: null,
    boostAnnouncedCombo: 0,
    gameOverEmitted: false,
  };
}

export function toPublicGameState(session: GameSession): PublicGameState {
  return {
    sessionId: session.sessionId,
    gameState: session.gameState,
    difficulty: session.difficulty,
    playerSpeed: session.playerSpeed,
    runningIntensity: session.runningIntensity,
    zombieDistance: session.zombieDistance,
    stamina: Math.round(session.stamina),
    comboCount: session.comboCount,
    survivalTime: session.survivalTime,
    currentObstacle: session.currentObstacle,
    score: session.score,
    countdownEndsAt: session.countdownEndsAt,
    boostUntil: session.boostUntil,
  };
}

export function setDifficulty(session: GameSession, difficulty: Difficulty) {
  const config = DIFFICULTY_CONFIGS[difficulty];
  session.difficulty = difficulty;
  session.zombieDistance = config.startingDistance;
  session.nextObstacleAt = Date.now() + randomBetween(config.obstacleMinMs, config.obstacleMaxMs);
  session.comboCount = 0;
}

export function startCalibration(session: GameSession) {
  const config = DIFFICULTY_CONFIGS[session.difficulty];
  const now = Date.now();
  session.gameState = 'CALIBRATION';
  session.currentObstacle = null;
  session.comboCount = 0;
  session.survivalTime = 0;
  session.playerSpeed = 0;
  session.runningIntensity = 0;
  session.zombieDistance = config.startingDistance;
  session.stamina = 100;
  session.score = 0;
  session.countdownEndsAt = null;
  session.boostUntil = null;
  session.nextObstacleAt = now + randomBetween(config.obstacleMinMs, config.obstacleMaxMs);
  session.lastGameUpdate = now;
  session.lastEmittedObstacleId = null;
  session.boostAnnouncedCombo = 0;
  session.gameOverEmitted = false;
}

export function confirmCalibration(session: GameSession) {
  session.gameState = 'COUNTDOWN';
  session.countdownEndsAt = Date.now() + 3200;
  session.currentObstacle = null;
}

export function pauseSession(session: GameSession) {
  if (session.gameState === 'RUNNING') {
    session.gameState = 'PAUSED';
  }
}

export function resumeSession(session: GameSession) {
  if (session.gameState === 'PAUSED') {
    session.gameState = 'RUNNING';
    session.lastGameUpdate = Date.now();
  }
}

export function restartSession(session: GameSession) {
  const fresh = createSession(session.playerName);
  fresh.difficulty = session.difficulty;
  Object.assign(session, fresh);
}

export function handleMotionUpdate(session: GameSession, payload: MotionPayload) {
  const sanitized: MotionPayload = {
    ...payload,
    runningIntensity: clamp(payload.runningIntensity, 0, 1),
    playerSpeed: clamp(payload.playerSpeed, 0, 1),
    confidence: clamp(payload.confidence, 0, 1),
    timestamp: Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now(),
  };

  session.lastMotion = sanitized;
  session.runningIntensity = sanitized.runningIntensity;
  session.playerSpeed = sanitized.playerSpeed;

  if (session.gameState === 'RUNNING') {
    tryResolveCurrentObstacle(session, sanitized);
  }
}

function tryResolveCurrentObstacle(session: GameSession, motion: MotionPayload) {
  if (!session.currentObstacle || session.currentObstacle.resolved || Date.now() > session.currentObstacle.deadline) {
    return;
  }

  const type = session.currentObstacle.type;
  const success =
    (type === 'JUMP' && motion.jumpDetected) ||
    (type === 'DODGE_LEFT' && motion.lane === 'left') ||
    (type === 'DODGE_RIGHT' && motion.lane === 'right') ||
    (type === 'SIX_SEVEN' && motion.sixtySevenCount > session.lastSixtySevenCount);

  session.lastSixtySevenCount = Math.max(session.lastSixtySevenCount, motion.sixtySevenCount);

  if (success) {
    applyObstacleSuccess(session);
  }
}

export function handleObstacleResult(session: GameSession, obstacleId: string, success: boolean) {
  if (!session.currentObstacle || session.currentObstacle.id !== obstacleId || session.currentObstacle.resolved) {
    return;
  }

  if (success) {
    applyObstacleSuccess(session);
  } else {
    applyObstacleMiss(session);
  }
}

function applyObstacleSuccess(session: GameSession) {
  if (!session.currentObstacle) {
    return;
  }

  const config = DIFFICULTY_CONFIGS[session.difficulty];
  session.currentObstacle.resolved = true;
  session.currentObstacle = null;
  session.comboCount += 1;
  session.score += 20 + session.comboCount * 2;
  session.zombieDistance += 8;

  if (session.comboCount > 0 && session.comboCount % 3 === 0) {
    session.boostUntil = Date.now() + 2600;
    session.zombieDistance += config.comboBonus;
    session.score += config.comboBonus * 2;
  }

  scheduleNextObstacle(session);
}

function applyObstacleMiss(session: GameSession) {
  const config = DIFFICULTY_CONFIGS[session.difficulty];
  if (session.currentObstacle) {
    session.currentObstacle.resolved = true;
  }
  session.currentObstacle = null;
  session.comboCount = 0;
  session.zombieDistance -= config.missPenalty;
  session.score = Math.max(0, session.score - 8);
  scheduleNextObstacle(session);
}

function scheduleNextObstacle(session: GameSession) {
  const config = DIFFICULTY_CONFIGS[session.difficulty];
  session.nextObstacleAt = Date.now() + randomBetween(config.obstacleMinMs, config.obstacleMaxMs);
}

function spawnObstacle(session: GameSession, now: number) {
  const config = DIFFICULTY_CONFIGS[session.difficulty];
  const type: ObstacleType = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
  session.currentObstacle = {
    id: uuidv4(),
    type,
    spawnAt: now,
    deadline: now + config.obstacleDurationMs,
    resolved: false,
  };
  session.lastSixtySevenCount = session.lastMotion?.sixtySevenCount ?? 0;
  scheduleNextObstacle(session);
}

export function tickSession(session: GameSession, now: number) {
  const deltaMs = Math.max(0, now - session.lastGameUpdate);
  session.lastGameUpdate = now;

  if (session.gameState === 'COUNTDOWN' && session.countdownEndsAt && now >= session.countdownEndsAt) {
    session.gameState = 'RUNNING';
    session.countdownEndsAt = null;
    session.lastGameUpdate = now;
    return;
  }

  if (session.gameState !== 'RUNNING') {
    return;
  }

  const config = DIFFICULTY_CONFIGS[session.difficulty];
  const deltaSeconds = deltaMs / 1000;
  const motionFresh = session.lastMotion ? now - session.lastMotion.timestamp < MOTION_STALE_MS : false;
  const rawSpeed = motionFresh ? session.playerSpeed : 0;
  const staminaDrain = Math.max(0, rawSpeed - 0.28) * 20 * deltaSeconds;
  const staminaRecovery = rawSpeed < 0.22 ? 13 * deltaSeconds : 3 * deltaSeconds;

  session.stamina = clamp(session.stamina - staminaDrain + staminaRecovery, 0, 100);
  const staminaMultiplier = session.stamina < 25 ? 0.55 + session.stamina / 55 : 1;
  const effectiveSpeed = rawSpeed * staminaMultiplier;
  const boostActive = Boolean(session.boostUntil && now < session.boostUntil);

  session.survivalTime += deltaSeconds;
  session.playerSpeed = effectiveSpeed;

  const pushBack = Math.max(0, effectiveSpeed - 0.16) * config.recoveryRate * deltaSeconds * 42;
  const pullIn = (1 - Math.min(effectiveSpeed, 1)) * config.chaseRate * deltaSeconds * 22;
  const boostPush = boostActive ? 3.2 * deltaSeconds : 0;
  session.zombieDistance += pushBack + boostPush - pullIn;
  session.score += effectiveSpeed * deltaSeconds * 10;

  if (session.currentObstacle && now >= session.currentObstacle.deadline && !session.currentObstacle.resolved) {
    applyObstacleMiss(session);
  }

  if (!session.currentObstacle && now >= session.nextObstacleAt) {
    spawnObstacle(session, now);
  }

  if (session.boostUntil && now >= session.boostUntil) {
    session.boostUntil = null;
  }

  session.zombieDistance = clamp(session.zombieDistance, 0, config.maxDistance);
  if (session.zombieDistance <= 0) {
    session.gameState = 'GAME_OVER';
    session.currentObstacle = null;
  }
}
