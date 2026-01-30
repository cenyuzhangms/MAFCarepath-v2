from __future__ import annotations

import os
from collections import defaultdict
from pathlib import Path
import sys
from typing import Any, DefaultDict, Dict, List, Optional, Set

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from healthcare_lab.agents.healthcare_handoff import Agent

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UI_ROOT = ROOT_DIR / "ui"
if UI_ROOT.exists():
    app.mount("/ui", StaticFiles(directory=str(UI_ROOT)), name="ui")


STATE_STORE: Dict[str, Any] = {}


class ChatRequest(BaseModel):
    session_id: str
    prompt: str
    pattern: str | None = None


class ChatResponse(BaseModel):
    response: str


class ConnectionManager:
    def __init__(self) -> None:
        self.sessions: DefaultDict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, session_id: str, ws: WebSocket) -> None:
        self.sessions[session_id].add(ws)

    def disconnect(self, session_id: str, ws: WebSocket) -> None:
        if session_id in self.sessions:
            self.sessions[session_id].discard(ws)
            if not self.sessions[session_id]:
                self.sessions.pop(session_id, None)

    async def broadcast(self, session_id: str, message: dict) -> None:
        dead: List[WebSocket] = []
        for ws in list(self.sessions.get(session_id, [])):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(session_id, ws)


MANAGER = ConnectionManager()


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    if req.pattern:
        STATE_STORE[f"{req.session_id}_pattern"] = req.pattern
    agent = Agent(STATE_STORE, req.session_id)
    answer = await agent.chat_async(req.prompt)
    return ChatResponse(response=answer)

@app.get("/")
async def serve_ui() -> FileResponse:
    return FileResponse(str(UI_ROOT / "index.html"))


@app.websocket("/ws/chat")
async def ws_chat(ws: WebSocket):
    await ws.accept()
    connected_session: Optional[str] = None

    try:
        while True:
            data = await ws.receive_json()
            session_id = data.get("session_id")
            prompt = data.get("prompt")
            pattern = data.get("pattern")

            if not session_id:
                await ws.send_json({"type": "error", "message": "Missing session_id"})
                continue

            if connected_session is None:
                await MANAGER.connect(session_id, ws)
                connected_session = session_id
                await ws.send_json({"type": "info", "message": f"Registered session {session_id}"})

            if not prompt:
                continue

            if pattern:
                STATE_STORE[f"{session_id}_pattern"] = pattern

            agent = Agent(STATE_STORE, session_id)
            if hasattr(agent, "set_websocket_manager"):
                agent.set_websocket_manager(MANAGER)

            try:
                await agent.chat_async(prompt)
                await MANAGER.broadcast(session_id, {"type": "done"})
            except Exception as exc:
                await MANAGER.broadcast(session_id, {"type": "error", "message": str(exc)})

    except WebSocketDisconnect:
        pass
    finally:
        if connected_session:
            MANAGER.disconnect(connected_session, ws)


if __name__ == "__main__":
    port = int(os.getenv("HEALTHCARE_LAB_PORT", "7000"))
    host = os.getenv("HEALTHCARE_LAB_HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port)
