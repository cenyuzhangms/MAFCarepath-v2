from __future__ import annotations

import os
import uuid
import json
from collections import defaultdict
from pathlib import Path
import sys
from typing import Any, DefaultDict, Dict, List, Optional, Set

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from healthcare_lab.agents.healthcare_handoff import Agent
from database import get_db, init_db
from auth import hash_password, verify_password, create_token, decode_token

load_dotenv()

app = FastAPI()

# ─── Security Headers Middleware ───
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self' ws: wss:;"
        )
        return response

app.add_middleware(SecurityHeadersMiddleware)

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


# ─── Pydantic Models ───

class ChatRequest(BaseModel):
    session_id: str
    prompt: str
    pattern: str | None = None


class ChatResponse(BaseModel):
    response: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    email: str | None = None


class SessionCreateRequest(BaseModel):
    title: str | None = None


class SessionEventRequest(BaseModel):
    event_type: str
    payload: dict


# ─── Auth Dependency ───

def get_current_user(authorization: str = Header(...)) -> dict:
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail={"error": {"code": "invalid_token", "message": "Token is invalid or expired. Please log in again."}},
        )
    return payload


# ─── Error helper ───

def error_response(status: int, code: str, message: str):
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


# ─── Auth Endpoints ───

@app.post("/api/register")
async def register(req: RegisterRequest):
    if not req.email or "@" not in req.email:
        return error_response(400, "invalid_email", "Please provide a valid email address.")
    if len(req.password) < 8:
        return error_response(400, "weak_password", "Password must be at least 8 characters long.")

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE email=?", (req.email.lower().strip(),)).fetchone()
    if existing:
        db.close()
        return error_response(409, "email_exists", "An account with this email already exists.")

    user_id = str(uuid.uuid4())
    email = req.email.lower().strip()
    db.execute(
        "INSERT INTO users (id, email, password, display_name) VALUES (?,?,?,?)",
        (user_id, email, hash_password(req.password), req.display_name.strip()),
    )
    db.commit()
    db.close()
    token = create_token(user_id, email)
    return TokenResponse(
        access_token=token,
        user={"id": user_id, "email": email, "display_name": req.display_name.strip()},
    )


@app.post("/api/login")
async def login(req: LoginRequest):
    db = get_db()
    row = db.execute("SELECT * FROM users WHERE email=?", (req.email.lower().strip(),)).fetchone()
    db.close()
    if not row or not verify_password(req.password, row["password"]):
        return error_response(401, "invalid_credentials", "Invalid email or password.")
    token = create_token(row["id"], row["email"])
    return TokenResponse(
        access_token=token,
        user={"id": row["id"], "email": row["email"], "display_name": row["display_name"]},
    )


@app.get("/api/me")
async def me(user: dict = Depends(get_current_user)):
    db = get_db()
    row = db.execute("SELECT id, email, display_name, created_at, updated_at FROM users WHERE id=?", (user["sub"],)).fetchone()
    db.close()
    if not row:
        return error_response(404, "user_not_found", "User not found.")
    return dict(row)


