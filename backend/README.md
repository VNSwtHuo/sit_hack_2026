# The Last Braincell Backend

Socket.IO game-state server for The Last Braincell. Webcam frames never leave the browser; the backend only receives compact motion payloads and returns game-state updates.

## Run

```bash
npm install
npm run dev
```

Default URL: `http://localhost:4000`

Set `FRONTEND_ORIGIN=http://localhost:5173` and `PORT=4000` as needed.
