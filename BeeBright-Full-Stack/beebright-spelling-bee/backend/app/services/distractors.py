from __future__ import annotations

import hashlib
import random
import re


SPECIAL_DISTRACTORS: dict[str, list[str]] = {
    "equestrian": ["equestian", "equestrean", "equestrain"],
}


PHONETIC_REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("ph", "f"),
    ("f", "ph"),
    ("ght", "t"),
    ("tion", "sion"),
    ("sion", "tion"),
    ("ture", "cher"),
    ("ch", "tch"),
    ("tch", "ch"),
    ("ck", "k"),
    ("qu", "kw"),
    ("x", "ks"),
    ("j", "g"),
    ("dge", "ge"),
    ("ge", "dge"),
    ("ce", "se"),
    ("ci", "si"),
    ("sc", "s"),
    ("wr", "r"),
    ("kn", "n"),
    ("wh", "w"),
    ("rh", "r"),
    ("ae", "e"),
    ("oe", "e"),
    ("ie", "ei"),
    ("ei", "ie"),
    ("ea", "ee"),
    ("ee", "ea"),
    ("ai", "ay"),
    ("ay", "ai"),
    ("ou", "ow"),
    ("ow", "ou"),
    ("au", "aw"),
    ("aw", "au"),
    ("oo", "u"),
    ("er", "ur"),
    ("ur", "er"),
    ("able", "ible"),
    ("ible", "able"),
    ("ance", "ence"),
    ("ence", "ance"),
    ("ant", "ent"),
    ("ent", "ant"),
)


def _add(candidates: list[str], value: str, word: str) -> None:
    clean = re.sub(r"[^a-z'-]", "", value.lower())
    if clean and clean != word and clean not in candidates:
        candidates.append(clean)


def generate_distractors(word: str) -> list[str]:
    """Create three deterministic, pronunciation-style misspellings."""
    lower = word.strip().lower()
    if lower in SPECIAL_DISTRACTORS:
        return SPECIAL_DISTRACTORS[lower].copy()

    phonetic: list[str] = []
    endings: list[str] = []
    doubled: list[str] = []
    vowels: list[str] = []
    transposed: list[str] = []

    for old, new in PHONETIC_REPLACEMENTS:
        start = 0
        while (index := lower.find(old, start)) >= 0:
            _add(phonetic, lower[:index] + new + lower[index + len(old) :], lower)
            start = index + 1

    # Common long-vowel spellings, such as tape -> taip/tayp.
    silent_e = re.search(r"([aeiou])([^aeiou])e$", lower)
    if silent_e:
        vowel, consonant = silent_e.groups()
        prefix = lower[: silent_e.start()]
        long_vowels = {
            "a": ("ai", "ay"),
            "e": ("ee", "ea"),
            "i": ("igh", "ie"),
            "o": ("oa", "ow"),
            "u": ("ue", "ew"),
        }
        for spelling in long_vowels[vowel]:
            _add(phonetic, prefix + spelling + consonant, lower)
    elif lower.endswith("y"):
        _add(phonetic, lower[:-1] + "ie", lower)
        _add(phonetic, lower[:-1] + "i", lower)
        if lower.startswith("s"):
            _add(phonetic, "c" + lower[1:], lower)
    elif len(lower) > 3:
        _add(endings, lower + "e", lower)

    ending_rules = (
        (r"y$", "ie"),
        (r"ie$", "y"),
        (r"er$", "or"),
        (r"or$", "er"),
        (r"ary$", "ery"),
        (r"ery$", "ary"),
        (r"ous$", "us"),
        (r"ic$", "ick"),
        (r"al$", "el"),
        (r"el$", "al"),
    )
    for pattern, replacement in ending_rules:
        if re.search(pattern, lower):
            _add(endings, re.sub(pattern, replacement, lower), lower)

    # Doubling or undoubling a consonant produces familiar spelling errors.
    consonant_indexes = [
        index
        for index, char in enumerate(lower[1:-1], start=1)
        if char in "bcdfghjklmnpqrstvwxyz"
    ]
    for index in consonant_indexes:
        _add(doubled, lower[:index] + lower[index] + lower[index:], lower)
    for match in re.finditer(r"([bcdfghjklmnpqrstvwxyz])\1", lower):
        index = match.start()
        _add(doubled, lower[:index] + lower[index + 1 :], lower)

    # Vowel-pair and schwa-like alternatives are useful for words without a
    # recognized pattern above.
    vowel_alternates = {"a": "e", "e": "i", "i": "e", "o": "a", "u": "o"}
    for index, char in enumerate(lower):
        if char in vowel_alternates:
            _add(vowels, lower[:index] + vowel_alternates[char] + lower[index + 1 :], lower)

    # Adjacent-letter reversals resemble the kinds of errors spellers make.
    for index in range(1, len(lower) - 1):
        if lower[index] != lower[index + 1]:
            _add(transposed, lower[:index] + lower[index + 1] + lower[index] + lower[index + 2 :], lower)

    fallbacks = [
        lower + "h",
        lower + "e",
        lower[:-1] + lower[-1:] * 2 if lower else "",
        lower[:1] + "e" + lower[1:],
        lower[:1] + "a" + lower[1:],
    ]
    fallback_candidates: list[str] = []
    for fallback in fallbacks:
        _add(fallback_candidates, fallback, lower)

    # Prefer one candidate from each high-quality family before using basic
    # typographical fallbacks. Rotation keeps similar words from receiving the
    # exact same pattern while remaining deterministic.
    rng = random.Random(int(hashlib.sha256(lower.encode("utf-8")).hexdigest()[:16], 16))
    for group in (phonetic, endings, doubled, vowels, transposed, fallback_candidates):
        rng.shuffle(group)
    candidates: list[str] = []
    for group in (phonetic, endings, doubled, vowels, transposed, fallback_candidates):
        if group:
            _add(candidates, group[0], lower)
    for group in (phonetic, endings, doubled, vowels, transposed, fallback_candidates):
        for candidate in group[1:]:
            _add(candidates, candidate, lower)
    return candidates[:3]


def shuffled_options(word: str, wrong_spellings: list[str]) -> list[str]:
    options = [word, *wrong_spellings]
    rng = random.Random(int(hashlib.sha256(f"options:{word}".encode()).hexdigest()[:16], 16))
    rng.shuffle(options)
    return options
