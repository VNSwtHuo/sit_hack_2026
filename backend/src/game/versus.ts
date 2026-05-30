import { v4 as uuidv4 } from 'uuid';
import type { Lane, MotionPayload, Obstacle, ObstacleType } from '../types.js';
import { OBSTACLE_TYPES } from './constants.js';
import { clamp, randomBetween } from './utils.js';

// ---------------------------------------------------------------------------
// Two-player "Versus" mode.
//
// One player is the HUMAN (being chased), the other is the ZOMBIE (chasing).
// Both physically run in place. A single shared "gap" measures how far the
// human is ahead of the zombie:
//
//   - The faster runner moves the gap in their favour every tick.
//   - Clearing an obstacle nudges the gap toward you; missing one nudges it
//     toward your opponent (a "mistake").
//
// If the gap reaches 0 the zombie has caught the human  -> ZOMBIE wins.
// If the human survives until the escape timer elapses   -> HUMAN wins.
//
// This directly encodes the rule "if the zombie runs faster and makes fewer
// mistakes than the human, the zombie wins".
// ---------------------------------------------------------------------------

export const VERSUS_TICK_MS = 100;
export const VERSUS_MOTION_STALE_MS = 650;

const MAX_GAP = 100;
const START_GAP = 55;
const COUNTDOWN_MS = 3200;
const ESCAPE_TIME_SECONDS = 45;

// How fast a full-speed difference (human 1.0 vs zombie 0.0 = +1) moves the gap
// per second. Positive favours the human.
const SPEED_FACTOR = 11;

// Obstacle tuning (per player, independent prompts).
const OBSTACLE_MIN_MS = 3600;
const OBSTACLE_MAX_MS = 6200;
const OBSTACLE_DURATION_MS = 3200;
const MISS_PENALTY = 9; // gap swing toward the opponent on a missed obstacle
const HIT_BONUS = 3; // gap swing toward you on a cleared obstacle

export type VersusRole = 'HUMAN' | 'ZOMBIE';
export type VersusState = 'LOBBY' | 'COUNTDOWN' | 'RUNNING' | 'FINISHED';

export interface VersusPlayer {
  socketId: string;
  role: VersusRole;
  name: string;
  connected: boolean;
  ready: boolean; // calibrated and waiting to start
  speed: number; // smoothed playerSpeed 0..1
  lastMotionAt: number;
  currentObstacle: Obstacle | null;
  nextObstacleAt: number;
  lastSixtySevenCount: number;
  hits: number;
  misses: number;
}

export interface VersusMatch {
  code: string;
  state: VersusState;
  players: Partial<Record<VersusRole, VersusPlayer>>;
  gap: number;
  elapsed: number; // seconds spent in RUNNING
  countdownEndsAt: number | null;
  lastTick: number;
  winner: VersusRole | null;
  endReason: string | null;
  createdAt: number;
}

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

function createPlayer(socketId: string, role: VersusRole, name: string, now: number): VersusPlayer {
  return {
    socketId,
    role,
    name,
    connected: true,
    ready: false,
    speed: 0,
    lastMotionAt: 0,
    currentObstacle: null,
    nextObstacleAt: now + randomBetween(OBSTACLE_MIN_MS, OBSTACLE_MAX_MS),
    lastSixtySevenCount: 0,
    hits: 0,
    misses: 0,
  };
}

export function createMatch(code: string, hostSocketId: string, hostName: string, hostRole: VersusRole): VersusMatch {
  const now = Date.now();
  return {
    code,
    state: 'LOBBY',
    players: { [hostRole]: createPlayer(hostSocketId, hostRole, hostName, now) },
    gap: START_GAP,
    elapsed: 0,
    countdownEndsAt: null,
    lastTick: now,
    winner: null,
    endReason: null,
    createdAt: now,
  };
}

export function otherRole(role: VersusRole): VersusRole {
  return role === 'HUMAN' ? 'ZOMBIE' : 'HUMAN';
}

/** Add the second player to a match. Returns the assigned role, or null if full. */
export function joinMatch(match: VersusMatch, socketId: string, name: string): VersusRole | null {
  const takenRoles = Object.keys(match.players) as VersusRole[];
  if (takenRoles.length >= 2) {
    return null;
  }
  const role = takenRoles.length === 1 ? otherRole(takenRoles[0]) : 'HUMAN';
  match.players[role] = createPlayer(socketId, role, name, Date.now());
  return role;
}

export function playerCount(match: VersusMatch): number {
  return Object.keys(match.players).length;
}

export function findPlayerBySocket(
  match: VersusMatch,
  socketId: string,
): VersusPlayer | undefined {
  return Object.values(match.players).find((player) => player?.socketId === socketId);
}

export function markReady(match: VersusMatch, socketId: string) {
  const player = findPlayerBySocket(match, socketId);
  if (!player) {
    return;
  }
  player.ready = true;

  const players = Object.values(match.players);
  if (match.state === 'LOBBY' && players.length === 2 && players.every((p) => p?.ready)) {
    match.state = 'COUNTDOWN';
    match.countdownEndsAt = Date.now() + COUNTDOWN_MS;
  }
}

export function applyVersusMotion(match: VersusMatch, socketId: string, payload: MotionPayload) {
  const player = findPlayerBySocket(match, socketId);
  if (!player) {
    return;
  }

  player.speed = clamp(payload.playerSpeed, 0, 1);
  player.lastMotionAt = Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now();

  if (match.state === 'RUNNING') {
    tryResolveObstacle(match, player, payload);
  }
}

