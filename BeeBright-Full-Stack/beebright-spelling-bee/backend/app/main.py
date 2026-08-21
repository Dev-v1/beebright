from __future__ import annotations

import json
import logging
import random
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.auth import get_current_user_id
from app.database import delete_progress, initialize_database, read_progress, save_progress
from app.models import (
    DictionaryResult,
    ImportedPdf,
    LevelInfo,
    PracticeResponse,
    ProgressPayload,
    ProgressResponse,
    WordItem,
)
from app.services.distractors import generate_distractors, shuffled_options
from app.services.merriam_webster import lookup_word
from app.services.pdf_parser import LEVEL_LABELS, parse_pdf


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_FILE = BASE_DIR / "data" / "words.json"
DISTRACTORS_FILE = BASE_DIR / "data" / "distractors.json"
settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        initialize_database()
    except Exception:
        logger.exception("Neon database initialization failed; public practice routes remain available.")
    yield

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Backend API for the BeeBright spelling bee practice site.",
    lifespan=lifespan,
)

allowed_origins = [
    "http://localhost:5173",
    settings.frontend_url.rstrip("/"),
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(origin for origin in allowed_origins if origin)),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def load_words() -> dict[str, list[str]]:
    if not DATA_FILE.exists():
        return {"one_bee": [], "two_bee": [], "three_bee": []}
    return json.loads(DATA_FILE.read_text(encoding="utf-8"))["levels"]


WORD_LEVELS = load_words()


def load_distractors() -> dict[str, list[str]]:
    if not DISTRACTORS_FILE.exists():
        return {
            word: generate_distractors(word)
            for words in WORD_LEVELS.values()
            for word in words
        }
    return json.loads(DISTRACTORS_FILE.read_text(encoding="utf-8"))


WORD_DISTRACTORS = load_distractors()


def word_item(word: str, level: str, source: str = "2024 Words of the Champions") -> WordItem:
    wrong = WORD_DISTRACTORS.get(word) or generate_distractors(word)
    return WordItem(
        word=word,
        level=level,
        source=source,
        options=shuffled_options(word, wrong),
    )


@app.get("/")
def root():
    return {"name": "BeeBright API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "word_count": sum(len(words) for words in WORD_LEVELS.values()),
        "merriam_webster_configured": bool(settings.merriam_webster_api_key.strip()),
        "clerk_configured": bool(settings.clerk_jwt_key.strip()),
        "database_configured": bool(settings.database_url.strip()),
    }


@app.get("/api/levels", response_model=list[LevelInfo])
def levels():
    return [
        LevelInfo(key=key, label=LEVEL_LABELS[key], count=len(words))
        for key, words in WORD_LEVELS.items()
        if words
    ]


@app.get("/api/practice", response_model=PracticeResponse)
def practice_set(
    level: str = Query(default="one_bee"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    randomize: bool = Query(default=False),
):
    if level not in WORD_LEVELS:
        raise HTTPException(status_code=404, detail="Unknown spelling-bee level.")

    source = WORD_LEVELS[level]
    if not source:
        raise HTTPException(status_code=404, detail="This level has no words.")

    if randomize:
        selected = random.sample(source, k=min(limit, len(source)))
        response_offset = 0
    else:
        selected = source[offset : offset + limit]
        response_offset = offset
        if not selected and offset:
            selected = source[:limit]
            response_offset = 0

    return PracticeResponse(
        level=level,
        label=LEVEL_LABELS[level],
        offset=response_offset,
        limit=limit,
        total=len(source),
        has_more=response_offset + len(selected) < len(source),
        words=[word_item(word, level) for word in selected],
    )


@app.get("/api/dictionary/{word}", response_model=DictionaryResult)
def dictionary(word: str):
    clean = word.strip()
    if not clean or len(clean) > 80:
        raise HTTPException(status_code=400, detail="Invalid word.")
    try:
        return DictionaryResult(**lookup_word(clean))
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Dictionary service is temporarily unavailable.") from exc


@app.post("/api/import-pdf", response_model=ImportedPdf)
async def import_pdf(file: UploadFile = File(...)):
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="Please upload a PDF file.")
    payload = await file.read()
    if len(payload) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF must be 15 MB or smaller.")
    try:
        parsed = parse_pdf(payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    level_info = [
        LevelInfo(key=key, label=LEVEL_LABELS[key], count=len(words))
        for key, words in parsed.items()
    ]
    items = [
        word_item(word, level, file.filename or "Imported PDF")
        for level, words in parsed.items()
        for word in words
    ]
    return ImportedPdf(filename=file.filename or "uploaded.pdf", levels=level_info, words=items)


@app.get("/api/progress", response_model=ProgressResponse)
def get_progress(user_id: str = Depends(get_current_user_id)):
    try:
        return ProgressResponse(session=read_progress(user_id))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Saved progress is temporarily unavailable.") from exc


@app.put("/api/progress", status_code=204)
def put_progress(payload: ProgressPayload, user_id: str = Depends(get_current_user_id)):
    serialized = json.dumps(payload.session)
    if len(serialized.encode("utf-8")) > 150_000:
        raise HTTPException(status_code=413, detail="Saved practice data is too large.")
    try:
        save_progress(user_id, payload.session)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Progress could not be saved.") from exc
    return Response(status_code=204)


@app.delete("/api/progress", status_code=204)
def remove_progress(user_id: str = Depends(get_current_user_id)):
    try:
        delete_progress(user_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Progress could not be deleted.") from exc
    return Response(status_code=204)
