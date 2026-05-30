import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmark } from "./motionTypes";

interface PoseResult {
  poseLandmarks?: PoseLandmark[];
  segmentationMask?: HTMLCanvasElement | HTMLImageElement | ImageBitmap;
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
  "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
  "https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js",
];

const PERSON_BACKGROUND_VIDEO_URL = "/r_video_background.mp4";
const SWAMP_BACKGROUND_URL = "/swamp_background.png";

export function usePoseTracker(swampActive = false) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const swampImageRef = useRef<HTMLImageElement | null>(null);
  const swampActiveRef = useRef(swampActive);
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

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;

    canvas.width = Math.round(videoWidth);
    canvas.height = Math.round(videoHeight);
    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);

    const swampImage = swampImageRef.current;
    const backgroundVideo = backgroundVideoRef.current;
    if (swampActiveRef.current && swampImage?.complete && swampImage.naturalWidth > 0) {
      drawImageCover(context, swampImage, canvas.width, canvas.height);
    } else if (
      backgroundVideo &&
      backgroundVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      drawVideoCover(context, backgroundVideo, canvas.width, canvas.height);
    } else {
      context.fillStyle = "#0f172a";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (results.segmentationMask) {
      const maskCanvas =
        maskCanvasRef.current ?? document.createElement("canvas");
      maskCanvas.width = canvas.width;
      maskCanvas.height = canvas.height;
      maskCanvasRef.current = maskCanvas;

      const maskContext = maskCanvas.getContext("2d");
      if (maskContext) {
        maskContext.save();
        maskContext.clearRect(0, 0, canvas.width, canvas.height);
        maskContext.drawImage(
          results.segmentationMask,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        maskContext.globalCompositeOperation = "source-in";
        maskContext.drawImage(video, 0, 0, canvas.width, canvas.height);
        maskContext.restore();

        context.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
      } else {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    } else {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    if (results.poseLandmarks) {
      context.strokeStyle = "#38bdf8";
      context.lineWidth = 3;
      POSE_CONNECTIONS.forEach(([from, to]) => {
        const a = results.poseLandmarks?.[from];
        const b = results.poseLandmarks?.[to];
        if (
          !a ||
          !b ||
          (a.visibility ?? 1) < 0.35 ||
          (b.visibility ?? 1) < 0.35
        ) {
          return;
        }
        context.beginPath();
        context.moveTo(a.x * videoWidth, a.y * videoHeight);
        context.lineTo(b.x * videoWidth, b.y * videoHeight);
        context.stroke();
      });

      context.fillStyle = "#facc15";
      results.poseLandmarks.forEach((landmark, index) => {
        if (index <= 10 || (landmark.visibility ?? 1) < 0.35) {
          return;
        }
        context.beginPath();
        context.arc(
          landmark.x * videoWidth,
          landmark.y * videoHeight,
          4,
          0,
          Math.PI * 2,
        );
        context.fill();
      });
    }

    context.restore();
  }, []);

  useEffect(() => {
    swampActiveRef.current = swampActive;
  }, [swampActive]);

  useEffect(() => {
    const backgroundVideo = document.createElement("video");
    const swampImage = new Image();
    swampImage.src = SWAMP_BACKGROUND_URL;
    swampImageRef.current = swampImage;

    backgroundVideo.src = PERSON_BACKGROUND_VIDEO_URL;
    backgroundVideo.loop = true;
    backgroundVideo.muted = true;
    backgroundVideo.playsInline = true;
    backgroundVideo.preload = "auto";
    backgroundVideoRef.current = backgroundVideo;
    void backgroundVideo.play().catch(() => {
      // Muted autoplay can still be delayed until the camera-start gesture.
    });

    return () => {
      backgroundVideo.pause();
      backgroundVideoRef.current = null;
      swampImageRef.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    if (!videoRef.current || cameraRef.current) {
      return;
    }

    try {
      await loadMediaPipeScripts();

      if (!window.Pose || !window.Camera) {
        throw new Error(
          "MediaPipe scripts loaded without Pose or Camera globals",
        );
      }

      void backgroundVideoRef.current?.play().catch(() => {
        // The start button click usually unlocks muted video playback.
      });

      const pose = new window.Pose({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      pose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        enableSegmentation: true,
        smoothSegmentation: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      pose.onResults((results: PoseResult) => {
        const now = performance.now();
        frameTimesRef.current.push(now);
        frameTimesRef.current = frameTimesRef.current.filter(
          (time) => now - time < 1000,
        );
        setFps(frameTimesRef.current.length);

        const nextLandmarks = results.poseLandmarks ?? [];
        setLandmarks(nextLandmarks);
        setConfidence(
          nextLandmarks.length
            ? nextLandmarks.reduce(
                (sum, landmark) => sum + (landmark.visibility ?? 1),
                0,
              ) / nextLandmarks.length
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
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to start camera",
      );
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

function drawVideoCover(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const imageRatio = video.videoWidth / video.videoHeight;
  const canvasRatio = width / height;
  const drawWidth = imageRatio > canvasRatio ? height * imageRatio : width;
  const drawHeight = imageRatio > canvasRatio ? height : width / imageRatio;
  const dx = (width - drawWidth) / 2;
  const dy = (height - drawHeight) / 2;

  context.drawImage(video, dx, dy, drawWidth, drawHeight);
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = width / height;
  const drawWidth = imageRatio > canvasRatio ? height * imageRatio : width;
  const drawHeight = imageRatio > canvasRatio ? height : width / imageRatio;
  const dx = (width - drawWidth) / 2;
  const dy = (height - drawHeight) / 2;

  context.drawImage(image, dx, dy, drawWidth, drawHeight);
}

function loadMediaPipeScripts() {
  return Promise.all(SCRIPT_URLS.map(loadScript));
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}
