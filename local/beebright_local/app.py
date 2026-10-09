"""The website React UI rendered locally in a native desktop WebView."""
from __future__ import annotations

import base64
import json
import secrets
import shutil
import subprocess
import sys
import threading
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from .engine import load_catalog, hint_for, choices_for, read_json, save_json, USER_DATA
from .shared.practice_core import shuffled_words

LABELS = {'one_bee': 'One Bee', 'two_bee': 'Two Bee', 'three_bee': 'Three Bee'}


class DesktopApi:
    def __init__(self):
        self._lists, self._hints, self._distractors = load_catalog()
        self._lock = threading.RLock()

    def request(self, path, method='GET', payload=None):
        """Only allow the offline practice routes; no cloud/admin/account routes."""
        try:
            with self._lock:
                return self._request(path, method, payload)
        except (ValueError, KeyError, TypeError) as exc:
            return {'error': str(exc)}

    def _request(self, path, method, payload):
        parsed = urlsplit(path)
        if parsed.scheme or parsed.netloc:
            raise ValueError('Only local practice is supported.')
        route = unquote(parsed.path)
        if route == '/api/word-lists' and method == 'GET':
            return [{'id': r['id'], 'title': r['title'], 'built_in': True, 'published': True,
                     'randomized': bool(r.get('randomized')), 'word_count': sum(map(len, r['levels'].values())),
                     'levels': [{'key': key, 'label': LABELS[key], 'count': len(words),
                                 'description': r.get('level_descriptions', {}).get(key, '')}
                                for key, words in r['levels'].items()]} for r in self._lists]
        if route.startswith('/api/dictionary/') and method == 'GET':
            word = route.removeprefix('/api/dictionary/')
            if word not in self._hints:
                raise ValueError('This word is not in the bundled dictionary.')
            return hint_for(word, self._hints)
        if route == '/api/practice' and method == 'GET':
            q = parse_qs(parsed.query)
            record = next((r for r in self._lists if r['id'] == q.get('word_list_id', ['study-2027'])[0]), None)
            if record is None:
                raise ValueError('Unknown local word list.')
            level = q.get('level', ['one_bee'])[0]
            source = record['levels'][level]
            offset = max(0, int(q.get('offset', ['0'])[0]))
            limit = max(1, min(100, int(q.get('limit', ['100'])[0])))
            if offset >= len(source):
                offset = 0
                q.pop('shuffle_seed', None)
            seed = None
            if record.get('randomized'):
                seed = q.get('shuffle_seed', [secrets.token_urlsafe(18)])[0]
                source = shuffled_words(source, seed)
            selected = source[offset:offset + limit]
            return {'word_list_id': record['id'], 'level': level, 'label': LABELS[level],
                    'offset': offset, 'limit': limit, 'total': len(source),
                    'shuffle_seed': seed, 'has_more': offset + len(selected) < len(source),
                    'words': [{'word': word, 'level': level, 'source': record['title'],
                               'options': choices_for(word, self._distractors)} for word in selected]}
        if route == '/api/progress':
            if method == 'GET':
                session = read_json('progress.json')
                # Preserve earlier Tkinter sessions by converting to the shared React shape.
                if session and session.get('words') and isinstance(session['words'][0], str):
                    session = {'mode': session['mode'], 'level': session['level'],
                               'wordListId': session['list_id'], 'setOffset': 0,
                               'shuffleSeed': session.get('seed'),
                               'words': [{'word': w, 'options': choices_for(w, self._distractors)} for w in session['words']],
                               'index': session['index'], 'correct': session['correct'],
                               'streak': session['streak'], 'bestStreak': session['best']}
                    save_json('progress.json', session)
                return {'session': session}
            if method == 'PUT':
                session = payload.get('session')
                if not isinstance(session, dict) or not isinstance(session.get('words'), list):
                    raise ValueError('Invalid local session.')
                save_json('progress.json', session)
                return {'session': session}
            if method == 'DELETE':
                save_json('progress.json', None)
                return None
        raise ValueError('This feature is not available in the offline edition.')

    def settings(self, value=None):
        with self._lock:
            if value is not None:
                theme = value.get('theme')
                if theme not in ('light', 'dark'):
                    raise ValueError('Unknown appearance.')
                save_json('settings.json', {'theme': theme})
            saved = read_json('settings.json', {})
            return {'theme': saved.get('theme', 'dark' if saved.get('dark') else 'light')}

    def speak(self, word):
        if not isinstance(word, str) or word not in self._hints:
            raise ValueError('Unknown practice word.')
        # Pass words on stdin, never through command interpolation.
        if sys.platform == 'win32':
            script = "Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate=-2; $s.Speak([Console]::In.ReadToEnd())"
            args = ['powershell.exe', '-NoProfile', '-EncodedCommand', base64.b64encode(script.encode('utf-16le')).decode()]
            subprocess.run(args, input=word, text=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=60, check=True)
        elif sys.platform == 'darwin':
            subprocess.run(['say', '--', word], check=True, timeout=60)
        elif shutil.which('espeak') or shutil.which('espeak-ng'):
            subprocess.run([shutil.which('espeak') or shutil.which('espeak-ng'), '-s', '130', '--', word], check=True, timeout=60)
        else:
            raise RuntimeError('Install an offline speech voice such as espeak.')
        return True


def run(smoke_test=None):
    if sys.platform == 'win32' and sys.version_info < (3, 15):
        # An older installed launcher is still executing during its first update.
        # Re-enter the updated launcher so it can migrate the runtime before opening the UI.
        launcher = USER_DATA.parent / 'bootstrap.ps1'
        if launcher.exists():
            subprocess.Popen(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(launcher)])
            return
        raise RuntimeError('BeeBright needs Python 3.15. Run the install command again.')
    import webview
    ui = Path(__file__).parent / 'ui' / 'local.html'
    if not ui.exists():
        raise RuntimeError('The bundled website UI is missing. Reinstall BeeBright.')
    # Avoid asynchronous native JavaScript API injection during first launch.
    from .web import LocalServer
    server = LocalServer(0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        window = webview.create_window('BeeBright • Local Spelling Practice',
                                      f'http://127.0.0.1:{server.server_address[1]}/',
                                      width=1280, height=850, min_size=(740, 650),
                                      background_color='#fbf8ef', text_select=True)
        USER_DATA.mkdir(parents=True, exist_ok=True)
        webview.start(smoke_test, window if smoke_test else None,
                      gui='edgechromium' if sys.platform == 'win32' else None,
                      private_mode=False, storage_path=str(USER_DATA / 'webview'))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
