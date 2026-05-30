import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from './socket';
import type { MotionPayload, PublicGameState } from './motionTypes';

export function useGameSocket() {
  const socketRef = useRef(getSocket());
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<PublicGameState | null>(null);
  const [boostMessage, setBoostMessage] = useState<string | null>(null);

  useEffect(() => {
    const socket = socketRef.current;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onGameState = (state: PublicGameState) => setGameState(state);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('session-created', onGameState);
    socket.on('game-state', onGameState);
    socket.on('brainrot-boost', (event) => {
      setBoostMessage(`BrainRotBoost x${event.comboCount}`);
      window.setTimeout(() => setBoostMessage(null), 1800);
    });

    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('session-created', onGameState);
      socket.off('game-state', onGameState);
      socket.disconnect();
    };
  }, []);

  const emitMotion = useCallback((motion: MotionPayload) => {
    if (socketRef.current.connected) {
      socketRef.current.emit('motion-update', motion);
    }
  }, []);

  const startCalibration = useCallback(() => socketRef.current.emit('start-calibration'), []);
  const confirmCalibration = useCallback(() => socketRef.current.emit('confirm-calibration'), []);
  const restart = useCallback(() => socketRef.current.emit('restart'), []);
  const pause = useCallback(() => socketRef.current.emit('pause'), []);
  const resume = useCallback(() => socketRef.current.emit('resume'), []);

  return {
    connected,
    gameState,
    boostMessage,
    startCalibration,
    confirmCalibration,
    restart,
    pause,
    resume,
    emitMotion,
  };
}
