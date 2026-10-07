# 2027 study list

The list contains the user's 150 supplied spellings, including capitalization and accents. It has one level, Two Bee, labeled `4-6th grade words`. The title identifies this user-requested collection; it does not assert endorsement by a spelling-bee organization.

`study_2027_hints.json` supplies a concrete definition, part of speech, etymology summary, and individually written contextual sentence for every entry. Definitions and origins are paraphrased for learners from the entry-level dictionary links in `source_url`. Wiktionary-derived entries are attributed and marked CC BY-SA 4.0. Examples are original BeeBright sentences, not dictionary quotations. They deliberately match the displayed sense and grammatical form.

An uncertain historical origin is identified as uncertain (for example awning, arnica, burlap, cuddle, and Oregon). No speculative origin is presented as established fact. Inflected entries retain their requested form and have matching sentence grammar.

The API replaces the exact answer with three underscores before returning a sentence. All 150 entries work without a dictionary API key or network access. Other lists retain their existing dictionary fallback behavior.

Each new practice run shuffles the complete list. A saved shuffle seed makes pagination and resumed practice consistent: the first 100 words and remaining 50 together cover the list exactly once. Starting another run or completing the cycle generates a new seed.

Validation: `tests/test_study_2027.py` checks metadata, unavailable levels, complete coverage, pagination without repeats, resume order, fresh shuffle seeds, four unique answer choices, all 150 dictionary endpoints without network access, and absence of the target spelling in every displayed hint.
