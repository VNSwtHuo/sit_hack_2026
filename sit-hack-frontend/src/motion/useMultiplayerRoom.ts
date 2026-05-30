import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "./socket";
import type { MotionPayload, PublicMultiplayerRoom } from "./motionTypes";

export function useMultiplayerRoom() {
  const socketRef = useRef(getSocket());
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | undefined>(undefined);
  const [room, setRoom] = useState<PublicMultiplayerRoom | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = socketRef.current;
    const onConnect = () => {
      setConnected(true);
      setSocketId(socket.id);
    };
    const onDisconnect = () => {
      setConnected(false);
      setSocketId(undefined);
    };
    const onRoom = (nextRoom: PublicMultiplayerRoom) => {
      setRoom(nextRoom);
      setError(null);
    };
    const onError = (event: { message: string }) => setError(event.message);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("multiplayer-state", onRoom);
    socket.on("multiplayer-error", onError);
    socket.connect();
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("multiplayer-state", onRoom);
      socket.off("multiplayer-error", onError);
      socket.emit("multiplayer-leave-room");
    };
  }, []);

  const createRoom = useCallback(
    (payload: { playerName?: string; targetDistance?: number }) => {
      socketRef.current.emit("multiplayer-create-room", payload);
    },
    [],
  );

  const joinRoom = useCallback(
    (payload: { roomCode?: string; playerName?: string }) => {
      socketRef.current.emit("multiplayer-join-room", payload);
    },
    [],
  );

  const setTarget = useCallback((targetDistance: number) => {
    socketRef.current.emit("multiplayer-set-target", { targetDistance });
  }, []);

  const setReady = useCallback((ready: boolean) => {
    socketRef.current.emit("multiplayer-ready", { ready });
  }, []);

  const startRoom = useCallback(() => {
    socketRef.current.emit("multiplayer-start");
  }, []);

  const sendMotion = useCallback((motion: MotionPayload) => {
    socketRef.current.emit("multiplayer-motion-update", motion);
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current.emit("multiplayer-leave-room");
    setRoom(null);
  }, []);

  return {
    socketId,
    connected,
    room,
    error,
    createRoom,
    joinRoom,
    setTarget,
    setReady,
    startRoom,
    sendMotion,
    leaveRoom,
  };
}
