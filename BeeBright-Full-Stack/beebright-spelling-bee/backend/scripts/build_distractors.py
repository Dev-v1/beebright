from __future__ import annotations

import json
from pathlib import Path

from app.services.distractors import generate_distractors


BASE_DIR = Path(__file__).resolve().parents[1]
WORDS_FILE = BASE_DIR / "data" / "words.json"
OUTPUT_FILE = BASE_DIR / "data" / "distractors.json"


def main() -> None:
    levels = json.loads(WORDS_FILE.read_text(encoding="utf-8"))["levels"]
    output = {
        word: generate_distractors(word)
        for words in levels.values()
        for word in words
    }
    invalid = [word for word, choices in output.items() if len(choices) != 3 or len(set(choices)) != 3]
    if invalid:
        raise RuntimeError(f"Could not create three unique distractors for: {invalid[:10]}")
    OUTPUT_FILE.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Created three distractors for {len(output):,} words in {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
