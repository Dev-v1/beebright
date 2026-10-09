"""Local profiles, portable backups, diagnostics and reminder settings."""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import secrets
from datetime import datetime
from . import engine

COMMANDS = ('daily', 'review', 'compete', 'doctor', 'stats', 'profile', 'backup', 'restore',
            'sprint', 'lists', 'practice', 'audio', 'origins', 'pairs', 'favorites',
            'worksheet', 'remind', 'achievements', 'duel', 'changelog')


def profiles():
    value = engine.read_json('profiles.json', {'active': 'default', 'players': [{'id': 'default', 'name': 'Me'}]})
    if not isinstance(value, dict) or not isinstance(value.get('players'), list) or not value['players']:
        raise ValueError('Player registry is damaged. Restore a backup.')
    if any(not isinstance(p, dict) or not re.fullmatch(r'(default|[a-f0-9]{16})', str(p.get('id', ''))) or not isinstance(p.get('name'), str) for p in value['players']):
        raise ValueError('Player registry is damaged. Restore a backup.')
    ids = {p['id'] for p in value['players']}
    if value.get('active') not in ids or not re.fullmatch(r'(default|[a-f0-9]{16})', str(value.get('active', ''))):
        raise ValueError('Player registry is damaged. Restore a backup.')
    return value


def profile_path(name):
    active = profiles()['active']
    return name if active == 'default' else f'players/{active}/{name}'


def read(name, default=None):
    return engine.read_json(profile_path(name), default)


def save(name, value):
    engine.save_json(profile_path(name), value)


def change_profile(action, name):
    registry = profiles()
    if action == 'add':
        name = name.strip()
        if not 1 <= len(name) <= 40:
            raise ValueError('Choose a name of 1 to 40 characters.')
        if any(p['name'].casefold() == name.casefold() for p in registry['players']):
            raise ValueError('That player already exists.')
        if len(registry['players']) >= 50:
            raise ValueError('Up to 50 local players are supported.')
        player = {'id': secrets.token_hex(8), 'name': name}
        registry['players'].append(player)
        registry['active'] = player['id']
    elif action == 'switch':
        player = next((p for p in registry['players'] if p['id'] == name or p['name'].casefold() == name.casefold()), None)
        if not player:
            raise ValueError('Player not found. Run beebright profile list.')
        registry['active'] = player['id']
    else:
        raise ValueError('Use profile add NAME or profile switch NAME.')
    engine.save_json('profiles.json', registry)
    return registry


def backup():
    registry = profiles()
    return {'app': 'BeeBright backup', 'format': 1, 'created': datetime.now().isoformat(),
            'profiles': registry, 'data': {
                player['id']: {name: engine.read_json(name if player['id'] == 'default' else f"players/{player['id']}/{name}")
                               for name in ('progress.json', 'settings.json', 'studio.json')}
                for player in registry['players']}}


def restore(value):
    # Validate the entire backup before any writes. Never accept arbitrary paths.
    if not isinstance(value, dict) or value.get('app') != 'BeeBright backup' or value.get('format') != 1:
        raise ValueError('Choose a BeeBright backup JSON file.')
    registry, data = value.get('profiles'), value.get('data')
    if not isinstance(registry, dict) or not isinstance(data, dict):
        raise ValueError('Invalid backup.')
    players = registry.get('players')
    if not isinstance(players, list) or not 1 <= len(players) <= 50:
        raise ValueError('Invalid player list.')
    ids = set()
    for player in players:
        if not isinstance(player, dict) or not re.fullmatch(r'(default|[a-f0-9]{16})', str(player.get('id', ''))) or not isinstance(player.get('name'), str) or not 1 <= len(player['name']) <= 40:
            raise ValueError('Invalid player.')
        if player['id'] in ids:
            raise ValueError('Duplicate player ID.')
        ids.add(player['id'])
        saved = data.get(player['id'])
        if not isinstance(saved, dict) or any(saved.get(name) is not None and not isinstance(saved[name], dict) for name in ('progress.json','settings.json','studio.json')):
            raise ValueError('Invalid player data.')
        session = saved.get('progress.json')
        if session is not None and (not isinstance(session.get('words'), list) or not session['words'] or not isinstance(session.get('index', 0), int) or not 0 <= session.get('index', 0) < len(session['words'])):
            raise ValueError('Invalid saved practice session.')
    if registry.get('active') not in ids:
        raise ValueError('Invalid active player.')
    for player in players:
        for name in ('progress.json','settings.json','studio.json'):
            engine.save_json(name if player['id'] == 'default' else f"players/{player['id']}/{name}", data[player['id']].get(name))
    engine.save_json('profiles.json', registry)
    return registry


def diagnostic():
    import sys, shutil
    package = Path(__file__).parent
    checks = []
    checks.append({'name': 'Python runtime', 'ok': sys.version_info[:2] == (3,15), 'detail': sys.version.split()[0]})
    for name, path in [('Practice UI', package / 'ui/local.html'), ('Word lists', engine.DATA / 'lists.json'), ('Dictionary', engine.DATA / 'hints.json')]:
        try:
            if path.suffix == '.json': json.loads(path.read_text(encoding='utf-8'))
            elif not path.is_file(): raise OSError('File missing')
            checks.append({'name': name, 'ok': True, 'detail': 'Ready'})
        except (OSError, ValueError) as exc:
            checks.append({'name': name, 'ok': False, 'detail': str(exc) + '. Run beebright update.'})
    try:
        engine.save_json('.doctor.json', {'check': True})
        (engine.USER_DATA / '.doctor.json').unlink()
        checks.append({'name': 'Saved data', 'ok': True, 'detail': str(engine.USER_DATA)})
    except OSError as exc:
        checks.append({'name': 'Saved data', 'ok': False, 'detail': str(exc)})
    voice = sys.platform in ('win32','darwin') or bool(shutil.which('espeak') or shutil.which('espeak-ng'))
    checks.append({'name':'Offline speech command', 'ok':voice, 'detail':'Available; run beebright audio to test a voice.' if voice else 'Install espeak-ng for offline pronunciation.'})
    return checks
