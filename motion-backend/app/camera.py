from __future__ import annotations

import cv2
import mediapipe as mp

from app.motion_detector import MotionData, MotionDetector


class WebcamMotionTracker:
    """Owns the webcam, MediaPipe Pose model, and motion detector."""

    def __init__(self, camera_index: int = 0, mirror: bool = True) -> None:
        self.camera_index = camera_index
        self.mirror = mirror
        self.detector = MotionDetector()
        self._pose = mp.solutions.pose.Pose(
            model_complexity=1,
            min_detection_confidence=0.55,
            min_tracking_confidence=0.55,
        )
        self._drawing = mp.solutions.drawing_utils
        self._pose_module = mp.solutions.pose
        self._capture: cv2.VideoCapture | None = None

    def start(self) -> None:
        if self._capture is not None:
            return
        capture = cv2.VideoCapture(self.camera_index)
        capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        if not capture.isOpened():
            raise RuntimeError(f"Could not open webcam at index {self.camera_index}")
        self._capture = capture

    def read(self, draw_debug: bool = False) -> tuple[MotionData, object | None]:
        self.start()
        assert self._capture is not None

        ok, frame = self._capture.read()
        if not ok:
            raise RuntimeError("Could not read a frame from the webcam")

        if self.mirror:
            frame = cv2.flip(frame, 1)

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._pose.process(rgb)
        landmarks = results.pose_landmarks.landmark if results.pose_landmarks else None
        motion = self.detector.update(landmarks)

        if draw_debug and results.pose_landmarks:
            self._drawing.draw_landmarks(
                frame,
                results.pose_landmarks,
                self._pose_module.POSE_CONNECTIONS,
            )

        return motion, frame

    def stop(self) -> None:
        if self._capture is not None:
            self._capture.release()
            self._capture = None
        self._pose.close()
