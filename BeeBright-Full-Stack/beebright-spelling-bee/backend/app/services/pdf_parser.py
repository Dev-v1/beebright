from __future__ import annotations

import io
import re
from collections import defaultdict
from pathlib import Path
from typing import BinaryIO

import pdfplumber


LEVEL_LABELS = {
    "one_bee": "One Bee",
    "two_bee": "Two Bee",
    "three_bee": "Three Bee",
    "random": "Random",
}

# The 2024 Words of the Champions PDF uses three aligned columns. These are
# the x coordinates of the first word in each column. Keeping these values in
# one obvious place makes it easy to update the parser for a future edition.
SCRIPPS_COLUMN_X = (92.2, 260.0, 427.8)
SCRIPPS_PAGE_RANGES = {
    "one_bee": range(4, 14),
    "two_bee": range(14, 30),
    "three_bee": range(30, 40),
}


def _clean_word(value: str) -> str:
    value = value.replace("*", "").strip()
    value = re.sub(r"\s+", " ", value)
    return value


def _looks_like_spelling_word(value: str) -> bool:
    if not value or len(value) > 45:
        return False
    if any(char.isdigit() for char in value):
        return False
    if value.lower().startswith(("difficulty level", "words of the champions")):
        return False
    return bool(re.fullmatch(r"[A-Za-zÀ-ÖØ-öø-ÿ'’.-]+(?: [A-Za-zÀ-ÖØ-öø-ÿ'’.-]+){0,3}", value))


def _parse_scripps(pdf: pdfplumber.PDF) -> dict[str, list[str]]:
    parsed: dict[str, list[str]] = defaultdict(list)

    for level, pages in SCRIPPS_PAGE_RANGES.items():
        for page_number in pages:
            if page_number > len(pdf.pages):
                continue

            page = pdf.pages[page_number - 1]
            words = page.extract_words(extra_attrs=["fontname", "size"])
            regular = [
                item
                for item in words
                if "FilsonProRegular" in item.get("fontname", "")
                and abs(float(item.get("size", 0)) - 10.0) < 0.25
            ]

            for item in regular:
                anchor = min(SCRIPPS_COLUMN_X, key=lambda x: abs(item["x0"] - x))
                if abs(item["x0"] - anchor) > 2.5:
                    continue
                if not (30 < item["top"] < 750):
                    continue

                same_line = [
                    other["text"]
                    for other in regular
                    if abs(other["top"] - item["top"]) < 1
                    and anchor - 2 <= other["x0"] < anchor + 165
                ]
                candidate = _clean_word(" ".join(same_line))
                if _looks_like_spelling_word(candidate):
                    parsed[level].append(candidate)

    return {key: _dedupe(values) for key, values in parsed.items()}


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        normalized = value.casefold()
        if normalized not in seen:
            seen.add(normalized)
            result.append(value)
    return result


def _parse_generic(pdf: pdfplumber.PDF) -> dict[str, list[str]]:
    """Fallback for simple word-list PDFs that do not use the Scripps layout."""
    candidates: list[str] = []
    for page in pdf.pages:
        text = page.extract_text() or ""
        for raw_line in text.splitlines():
            line = _clean_word(raw_line)
            # Generic lists work best when each line is a single word/short phrase.
            if _looks_like_spelling_word(line) and len(line.split()) <= 3:
                candidates.append(line)
    return {"random": _dedupe(candidates)}


def parse_pdf(source: str | Path | BinaryIO | bytes) -> dict[str, list[str]]:
    if isinstance(source, bytes):
        source = io.BytesIO(source)

    with pdfplumber.open(source) as pdf:
        first_pages = "\n".join((page.extract_text() or "") for page in pdf.pages[:4])
        is_scripps = (
            "Words of the Champions" in first_pages
            and "difficulty level" in first_pages.lower()
        )
        parsed = _parse_scripps(pdf) if is_scripps else _parse_generic(pdf)

    if not any(parsed.values()):
        raise ValueError("No usable spelling words were found in this PDF.")
    return parsed

