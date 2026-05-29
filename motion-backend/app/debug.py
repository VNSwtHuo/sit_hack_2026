from __future__ import annotations

import argparse

import cv2

from app.camera import WebcamMotionTracker


def draw_status(frame: object, data: dict[str, object]) -> None:
    lines = [
        f"speed: {data['speed']}",
        f"isRunning: {data['isRunning']}",
        f"jump: {data['jump']}",
        f"lane: {data['lane']}",
        f"67 reps: {data['sixtySevenCount']}",
        f"confidence: {data['confidence']}",
    ]
    for index, line in enumerate(lines):
        y = 30 + index * 28
        cv2.putText(frame, line, (18, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 4)
        cv2.putText(frame, line, (18, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (60, 255, 120), 2)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Open webcam debug view for Zombie Run motion tracking."
    )
    parser.add_argument("--camera", type=int, default=0, help="Webcam index. Usually 0.")
    args = parser.parse_args()

    tracker = WebcamMotionTracker(camera_index=args.camera)
    print("Debug mode started. Press q or Esc to quit.")
    try:
        while True:
            motion, frame = tracker.read(draw_debug=True)
            draw_status(frame, motion.to_dict())
            cv2.imshow("Zombie Run Motion Debug", frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord("q")):
                break
    finally:
        tracker.stop()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
