# Dictionary hint data

`word_hints.json` contains selected English Wiktionary entries from the Kaikki
English extract downloaded on September 19, 2026. The extract describes the
September 2, 2026 Wiktionary dump. Each record links to its source entry.

- Source: https://kaikki.org/dictionary/English/
- Wiktionary: https://en.wiktionary.org/
- Contributor attribution: use the linked entry's **View history** tab.
- Text license: Creative Commons Attribution-ShareAlike 4.0 International,
  https://creativecommons.org/licenses/by-sa/4.0/

BeeBright selects a definition and example from the same dictionary sense,
selects its corresponding etymology, and masks the answer for spelling practice.
Some entries have paraphrased definitions, summarized origins, or original
examples in `reviewed_hints.json`. Their source and example attribution are
recorded separately. Quoted examples retain their original reference; they
are not claimed to be original BeeBright writing. Adapted Wiktionary text
continues under CC BY-SA 4.0. This data license does not relicense app code.

The small number of Merriam-Webster-based reviewed entries contain paraphrases
and original BeeBright sentences, with links to the consulted dictionary pages.
Online fallback results come from the site's configured Merriam-Webster API.

`hint_coverage.json` lists missing fields for the 3,997 built-in words. Coverage
does not establish that every selection has been editorially checked. The
catalog is incomplete. Unknown histories must not be invented; genuine unknown
origins should be distinguished from entries that still require research.

Rebuild with `python scripts/build_hint_catalog.py` from the backend directory.
This requires an untracked `data/dictionary_extract.json` containing source
entries grouped by case-folded word. The deployed application only needs the
generated catalog. The source extract is not a runtime dependency.
