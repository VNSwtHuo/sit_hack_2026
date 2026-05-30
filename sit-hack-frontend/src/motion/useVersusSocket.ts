import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from './socket';
import type { MotionPayload, VersusPublicState, VersusRole } from './motionTypes';

/**
 * Socket layer for the two-player versus mode. Reuses the singleton Socket.IO
 * connection and exposes the room/match lifecycle (create, join, ready,
 * restart) plus the broadcast match state and this client's assigned role.
 */
export function useVersusSocket() {
  const socketRef = useRef(getSocket());
  const [connected, setConnected] = useState(socketRef.current.connected);
  const [role, setRole] = useState<VersusRole | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [versusState, setVersusState] = useState<VersusPublicState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = socketRef.current;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onCreated = ({ code: c, role: r }: { code: string; role: VersusRole }) => {
      setCode(c);
      setRole(r);
      setError(null);
    };
    const onJoined = ({ code: c, role: r }: { code: string; role: VersusRole }) => {
      setCode(c);
      setRole(r);
      setError(null);
    };
    const onState = (state: VersusPublicState) => setVersusState(state);
    const onError = ({ message }: { message: string }) => setError(message);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('versus:created', onCreated);
    socket.on('versus:joined', onJoined);
    socket.on('versus:state', onState);
    socket.on('versus:error', onError);

    if (!socket.connected) {
      socket.connect();
    } else {
      setConnected(true);
    }

    return () => {
      socket.emit('versus:leave');
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('versus:created', onCreated);
      socket.off('versus:joined', onJoined);
      socket.off('versus:state', onState);
      socket.off('versus:error', onError);
    };
  }, []);

  const createMatch = useCallback((name: string, chosenRole: VersusRole) => {
    setError(null);
    socketRef.current.emit('versus:create', { name, role: chosenRole });
  }, []);

  const joinMatch = useCallback((joinCode: string, name: string) => {
    setError(null);
    socketRef.current.emit('versus:join', { code: joinCode, name });
  }, []);

  const sendReady = useCallback(() => socketRef.current.emit('versus:ready'), []);
  const restartMatch = useCallback(() => socketRef.current.emit('versus:restart'), []);
  const leaveMatch = useCallback(() => {
    socketRef.current.emit('versus:leave');
    setRole(null);
    setCode(null);
    setVersusState(null);
  }, []);

  const emitMotion = useCallback((motion: MotionPayload) => {
    if (socketRef.current.connected) {
      socketRef.current.emit('versus:motion', motion);
    }
  }, []);

  return {
    connected,
    role,
    code,
    versusState,
    error,
    createMatch,
    joinMatch,
    sendReady,
    restartMatch,
    leaveMatch,
    emitMotion,
  };
}
