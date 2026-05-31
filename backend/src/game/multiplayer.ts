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
const HEAD_START_M = 20; // survivor's starting lead, in metres
const FULL_SPEED_MPS = 8; // metres/second a player gains at full running speed
const ROLE_REVEAL_MS = 3800;
const OBSTACLE_BONUS_M = 6; // metres gained for clearing an obstacle
// Metres lost for missing an obstacle. Applied to the misser's own distance,
// so a zombie miss grows the gap (survivor pulls ahead) and a survivor miss
// shrinks it (zombie closes in).
const MISS_PENALTY_M = 12;
const BOOST_BONUS_M = 10; // extra metres on a 3-combo brain-rot boost
const BOOST_MS = 2600;
const OBSTACLE_MIN_MS = 4200;
const OBSTACLE_MAX_MS = 6800;
const OBSTACLE_DURATION_MS = 3000;
const MOTION_STALE_MS = 650;
const PENALTY_VISUAL_MS = 1200;
const MIN_TARGET_M = 100;
const MAX_TARGET_M = 10000;
const DEFAULT_TARGET_M = 1000;

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class MultiplayerManager {
  private rooms = new Map<string, MultiplayerRoom>();
  private socketToRoom = new Map<string, string>();

  // --- lookups -------------------------------------------------------------
  getRoomBySocket(socketId: string): MultiplayerRoom | null {
    const code = this.socketToRoom.get(socketId);
    return code ? this.rooms.get(code) ?? null : null;
  }

  allRooms(): MultiplayerRoom[] {
    return [...this.rooms.values()];
  }

  // --- lobby ---------------------------------------------------------------
  createRoom(socketId: string, name: string, targetDistance?: number): MultiplayerRoom {
    this.leave(socketId);
    const code = this.generateCode();
    const now = Date.now();
    const room: MultiplayerRoom = {
      code,
      hostSocketId: socketId,
      targetDistance: clampTarget(targetDistance ?? DEFAULT_TARGET_M),
      headStart: HEAD_START_M,
      phase: 'LOBBY',
      players: [makePlayer(socketId, name || 'Host', true)],
      gap: HEAD_START_M,
      startedAt: null,
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

  setTarget(socketId: string, targetDistance: number): MultiplayerRoom | null {
    const room = this.getRoomBySocket(socketId);
    if (!room || room.hostSocketId !== socketId || room.phase !== 'LOBBY') {
      return null;
    }
    room.targetDistance = clampTarget(targetDistance);
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
      player.distance = 0;
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
    room.gap = room.headStart;
    room.startedAt = null;
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
    player.distance = Math.max(0, player.distance + OBSTACLE_BONUS_M);

    if (player.comboCount > 0 && player.comboCount % 3 === 0) {
      player.boostUntil = Date.now() + BOOST_MS;
      player.distance += BOOST_BONUS_M;
    }

    // If both players cleared the obstacle, retire it early.
    if (room.players.every((entry) => entry.obstacleResolved)) {
      room.currentObstacle = null;
      room.nextObstacleAt = Date.now() + randomBetween(OBSTACLE_MIN_MS, OBSTACLE_MAX_MS);
    }
  }

  tick(room: MultiplayerRoom, now: number) {
    const deltaSeconds = Math.max(0, now - room.lastUpdate) / 1000;
    room.lastUpdate = now;

    if (room.phase === 'ROLE_REVEAL') {
      if (room.roleRevealEndsAt && now >= room.roleRevealEndsAt) {
        room.phase = 'RUNNING';
        room.startedAt = now;
        room.roleRevealEndsAt = null;
        room.nextObstacleAt = now + randomBetween(OBSTACLE_MIN_MS, OBSTACLE_MAX_MS);
        room.lastUpdate = now;
      }
      return;
    }

    if (room.phase !== 'RUNNING') {
      return;
    }

    // Both players accumulate distance from their running activity.
    for (const player of room.players) {
      const fresh = now - player.lastMotionAt < MOTION_STALE_MS;
      const speed = fresh ? player.speed : 0;
      player.distance += speed * FULL_SPEED_MPS * deltaSeconds;
    }

    // Obstacle deadline: penalise whoever did not clear it, then retire it.
    if (room.currentObstacle && now >= room.currentObstacle.deadline) {
      for (const player of room.players) {
        if (!player.obstacleResolved) {
          player.distance = Math.max(0, player.distance - MISS_PENALTY_M);
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

    const survivor = room.players.find((player) => player.role === 'survivor');
    const zombie = room.players.find((player) => player.role === 'zombie');
    const survivorDistance = survivor?.distance ?? 0;
    const zombieDistance = zombie?.distance ?? 0;
    room.gap = survivorDistance + room.headStart - zombieDistance;

    if (room.gap <= 0) {
      this.finish(room, 'zombie', 'caught');
    } else if (survivorDistance >= room.targetDistance) {
      this.finish(room, 'survivor', 'reached');
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
      targetDistance: room.targetDistance,
      headStart: room.headStart,
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
        distance: Math.max(0, Math.round(player.distance)),
      })),
      gap: Number(room.gap.toFixed(2)),
      startedAt: room.startedAt,
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
    distance: 0,
    lastMotionAt: 0,
    comboCount: 0,
  };
}

function clampTarget(meters: number): number {
  if (!Number.isFinite(meters)) {
    return DEFAULT_TARGET_M;
  }
  return Math.round(clamp(meters, MIN_TARGET_M, MAX_TARGET_M));
}
