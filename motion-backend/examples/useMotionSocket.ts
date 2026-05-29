import { useEffect, useRef, useState } from "react";

export type MotionData = {
  speed: number;
  isRunning: boolean;
  jump: boolean;
  lane: "left" | "center" | "right";
  sixtySevenCount: number;
  confidence: number;
};

const initialMotion: MotionData = {
  speed: 0,
  isRunning: false,
  jump: false,
  lane: "center",
  sixtySevenCount: 0,
  confidence: 0,
};

export function useMotionSocket(url = "ws://localhost:8000/ws/motion") {
  const [motion, setMotion] = useState<MotionData>(initialMotion);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let socket: WebSocket | undefined;
    let closedByEffect = false;

    const connect = () => {
      socket = new WebSocket(url);

      socket.onopen = () => setConnected(true);
      socket.onmessage = (event) => {
        const nextMotion = JSON.parse(event.data) as MotionData;
        setMotion(nextMotion);
      };
      socket.onclose = () => {
        setConnected(false);
        if (!closedByEffect) {
          reconnectTimer.current = window.setTimeout(connect, 800);
        }
      };
      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      closedByEffect = true;
      window.clearTimeout(reconnectTimer.current);
      socket?.close();
    };
  }, [url]);

  return { motion, connected };
}
