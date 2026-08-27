from __future__ import annotations

import re
from functools import lru_cache

import httpx

from app.config import get_settings


API_URL = "https://www.dictionaryapi.com/api/v3/references/collegiate/json/{word}"


def _hide_spelling(text: str, word: str, replacement: str) -> str:
    if not text:
        return text
    # Also hides common inflections so a hint cannot expose the target spelling.
    pattern = re.compile(rf"\b{re.escape(word)}(?:s|es|ed|ing|ly)?\b", re.IGNORECASE)
    return pattern.sub(replacement, text)


def _definition_cloze_sentence(definition: str) -> str:
    clean = re.sub(r"\s+", " ", definition or "").strip().rstrip(".!?")
    unavailable = (
        not clean
        or clean in {"Definition unavailable", "Dictionary information is temporarily unavailable"}
        or "API key" in clean
    )
    if unavailable:
        return "Use ___ correctly in this sentence."
    starts_with_acronym = len(clean) > 1 and clean[0].isupper() and clean[1].isupper()
    if clean[0].isupper() and not starts_with_acronym:
        clean = clean[0].lower() + clean[1:]
    return f"___ means {clean}."


def _short_complete_sentence(text: str, word: str, definition: str) -> str:
    unavailable = not text or text == "Example sentence unavailable."
    if unavailable:
        return _definition_cloze_sentence(definition)

    hidden = _hide_spelling(text, word, "___").strip()
    # Keep the first complete sentence and limit unusually long dictionary examples.
    match = re.match(r"^(.{1,180}?[.!?])(?:\s|$)", hidden)
    sentence = match.group(1) if match else hidden[:177].rstrip(" ,;:")
    if not sentence.endswith((".", "!", "?")):
        sentence += "."
    if "___" not in sentence:
        return _definition_cloze_sentence(definition)
    return sentence


def _safe_dictionary_result(result: dict, word: str) -> dict:
    safe_definition = _hide_spelling(
        result.get("definition", "Definition unavailable."), word, "this word"
    )
    result["definition"] = safe_definition
    result["origin"] = _hide_spelling(
        result.get("origin", "Word origin unavailable."), word, "this word"
    )
    result["sentence"] = _short_complete_sentence(
        result.get("sentence", ""), word, safe_definition
    )
    return result


def _strip_mw_markup(text: str) -> str:
    replacements = {
        "{bc}": "",
        "{ldquo}": '"',
        "{rdquo}": '"',
        "{lsquo}": "'",
        "{rsquo}": "'",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"\{/?(?:it|wi|sc|sup|inf)\}", "", text)
    text = re.sub(r"\{(?:a_link|d_link|i_link|mat|sx)\|([^|}]+)(?:\|[^}]*)?\}", r"\1", text)
    text = re.sub(r"\{[^}]+\}", "", text)
    return re.sub(r"\s+", " ", text).strip(" :")


def _walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk(child)


def _first_definition(entry: dict) -> str:
    for node in _walk(entry.get("def", [])):
        dt = node.get("dt")
        if not isinstance(dt, list):
            continue
        for item in dt:
            if isinstance(item, list) and len(item) > 1 and item[0] == "text":
                text = _strip_mw_markup(str(item[1]))
                if text:
                    return text
    shortdef = entry.get("shortdef") or []
    return _strip_mw_markup(str(shortdef[0])) if shortdef else "Definition unavailable."


def _first_sentence(entry: dict) -> str:
    for node in _walk(entry.get("def", [])):
        dt = node.get("dt")
        if not isinstance(dt, list):
            continue
        for item in dt:
            if not (isinstance(item, list) and len(item) > 1 and item[0] == "vis"):
                continue
            examples = item[1] if isinstance(item[1], list) else []
            for example in examples:
                if isinstance(example, dict) and example.get("t"):
                    return _strip_mw_markup(str(example["t"]))
    return "Example sentence unavailable."


def _audio_url(audio: str) -> str:
    if not audio:
        return ""
    if audio.startswith("bix"):
        folder = "bix"
    elif audio.startswith("gg"):
        folder = "gg"
    elif not audio[0].isalpha():
        folder = "number"
    else:
        folder = audio[0].lower()
    return f"https://media.merriam-webster.com/audio/prons/en/us/mp3/{folder}/{audio}.mp3"


def _pronunciation(entry: dict) -> tuple[str, str]:
    pronunciations = entry.get("hwi", {}).get("prs", [])
    for pronunciation in pronunciations:
        written = pronunciation.get("mw", "")
        audio = pronunciation.get("sound", {}).get("audio", "")
        if written or audio:
            return written, _audio_url(audio)
    return "", ""


@lru_cache(maxsize=2048)
def lookup_word(word: str) -> dict:
    key = get_settings().merriam_webster_api_key.strip()
    if not key:
        return _safe_dictionary_result({
            "word": word,
            "found": False,
            "definition": "Add MERRIAM_WEBSTER_API_KEY on the backend to load the definition.",
            "origin": "Add the Merriam-Webster API key to load word origin.",
            "sentence": "Add the Merriam-Webster API key to load an example sentence.",
            "pronunciation": "",
            "audio_url": "",
            "suggestions": [],
        }, word)

    with httpx.Client(timeout=10.0) as client:
        response = client.get(API_URL.format(word=word), params={"key": key})
        response.raise_for_status()
        payload = response.json()

    if not payload:
        return _safe_dictionary_result({"word": word, "found": False, "suggestions": []}, word)
    if isinstance(payload[0], str):
        return _safe_dictionary_result(
            {"word": word, "found": False, "suggestions": payload[:8]}, word
        )

    entry = payload[0]
    pronunciation, audio_url = _pronunciation(entry)
    etymology = entry.get("et", [])
    origin = "Word origin unavailable."
    if etymology:
        first = etymology[0]
        if isinstance(first, list) and len(first) > 1:
            origin = _strip_mw_markup(str(first[1]))

    return _safe_dictionary_result({
        "word": word,
        "found": True,
        "definition": _first_definition(entry),
        "origin": origin,
        "sentence": _first_sentence(entry),
        "pronunciation": pronunciation,
        "audio_url": audio_url,
        "suggestions": [],
    }, word)
