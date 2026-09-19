import json
import re
from pathlib import Path

from app.models import DictionaryResult
from app.services.merriam_webster import _local_hints, _safe_dictionary_result, lookup_word


def test_every_catalog_example_has_an_exact_answer_and_survives_masking():
    for word, record in _local_hints().items():
        if not record.get('sentence'):
            continue
        masked = _safe_dictionary_result(record, word)['sentence']
        assert '___' in masked, word
        assert not re.search(r'(?<!\w)' + re.escape(word) + r'(?!\w)', masked, re.I), word
        assert record.get('sentence_reference'), word


def test_bronze_and_sky_have_concrete_contextual_examples():
    bronze = DictionaryResult(**lookup_word('bronze'))
    assert bronze.part_of_speech == 'noun'
    assert 'copper and tin' in bronze.definition
    assert bronze.sentence == 'The sculptor cast the statue in ___.'
    assert 'Italian bronzo' in bronze.origin
    assert lookup_word('sky')['sentence'] == 'The ___ was clear today.'


def test_coverage_accounts_for_every_builtin_word():
    data = Path(__file__).resolve().parents[1] / 'data'
    words = {w for level in json.loads((data / 'words.json').read_text())['levels'].values() for w in level}
    report = json.loads((data / 'hint_coverage.json').read_text())
    hints = _local_hints()
    assert report['total_words'] == len(words) == 3997
    for field, count in [('definition', 'definitions'), ('origin', 'origins'), ('sentence', 'sentences')]:
        missing = set(report['missing'][field])
        assert missing <= words
        assert report[count] + len(missing) == len(words)
        for word in words - missing:
            assert hints[word][field], (word, field)
