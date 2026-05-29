import { useCallback, useEffect, useRef, useState } from 'react';
import type { PoseLandmark } from './motionTypes';

interface PoseResult {
  poseLandmarks?: PoseLandmark[];
}

interface MediaPipePose {
  setOptions: (options: Record<string, boolean | number>) => void;
  onResults: (callback: (results: PoseResult) => void) => void;
  send: (payload: { image: HTMLVideoElement }) => Promise<void>;
  close: () => void;
}

interface MediaPipeCamera {
  start: () => Promise<void>;
  stop: () => void;
}

interface CameraConstructor {
  new (
    videoElement: HTMLVideoElement,
    options: { width: number; height: number; onFrame: () => Promise<void> },
  ): MediaPipeCamera;
}

interface PoseConstructor {
  new (options: { locateFile: (file: string) => string }): MediaPipePose;
}

declare global {
  interface Window {
    Camera?: CameraConstructor;
    Pose?: PoseConstructor;
  }
}

const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [28, 30],
  [30, 32],
];

const SCRIPT_URLS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
];

export function usePoseTracker() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<MediaPipeCamera | null>(null);
  const poseRef = useRef<MediaPipePose | null>(null);
  const frameTimesRef = useRef<number[]>([]);
  const [landmarks, setLandmarks] = useState<PoseLandmark[]>([]);
  const [fps, setFps] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drawResults = useCallback((results: PoseResult) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      context.strokeStyle = '#38bdf8';
      context.lineWidth = 3;
      POSE_CONNECTIONS.forEach(([from, to]) => {
        const a = results.poseLandmarks?.[from];
        const b = results.poseLandmarks?.[to];
        if (!a || !b || (a.visibility ?? 1) < 0.35 || (b.visibility ?? 1) < 0.35) {
          return;
        }
        context.beginPath();
        context.moveTo(a.x * canvas.width, a.y * canvas.height);
        context.lineTo(b.x * canvas.width, b.y * canvas.height);
        context.stroke();
      });

      context.fillStyle = '#facc15';
      results.poseLandmarks.forEach((landmark) => {
        if ((landmark.visibility ?? 1) < 0.35) {
          return;
        }
        context.beginPath();
        context.arc(landmark.x * canvas.width, landmark.y * canvas.height, 4, 0, Math.PI * 2);
        context.fill();
      });
    }

    context.restore();
  }, []);

  const start = useCallback(async () => {
    if (!videoRef.current || cameraRef.current) {
      return;
    }

    try {
      await loadMediaPipeScripts();

      if (!window.Pose || !window.Camera) {
        throw new Error('MediaPipe scripts loaded without Pose or Camera globals');
      }

      const pose = new window.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      pose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.onResults((results: PoseResult) => {
        const now = performance.now();
        frameTimesRef.current.push(now);
        frameTimesRef.current = frameTimesRef.current.filter((time) => now - time < 1000);
        setFps(frameTimesRef.current.length);

        const nextLandmarks = results.poseLandmarks ?? [];
        setLandmarks(nextLandmarks);
        setConfidence(
          nextLandmarks.length
            ? nextLandmarks.reduce((sum, landmark) => sum + (landmark.visibility ?? 1), 0) / nextLandmarks.length
            : 0,
        );
        drawResults(results);
      });

      poseRef.current = pose;
      cameraRef.current = new window.Camera(videoRef.current, {
        width: 640,
        height: 480,
        onFrame: async () => {
          if (videoRef.current) {
            await pose.send({ image: videoRef.current });
          }
        },
      });

      await cameraRef.current.start();
      setIsRunning(true);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to start camera');
      setIsRunning(false);
    }
  }, [drawResults]);

  const stop = useCallback(() => {
    cameraRef.current?.stop();
    poseRef.current?.close();
    cameraRef.current = null;
    poseRef.current = null;
    setIsRunning(false);
  }, []);

  useEffect(() => stop, [stop]);

  return {
    videoRef,
    canvasRef,
    landmarks,
    fps,
    confidence,
    isRunning,
    error,
    start,
    stop,
  };
}

function loadMediaPipeScripts() {
  return Promise.all(SCRIPT_URLS.map(loadScript));
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}
