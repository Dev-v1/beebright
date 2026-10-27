"""Account-scoped classrooms, opt-in activity, studio sync and desktop pairing."""
from __future__ import annotations
import hashlib
import json
import secrets
import string
import threading
import time
from collections import deque
from pathlib import Path
from uuid import uuid4

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from app.auth import get_current_user_id
from app.database import _connect

router = APIRouter(prefix="/api")
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_rate_lock = threading.Lock()
_attempts: dict[str, deque] = {}


def rate_limit(request: Request, group: str, limit: int = 20):
    # Bounded, per-process guard in addition to unguessable pairing secrets.
    key = group + ":" + (request.client.host if request.client else "unknown")
    now = time.monotonic()
    with _rate_lock:
        for old in list(_attempts):
            if not _attempts[old] or _attempts[old][-1] < now - 600:
                del _attempts[old]
        if key not in _attempts and len(_attempts) >= 10000:
            raise HTTPException(429, "Please try again later.")
        q = _attempts.setdefault(key, deque())
        while q and q[0] < now - 600:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(429, "Too many attempts. Wait ten minutes.")
        q.append(now)


def initialize():
    with _connect() as db:
        db.execute((Path(__file__).parent / "classrooms.sql").read_text())


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def device_user(token: str) -> str:
    with _connect() as db:
        row = db.execute("SELECT user_id FROM desktop_sessions WHERE token_hash=%s AND expires_at>NOW()", (token_hash(token),)).fetchone()
    if not row or not row[0]:
        raise HTTPException(401, "Desktop login expired. Run beebright login.")
    return row[0]