function tryResolveObstacle(match: VersusMatch, player: VersusPlayer, motion: MotionPayload) {
  const obstacle = player.currentObstacle;
  if (!obstacle || obstacle.resolved || Date.now() > obstacle.deadline) {
    return;
  }

  const lane: Lane = motion.lane;
  const success =
    (obstacle.type === 'JUMP' && motion.jumpDetected) ||
    (obstacle.type === 'DODGE_LEFT' && lane === 'left') ||
    (obstacle.type === 'DODGE_RIGHT' && lane === 'right') ||
    (obstacle.type === 'SIX_SEVEN' && motion.sixtySevenCount > player.lastSixtySevenCount);

  player.lastSixtySevenCount = Math.max(player.lastSixtySevenCount, motion.sixtySevenCount);

  if (success) {
    resolveObstacle(match, player, true);
  }
}

function resolveObstacle(match: VersusMatch, player: VersusPlayer, success: boolean) {
  if (!player.currentObstacle) {
    return;
  }
  player.currentObstacle.resolved = true;
  player.currentObstacle = null;

  // A cleared obstacle pushes the gap in this player's favour; a miss pushes it
  // toward the opponent. Human-favourable swings widen the gap, zombie ones
  // narrow it.
  const sign = player.role === 'HUMAN' ? 1 : -1;
  if (success) {
    player.hits += 1;
    match.gap += sign * HIT_BONUS;
  } else {
    player.misses += 1;
    match.gap -= sign * MISS_PENALTY;
  }

  player.nextObstacleAt = Date.now() + randomBetween(OBSTACLE_MIN_MS, OBSTACLE_MAX_MS);
}

function spawnObstacle(player: VersusPlayer, now: number) {
  const type: ObstacleType = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
  player.currentObstacle = {
    id: uuidv4(),
    type,
    spawnAt: now,
    deadline: now + OBSTACLE_DURATION_MS,
    resolved: false,
  };
}

export function tickMatch(match: VersusMatch, now: number) {
  const deltaMs = Math.max(0, now - match.lastTick);
  match.lastTick = now;

  if (match.state === 'COUNTDOWN' && match.countdownEndsAt && now >= match.countdownEndsAt) {
    match.state = 'RUNNING';
    match.countdownEndsAt = null;
    return;
  }

  if (match.state !== 'RUNNING') {
    return;
  }

  const human = match.players.HUMAN;
  const zombie = match.players.ZOMBIE;
  if (!human || !zombie) {
    return;
  }

  const deltaSeconds = deltaMs / 1000;
  match.elapsed += deltaSeconds;

  const humanSpeed = effectiveSpeed(human, now);
  const zombieSpeed = effectiveSpeed(zombie, now);

  // The faster runner moves the gap their way.
  match.gap += (humanSpeed - zombieSpeed) * SPEED_FACTOR * deltaSeconds;

  // Per-player obstacle lifecycle (spawn / timeout-as-miss).
  for (const player of [human, zombie]) {
    if (player.currentObstacle && now >= player.currentObstacle.deadline && !player.currentObstacle.resolved) {
      resolveObstacle(match, player, false);
    }
    if (!player.currentObstacle && now >= player.nextObstacleAt) {
      spawnObstacle(player, now);
    }
  }

  match.gap = clamp(match.gap, 0, MAX_GAP);

  if (match.gap <= 0) {
    finishMatch(match, 'ZOMBIE', 'The zombie caught the human!');
  } else if (match.elapsed >= ESCAPE_TIME_SECONDS) {
    finishMatch(match, 'HUMAN', 'The human reached the safe zone!');
  }
}

function effectiveSpeed(player: VersusPlayer, now: number): number {
  const fresh = player.lastMotionAt > 0 && now - player.lastMotionAt < VERSUS_MOTION_STALE_MS;
  return fresh ? player.speed : 0;
}

export function finishMatch(match: VersusMatch, winner: VersusRole, reason: string) {
  match.state = 'FINISHED';
  match.winner = winner;
  match.endReason = reason;
  match.countdownEndsAt = null;
  const human = match.players.HUMAN;
  const zombie = match.players.ZOMBIE;
  if (human) human.currentObstacle = null;
  if (zombie) zombie.currentObstacle = null;
}

/** Reset a finished match back to a fresh round, keeping the same players/roles. */
export function restartMatch(match: VersusMatch) {
  const now = Date.now();
  match.gap = START_GAP;
  match.elapsed = 0;
  match.winner = null;
  match.endReason = null;
  match.countdownEndsAt = null;
  match.lastTick = now;
  match.state = 'LOBBY';
  for (const player of Object.values(match.players)) {
    if (!player) continue;
    player.ready = false;
    player.speed = 0;
    player.lastMotionAt = 0;
    player.currentObstacle = null;
    player.nextObstacleAt = now + randomBetween(OBSTACLE_MIN_MS, OBSTACLE_MAX_MS);
    player.lastSixtySevenCount = 0;
    player.hits = 0;
    player.misses = 0;
  }
}

export function toPublicVersusState(match: VersusMatch): VersusPublicState {
  const players: Partial<Record<VersusRole, VersusPublicPlayer>> = {};
  for (const [role, player] of Object.entries(match.players) as [VersusRole, VersusPlayer][]) {
    players[role] = {
      role: player.role,
      name: player.name,
      connected: player.connected,
      ready: player.ready,
      speed: player.speed,
      hits: player.hits,
      misses: player.misses,
      currentObstacle: player.currentObstacle,
    };
  }

  return {
    code: match.code,
    state: match.state,
    gap: match.gap,
    maxGap: MAX_GAP,
    elapsed: match.elapsed,
    escapeTime: ESCAPE_TIME_SECONDS,
    countdownEndsAt: match.countdownEndsAt,
    winner: match.winner,
    endReason: match.endReason,
    players,
  };
}
