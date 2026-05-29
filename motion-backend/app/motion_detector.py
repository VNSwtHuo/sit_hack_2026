from __future__ import annotations

from collections import deque
from dataclasses import asdict, dataclass
from time import monotonic
from typing import Iterable


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


@dataclass
class MotionData:
    speed: float = 0.0
    isRunning: bool = False
    jump: bool = False
    lane: str = "center"
    sixtySevenCount: int = 0
    confidence: float = 0.0

    def to_dict(self) -> dict[str, float | bool | str | int]:
        data = asdict(self)
        data["speed"] = round(float(data["speed"]), 2)
        data["confidence"] = round(float(data["confidence"]), 2)
        return data


class PoseLandmarkIndex:
    NOSE = 0
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28
    LEFT_WRIST = 15
    RIGHT_WRIST = 16


class MotionDetector:
    """Small heuristic detector tuned for webcam hackathon gameplay.

    MediaPipe landmarks are normalized: x/y are in [0, 1], where y increases
    downward. All thresholds are scaled by torso size so the detector works
    across different camera distances.
    """

    def __init__(self) -> None:
        self.data = MotionData()
        self._last_time: float | None = None
        self._last_leg_phase: float | None = None
        self._leg_crossings: deque[float] = deque(maxlen=10)
        self._speed_ema = 0.0

        self._hip_y_baseline: float | None = None
        self._center_x_baseline: float | None = None
        self._jump_until = 0.0
        self._last_jump_time = 0.0

        self._hand_position: str | None = None
        self._sixty_seven_count = 0
        self._last_hand_transition = 0.0

    def update(self, landmarks: Iterable[object] | None) -> MotionData:
        now = monotonic()
        if landmarks is None:
            self._decay_when_missing()
            return self.data

        points = list(landmarks)
        confidence = self._confidence(points)
        if confidence < 0.35:
            self._decay_when_missing(confidence)
            return self.data

        dt = 1 / 30 if self._last_time is None else max(now - self._last_time, 1 / 120)
        self._last_time = now

        torso = self._torso_size(points)
        hip_x, hip_y = self._midpoint(
            points,
            PoseLandmarkIndex.LEFT_HIP,
            PoseLandmarkIndex.RIGHT_HIP,
        )
        shoulder_x, shoulder_y = self._midpoint(
            points, PoseLandmarkIndex.LEFT_SHOULDER, PoseLandmarkIndex.RIGHT_SHOULDER
        )

        self._update_running(points, torso, dt, now)
        self._update_jump(hip_y, shoulder_y, torso, now)
        self._update_lane(hip_x, shoulder_x, torso)
        self._update_sixty_seven(points, now)

        self.data.confidence = confidence
        self.data.sixtySevenCount = self._sixty_seven_count
        return self.data

    def _update_running(self, points: list[object], torso: float, dt: float, now: float) -> None:
        left_ankle_y = self._y(points, PoseLandmarkIndex.LEFT_ANKLE)
        right_ankle_y = self._y(points, PoseLandmarkIndex.RIGHT_ANKLE)
        left_knee_y = self._y(points, PoseLandmarkIndex.LEFT_KNEE)
        right_knee_y = self._y(points, PoseLandmarkIndex.RIGHT_KNEE)

        # Positive/negative phase means the legs are in opposite vertical states.
        ankle_phase = (left_ankle_y - right_ankle_y) / torso
        knee_phase = (left_knee_y - right_knee_y) / torso
        leg_phase = 0.7 * ankle_phase + 0.3 * knee_phase

        if self._last_leg_phase is not None:
            crossed = (leg_phase > 0.12 >= self._last_leg_phase) or (
                leg_phase < -0.12 <= self._last_leg_phase
            )
            if crossed and (not self._leg_crossings or now - self._leg_crossings[-1] > 0.16):
                self._leg_crossings.append(now)

        derivative = (
            0.0
            if self._last_leg_phase is None
            else abs(leg_phase - self._last_leg_phase) / dt
        )
        self._last_leg_phase = leg_phase

        cadence = 0.0
        if len(self._leg_crossings) >= 2:
            elapsed = self._leg_crossings[-1] - self._leg_crossings[0]
            cadence = (len(self._leg_crossings) - 1) / elapsed if elapsed > 0 else 0.0
            if now - self._leg_crossings[-1] > 0.7:
                cadence = 0.0

        movement_score = clamp(derivative / 7.0)
        cadence_score = clamp(cadence / 5.0)
        raw_speed = clamp(0.55 * cadence_score + 0.45 * movement_score)
        if abs(leg_phase) < 0.08 and cadence == 0.0:
            raw_speed *= 0.35

        alpha = 0.28 if raw_speed > self._speed_ema else 0.16
        self._speed_ema = (1 - alpha) * self._speed_ema + alpha * raw_speed
        if now - (self._leg_crossings[-1] if self._leg_crossings else 0.0) > 1.0:
            self._speed_ema *= 0.92

        self.data.speed = clamp(self._speed_ema)
        self.data.isRunning = self.data.speed >= 0.18

    def _update_jump(self, hip_y: float, shoulder_y: float, torso: float, now: float) -> None:
        body_y = 0.65 * hip_y + 0.35 * shoulder_y
        if self._hip_y_baseline is None:
            self._hip_y_baseline = body_y

        rise = (self._hip_y_baseline - body_y) / torso
        in_cooldown = now - self._last_jump_time < 0.65
        if rise > 0.16 and not in_cooldown:
            self._jump_until = now + 0.25
            self._last_jump_time = now

        self.data.jump = now < self._jump_until

        if not self.data.jump and abs(rise) < 0.12:
            self._hip_y_baseline = 0.985 * self._hip_y_baseline + 0.015 * body_y

    def _update_lane(self, hip_x: float, shoulder_x: float, torso: float) -> None:
        body_x = 0.7 * hip_x + 0.3 * shoulder_x
        if self._center_x_baseline is None:
            self._center_x_baseline = body_x

        offset = (body_x - self._center_x_baseline) / torso
        if offset < -0.34:
            self.data.lane = "left"
        elif offset > 0.34:
            self.data.lane = "right"
        else:
            self.data.lane = "center"
            self._center_x_baseline = 0.98 * self._center_x_baseline + 0.02 * body_x

    def _update_sixty_seven(self, points: list[object], now: float) -> None:
        left_wrist_y = self._y(points, PoseLandmarkIndex.LEFT_WRIST)
        right_wrist_y = self._y(points, PoseLandmarkIndex.RIGHT_WRIST)
        shoulder_y = (
            self._y(points, PoseLandmarkIndex.LEFT_SHOULDER)
            + self._y(points, PoseLandmarkIndex.RIGHT_SHOULDER)
        ) / 2
        hip_y = (
            self._y(points, PoseLandmarkIndex.LEFT_HIP)
            + self._y(points, PoseLandmarkIndex.RIGHT_HIP)
        ) / 2

        both_high = left_wrist_y < shoulder_y and right_wrist_y < shoulder_y
        both_low = left_wrist_y > hip_y and right_wrist_y > hip_y
        new_position = "high" if both_high else "low" if both_low else None

        if (
            new_position
            and self._hand_position
            and new_position != self._hand_position
            and now - self._last_hand_transition > 0.22
        ):
            self._sixty_seven_count += 1
            self._last_hand_transition = now

        if new_position:
            self._hand_position = new_position

    def _decay_when_missing(self, confidence: float = 0.0) -> None:
        self._speed_ema *= 0.88
        self.data.speed = clamp(self._speed_ema)
        self.data.isRunning = self.data.speed >= 0.18
        self.data.jump = False
        self.data.confidence = confidence

    def _confidence(self, points: list[object]) -> float:
        required = [
            PoseLandmarkIndex.LEFT_SHOULDER,
            PoseLandmarkIndex.RIGHT_SHOULDER,
            PoseLandmarkIndex.LEFT_HIP,
            PoseLandmarkIndex.RIGHT_HIP,
            PoseLandmarkIndex.LEFT_ANKLE,
            PoseLandmarkIndex.RIGHT_ANKLE,
            PoseLandmarkIndex.LEFT_WRIST,
            PoseLandmarkIndex.RIGHT_WRIST,
        ]
        return sum(float(getattr(points[i], "visibility", 1.0)) for i in required) / len(
            required
        )

    def _torso_size(self, points: list[object]) -> float:
        shoulder_x, shoulder_y = self._midpoint(
            points,
            PoseLandmarkIndex.LEFT_SHOULDER,
            PoseLandmarkIndex.RIGHT_SHOULDER,
        )
        hip_x, hip_y = self._midpoint(
            points,
            PoseLandmarkIndex.LEFT_HIP,
            PoseLandmarkIndex.RIGHT_HIP,
        )
        return max(
            ((shoulder_x - hip_x) ** 2 + (shoulder_y - hip_y) ** 2) ** 0.5,
            0.12,
        )

    def _midpoint(
        self,
        points: list[object],
        left_index: int,
        right_index: int,
    ) -> tuple[float, float]:
        return (
            (self._x(points, left_index) + self._x(points, right_index)) / 2,
            (self._y(points, left_index) + self._y(points, right_index)) / 2,
        )

    def _x(self, points: list[object], index: int) -> float:
        return float(getattr(points[index], "x"))

    def _y(self, points: list[object], index: int) -> float:
        return float(getattr(points[index], "y"))
