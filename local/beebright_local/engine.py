from __future__ import annotations

import json
import os
import secrets
from pathlib import Path

from .shared.practice_core import _safe_dictionary_result, shuffled_words
from .shared.distractors import generate_distractors, shuffled_options

DATA = Path(__file__).parent / 'data'
USER_DATA = Path(os.environ.get('BEEBRIGHT_DATA_DIR') or (
    Path(os.environ.get('LOCALAPPDATA', Path.home() / '.local' / 'share')) / 'BeeBright' / 'userdata'
))


def load_catalog():
    lists = json.loads((DATA / 'lists.json').read_text(encoding='utf-8'))
    hints = json.loads((DATA / 'hints.json').read_text(encoding='utf-8'))
    distractors = json.loads((DATA / 'distractors.json').read_text(encoding='utf-8'))
    return lists, hints, distractors


def hint_for(word, hints):
    return _safe_dictionary_result({**hints.get(word, {}), 'word': word}, word)


def new_session(record, level, mode):
    seed = secrets.token_urlsafe(18)
    return {'list_id': record['id'], 'level': level, 'mode': mode,
            'words': shuffled_words(record['levels'][level], seed), 'seed': seed,
            'index': 0, 'correct': 0, 'streak': 0, 'best': 0, 'checked': False}


def check(session, answer):
    if session['checked']:
        return None
    correct = answer.strip().casefold() == session['words'][session['index']].casefold()
    session['checked'] = True
    session['correct'] += int(correct)
    session['streak'] = session['streak'] + 1 if correct else 0
    session['best'] = max(session['best'], session['streak'])
    return correct


def choices_for(word, distractors):
    return shuffled_options(word, distractors.get(word) or generate_distractors(word))


def save_json(name, value):
    USER_DATA.mkdir(parents=True, exist_ok=True)
    path = USER_DATA / name
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    temp.replace(path)


def read_json(name, default=None):
    try:
        return json.loads((USER_DATA / name).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return default
