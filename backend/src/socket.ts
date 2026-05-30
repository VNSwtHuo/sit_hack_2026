import type { Server, Socket } from 'socket.io';
import {
  confirmCalibration,
  createSession,
  handleMotionUpdate,
  handleObstacleResult,
  pauseSession,
  restartSession,
  resumeSession,
  startCalibration,
  tickSession,
  toPublicGameState,
} from './game/engine.js';
import { GAME_UPDATE_MS } from './game/constants.js';
import { MultiplayerManager } from './game/multiplayer.js';
import type { GameSession, MotionPayload, MultiplayerRoom } from './types.js';

const sessions = new Map<string, GameSession>();
const multiplayer = new MultiplayerManager();

function emitGameState(socket: Socket, session: GameSession) {
  socket.emit('game-state', toPublicGameState(session));
}

function broadcastRoom(io: Server, room: MultiplayerRoom | null) {
  if (room) {
    io.to(room.code).emit('multiplayer-state', multiplayer.toPublicRoom(room));
  }
}

function bindSessionHandlers(io: Server, socket: Socket) {
  const session = createSession('Runner');
  sessions.set(socket.id, session);

  socket.emit('session-created', toPublicGameState(session));
  emitGameState(socket, session);

  // ---- single player -------------------------------------------------------
  socket.on('join-session', ({ playerName }: { playerName?: string }) => {
    if (playerName) {
      session.playerName = playerName;
    }
    emitGameState(socket, session);
  });

  socket.on('start-calibration', () => {
    startCalibration(session);
    emitGameState(socket, session);
  });

  socket.on('confirm-calibration', () => {
    confirmCalibration(session);
    emitGameState(socket, session);
  });

  socket.on('pause', () => {
    pauseSession(session);
    emitGameState(socket, session);
  });

  socket.on('resume', () => {
    resumeSession(session);
    emitGameState(socket, session);
  });

  socket.on('motion-update', (payload: MotionPayload) => {
    handleMotionUpdate(session, payload);
    emitGameState(socket, session);
  });

  socket.on('obstacle-result', ({ obstacleId, success }: { obstacleId: string; success: boolean }) => {
    handleObstacleResult(session, obstacleId, success);
    emitGameState(socket, session);
  });

  socket.on('restart', () => {
    restartSession(session);
    emitGameState(socket, session);
  });

  // ---- two player (LAN) ----------------------------------------------------
  socket.on('multiplayer-create-room', ({ playerName, targetDistance }: { playerName?: string; targetDistance?: number }) => {
    const previous = multiplayer.getRoomBySocket(socket.id);
    if (previous) {
      socket.leave(previous.code);
    }
    const room = multiplayer.createRoom(socket.id, playerName ?? 'Host', targetDistance);
    socket.join(room.code);
    broadcastRoom(io, room);
  });

  socket.on('multiplayer-join-room', ({ roomCode, playerName }: { roomCode?: string; playerName?: string }) => {
    const result = multiplayer.joinRoom(socket.id, roomCode ?? '', playerName ?? 'Guest');
    if ('error' in result) {
      socket.emit('multiplayer-error', { message: result.error });
      return;
    }
    socket.join(result.room.code);
    broadcastRoom(io, result.room);
  });

  socket.on('multiplayer-set-target', ({ targetDistance }: { targetDistance: number }) => {
    broadcastRoom(io, multiplayer.setTarget(socket.id, targetDistance));
  });

  socket.on('multiplayer-ready', ({ ready }: { ready: boolean }) => {
    broadcastRoom(io, multiplayer.setReady(socket.id, ready));
  });

  socket.on('multiplayer-start', () => {
    broadcastRoom(io, multiplayer.startGame(socket.id));
  });

  socket.on('multiplayer-motion-update', (payload: MotionPayload) => {
    // Gap/obstacle changes are streamed by the tick loop; no per-message broadcast.
    multiplayer.handleMotion(socket.id, payload);
  });

  socket.on('multiplayer-leave-room', () => {
    const code = multiplayer.getRoomBySocket(socket.id)?.code;
    const room = multiplayer.leave(socket.id);
    if (code) {
      socket.leave(code);
    }
    broadcastRoom(io, room);
  });

  socket.on('disconnect', () => {
    sessions.delete(socket.id);
    const room = multiplayer.leave(socket.id);
    broadcastRoom(io, room);
  });
}

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket) => bindSessionHandlers(io, socket));

  setInterval(() => {
    const now = Date.now();

    // Single-player sessions.
    sessions.forEach((session, socketId) => {
      tickSession(session, now);
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) {
        sessions.delete(socketId);
        return;
      }

      emitGameState(socket, session);

      const obstacleId = session.currentObstacle?.id ?? null;
      if (session.currentObstacle && obstacleId !== session.lastEmittedObstacleId) {
        socket.emit('obstacle', session.currentObstacle);
      }
      session.lastEmittedObstacleId = obstacleId;

      const boostActive = Boolean(session.boostUntil && session.boostUntil > now);
      if (boostActive && session.comboCount > 0 && session.comboCount % 3 === 0) {
        if (session.boostAnnouncedCombo !== session.comboCount) {
          socket.emit('brainrot-boost', {
            comboCount: session.comboCount,
            boostUntil: session.boostUntil as number,
            zombieDistance: session.zombieDistance,
          });
          session.boostAnnouncedCombo = session.comboCount;
        }
      }

      if (session.gameState === 'GAME_OVER' && !session.gameOverEmitted) {
        socket.emit('game-over', {
          sessionId: session.sessionId,
          finalScore: Math.round(session.score),
          survivalTime: session.survivalTime,
        });
        session.gameOverEmitted = true;
      }
    });

    // Multiplayer rooms: tick and stream active ones.
    multiplayer.allRooms().forEach((room) => {
      const previousPhase = room.phase;
      multiplayer.tick(room, now);
      const becameFinished = previousPhase !== 'FINISHED' && room.phase === 'FINISHED';
      if (room.phase === 'ROLE_REVEAL' || room.phase === 'RUNNING' || becameFinished) {
        broadcastRoom(io, room);
      }
    });
  }, GAME_UPDATE_MS);
}
