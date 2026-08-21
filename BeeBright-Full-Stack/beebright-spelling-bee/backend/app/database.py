from __future__ import annotations

import json

import psycopg

from app.config import get_settings


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS practice_progress (
    clerk_user_id TEXT PRIMARY KEY,
    session_data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


def _connect():
    database_url = get_settings().database_url.strip()
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured on the backend.")
    return psycopg.connect(database_url, connect_timeout=8)


def initialize_database() -> None:
    if not get_settings().database_url.strip():
        return
    with _connect() as connection:
        connection.execute(CREATE_TABLE_SQL)


def read_progress(user_id: str) -> dict | None:
    with _connect() as connection:
        row = connection.execute(
            "SELECT session_data FROM practice_progress WHERE clerk_user_id = %s",
            (user_id,),
        ).fetchone()
    if not row:
        return None
    return row[0] if isinstance(row[0], dict) else json.loads(row[0])


def save_progress(user_id: str, session_data: dict) -> None:
    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO practice_progress (clerk_user_id, session_data, updated_at)
            VALUES (%s, %s::jsonb, NOW())
            ON CONFLICT (clerk_user_id) DO UPDATE
            SET session_data = EXCLUDED.session_data, updated_at = NOW()
            """,
            (user_id, json.dumps(session_data)),
        )


def delete_progress(user_id: str) -> None:
    with _connect() as connection:
        connection.execute(
            "DELETE FROM practice_progress WHERE clerk_user_id = %s",
            (user_id,),
        )
