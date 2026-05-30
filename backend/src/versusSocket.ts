import type { Server, Socket } from 'socket.io';
import type { MotionPayload } from './types.js';
import {
  applyVersusMotion,
  createMatch,
  finishMatch,
  findPlayerBySocket,
  joinMatch,
  markReady,
  otherRole,
  playerCount,
  restartMatch,
  tickMatch,
  toPublicVersusState,
  VERSUS_TICK_MS,
  type VersusMatch,
  type VersusRole,
} from './game/versus.js';

const matches = new Map<string, VersusMatch>();
// socket.id -> match code, so we can find a player's match on motion/disconnect.
const socketToCode = new Map<string, string>();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily-confused chars

function generateCode(): string {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
  } while (matches.has(code));
  return code;
}

function broadcastState(io: Server, match: VersusMatch) {
  io.to(match.code).emit('versus:state', toPublicVersusState(match));
}

function cleanupMatch(match: VersusMatch) {
  for (const player of Object.values(match.players)) {
    if (player) {
      socketToCode.delete(player.socketId);
    }
  }
  matches.delete(match.code);
}

export function registerVersusHandlers(io: Server, socket: Socket) {
  socket.on(
    'versus:create',
    ({ name, role }: { name?: string; role?: VersusRole }) => {
      // Leave any previous match first.
      handleLeave(io, socket);

      const code = generateCode();
      const hostRole: VersusRole = role === 'ZOMBIE' ? 'ZOMBIE' : 'HUMAN';
      const match = createMatch(code, socket.id, (name || 'Player').slice(0, 20), hostRole);
      matches.set(code, match);
      socketToCode.set(socket.id, code);
      socket.join(code);

      socket.emit('versus:created', { code, role: hostRole });
      broadcastState(io, match);
    },
  );

  socket.on('versus:join', ({ code, name }: { code?: string; name?: string }) => {
    const normalized = (code || '').trim().toUpperCase();
    const match = matches.get(normalized);
    if (!match) {
      socket.emit('versus:error', { message: 'No match found for that code.' });
      return;
    }
    if (playerCount(match) >= 2) {
      socket.emit('versus:error', { message: 'That match is already full.' });
      return;
    }

    handleLeave(io, socket);

    const role = joinMatch(match, socket.id, (name || 'Player').slice(0, 20));
    if (!role) {
      socket.emit('versus:error', { message: 'That match is already full.' });
      return;
    }
    socketToCode.set(socket.id, match.code);
    socket.join(match.code);

    socket.emit('versus:joined', { code: match.code, role });
    broadcastState(io, match);
  });

  socket.on('versus:ready', () => {
    const match = getMatch(socket);
    if (!match) return;
    markReady(match, socket.id);
    broadcastState(io, match);
  });

  socket.on('versus:motion', (payload: MotionPayload) => {
    const match = getMatch(socket);
    if (!match) return;
    applyVersusMotion(match, socket.id, payload);
  });

  socket.on('versus:restart', () => {
    const match = getMatch(socket);
    if (!match) return;
    restartMatch(match);
    broadcastState(io, match);
  });

  socket.on('versus:leave', () => {
    handleLeave(io, socket);
  });

  socket.on('disconnect', () => {
    handleLeave(io, socket);
  });
}

function getMatch(socket: Socket): VersusMatch | undefined {
  const code = socketToCode.get(socket.id);
  return code ? matches.get(code) : undefined;
}

function handleLeave(io: Server, socket: Socket) {
  const code = socketToCode.get(socket.id);
  if (!code) return;
  const match = matches.get(code);
  socketToCode.delete(socket.id);
  socket.leave(code);
  if (!match) return;

  const leaving = findPlayerBySocket(match, socket.id);
  if (!leaving) return;

  // Remove the player from the match.
  delete match.players[leaving.role];

  if (playerCount(match) === 0) {
    cleanupMatch(match);
    return;
  }

  // A mid-game departure hands the win to whoever stayed.
  if (match.state === 'RUNNING' || match.state === 'COUNTDOWN') {
    finishMatch(match, otherRole(leaving.role), 'Opponent left the match.');
  } else if (match.state === 'FINISHED') {
    // leave the result as-is
  }
  broadcastState(io, match);
}

export function startVersusLoop(io: Server) {
  setInterval(() => {
    const now = Date.now();
    matches.forEach((match) => {
      const before = match.state;
      tickMatch(match, now);
      if (match.state === 'RUNNING' || match.state === 'COUNTDOWN' || before !== match.state) {
        broadcastState(io, match);
      }
    });
  }, VERSUS_TICK_MS);
}
