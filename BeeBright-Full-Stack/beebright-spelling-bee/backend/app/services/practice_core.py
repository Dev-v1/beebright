from __future__ import annotations

import random
import re

def _hide_spelling(text: str, word: str, replacement: str) -> str:
    if not text:
        return text
    # Match the exact word, including Unicode and multiword entries.
    pattern = re.compile(rf"(?<!\w){re.escape(word)}(?!\w)", re.IGNORECASE)
    return pattern.sub(replacement, text)


MISSING_SENTENCE = "A checked example sentence is not yet available for this word."


def _short_complete_sentence(text: str, word: str, definition: str = "") -> str:
    text = (text or "").strip()
    if not text or len(text) > 500 or not re.search(r'[.!?][\"”\')]*$', text):
        return MISSING_SENTENCE
    hidden = _hide_spelling(text, word, "___")
    return hidden if hidden != text else MISSING_SENTENCE


def _safe_dictionary_result(result: dict, word: str) -> dict:
    result = dict(result)
    raw_definition = result.get("definition", "Definition unavailable.")
    safe_definition = _hide_spelling(
        raw_definition, word, "this word"
    )
    result["definition"] = safe_definition
    result["origin"] = _hide_spelling(
        result.get("origin", "Word origin unavailable."), word, "this word"
    )
    result["sentence"] = _short_complete_sentence(
        result.get("sentence", ""), word, raw_definition
    )
    return result


def shuffled_words(words: list[str], seed: str) -> list[str]:
    result = list(words)
    random.Random(seed).shuffle(result)
    return result
