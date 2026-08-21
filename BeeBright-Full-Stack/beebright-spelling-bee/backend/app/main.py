from __future__ import annotations

import json
import logging
import random
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.auth import get_current_admin_user_id, get_current_user_id, is_admin_user
from app.database import (
    admin_overview,
    create_word_list,
    create_word_list_request,
    delete_progress,
    delete_word_list,
    get_word_list,
    initialize_database,
    list_word_list_requests,
    list_word_lists,
    read_progress,
    save_progress,
    update_word_list,
    update_word_list_request,
)
from app.models import (
    AccessResponse,
    AdminOverview,
    AdminWordListUpdate,
    DictionaryResult,
    LevelInfo,
    PracticeResponse,
    ProgressPayload,
    ProgressResponse,
    WordListRequestCreate,
    WordListRequestResponse,
    WordListRequestStatusUpdate,
    WordListSummary,
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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


def word_list_summary(record: dict, *, built_in: bool = False) -> WordListSummary:
    level_info = [
        LevelInfo(key=key, label=LEVEL_LABELS[key], count=len(words))
        for key, words in record["levels"].items()
        if words
    ]
    return WordListSummary(
        id=record["id"],
        title=record["title"],
        filename=record["filename"],
        levels=level_info,
        word_count=sum(item.count for item in level_info),
        published=record.get("published", True),
        built_in=built_in,
        created_at=record.get("created_at"),
    )


def built_in_word_list() -> WordListSummary:
    return word_list_summary(
        {
            "id": "champions-2024",
            "title": "2024 Words of the Champions",
            "filename": "2024 Words of the Champions.pdf",
            "levels": WORD_LEVELS,
            "published": True,
        },
        built_in=True,
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
        "admin_configured": bool(settings.admin_clerk_user_ids.strip()),
    }


@app.get("/api/levels", response_model=list[LevelInfo])
def levels():
    return [
        LevelInfo(key=key, label=LEVEL_LABELS[key], count=len(words))
        for key, words in WORD_LEVELS.items()
        if words
    ]


@app.get("/api/access", response_model=AccessResponse)
def access(user_id: str = Depends(get_current_user_id)):
    return AccessResponse(is_admin=is_admin_user(user_id))


@app.get("/api/word-lists", response_model=list[WordListSummary])
def published_word_lists():
    result = [built_in_word_list()]
    if not settings.database_url.strip():
        return result
    try:
        result.extend(word_list_summary(item) for item in list_word_lists(published_only=True))
    except Exception:
        logger.exception("Custom word lists could not be loaded; returning the built-in list.")
    return result


@app.get("/api/practice", response_model=PracticeResponse)
def practice_set(
    word_list_id: str = Query(default="champions-2024"),
    level: str = Query(default="one_bee"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
    randomize: bool = Query(default=False),
):
    if word_list_id == "champions-2024":
        available_levels = WORD_LEVELS
        source_title = "2024 Words of the Champions"
    else:
        try:
            custom_list = get_word_list(word_list_id, published_only=True)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Custom word lists are temporarily unavailable.") from exc
        if not custom_list:
            raise HTTPException(status_code=404, detail="This word list is unavailable.")
        available_levels = custom_list["levels"]
        source_title = custom_list["title"]

    if level not in available_levels:
        raise HTTPException(status_code=404, detail="Unknown spelling-bee level.")

    source = available_levels[level]
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
        word_list_id=word_list_id,
        level=level,
        label=LEVEL_LABELS[level],
        offset=response_offset,
        limit=limit,
        total=len(source),
        has_more=response_offset + len(selected) < len(source),
        words=[word_item(word, level, source_title) for word in selected],
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


@app.post("/api/admin/word-lists/import", response_model=WordListSummary)
@app.post("/api/import-pdf", response_model=WordListSummary, deprecated=True)
async def import_pdf(
    title: str = Form(default=""),
    file: UploadFile = File(...),
    admin_user_id: str = Depends(get_current_admin_user_id),
):
    if file.content_type not in {"application/pdf", "application/octet-stream"}:
        raise HTTPException(status_code=415, detail="Please upload a PDF file.")
    payload = await file.read()
    if len(payload) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF must be 15 MB or smaller.")
    try:
        parsed = parse_pdf(payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    clean_title = title.strip() or (file.filename or "Imported word list").removesuffix(".pdf")
    if len(clean_title) > 120:
        raise HTTPException(status_code=400, detail="Word-list title must be 120 characters or fewer.")
    try:
        created = create_word_list(
            clean_title,
            file.filename or "uploaded.pdf",
            parsed,
            admin_user_id,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="The word list could not be saved.") from exc
    return word_list_summary(created)


@app.get("/api/admin/overview", response_model=AdminOverview)
def get_admin_overview(_: str = Depends(get_current_admin_user_id)):
    try:
        return AdminOverview(**admin_overview())
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Admin statistics are temporarily unavailable.") from exc


@app.get("/api/admin/word-lists", response_model=list[WordListSummary])
def admin_word_lists(_: str = Depends(get_current_admin_user_id)):
    try:
        return [word_list_summary(item) for item in list_word_lists()]
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Word lists are temporarily unavailable.") from exc


@app.patch("/api/admin/word-lists/{word_list_id}", response_model=WordListSummary)
def patch_admin_word_list(
    word_list_id: str,
    payload: AdminWordListUpdate,
    _: str = Depends(get_current_admin_user_id),
):
    title = payload.title.strip() if payload.title is not None else None
    try:
        updated = update_word_list(word_list_id, title, payload.published)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="The word list could not be updated.") from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Word list not found.")
    return word_list_summary(updated)


@app.delete("/api/admin/word-lists/{word_list_id}", status_code=204)
def remove_admin_word_list(word_list_id: str, _: str = Depends(get_current_admin_user_id)):
    try:
        deleted = delete_word_list(word_list_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="The word list could not be deleted.") from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Word list not found.")
    return Response(status_code=204)


@app.post("/api/word-list-requests", response_model=WordListRequestResponse, status_code=201)
def request_word_list(
    payload: WordListRequestCreate,
    user_id: str = Depends(get_current_user_id),
):
    try:
        return WordListRequestResponse(**create_word_list_request(
            user_id,
            payload.title.strip(),
            payload.details.strip(),
        ))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Your request could not be submitted.") from exc


@app.get("/api/word-list-requests/mine", response_model=list[WordListRequestResponse])
def my_word_list_requests(user_id: str = Depends(get_current_user_id)):
    try:
        return [WordListRequestResponse(**item) for item in list_word_list_requests(user_id)]
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Your requests could not be loaded.") from exc


@app.get("/api/admin/word-list-requests", response_model=list[WordListRequestResponse])
def admin_word_list_requests(_: str = Depends(get_current_admin_user_id)):
    try:
        return [WordListRequestResponse(**item) for item in list_word_list_requests()]
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Word-list requests could not be loaded.") from exc


@app.patch("/api/admin/word-list-requests/{request_id}", response_model=WordListRequestResponse)
def patch_word_list_request(
    request_id: str,
    payload: WordListRequestStatusUpdate,
    _: str = Depends(get_current_admin_user_id),
):
    try:
        updated = update_word_list_request(request_id, payload.status)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="The request could not be updated.") from exc
    if not updated:
        raise HTTPException(status_code=404, detail="Request not found.")
    return WordListRequestResponse(**updated)


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
