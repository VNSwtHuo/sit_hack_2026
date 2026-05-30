# 🧟 Zombie Run

A browser-based apocalypse survival game controlled entirely by your **webcam**.
Run in place to outpace the horde, jump / dodge / throw the viral **6 7** gesture to
survive. Pose estimation runs client-side with MediaPipe; a Socket.IO backend owns
the game state (webcam frames never leave the browser — only compact motion payloads do).

## Stack

- **Frontend** (`sit-hack-frontend/`): React 19 + TypeScript + Vite + TailwindCSS + framer-motion, MediaPipe Pose, `socket.io-client`.
- **Backend** (`backend/`): Express + Socket.IO game-state engine (automatic speed scaling, stamina, obstacles, combos / brain-rot boost, game over).

## Quick start

From the repository root:

```bash
npm install   # installs root + backend + frontend (via postinstall)
npm run dev   # starts backend (http://localhost:4000) and frontend (http://localhost:5173) together
```

Then open **http://localhost:5173**, hit **Enter the Apocalypse**, and allow webcam
access when prompted.

> A working webcam is required for gameplay. Stand back far enough that your whole
> body is visible during the calibration step.

## How it flows

`MENU → CALIBRATION → COUNTDOWN → RUNNING → GAME_OVER`

- The frontend streams throttled motion payloads (`runningIntensity`, `jumpDetected`, `lane`, `sixtySevenCount`, …) to the backend.
- The backend ticks the game ~10×/s, pushing zombies back when you run and pulling them in when you slow down or miss an obstacle.
- The horde starts at the easy pace and automatically gets faster over time.
- Three consecutive obstacle clears trigger a **Brain Rot Boost**.

## Routes

- `/` — the game
- `/debug` — a live motion / pose / game-state debug dashboard

## Useful scripts (root)

| Command | Description |
| --- | --- |
| `npm run dev` | Run backend + frontend together (dev) |
| `npm run build` | Type-check & build both projects |
| `npm run start` | Run the built backend |

### Configuration

- Backend: `PORT` (default `4000`), `HOST` (default `127.0.0.1`), `FRONTEND_ORIGIN` (default `http://localhost:5173`).
- Frontend: `VITE_SOCKET_URL` (default `http://localhost:4000`).
