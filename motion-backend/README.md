# Zombie Run Motion Backend

Python webcam motion tracking for the Zombie Run hackathon game. It uses MediaPipe Pose to detect running in place, jumping, left/right lane movement, and the repeated two-hand "67 motion", then streams JSON to the React frontend over WebSocket.

## Folder Structure

```text
motion-backend/
  app/
    camera.py            # Webcam + MediaPipe Pose wrapper
    debug.py             # Webcam debug window with skeleton and values
    motion_detector.py   # Motion heuristics and smoothing
    server.py            # FastAPI WebSocket server
  examples/
    MotionDebugPanel.tsx # React display component example
    useMotionSocket.ts   # React WebSocket hook example
  requirements.txt
  README.md
```

## Install

From the `KMUTT 2026` workspace folder on macOS:

```bash
cd sit_hack_2026/motion-backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

If `pip` cannot find a MediaPipe wheel, create the virtual environment with Python 3.10, 3.11, or 3.12.

After the virtual environment is activated, the `python` and `pip` commands should work inside this folder. If they do not, use `python3` and `python3 -m pip`.

On Windows PowerShell:

```powershell
cd motion-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run the WebSocket Server

```bash
source .venv/bin/activate
python -m app.server
```

The frontend can connect to:

```text
ws://localhost:8000/ws/motion
```

Each message looks like:

```json
{
  "speed": 0.72,
  "isRunning": true,
  "jump": false,
  "lane": "center",
  "sixtySevenCount": 4,
  "confidence": 0.91
}
```

## Debug Mode

Use this while tuning in VS Code. It opens the webcam, draws the MediaPipe skeleton, and overlays current motion values.

```bash
source .venv/bin/activate
python -m app.debug
```

Press `q` or `Esc` to quit.

If your laptop has multiple cameras:

```bash
python -m app.debug --camera 1
```

## Detection Notes

- Running uses alternating ankle and knee vertical movement. A smoothed `speed` score rises with faster leg alternation and decays when movement stops.
- Jumping uses short upward movement of the hip/shoulder body center relative to a slowly updating standing baseline.
- Lane uses body center horizontal offset from a slowly updating center baseline.
- 67 motion counts a rep whenever both wrists clearly transition together between high and low positions.
- `confidence` is the average visibility of key shoulders, hips, ankles, and wrists.

## React TypeScript Example

Copy `examples/useMotionSocket.ts` into your frontend, then use it in a component:

```tsx
import { useMotionSocket } from "./useMotionSocket";

export function GameController() {
  const { motion, connected } = useMotionSocket();

  // Example game mappings:
  const avatarSpeed = 4 + motion.speed * 10;
  const lane = motion.lane;
  const shouldJump = motion.jump;

  return (
    <div>
      <p>Backend: {connected ? "connected" : "offline"}</p>
      <p>Speed: {avatarSpeed.toFixed(1)}</p>
      <p>Lane: {lane}</p>
      <p>Jump: {String(shouldJump)}</p>
      <p>67 reps: {motion.sixtySevenCount}</p>
    </div>
  );
}
```

## Tuning

The main thresholds live in `app/motion_detector.py`. For a hackathon demo, tune these while watching debug mode:

- Running threshold: `self.data.isRunning = self.data.speed >= 0.18`
- Jump threshold: `rise > 0.16`
- Lane threshold: `offset < -0.34` and `offset > 0.34`
- 67 transition debounce: `now - self._last_hand_transition > 0.22`
