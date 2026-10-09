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
from . import studio

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
        if route == '/api/studio' and method == 'GET':
            return studio.read('studio.json', {})
        if route == '/api/studio' and method == 'PUT':
            if not isinstance(payload, dict): raise ValueError('Invalid studio data.')
            studio.save('studio.json', payload)
            return payload
        if route == '/api/studio/catalog' and method == 'GET':
            return {'lists': self._lists, 'hints': self._hints, 'distractors': self._distractors}
        if route == '/api/studio/profiles' and method == 'GET':
            return studio.profiles()
        if route == '/api/studio/profiles' and method == 'PUT':
            return studio.change_profile(payload['action'], payload['name'])
        if route == '/api/studio/backup' and method == 'GET':
            return studio.backup()
        if route == '/api/studio/restore' and method == 'PUT':
            return studio.restore(payload)
        if route == '/api/studio/voices' and method == 'GET':
            return self.voices()
        if route == '/api/studio/doctor' and method == 'GET':
            return studio.diagnostic()
        if route == '/api/studio/remind':
            from .commands import set_reminder
            if method == 'PUT': return set_reminder(payload.get('time', 'off'))
            return read_json('reminder.json', {})
        if route == '/api/word-lists'  and method == 'GET':
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
                session = studio.read('progress.json')
                # Preserve earlier Tkinter sessions by converting to the shared React shape.
                if session and session.get('words') and isinstance(session['words'][0], str):
                    session = {'mode': session['mode'], 'level': session['level'],
                               'wordListId': session['list_id'], 'setOffset': 0,
                               'shuffleSeed': session.get('seed'),
                               'words': [{'word': w, 'options': choices_for(w, self._distractors)} for w in session['words']],
                               'index': session['index'], 'correct': session['correct'],
                               'streak': session['streak'], 'bestStreak': session['best']}
                    studio.save('progress.json', session)
                return {'session': session}
            if method == 'PUT':
                session = payload.get('session')
                if not isinstance(session, dict) or not isinstance(session.get('words'), list):
                    raise ValueError('Invalid local session.')
                studio.save('progress.json', session)
                return {'session': session}
            if method == 'DELETE':
                studio.save('progress.json', None)
                return None
        raise ValueError('This feature is not available in the offline edition.')

    def settings(self, value=None):
        with self._lock:
            if value is not None:
                theme = value.get('theme')
                if theme not in ('light', 'dark'):
                    raise ValueError('Unknown appearance.')
                studio.save('settings.json', {'theme': theme})
            saved = studio.read('settings.json', {}) or {}
            return {'theme': saved.get('theme', 'dark' if saved.get('dark') else 'light'), 'profileId': studio.profiles()['active']}

    def voices(self):
        if sys.platform == 'win32':
            script = "Add-Type -AssemblyName System.Speech; [Console]::OutputEncoding=[Text.UTF8Encoding]::new(); $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; @($s.GetInstalledVoices() | ForEach-Object { @{name=$_.VoiceInfo.Name; voiceURI=$_.VoiceInfo.Name; lang=$_.VoiceInfo.Culture.Name} }) | ConvertTo-Json -Compress"
            result = subprocess.run(['powershell.exe', '-NoProfile', '-EncodedCommand', base64.b64encode(script.encode('utf-16le')).decode()], capture_output=True, text=True, encoding='utf-8', timeout=20, check=True)
            data = json.loads(result.stdout or '[]')
            return data if isinstance(data, list) else [data]
        if sys.platform == 'darwin':
            import re
            result = subprocess.run(['say', '-v', '?'], capture_output=True, text=True, timeout=20, check=True)
            voices = []
            for line in result.stdout.splitlines():
                match = re.match(r'(.+?)\s+([a-z]{2}_[A-Z]{2})\s+', line)
                if match: voices.append({'name':match[1].strip(), 'voiceURI':match[1].strip(), 'lang':match[2]})
            return voices
        speech = shutil.which('espeak') or shutil.which('espeak-ng')
        if not speech: return []
        result = subprocess.run([speech, '--voices'], capture_output=True, text=True, timeout=20, check=True)
        return [{'name':parts[3], 'voiceURI':parts[1], 'lang':parts[1]} for line in result.stdout.splitlines()[1:] if len(parts := line.split()) >= 5]

    def speak(self, word):
        if not isinstance(word, str) or (word not in self._hints and word not in {'compliment','complement','accept','except','principal','principle','stationary','stationery','desert','dessert','peace','piece','their','there','weather','whether'}):
            raise ValueError('Unknown practice word.')
        audio = (studio.read('studio.json', {}) or {}).get('audio', {})
        rate = min(1.5, max(.3, float(audio.get('rate', .72))))
        voice = str(audio.get('voice', ''))
        volume = min(100, max(0, round(float(audio.get('volume', 1))*100)))
        # Pass words and voice names on stdin, never through command interpolation.
        if sys.platform == 'win32':
            script = "Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; [Console]::InputEncoding=[Text.UTF8Encoding]::new(); $p=[Console]::In.ReadToEnd() | ConvertFrom-Json; $s.Rate=$p.rate; $s.Volume=$p.volume; if($p.voice){$s.SelectVoice($p.voice)}; $s.Speak($p.word)".replace('{speed}', str(round((rate-1)*8)))
            args = ['powershell.exe', '-NoProfile', '-EncodedCommand', base64.b64encode(script.encode('utf-16le')).decode()]
            subprocess.run(args, input=json.dumps({'word':word,'rate':round((rate-1)*8),'volume':volume,'voice':voice}, ensure_ascii=False), text=True, encoding='utf-8', creationflags=subprocess.CREATE_NO_WINDOW, timeout=60, check=True)
        elif sys.platform == 'darwin':
            subprocess.run(['say', '-r', str(round(180*rate)), *(['-v', voice] if voice else []), '--', word], check=True, timeout=60)
        elif shutil.which('espeak') or shutil.which('espeak-ng'):
            subprocess.run([shutil.which('espeak') or shutil.which('espeak-ng'), '-s', str(round(180*rate)), '-a', str(volume*2), *(['-v', voice] if voice else []), '--', word], check=True, timeout=60)
        else:
            raise RuntimeError('Install an offline speech voice such as espeak.')
        return True


def run(smoke_test=None, feature=None):
    if sys.platform == 'win32' and sys.version_info < (3, 15):
        # An older installed launcher is still executing during its first update.
        # Re-enter the updated launcher so it can migrate the runtime before opening the UI.
        launcher = USER_DATA.parent / 'bootstrap.ps1'
        if launcher.exists():
            subprocess.Popen(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(launcher)])
            return
        raise RuntimeError('BeeBright needs Python 3.15. Run the install command again.')
    import webview
    webview.settings['ALLOW_DOWNLOADS'] = True
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
                                      f'http://127.0.0.1:{server.server_address[1]}/' + (f'?feature={feature}' if feature else ''),
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
