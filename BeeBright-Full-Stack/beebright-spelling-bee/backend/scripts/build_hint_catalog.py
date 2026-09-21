"""Build attributed hints from a local Kaikki/Wiktionary extract.

Usage: python scripts/build_hint_catalog.py
The source extract is intentionally excluded from git. The checked-in catalog,
reviewed overrides, and coverage report are the deployable outputs.
"""
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
BAD = {'obsolete', 'archaic', 'vulgar', 'offensive', 'derogatory', 'slang'}
POS = {'noun':'noun', 'verb':'verb', 'adj':'adjective', 'adv':'adverb', 'name':'proper noun', 'intj':'interjection', 'prep':'preposition'}


def exact(text, word):
    return re.search(r'(?<!\w)' + re.escape(word) + r'(?!\w)', text, re.I)


def example(sense, word, budgets):
    for ex in sorted(sense.get('examples', []), key=lambda x: x.get('type') != 'example'):
        text = ex.get('text', '')
        for sentence in re.split(r'(?<=[.!?])\s+(?=[A-Z])', text):
            if not 5 <= len(sentence.split()) <= 25 or len(sentence) > 300:
                continue
            if not re.match(r'[A-Z“\"]', sentence) or not re.search(r'[.!?][”\"]?$', sentence):
                continue
            if any(c in sentence for c in ('\n', '[', '…', '...')) or not exact(sentence, word):
                continue
            if re.search(r'\b(fuck|sexual|nigger|shit|bitch|whore|naked|rape|porn|penis)\b', sentence, re.I):
                continue
            ref = ex.get('ref', '')
            if ex.get('type') != 'example' and (not ref or budgets[ref] + len(sentence.split()) > 25):
                continue
            return sentence, ref or 'Wiktionary contributors'
    return '', ''


def build():
    extract = json.loads((DATA / 'dictionary_extract.json').read_text())
    words = [w for level in json.loads((DATA / 'words.json').read_text())['levels'].values() for w in level]
    overrides = json.loads((DATA / 'reviewed_hints.json').read_text())
    catalog = {}
    budgets = Counter()
    gaps = {'definition': [], 'origin': [], 'sentence': []}
    for word in words:
        entries = extract.get(word.casefold(), [])
        literal = [e for e in entries if e.get('word') == word]
        entries = literal or entries
        if word[0].islower():
            entries = [e for e in entries if e.get('pos') != 'name']
        candidates = []
        for ei, entry in enumerate(entries):
            for si, sense in enumerate(entry.get('senses', [])):
                if BAD.intersection(sense.get('tags', [])) or sense.get('alt_of') or sense.get('form_of'):
                    continue
                gloss = (sense.get('glosses') or [''])[-1]
                if not 8 <= len(gloss) <= 600 or exact(gloss, word) or gloss.startswith(('Synonym of ', 'Alternative ', 'Obsolete ')):
                    continue
                sentence, reference = example(sense, word, budgets)
                score = (0 if sentence else 20) + ei * .4 + si * .2
                candidates.append((score, entry, gloss, sentence, reference))
        if candidates:
            _, entry, definition, sentence, reference = min(candidates, key=lambda x: x[0])
            origin = entry.get('etymology_text', '')
            # Only share histories within the SAME numbered etymology, never
            # across unrelated homographs such as bow (ship) and bow (weapon).
            if not origin:
                origin = next((e['etymology_text'] for e in entries if e.get('etymology_number') == entry.get('etymology_number') and e.get('etymology_text')), '')
            record = {'definition': definition, 'origin': origin, 'sentence': sentence,
                      'part_of_speech': POS.get(entry.get('pos'), entry.get('pos', '')),
                      'source': 'Wiktionary via Kaikki', 'source_url': 'https://en.wiktionary.org/wiki/' + quote(entry['word'], safe=''),
                      'license': 'CC BY-SA 4.0', 'sentence_reference': reference}
            if reference and reference != 'Wiktionary contributors':
                budgets[reference] += len(sentence.split())
        else:
            record = {'definition': '', 'origin': '', 'sentence': '', 'part_of_speech': '', 'source': 'BeeBright'}
        record.update(overrides.get(word, {}))
        for field in gaps:
            if not record.get(field):
                gaps[field].append(word)
        # Keep missing fields explicit. Never replace them with fabricated content.
        if record['definition']:
            record['origin'] = record.get('origin') or 'A documented origin is not yet available for this word.'
            catalog[word] = record
    report = {'total_words': len(words), 'definitions': len(words)-len(gaps['definition']),
              'origins': len(words)-len(gaps['origin']), 'sentences': len(words)-len(gaps['sentence']),
              'missing': gaps, 'note': 'Coverage counts are not a claim of individual editorial verification. Missing fields need research.'}
    (DATA / 'word_hints.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    (DATA / 'hint_coverage.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print({k:v for k,v in report.items() if k != 'missing'})

if __name__ == '__main__':
    build()
