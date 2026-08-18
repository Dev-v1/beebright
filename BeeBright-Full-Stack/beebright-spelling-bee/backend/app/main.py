from __future__ import annotations

import json
import random
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.models import DictionaryResult, ImportedPdf, LevelInfo, PracticeResponse, WordItem
from app.services.merriam_webster import lookup_word
from app.services.pdf_parser import LEVEL_LABELS, parse_pdf


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_FILE = BASE_DIR / "data" / "words.json"
settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Backend API for the BeeBright spelling bee practice site.",
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


@app.get("/")
def root():
    return {"name": "BeeBright API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "word_count": sum(len(words) for words in WORD_LEVELS.values()),
        "merriam_webster_configured": bool(settings.merriam_webster_api_key.strip()),
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
        words=[WordItem(word=word, level=level) for word in selected],
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
        WordItem(word=word, level=level, source=file.filename or "Imported PDF")
        for level, words in parsed.items()
        for word in words
    ]
    return ImportedPdf(filename=file.filename or "uploaded.pdf", levels=level_info, words=items)

