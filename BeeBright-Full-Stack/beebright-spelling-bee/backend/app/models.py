from typing import Literal

from pydantic import BaseModel, Field


LevelKey = Literal["one_bee", "two_bee", "three_bee", "random"]


class WordItem(BaseModel):
    word: str
    level: LevelKey
    source: str = "2024 Words of the Champions"


class LevelInfo(BaseModel):
    key: LevelKey
    label: str
    count: int


class PracticeResponse(BaseModel):
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
    suggestions: list[str] = Field(default_factory=list)


class ImportedPdf(BaseModel):
    filename: str
    levels: list[LevelInfo]
    words: list[WordItem]

