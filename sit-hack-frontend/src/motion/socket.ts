import { io, type Socket } from 'socket.io-client';
import type { Difficulty, MotionPayload, Obstacle, PublicGameState } from './motionTypes';

export interface ServerToClientEvents {
  'session-created': (state: PublicGameState) => void;
  'game-state': (state: PublicGameState) => void;
  obstacle: (obstacle: Obstacle) => void;
  'brainrot-boost': (event: { comboCount: number; boostUntil: number; zombieDistance: number }) => void;
  'game-over': (event: { sessionId: string; finalScore: number; survivalTime: number }) => void;
}

export interface ClientToServerEvents {
  'join-session': (payload: { playerName?: string }) => void;
  'set-difficulty': (difficulty: Difficulty) => void;
  'start-calibration': () => void;
  'confirm-calibration': () => void;
  pause: () => void;
  resume: () => void;
  'motion-update': (payload: MotionPayload) => void;
  'obstacle-result': (payload: { obstacleId: string; success: boolean }) => void;
  restart: () => void;
}

export type ZombieRunSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ZombieRunSocket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000', {
      transports: ['websocket'],
      autoConnect: false,
    });
  }

  return socket;
}
