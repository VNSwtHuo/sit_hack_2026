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

- `/` — the single-player game
- `/multiplayer` — two-player (LAN) zombie-vs-survivor
- `/debug` — a live motion / pose / game-state debug dashboard

## Two-player on two laptops (same Wi-Fi / LAN)

One laptop runs the servers (the "host machine"); both laptops play in the browser.

1. **On the host machine**, start everything:

   ```bash
   npm run dev
   ```

   The Vite dev server is started with `--host`, so it's reachable on the LAN, and
   the backend binds `0.0.0.0:4000`.

2. **Find the host machine's LAN IP** (e.g. `192.168.1.23`):
   - macOS: `ipconfig getifaddr en0`
   - Windows: `ipconfig` → "IPv4 Address"
   - Linux: `hostname -I`

3. **On _both_ laptops**, open the browser to the host's IP and go to multiplayer:

   ```
   http://<HOST_IP>:5173/multiplayer
   ```

   (On the host machine you can also use `http://localhost:5173/multiplayer`.)
   The frontend automatically connects its Socket.IO client to `http://<same-host>:4000`,
   so no configuration is needed.

4. The host sets a **target distance** (200–10,000 m), clicks **Create room** and shares
   the 4-letter code. The other clicks **Join room** and enters it. Both **Calibrate**;
   once both show **Ready**, the host gets a **Start** button. Roles (zombie / survivor)
   are revealed, then the race runs: both players accumulate distance by running. The
   survivor starts with a 20 m head start — the **survivor wins** by reaching the target
   distance, the **zombie wins** by closing the gap to zero (catching up) first.

> Both laptops need a webcam and must be on the same network. If a firewall blocks the
> connection, allow inbound traffic on ports `5173` and `4000` on the host machine.

## Useful scripts (root)

| Command         | Description                           |
| --------------- | ------------------------------------- |
| `npm run dev`   | Run backend + frontend together (dev) |
| `npm run build` | Type-check & build both projects      |
| `npm run start` | Run the built backend                 |

### Configuration

- Backend: `PORT` (default `4000`), `HOST` (default `127.0.0.1`), `FRONTEND_ORIGIN` (default `http://localhost:5173`).
- Frontend: `VITE_SOCKET_URL` (default `http://localhost:4000`).
