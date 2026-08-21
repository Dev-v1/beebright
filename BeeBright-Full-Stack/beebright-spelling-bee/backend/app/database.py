from __future__ import annotations

import json
from uuid import uuid4

import psycopg

from app.config import get_settings


CREATE_PROGRESS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS practice_progress (
    clerk_user_id TEXT PRIMARY KEY,
    session_data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

CREATE_WORD_LISTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS custom_word_lists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    levels JSONB NOT NULL,
    published BOOLEAN NOT NULL DEFAULT TRUE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

CREATE_REQUESTS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS word_list_requests (
    id TEXT PRIMARY KEY,
    clerk_user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
        connection.execute(CREATE_PROGRESS_TABLE_SQL)
        connection.execute(CREATE_WORD_LISTS_TABLE_SQL)
        connection.execute(CREATE_REQUESTS_TABLE_SQL)


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
        connection.execute(
            "DELETE FROM word_list_requests WHERE clerk_user_id = %s",
            (user_id,),
        )


def _json_value(value):
    return value if isinstance(value, (dict, list)) else json.loads(value)


def create_word_list(title: str, filename: str, levels: dict[str, list[str]], created_by: str) -> dict:
    word_list_id = str(uuid4())
    with _connect() as connection:
        row = connection.execute(
            """
            INSERT INTO custom_word_lists (id, title, filename, levels, published, created_by)
            VALUES (%s, %s, %s, %s::jsonb, TRUE, %s)
            RETURNING id, title, filename, levels, published, created_at
            """,
            (word_list_id, title, filename, json.dumps(levels), created_by),
        ).fetchone()
    return {
        "id": row[0],
        "title": row[1],
        "filename": row[2],
        "levels": _json_value(row[3]),
        "published": row[4],
        "created_at": row[5],
    }


def list_word_lists(published_only: bool = False) -> list[dict]:
    query = """
        SELECT id, title, filename, levels, published, created_at
        FROM custom_word_lists
    """
    if published_only:
        query += " WHERE published = TRUE"
    query += " ORDER BY created_at DESC"
    with _connect() as connection:
        rows = connection.execute(query).fetchall()
    return [
        {
            "id": row[0],
            "title": row[1],
            "filename": row[2],
            "levels": _json_value(row[3]),
            "published": row[4],
            "created_at": row[5],
        }
        for row in rows
    ]


def get_word_list(word_list_id: str, published_only: bool = False) -> dict | None:
    query = """
        SELECT id, title, filename, levels, published, created_at
        FROM custom_word_lists WHERE id = %s
    """
    parameters: list[object] = [word_list_id]
    if published_only:
        query += " AND published = TRUE"
    with _connect() as connection:
        row = connection.execute(query, parameters).fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "title": row[1],
        "filename": row[2],
        "levels": _json_value(row[3]),
        "published": row[4],
        "created_at": row[5],
    }


def update_word_list(word_list_id: str, title: str | None, published: bool | None) -> dict | None:
    with _connect() as connection:
        row = connection.execute(
            """
            UPDATE custom_word_lists
            SET title = COALESCE(%s, title),
                published = COALESCE(%s, published),
                updated_at = NOW()
            WHERE id = %s
            RETURNING id, title, filename, levels, published, created_at
            """,
            (title, published, word_list_id),
        ).fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "title": row[1],
        "filename": row[2],
        "levels": _json_value(row[3]),
        "published": row[4],
        "created_at": row[5],
    }


def delete_word_list(word_list_id: str) -> bool:
    with _connect() as connection:
        result = connection.execute("DELETE FROM custom_word_lists WHERE id = %s", (word_list_id,))
    return result.rowcount > 0


def create_word_list_request(user_id: str, title: str, details: str) -> dict:
    request_id = str(uuid4())
    with _connect() as connection:
        row = connection.execute(
            """
            INSERT INTO word_list_requests (id, clerk_user_id, title, details)
            VALUES (%s, %s, %s, %s)
            RETURNING id, clerk_user_id, title, details, status, created_at, updated_at
            """,
            (request_id, user_id, title, details),
        ).fetchone()
    return _request_row(row)


def _request_row(row) -> dict:
    return {
        "id": row[0],
        "clerk_user_id": row[1],
        "title": row[2],
        "details": row[3],
        "status": row[4],
        "created_at": row[5],
        "updated_at": row[6],
    }


def list_word_list_requests(user_id: str | None = None) -> list[dict]:
    query = """
        SELECT id, clerk_user_id, title, details, status, created_at, updated_at
        FROM word_list_requests
    """
    parameters: tuple = ()
    if user_id:
        query += " WHERE clerk_user_id = %s"
        parameters = (user_id,)
    query += " ORDER BY created_at DESC"
    with _connect() as connection:
        rows = connection.execute(query, parameters).fetchall()
    return [_request_row(row) for row in rows]


def update_word_list_request(request_id: str, status: str) -> dict | None:
    with _connect() as connection:
        row = connection.execute(
            """
            UPDATE word_list_requests
            SET status = %s, updated_at = NOW()
            WHERE id = %s
            RETURNING id, clerk_user_id, title, details, status, created_at, updated_at
            """,
            (status, request_id),
        ).fetchone()
    return _request_row(row) if row else None


def admin_overview() -> dict:
    with _connect() as connection:
        saved_users = connection.execute("SELECT COUNT(*) FROM practice_progress").fetchone()[0]
        custom_lists = connection.execute("SELECT COUNT(*) FROM custom_word_lists").fetchone()[0]
        published_lists = connection.execute(
            "SELECT COUNT(*) FROM custom_word_lists WHERE published = TRUE"
        ).fetchone()[0]
        pending_requests = connection.execute(
            "SELECT COUNT(*) FROM word_list_requests WHERE status = 'pending'"
        ).fetchone()[0]
    return {
        "saved_user_count": saved_users,
        "custom_list_count": custom_lists,
        "published_list_count": published_lists,
        "pending_request_count": pending_requests,
    }
