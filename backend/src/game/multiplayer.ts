import { v4 as uuidv4 } from 'uuid';
import type {
  MotionPayload,
  MultiplayerFinishReason,
  MultiplayerPlayerInternal,
  MultiplayerRole,
  MultiplayerRoom,
  ObstacleType,
  PublicMultiplayerRoom,
} from '../types.js';
import { OBSTACLE_TYPES } from './constants.js';
import { clamp, randomBetween } from './utils.js';

// --- Tuning -----------------------------------------------------------------
const INITIAL_GAP = 55;
const MAX_GAP = 100;
const ROLE_REVEAL_MS = 3800;
const SURVIVOR_PUSH = 17; // gap units/sec at full survivor running speed
const ZOMBIE_PULL = 19; // gap units/sec at full zombie running speed
const BASE_CHASE = 3.5; // baseline gap loss/sec — the zombie always creeps closer
const OBSTACLE_BONUS = 8; // gap swing when a player nails an obstacle
const MISS_PENALTY = 6; // gap swing when a player misses an obstacle
const BOOST_BONUS = 12; // extra gap swing on a 3-combo brain-rot boost
const BOOST_MS = 2600;
const OBSTACLE_MIN_MS = 4200;
const OBSTACLE_MAX_MS = 6800;
const OBSTACLE_DURATION_MS = 3000;
const MOTION_STALE_MS = 650;
const PENALTY_VISUAL_MS = 1200;
const MIN_DURATION = 30;
const MAX_DURATION = 300;
const DEFAULT_DURATION = 60;

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class MultiplayerManager {
  private rooms = new Map<string, MultiplayerRoom>();
  private socketToRoom = new Map<string, string>();

  // --- lookups -------------------------------------------------------------
  getRoomBySocket(socketId: string): MultiplayerRoom | null {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) ?? null : null;
  }

  rooms_(): MultiplayerRoom[] {
    return [...this.rooms.values()];
  }

  // --- lobby ---------------------------------------------------------------
  createRoom(socketId: string, name: string, durationSeconds?: number): MultiplayerRoom {
    this.leave(socketId);
    const code = this.generateCode();
    const now = Date.now();
    const room: MultiplayerRoom = {
      code,
      hostSocketId: socketId,
      durationSeconds: clampDuration(durationSeconds ?? DEFAULT_DURATION),
      phase: 'LOBBY',
      players: [makePlayer(socketId, name || 'Host', true)],
      gap: INITIAL_GAP,
      initialGap: INITIAL_GAP,
      maxGap: MAX_GAP,
      startedAt: null,
      endsAt: null,
      roleRevealEndsAt: null,
      currentObstacle: null,
      nextObstacleAt: 0,
      lastUpdate: now,
      winnerRole: null,
      winnerSocketId: null,
      finishReason: null,
    };
    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);
    return room;
  }

  joinRoom(
    socketId: string,
    code: string,
    name: string,
  ): { room: MultiplayerRoom } | { error: string } {
    const normalized = (code || '').trim().toUpperCase();
    const room = this.rooms.get(normalized);
    if (!room) {
      return { error: 'Room not found. Check the code.' };
    }
    if (room.players.some((player) => player.socketId === socketId)) {
      return { room };
    }
    if (room.players.length >= 2) {
      return { error: 'That room is already full.' };
    }
    if (room.phase !== 'LOBBY') {
      return { error: 'That game has already started.' };
    }
    this.leave(socketId);
    room.players.push(makePlayer(socketId, name || 'Guest', false));
    this.socketToRoom.set(socketId, room.code);
    return { room };
  }

  setDuration(socketId: string, durationSeconds: number): MultiplayerRoom | null {
    const room = this.getRoomBySocket(socketId);
    if (!room || room.hostSocketId !== socketId || room.phase !== 'LOBBY') {
      return null;
    }
    room.durationSeconds = clampDuration(durationSeconds);
    return room;
  }

  setReady(socketId: string, ready: boolean): MultiplayerRoom | null {
    const room = this.getRoomBySocket(socketId);
    if (!room) {
      return null;
    }
    const player = room.players.find((entry) => entry.socketId === socketId);
    if (!player) {
      return null;
    }
    player.ready = ready;
    return room;
  }

  startGame(socketId: string): MultiplayerRoom | null {
    const room = this.getRoomBySocket(socketId);
    if (
      !room ||
      room.hostSocketId !== socketId ||
      room.phase !== 'LOBBY' ||
      room.players.length !== 2 ||
      !room.players.every((player) => player.ready)
    ) {
      return null;
    }

    const now = Date.now();
    const roles: MultiplayerRole[] = Math.random() < 0.5 ? ['zombie', 'survivor'] : ['survivor', 'zombie'];
    room.players.forEach((player, index) => {
      player.role = roles[index];
      player.speed = 0;
      player.comboCount = 0;
      player.boostUntil = null;
      player.obstacleResolved = false;
      player.obstaclePenaltyUntil = null;
      player.lastSixtySevenCount = 0;
      player.sixtySevenCount = 0;
      player.lastMotionAt = 0;
    });

    room.phase = 'ROLE_REVEAL';
    room.roleRevealEndsAt = now + ROLE_REVEAL_MS;
    room.gap = room.initialGap;
    room.startedAt = null;
    room.endsAt = null;
    room.currentObstacle = null;
    room.winnerRole = null;
    room.winnerSocketId = null;
    room.finishReason = null;
    room.lastUpdate = now;
    return room;
  }

  // --- gameplay ------------------------------------------------------------
  handleMotion(socketId: string, motion: MotionPayload): MultiplayerRoom | null {
    const room = this.getRoomBySocket(socketId);
    if (!room || room.phase !== 'RUNNING') {
      return null;
    }
    const player = room.players.find((entry) => entry.socketId === socketId);
    if (!player) {
      return null;
    }

    player.speed = clamp(motion.playerSpeed, 0, 1);
    player.sixtySevenCount = motion.sixtySevenCount;
    player.lastMotionAt = Date.now(); // server clock avoids cross-laptop skew

    this.tryResolveObstacle(room, player, motion);
    return room;
  }

  private tryResolveObstacle(
    room: MultiplayerRoom,
    player: MultiplayerPlayerInternal,
    motion: MotionPayload,
  ) {
    const obstacle = room.currentObstacle;
    if (!obstacle || player.obstacleResolved || Date.now() > obstacle.deadline) {
      return;
    }

    const success =
      (obstacle.type === 'JUMP' && motion.jumpDetected) ||
      (obstacle.type === 'DUCK' && motion.duckDetected) ||
      (obstacle.type === 'DODGE_LEFT' && motion.lane === 'left') ||
      (obstacle.type === 'DODGE_RIGHT' && motion.lane === 'right') ||
      (obstacle.type === 'SIX_SEVEN' && motion.sixtySevenCount > player.lastSixtySevenCount);

    player.lastSixtySevenCount = Math.max(player.lastSixtySevenCount, motion.sixtySevenCount);

    if (!success) {
      return;
    }

    player.obstacleResolved = true;
    player.comboCount += 1;
    this.shiftGap(room, player, OBSTACLE_BONUS);

    if (player.comboCount > 0 && player.comboCount % 3 === 0) {
      player.boostUntil = Date.now() + BOOST_MS;
      this.shiftGap(room, player, BOOST_BONUS);
    }

    // If both players have cleared the obstacle, retire it early.
    if (room.players.every((entry) => entry.obstacleResolved)) {
      room.currentObstacle = null;
      room.nextObstacleAt = Date.now() + randomBetween(OBSTACLE_MIN_MS, OBSTACLE_MAX_MS);
    }
  }

  /** Positive amount always helps the acting player's goal. */
  private shiftGap(room: MultiplayerRoom, player: MultiplayerPlayerInternal, amount: number) {
    room.gap += player.role === 'survivor' ? amount : -amount;
    room.gap = clamp(room.gap, 0, room.maxGap);
  }

  tick(room: MultiplayerRoom, now: number) {
    const deltaSeconds = Math.max(0, now - room.lastUpdate) / 1000;
    room.lastUpdate = now;

    if (room.phase === 'ROLE_REVEAL') {
      if (room.roleRevealEndsAt && now >= room.roleRevealEndsAt) {
        room.phase = 'RUNNING';
        room.startedAt = now;
        room.endsAt = now + room.durationSeconds * 1000;
        room.roleRevealEndsAt = null;
        room.nextObstacleAt = now + randomBetween(OBSTACLE_MIN_MS, OBSTACLE_MAX_MS);
        room.lastUpdate = now;
      }
      return;
    }

    if (room.phase !== 'RUNNING') {
      return;
    }

    const survivor = room.players.find((player) => player.role === 'survivor');
    const zombie = room.players.find((player) => player.role === 'zombie');
    const survivorSpeed = survivor && now - survivor.lastMotionAt < MOTION_STALE_MS ? survivor.speed : 0;
    const zombieSpeed = zombie && now - zombie.lastMotionAt < MOTION_STALE_MS ? zombie.speed : 0;

    room.gap +=
      (survivorSpeed * SURVIVOR_PUSH - zombieSpeed * ZOMBIE_PULL - BASE_CHASE) * deltaSeconds;

    // Obstacle deadline: penalise whoever did not clear it, then retire it.
    if (room.currentObstacle && now >= room.currentObstacle.deadline) {
      for (const player of room.players) {
        if (!player.obstacleResolved) {
          this.shiftGap(room, player, -MISS_PENALTY);
          player.obstaclePenaltyUntil = now + PENALTY_VISUAL_MS;
          player.comboCount = 0;
        }
      }
      room.currentObstacle = null;
      room.nextObstacleAt = now + randomBetween(OBSTACLE_MIN_MS, OBSTACLE_MAX_MS);
    }

    if (!room.currentObstacle && now >= room.nextObstacleAt) {
      this.spawnObstacle(room, now);
    }

    room.gap = clamp(room.gap, 0, room.maxGap);

    if (room.gap <= 0) {
      this.finish(room, 'zombie', 'caught');
    } else if (room.endsAt && now >= room.endsAt) {
      this.finish(room, 'survivor', 'timeout');
    }
  }

  private spawnObstacle(room: MultiplayerRoom, now: number) {
    const type: ObstacleType = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    room.currentObstacle = {
      id: uuidv4(),
      type,
      spawnAt: now,
      deadline: now + OBSTACLE_DURATION_MS,
      resolved: false,
    };
    for (const player of room.players) {
      player.obstacleResolved = false;
      player.lastSixtySevenCount = player.sixtySevenCount;
    }
    room.nextObstacleAt = now + randomBetween(OBSTACLE_MIN_MS, OBSTACLE_MAX_MS);
  }

  private finish(room: MultiplayerRoom, role: MultiplayerRole, reason: MultiplayerFinishReason) {
    room.phase = 'FINISHED';
    room.winnerRole = role;
    room.winnerSocketId = room.players.find((player) => player.role === role)?.socketId ?? null;
    room.finishReason = reason;
    room.currentObstacle = null;
  }

  // --- leaving / disconnect ------------------------------------------------
  /** Returns the room (post-mutation) the socket was in, so the caller can broadcast. */
  leave(socketId: string): MultiplayerRoom | null {
    const code = this.socketToRoom.get(socketId);
    if (!code) {
      return null;
    }
    this.socketToRoom.delete(socketId);
    const room = this.rooms.get(code);
    if (!room) {
      return null;
    }

    const wasActive = room.phase === 'RUNNING' || room.phase === 'ROLE_REVEAL';
    room.players = room.players.filter((player) => player.socketId !== socketId);

    if (room.players.length === 0) {
      this.rooms.delete(code);
      return null;
    }

    // Promote the remaining player to host.
    const remaining = room.players[0];
    remaining.isHost = true;
    room.hostSocketId = remaining.socketId;

    if (wasActive) {
      // Opponent bailed mid-game: remaining player wins by abandonment.
      room.phase = 'FINISHED';
      room.finishReason = 'abandoned';
      room.winnerSocketId = remaining.socketId;
      room.winnerRole = remaining.role;
      room.currentObstacle = null;
    } else {
      remaining.ready = false;
    }
    return room;
  }

  // --- serialisation -------------------------------------------------------
  toPublicRoom(room: MultiplayerRoom): PublicMultiplayerRoom {
    return {
      code: room.code,
      hostSocketId: room.hostSocketId,
      durationSeconds: room.durationSeconds,
      phase: room.phase,
      players: room.players.map((player) => ({
        socketId: player.socketId,
        name: player.name,
        isHost: player.isHost,
        ready: player.ready,
        role: player.role,
        speed: Number(player.speed.toFixed(3)),
        sixtySevenCount: player.sixtySevenCount,
        obstacleResolved: player.obstacleResolved,
        obstaclePenaltyUntil: player.obstaclePenaltyUntil,
        lastSixtySevenCount: player.lastSixtySevenCount,
        connected: player.connected,
        boostUntil: player.boostUntil,
      })),
      gap: Number(room.gap.toFixed(2)),
      initialGap: room.initialGap,
      maxGap: room.maxGap,
      startedAt: room.startedAt,
      endsAt: room.endsAt,
      roleRevealEndsAt: room.roleRevealEndsAt,
      currentObstacle: room.currentObstacle,
      winnerRole: room.winnerRole,
      winnerSocketId: room.winnerSocketId,
      finishReason: room.finishReason,
      serverNow: Date.now(),
    };
  }

  private generateCode(): string {
    let code = '';
    do {
      code = Array.from(
        { length: 4 },
        () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }
}

function makePlayer(socketId: string, name: string, isHost: boolean): MultiplayerPlayerInternal {
  return {
    socketId,
    name,
    isHost,
    ready: false,
    role: null,
    speed: 0,
    sixtySevenCount: 0,
    obstacleResolved: false,
    obstaclePenaltyUntil: null,
    lastSixtySevenCount: 0,
    connected: true,
    boostUntil: null,
    lastMotionAt: 0,
    comboCount: 0,
  };
}

function clampDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return DEFAULT_DURATION;
  }
  return Math.round(clamp(seconds, MIN_DURATION, MAX_DURATION));
}