class ClassName(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    @field_validator("name")
    @classmethod
    def clean(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Enter a classroom name.")
        return value


class JoinClass(BaseModel):
    code: str = Field(min_length=8, max_length=12)
    display_name: str = Field(min_length=1, max_length=60)
    @field_validator("display_name")
    @classmethod
    def clean(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Enter your classroom display name.")
        return value


class DeviceCode(BaseModel):
    code: str = Field(pattern=r"^[A-Z2-9]{8}$")


class StudioPayload(BaseModel):
    data: dict
    merge_favorites: bool = False


class Activity(BaseModel):
    screen: str = Field(default="home", max_length=40)
    mode: str = Field(default="", max_length=40)
    level: str = Field(default="", max_length=40)
    answered: int = Field(default=0, ge=0, le=1000000)
    correct: int = Field(default=0, ge=0, le=1000000)
    source: str = Field(default="web", pattern=r"^(web|local)$")


import math


def validate_studio(value):
    if not isinstance(value, dict):
        raise HTTPException(422, "Invalid practice data.")
    events = value.get("events", [])
    favorites = value.get("favorites", [])
    games = value.get("games", {})
    if (not isinstance(events,list) or len(events)>10000 or
        not isinstance(favorites,list) or len(favorites)>5000 or
        any(not isinstance(w,str) or len(w)>200 for w in favorites) or
        not isinstance(games,dict) or len(games)>30 or
        any(not isinstance(k,str) or len(k)>40 or not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v) or not 0<=v<=1e12 for k,v in games.items())):
        raise HTTPException(422, "Invalid practice data.")
    for event in events:
        if (not isinstance(event,dict) or not isinstance(event.get("word"),str) or
            len(event["word"])>200 or not isinstance(event.get("correct"),bool) or
            not isinstance(event.get("at",0),(int,float)) or not math.isfinite(event.get("at",0))):
            raise HTTPException(422, "Invalid answer history.")
    return value


def merge_studio(old: dict, new: dict, merge_favorites: bool = False) -> dict:
    # Stable answer IDs prevent retries and offline imports from doubling scores.
    validate_studio(new)
    result = {**old, **new}
    result["games"] = {k:max(old.get("games",{}).get(k,0),new.get("games",{}).get(k,0)) for k in set(old.get("games",{})) | set(new.get("games",{}))}
    events = {}
    for event in [*old.get("events", []), *new.get("events", [])]:
        if isinstance(event, dict) and isinstance(event.get("id"), str) and len(event["id"]) <= 100:
            events.setdefault(event["id"], event)
    result["events"] = sorted(events.values(), key=lambda e: e.get("at", 0))[-10000:]
    if merge_favorites:
        result["favorites"] = sorted(set(old.get("favorites", [])) | set(new.get("favorites", [])))
    if len(json.dumps(result).encode()) > 4_000_000:
        raise HTTPException(413, "Practice history is too large. Export a backup first.")
    return result


@router.get("/classrooms")
def classes(user: str = Depends(get_current_user_id)):
    with _connect() as db:
        rows = db.execute("""SELECT c.id,c.name,c.owner_id,c.code FROM classrooms c
         WHERE c.owner_id=%s OR EXISTS(SELECT 1 FROM classroom_members m WHERE m.class_id=c.id AND m.user_id=%s)
         ORDER BY c.created_at DESC""", (user,user)).fetchall()
    return [{"id":r[0],"name":r[1],"teacher":r[2]==user,"code":r[3] if r[2]==user else None} for r in rows]


@router.post("/classrooms", status_code=201)
def create_class(payload: ClassName, user: str = Depends(get_current_user_id)):
    with _connect() as db:
        # Serialize quota checks per account, including concurrent requests.
        db.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (user,))
        if db.execute("SELECT COUNT(*) FROM classrooms WHERE owner_id=%s", (user,)).fetchone()[0] >= 30:
            raise HTTPException(400, "You can own up to 30 classrooms.")
        for _ in range(5):
            code = "".join(secrets.choice(ALPHABET) for _ in range(8))
            row = db.execute("""INSERT INTO classrooms(id,owner_id,name,code) VALUES(%s,%s,%s,%s)
             ON CONFLICT(code) DO NOTHING RETURNING id""", (str(uuid4()),user,payload.name,code)).fetchone()
            if row:
                return {"id":row[0],"name":payload.name,"code":code,"teacher":True}
    raise HTTPException(503, "Could not generate a code. Try again.")


@router.post("/classrooms/join")
def join_class(payload: JoinClass, request: Request, user: str = Depends(get_current_user_id)):
    rate_limit(request, "join")
    with _connect() as db:
        row = db.execute("SELECT id,owner_id FROM classrooms WHERE code=%s FOR UPDATE", (payload.code.strip().upper(),)).fetchone()
        if not row:
            raise HTTPException(404, "Classroom code not found.")
        if row[1] == user:
            raise HTTPException(400, "You already teach this classroom.")
        if db.execute("SELECT COUNT(*) FROM classroom_members WHERE class_id=%s", (row[0],)).fetchone()[0] >= 200:
            raise HTTPException(400, "This classroom is full.")
        db.execute("""INSERT INTO classroom_members(class_id,user_id,display_name) VALUES(%s,%s,%s)
         ON CONFLICT(class_id,user_id) DO UPDATE SET display_name=EXCLUDED.display_name""", (row[0],user,payload.display_name))
    return {"joined":True}


@router.get("/classrooms/{class_id}/students")
def students(class_id: str, user: str = Depends(get_current_user_id)):
    with _connect() as db:
        if not db.execute("SELECT 1 FROM classrooms WHERE id=%s AND owner_id=%s", (class_id,user)).fetchone():
            raise HTTPException(403, "Only this classroom's teacher can view students.")
        rows = db.execute("""SELECT m.user_id,m.display_name,a.activity,a.updated_at FROM classroom_members m
         LEFT JOIN classroom_activity a ON a.user_id=m.user_id AND a.updated_at>=m.joined_at
         WHERE m.class_id=%s ORDER BY m.display_name,m.user_id""", (class_id,)).fetchall()
    return [{"user_id":r[0],"name":r[1],"activity":r[2],"last_seen":r[3]} for r in rows]


@router.delete("/classrooms/{class_id}/members/{member_id}")
def leave_class(class_id: str, member_id: str, user: str = Depends(get_current_user_id)):
    with _connect() as db:
        if member_id != user and not db.execute("SELECT 1 FROM classrooms WHERE id=%s AND owner_id=%s", (class_id,user)).fetchone():
            raise HTTPException(403, "You cannot remove this student.")
        db.execute("DELETE FROM classroom_members WHERE class_id=%s AND user_id=%s", (class_id,member_id))
    return {"removed":True}


@router.delete("/classrooms/{class_id}")
def delete_class(class_id: str, user: str = Depends(get_current_user_id)):
    with _connect() as db:
        if not db.execute("DELETE FROM classrooms WHERE id=%s AND owner_id=%s RETURNING id", (class_id,user)).fetchone():
            raise HTTPException(403, "Only the teacher can delete this classroom.")
    return {"deleted":True}


@router.post("/classrooms/{class_id}/rotate-code")
def rotate_code(class_id: str, user: str = Depends(get_current_user_id)):
    with _connect() as db:
        code = "".join(secrets.choice(ALPHABET) for _ in range(8))
        row = db.execute("UPDATE classrooms SET code=%s WHERE id=%s AND owner_id=%s RETURNING code", (code,class_id,user)).fetchone()
        if not row:
            raise HTTPException(403, "Only the teacher can change this code.")
    return {"code":code}


@router.put("/activity")
def activity(payload: Activity, user: str = Depends(get_current_user_id)):
    with _connect() as db:
        # Do not collect activity for users who have not joined any classroom.
        if db.execute("SELECT 1 FROM classroom_members WHERE user_id=%s", (user,)).fetchone():
            db.execute("""INSERT INTO classroom_activity(user_id,activity) VALUES(%s,%s::jsonb)
             ON CONFLICT(user_id) DO UPDATE SET activity=EXCLUDED.activity,updated_at=NOW()""", (user,payload.model_dump_json()))
    return {"saved":True}


@router.get("/account/studio")
def get_studio(user: str = Depends(get_current_user_id)):
    with _connect() as db:
        row = db.execute("SELECT data FROM account_studio WHERE user_id=%s", (user,)).fetchone()
    return row[0] if row else {}


@router.put("/account/studio")
def save_studio(payload: StudioPayload, user: str = Depends(get_current_user_id)):
    validate_studio(payload.data)
    if len(json.dumps(payload.data).encode()) > 4_000_000:
        raise HTTPException(413, "Practice history is too large.")
    with _connect() as db:
        db.execute("INSERT INTO account_studio(user_id) VALUES(%s) ON CONFLICT DO NOTHING", (user,))
        old = db.execute("SELECT data FROM account_studio WHERE user_id=%s FOR UPDATE", (user,)).fetchone()[0]
        try:
            result = merge_studio(old,payload.data,payload.merge_favorites)
        except (TypeError, ValueError):
            raise HTTPException(422, "Invalid practice history.")
        db.execute("UPDATE account_studio SET data=%s::jsonb,updated_at=NOW() WHERE user_id=%s", (json.dumps(result),user))
    return result


@router.post("/devices/start", status_code=201)
def start_device(request: Request):
    rate_limit(request,"device",10)
    token = "bb_" + secrets.token_urlsafe(32)
    code = "".join(secrets.choice(ALPHABET) for _ in range(8))
    with _connect() as db:
        db.execute("DELETE FROM desktop_sessions WHERE expires_at<NOW()")
        db.execute("INSERT INTO desktop_sessions(token_hash,code,expires_at) VALUES(%s,%s,NOW()+INTERVAL '10 minutes')", (token_hash(token),code))
    return {"token":token,"code":code,"url":"https://www.beebright.app/classrooms?connect="+code}


@router.post("/devices/approve")
def approve_device(payload: DeviceCode, request: Request, user: str = Depends(get_current_user_id)):
    # A desktop credential cannot approve another desktop credential.
    if request.headers.get("authorization","").startswith("Bearer bb_"):
        raise HTTPException(403, "Approve this request in the website.")
    rate_limit(request,"approve")
    with _connect() as db:
        row = db.execute("""UPDATE desktop_sessions SET user_id=%s,expires_at=NOW()+INTERVAL '30 days'
         WHERE code=%s AND user_id IS NULL AND expires_at>NOW() RETURNING code""", (user,payload.code)).fetchone()
    if not row:
        raise HTTPException(400, "Code expired or already used. Run beebright login again.")
    return {"approved":True}


@router.get("/account/me")
def me(user: str = Depends(get_current_user_id)):
    return {"user_id":user}


@router.delete("/devices/current")
def revoke_device(request: Request, user: str = Depends(get_current_user_id)):
    token = request.headers.get("authorization","").removeprefix("Bearer ")
    if token.startswith("bb_"):
        with _connect() as db:
            db.execute("DELETE FROM desktop_sessions WHERE token_hash=%s", (token_hash(token),))
    return {"signed_out":True}

@router.delete("/account")
def delete_account_data(user: str = Depends(get_current_user_id)):
    with _connect() as db:
        db.execute("DELETE FROM desktop_sessions WHERE user_id=%s",(user,))
        db.execute("DELETE FROM classroom_members WHERE user_id=%s",(user,))
        db.execute("DELETE FROM classrooms WHERE owner_id=%s",(user,))
        db.execute("DELETE FROM classroom_activity WHERE user_id=%s",(user,))
        db.execute("DELETE FROM account_studio WHERE user_id=%s",(user,))
        db.execute("DELETE FROM practice_progress WHERE clerk_user_id=%s",(user,))
        db.execute("DELETE FROM word_list_requests WHERE clerk_user_id=%s",(user,))
    return {"deleted":True}
