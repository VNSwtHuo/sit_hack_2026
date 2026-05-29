import { confirmCalibration, createSession, handleMotionUpdate, handleObstacleResult, pauseSession, restartSession, resumeSession, setDifficulty, startCalibration, tickSession, toPublicGameState, } from './game/engine.js';
import { GAME_UPDATE_MS } from './game/constants.js';
const sessions = new Map();
function emitGameState(socket, session) {
    socket.emit('game-state', toPublicGameState(session));
}
function bindSessionHandlers(socket) {
    const session = createSession('Runner');
    sessions.set(socket.id, session);
    socket.emit('session-created', toPublicGameState(session));
    emitGameState(socket, session);
    socket.on('join-session', ({ playerName }) => {
        if (playerName) {
            session.playerName = playerName;
        }
        emitGameState(socket, session);
    });
    socket.on('set-difficulty', (difficulty) => {
        if (difficulty === 'EASY' || difficulty === 'NORMAL' || difficulty === 'HARD') {
            setDifficulty(session, difficulty);
            emitGameState(socket, session);
        }
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
    socket.on('motion-update', (payload) => {
        handleMotionUpdate(session, payload);
        emitGameState(socket, session);
    });
    socket.on('obstacle-result', ({ obstacleId, success }) => {
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
}
export function registerSocketHandlers(io) {
    io.on('connection', bindSessionHandlers);
    setInterval(() => {
        const now = Date.now();
        sessions.forEach((session, socketId) => {
            tickSession(session, now);
            const socket = io.sockets.sockets.get(socketId);
            if (!socket) {
                sessions.delete(socketId);
                return;
            }
            const previousObstacleId = session.currentObstacle?.id;
            emitGameState(socket, session);
            if (session.currentObstacle && session.currentObstacle.id !== previousObstacleId) {
                socket.emit('obstacle', session.currentObstacle);
            }
            if (session.boostUntil && session.boostUntil > now && session.comboCount > 0 && session.comboCount % 3 === 0) {
                socket.emit('brainrot-boost', {
                    comboCount: session.comboCount,
                    boostUntil: session.boostUntil,
                    zombieDistance: session.zombieDistance,
                });
            }
            if (session.gameState === 'GAME_OVER') {
                socket.emit('game-over', {
                    sessionId: session.sessionId,
                    finalScore: Math.round(session.score),
                    survivalTime: session.survivalTime,
                });
            }
        });
    }, GAME_UPDATE_MS);
}
