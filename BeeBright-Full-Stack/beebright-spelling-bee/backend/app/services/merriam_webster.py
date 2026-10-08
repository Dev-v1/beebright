from __future__ import annotations

import re
from functools import lru_cache

import httpx

from app.config import get_settings


API_URL = "https://www.dictionaryapi.com/api/v3/references/collegiate/json/{word}"


from app.services.practice_core import (
    MISSING_SENTENCE, _hide_spelling, _short_complete_sentence, _safe_dictionary_result,
)


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
    text = re.sub(r"\{(?:a_link|d_link|i_link|et_link|dxt|mat|sx)\|([^|}]+)(?:\|[^}]*)?\}", r"\1", text)
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


def _entry_word(entry: dict) -> str:
    return re.sub(r':\d+$', '', entry.get('meta', {}).get('id', '')).replace('*', '').casefold()


def _senses(entry: dict, word: str):
    for node in _walk(entry.get('def', [])):
        dt = node.get('dt', [])
        definitions = [_strip_mw_markup(str(x[1])) for x in dt if isinstance(x, list) and len(x) > 1 and x[0] == 'text']
        definition = ' '.join(definitions)
        if not definition or _hide_spelling(definition, word, '') != definition:
            continue
        examples = [ex for x in dt if isinstance(x, list) and len(x) > 1 and x[0] == 'vis' and isinstance(x[1], list) for ex in x[1] if isinstance(ex, dict)]
        sentence = next((_strip_mw_markup(ex['t']) for ex in examples if ex.get('t') and _short_complete_sentence(_strip_mw_markup(ex['t']), word) != MISSING_SENTENCE), '')
        yield definition, sentence


def _from_payload(payload: list, word: str) -> dict:
    empty = {'word': word, 'found': False, 'suggestions': []}
    if not payload or isinstance(payload[0], str):
        return _safe_dictionary_result({**empty, 'suggestions': payload[:8]}, word)
    entries = [e for e in payload if isinstance(e, dict) and _entry_word(e) == word.casefold()]
    entries.sort(key=lambda e: int(e.get('hom', 1) or 1))
    for entry in entries:
        senses = list(_senses(entry, word))
        if not senses:
            continue
        definition, sentence = next((s for s in senses if s[1]), senses[0])
        origin = ' '.join(_strip_mw_markup(str(p[1])) for p in entry.get('et', []) if isinstance(p, list) and len(p) > 1 and p[0] == 'text')
        pronunciation, audio_url = _pronunciation(entry)
        return _safe_dictionary_result({**empty, 'found': True, 'definition': definition,
            'sentence': sentence, 'origin': origin or 'A documented origin is not yet available for this word.',
            'part_of_speech': entry.get('fl', ''), 'pronunciation': pronunciation, 'audio_url': audio_url,
            'source': 'Merriam-Webster'}, word)
    return _safe_dictionary_result(empty, word)


@lru_cache(maxsize=1)
def _local_hints():
    import json
    from pathlib import Path
    path = Path(__file__).resolve().parents[2] / 'data' / 'word_hints.json'
    records = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
    study_path = path.with_name('study_2027_hints.json')
    if study_path.exists():
        records.update(json.loads(study_path.read_text(encoding='utf-8')))
    return records


@lru_cache(maxsize=8192)
def lookup_word(word: str) -> dict:
    from urllib.parse import quote
    record = _local_hints().get(word)
    if record:
        return _safe_dictionary_result({**record, 'word': word, 'found': True, 'suggestions': []}, word)
    key = get_settings().merriam_webster_api_key.strip()
    if not key:
        return _safe_dictionary_result({'word': word, 'found': False, 'suggestions': []}, word)
    with httpx.Client(timeout=10.0) as client:
        response = client.get(API_URL.format(word=quote(word, safe='')), params={'key': key})
        response.raise_for_status()
        return _from_payload(response.json(), word)
