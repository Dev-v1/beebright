"""Extract primary spelling entries from a Words of the Champions PDF.

Usage:
    python scripts/build_word_data.py "/path/to/Words of the Champions.pdf"
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.pdf_parser import parse_pdf  # noqa: E402


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/build_word_data.py <pdf-path>")

    source = Path(sys.argv[1]).expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"PDF not found: {source}")

    levels = parse_pdf(source)
    output = ROOT / "data" / "words.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(
            {
                "source": source.name,
                "note": "Generated from the user-provided 2024 Words of the Champions PDF.",
                "levels": levels,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    counts = {key: len(words) for key, words in levels.items()}
    print(f"Wrote {output}")
    print(f"Counts: {counts}; total={sum(counts.values())}")


if __name__ == "__main__":
    main()