@app.put("/api/settings")
async def update_settings(req: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    db = get_db()

    if req.email is not None:
        email = req.email.lower().strip()
        if not email or "@" not in email:
            db.close()
            return error_response(400, "invalid_email", "Please provide a valid email address.")
        existing = db.execute("SELECT id FROM users WHERE email=? AND id!=?", (email, user["sub"])).fetchone()
        if existing:
            db.close()
            return error_response(409, "email_exists", "This email is already in use by another account.")
        db.execute("UPDATE users SET email=?, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id=?", (email, user["sub"]))

    if req.display_name is not None:
        db.execute("UPDATE users SET display_name=?, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id=?", (req.display_name.strip(), user["sub"]))

    db.commit()
    row = db.execute("SELECT id, email, display_name, created_at, updated_at FROM users WHERE id=?", (user["sub"],)).fetchone()
    db.close()
    return dict(row)


# ─── Session helpers ───

def _get_latest_session(db, user_id: str):
    return db.execute(
        "SELECT id, title, summary, created_at, updated_at FROM sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT 1",
        (user_id,),
    ).fetchone()


def _build_light_summary(messages: list[dict]) -> str:
    if not messages:
        return ""
    trimmed = messages[-6:]
    lines = []
    for item in trimmed:
        role = item.get("role", "assistant")
        content = item.get("content", "")
        content = content.replace("\n", " ").strip()
        if len(content) > 160:
            content = content[:157] + "..."
        lines.append(f"{role}: {content}")
    return " | ".join(lines)


# ─── Sessions API ───

@app.post("/api/sessions")
async def create_session(req: SessionCreateRequest, user: dict = Depends(get_current_user)):
    db = get_db()
    session_id = str(uuid.uuid4())
    title = req.title.strip() if req.title else ""
    db.execute(
        "INSERT INTO sessions (id, user_id, title) VALUES (?,?,?)",
        (session_id, user["sub"], title),
    )
    db.commit()
    db.close()
    return {"id": session_id, "title": title}


@app.get("/api/sessions/latest")
async def get_latest_session(user: dict = Depends(get_current_user)):
    db = get_db()
    session = _get_latest_session(db, user["sub"])
    if not session:
        db.close()
        return error_response(404, "no_session", "No session found.")

    messages = db.execute(
        "SELECT role, content, ts FROM messages WHERE session_id=? ORDER BY ts ASC",
        (session["id"],),
    ).fetchall()
    artifacts = db.execute(
        "SELECT artifact_type, payload_json, ts FROM artifacts WHERE session_id=? ORDER BY ts ASC",
        (session["id"],),
    ).fetchall()
    handoffs = db.execute(
        "SELECT kind, content, ts FROM handoffs WHERE session_id=? ORDER BY ts ASC",
        (session["id"],),
    ).fetchall()
    db.close()

    return {
        "session": dict(session),
        "messages": [dict(row) for row in messages],
        "artifacts": [dict(row) for row in artifacts],
        "handoffs": [dict(row) for row in handoffs],
    }


@app.get("/api/sessions/{session_id}")
async def get_session_by_id(session_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    session = db.execute(
        "SELECT id, title, summary, created_at, updated_at FROM sessions WHERE id=? AND user_id=?",
        (session_id, user["sub"]),
    ).fetchone()
    if not session:
        db.close()
        return error_response(404, "session_not_found", "Session not found.")

    messages = db.execute(
        "SELECT role, content, ts FROM messages WHERE session_id=? ORDER BY ts ASC",
        (session_id,),
    ).fetchall()
    artifacts = db.execute(
        "SELECT artifact_type, payload_json, ts FROM artifacts WHERE session_id=? ORDER BY ts ASC",
        (session_id,),
    ).fetchall()
    handoffs = db.execute(
        "SELECT kind, content, ts FROM handoffs WHERE session_id=? ORDER BY ts ASC",
        (session_id,),
    ).fetchall()
    db.close()

    return {
        "session": dict(session),
        "messages": [dict(row) for row in messages],
        "artifacts": [dict(row) for row in artifacts],
        "handoffs": [dict(row) for row in handoffs],
    }


@app.get("/api/sessions")
async def list_sessions(user: dict = Depends(get_current_user)):
    db = get_db()
    rows = db.execute(
        "SELECT id, title, summary, created_at, updated_at FROM sessions WHERE user_id=? ORDER BY updated_at DESC",
        (user["sub"],),
    ).fetchall()
    db.close()
    return {"sessions": [dict(r) for r in rows]}


@app.post("/api/sessions/{session_id}/events")
async def append_session_event(
    session_id: str, req: SessionEventRequest, user: dict = Depends(get_current_user)
):
    db = get_db()
    owned = db.execute("SELECT id FROM sessions WHERE id=? AND user_id=?", (session_id, user["sub"])).fetchone()
    if not owned:
        db.close()
        return error_response(404, "session_not_found", "Session not found.")

    event_type = req.event_type
    payload = req.payload or {}
    now_update = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')"

    if event_type == "message":
        msg_id = str(uuid.uuid4())
        db.execute(
            "INSERT INTO messages (id, session_id, role, content) VALUES (?,?,?,?)",
            (msg_id, session_id, payload.get("role", "assistant"), payload.get("content", "")),
        )
        # update summary
        rows = db.execute(
            "SELECT role, content FROM messages WHERE session_id=? ORDER BY ts ASC",
            (session_id,),
        ).fetchall()
        summary = _build_light_summary([dict(r) for r in rows])
        db.execute(
            f"UPDATE sessions SET summary=?, updated_at={now_update} WHERE id=?",
            (summary, session_id),
        )
    elif event_type == "artifact":
        art_id = str(uuid.uuid4())
        db.execute(
            "INSERT INTO artifacts (id, session_id, artifact_type, payload_json) VALUES (?,?,?,?)",
            (art_id, session_id, payload.get("artifact_type", "unknown"), json.dumps(payload.get("data", {}))),
        )
        db.execute(f"UPDATE sessions SET updated_at={now_update} WHERE id=?", (session_id,))
    elif event_type == "handoff":
        handoff_id = str(uuid.uuid4())
        db.execute(
            "INSERT INTO handoffs (id, session_id, kind, content) VALUES (?,?,?,?)",
            (handoff_id, session_id, payload.get("kind", "info"), payload.get("content", "")),
        )
        db.execute(f"UPDATE sessions SET updated_at={now_update} WHERE id=?", (session_id,))
    else:
        db.close()
        return error_response(400, "invalid_event", "Unsupported event_type.")

    db.commit()
    db.close()
    return {"status": "ok"}


# ─── Startup ───

@app.on_event("startup")
def startup():
    init_db()


# ─── Connection Manager ───

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


# ─── REST Chat ───

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


# ─── WebSocket Chat ───

@app.websocket("/ws/chat")
async def ws_chat(ws: WebSocket):
    await ws.accept()
    connected_session: Optional[str] = None
    authenticated = False

    try:
        while True:
            data = await ws.receive_json()
            session_id = data.get("session_id")
            prompt = data.get("prompt")
            pattern = data.get("pattern")
            access_token = data.get("access_token")

            if not session_id:
                await ws.send_json({"type": "error", "message": "Missing session_id"})
                continue

            # Authenticate on first message
            if not authenticated:
                if not access_token:
                    await ws.send_json({"type": "auth_error", "message": "Authentication required. Please log in."})
                    await ws.close(1008)
                    return
                payload = decode_token(access_token)
                if not payload:
                    await ws.send_json({"type": "auth_error", "message": "Session expired. Please log in again."})
                    await ws.close(1008)
                    return
                authenticated = True

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
