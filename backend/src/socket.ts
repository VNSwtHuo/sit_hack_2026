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
import { registerVersusHandlers, startVersusLoop } from './versusSocket.js';
import type { GameSession, MotionPayload } from './types.js';

const sessions = new Map<string, GameSession>();

function emitGameState(socket: Socket, session: GameSession) {
  socket.emit('game-state', toPublicGameState(session));
}

function bindSessionHandlers(io: Server, socket: Socket) {
  const session = createSession('Runner');
  sessions.set(socket.id, session);

  socket.emit('session-created', toPublicGameState(session));
  emitGameState(socket, session);

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

  socket.on('disconnect', () => {
    sessions.delete(socket.id);
  });

  // Two-player versus mode shares the same socket connection.
  registerVersusHandlers(io, socket);
}

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => bindSessionHandlers(io, socket));
  startVersusLoop(io);

  setInterval(() => {
    const now = Date.now();
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
  }, GAME_UPDATE_MS);
}
