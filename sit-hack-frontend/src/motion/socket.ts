import { io, type Socket } from 'socket.io-client';
import type { MotionPayload, Obstacle, PublicGameState, PublicMultiplayerRoom } from './motionTypes';

export interface ServerToClientEvents {
  'session-created': (state: PublicGameState) => void;
  'game-state': (state: PublicGameState) => void;
  obstacle: (obstacle: Obstacle) => void;
  'brainrot-boost': (event: { comboCount: number; boostUntil: number; zombieDistance: number }) => void;
  'game-over': (event: { sessionId: string; finalScore: number; survivalTime: number }) => void;
  'multiplayer-state': (room: PublicMultiplayerRoom) => void;
  'multiplayer-error': (event: { message: string }) => void;
}

export interface ClientToServerEvents {
  'join-session': (payload: { playerName?: string }) => void;
  'start-calibration': () => void;
  'confirm-calibration': () => void;
  pause: () => void;
  resume: () => void;
  'motion-update': (payload: MotionPayload) => void;
  'obstacle-result': (payload: { obstacleId: string; success: boolean }) => void;
  restart: () => void;
  'multiplayer-create-room': (payload: { playerName?: string; targetDistance?: number }) => void;
  'multiplayer-join-room': (payload: { roomCode?: string; playerName?: string }) => void;
  'multiplayer-set-target': (payload: { targetDistance: number }) => void;
  'multiplayer-ready': (payload: { ready: boolean }) => void;
  'multiplayer-start': () => void;
  'multiplayer-motion-update': (payload: MotionPayload) => void;
  'multiplayer-leave-room': () => void;
}

export type ZombieRunSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ZombieRunSocket | null = null;

export function getSocket() {
  if (!socket) {
    // In production set VITE_SOCKET_URL to your deployed backend URL
    // (e.g. https://zombie-run-backend.onrender.com). Locally it falls back to
    // the same host on :4000, which also works for LAN play.
    const defaultSocketUrl = `${window.location.protocol}//${window.location.hostname}:4000`;
    socket = io(import.meta.env.VITE_SOCKET_URL || defaultSocketUrl, {
      // Prefer WebSocket, but allow HTTPS long-polling as a fallback for
      // networks/proxies that block raw WebSockets.
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }

  return socket;
}
