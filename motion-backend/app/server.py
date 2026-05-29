from __future__ import annotations

import argparse
import asyncio
import json
from contextlib import suppress

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.camera import WebcamMotionTracker


app = FastAPI(title="Zombie Run Motion Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

tracker = WebcamMotionTracker()
tracker_lock = asyncio.Lock()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.websocket("/ws/motion")
async def motion_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            async with tracker_lock:
                motion, _frame = await asyncio.to_thread(tracker.read, False)
            await websocket.send_text(json.dumps(motion.to_dict()))
            await asyncio.sleep(1 / 30)
    except WebSocketDisconnect:
        pass
    finally:
        # Keep the camera warm for reconnects during demos.
        with suppress(Exception):
            await websocket.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Zombie Run motion WebSocket server.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    import uvicorn

    uvicorn.run("app.server:app", host=args.host, port=args.port, reload=False)


if __name__ == "__main__":
    main()
