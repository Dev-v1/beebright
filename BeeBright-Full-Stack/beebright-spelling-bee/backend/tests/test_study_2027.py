import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.merriam_webster import lookup_word

DATA = Path(__file__).resolve().parents[1] / 'data'
LIST = json.loads((DATA / 'word_lists/study-2027.json').read_text())
WORDS = [word for words in LIST['levels'].values() for word in words]
TWO_WORDS = LIST['levels']['two_bee']
client = TestClient(app)


def practice(**kwargs):
    response = client.get('/api/practice', params={
        'word_list_id': 'study-2027', 'level': 'two_bee', **kwargs,
    })
    assert response.status_code == 200
    return response.json()


def test_published_list_has_three_levels_and_grade_descriptions():
    study = next(item for item in client.get('/api/word-lists').json() if item['id'] == 'study-2027')
    assert study['title'] == '2027 study list'
    assert study['built_in'] and study['published'] and study['randomized']
    assert study['word_count'] == len(WORDS) == len(set(WORDS)) == 450
    assert {item['key']: (item['count'], item['description']) for item in study['levels']} == {
        key: (150, LIST['level_descriptions'][key]) for key in LIST['levels']}
    for level in LIST['levels']:
        assert len(practice(level=level)['words']) == 100


def test_shuffled_pagination_covers_all_words_once_and_can_resume():
    first = practice()
    seed = first['shuffle_seed']
    first_words = [item['word'] for item in first['words']]
    assert seed and len(first_words) == 100 and first['has_more']
    resumed = practice(shuffle_seed=seed)
    assert [item['word'] for item in resumed['words']] == first_words
    second = practice(offset=100, shuffle_seed=seed)
    second_words = [item['word'] for item in second['words']]
    assert len(second_words) == 50 and not second['has_more']
    assert second['offset'] == 100 and second['shuffle_seed'] == seed
    assert set(first_words).isdisjoint(second_words)
    assert set(first_words + second_words) == set(TWO_WORDS)
    assert first_words + second_words != TWO_WORDS
    next_cycle = practice(offset=150, shuffle_seed=seed)
    assert next_cycle['offset'] == 0
    assert next_cycle['shuffle_seed'] != seed
    assert practice()['shuffle_seed'] != seed
    for item in first['words'] + second['words']:
        assert len(set(item['options'])) == 4
        assert item['options'].count(item['word']) == 1


@pytest.mark.parametrize('word', WORDS)
def test_every_study_word_has_complete_offline_hints_without_answer_leaks(word, monkeypatch):
    def no_network(*args, **kwargs):
        pytest.fail('Study list hints must not depend on a dictionary network call')
    monkeypatch.setattr('app.services.merriam_webster.httpx.Client', no_network)
    lookup_word.cache_clear()
    response = client.get('/api/dictionary/' + word)
    assert response.status_code == 200
    result = response.json()
    assert result['word'] == word and result['found']
    assert result['part_of_speech']
    assert result['source_url'].startswith('https://')
    assert result['sentence_reference'] == 'BeeBright original sentence'
    for field in ['definition', 'origin', 'sentence']:
        assert len(result[field]) >= 8
        assert not re.search(r'(?<!\w)' + re.escape(word) + r'(?!\w)', result[field], re.I)
        assert 'unavailable' not in result[field].lower()
        assert 'this word' not in result[field].lower()
    assert result['sentence'].count('___') == 1
    assert result['sentence'].endswith('.')
    assert result['definition'] != result['sentence']


def test_catalog_contains_exactly_the_requested_words_and_unique_examples():
    catalog = json.loads((DATA / 'study_2027_hints.json').read_text())
    assert set(catalog) == set(WORDS)
    assert {'Aeolus', 'Japanese', 'piñata', 'Oregon', 'Senegal', 'Caesar', 'Polaroid'} <= set(catalog)
    assert len({entry['sentence'] for entry in catalog.values()}) == 450
