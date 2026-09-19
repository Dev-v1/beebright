from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


LevelKey = Literal["one_bee", "two_bee", "three_bee", "random"]


class WordItem(BaseModel):
    word: str
    level: LevelKey
    source: str = "2024 Words of the Champions"
    options: list[str] = Field(default_factory=list)


class LevelInfo(BaseModel):
    key: LevelKey
    label: str
    count: int


class PracticeResponse(BaseModel):
    word_list_id: str = "champions-2024"
    level: LevelKey
    label: str
    offset: int
    limit: int
    total: int
    has_more: bool
    words: list[WordItem]


class DictionaryResult(BaseModel):
    word: str
    found: bool = False
    definition: str = "Definition unavailable."
    origin: str = "Word origin unavailable."
    sentence: str = "Example sentence unavailable."
    pronunciation: str = ""
    audio_url: str = ""
    source: str = "Merriam-Webster"
    source_url: str = ""
    part_of_speech: str = ""
    license: str = ""
    suggestions: list[str] = Field(default_factory=list)


class ImportedPdf(BaseModel):
    filename: str
    levels: list[LevelInfo]
    words: list[WordItem]


class ProgressPayload(BaseModel):
    session: dict = Field(default_factory=dict)


class ProgressResponse(BaseModel):
    session: dict | None = None


class AccessResponse(BaseModel):
    is_admin: bool = False


class WordListSummary(BaseModel):
    id: str
    title: str
    filename: str
    levels: list[LevelInfo]
    word_count: int
    published: bool = True
    built_in: bool = False
    created_at: datetime | None = None


class AdminWordListUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    published: bool | None = None


class WordListRequestCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    details: str = Field(default="", max_length=1000)


class WordListRequestResponse(BaseModel):
    id: str
    clerk_user_id: str
    title: str
    details: str
    status: Literal["pending", "approved", "declined"]
    created_at: datetime
    updated_at: datetime


class WordListRequestStatusUpdate(BaseModel):
    status: Literal["pending", "approved", "declined"]


class AdminOverview(BaseModel):
    saved_user_count: int = 0
    custom_list_count: int = 0
    published_list_count: int = 0
    pending_request_count: int = 0
