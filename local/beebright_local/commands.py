"""Offline terminal tools. GUI commands use the same bundled practice studio."""
from __future__ import annotations
from datetime import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from . import engine, studio


def set_reminder(value):
    if value != 'off' and not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', value):
        raise ValueError('Use a local time such as 18:30, or off.')
    engine.save_json('reminder.json', {'time': value, 'last': None})
    if value != 'off':
        kwargs = {'stdin': subprocess.DEVNULL, 'stdout': subprocess.DEVNULL, 'stderr': subprocess.DEVNULL}
        if sys.platform == 'win32': kwargs['creationflags'] = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        else: kwargs['start_new_session'] = True
        p = subprocess.Popen([sys.executable, '-m', 'beebright_local', '--reminder-worker'], cwd=Path(__file__).parent.parent, env={**os.environ, 'BEEBRIGHT_DATA_DIR': str(engine.USER_DATA)}, **kwargs)
        engine.save_json('reminder-worker.json', {'pid': p.pid})
    return {'time': value}


def reminder_worker():
    """One notification per local day while this computer is awake and signed in."""
    engine.USER_DATA.mkdir(parents=True, exist_ok=True)
    worker_lock = (engine.USER_DATA / 'reminder.lock').open('a+b')
    try:
        if sys.platform == 'win32':
            import msvcrt
            worker_lock.seek(0); worker_lock.write(b'0'); worker_lock.flush(); worker_lock.seek(0)
            msvcrt.locking(worker_lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(worker_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        worker_lock.close(); return
    while True:
        setting = engine.read_json('reminder.json', {})
        if setting.get('time', 'off') == 'off': break
        now = datetime.now()
        if now.strftime('%H:%M') == setting['time'] and setting.get('last') != now.date().isoformat():
            setting['last'] = now.date().isoformat(); engine.save_json('reminder.json', setting)
            try:
                if sys.platform == 'win32':
                    subprocess.run(['powershell.exe','-NoProfile','-Command',"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Time for your BeeBright spelling practice!', 'BeeBright reminder')"], timeout=120)
                elif sys.platform == 'darwin':
                    subprocess.run(['osascript','-e','display notification "Time for spelling practice!" with title "BeeBright"'], timeout=10)
                else:
                    subprocess.run(['notify-send','BeeBright','Time for spelling practice!'], timeout=10)
            except (OSError, subprocess.SubprocessError): pass
        time.sleep(20)
    worker_lock.close()
    (engine.USER_DATA / 'reminder-worker.json').unlink(missing_ok=True)


def terminal(command, args):
    """Return False when a command belongs in the shared UI."""
    if command == 'doctor':
        checks = studio.diagnostic()
        for c in checks: print(f"{'OK' if c['ok'] else 'CHECK'}  {c['name']}: {c['detail']}")
        return True
    if command == 'changelog':
        print((Path(__file__).parent.parent / 'CHANGELOG.md').read_text(encoding='utf-8')); return True
    if command == 'profile' and args:
        if args == ['list']:
            r = studio.profiles()
        elif len(args) >= 2 and args[0] in ('add','switch'):
            r = studio.change_profile(args[0], ' '.join(args[1:]))
        else: raise ValueError('Use beebright profile [list | add NAME | switch NAME].')
        for p in r['players']: print(f"{'*' if p['id']==r['active'] else ' '} {p['name']}")
        return True
    if command == 'backup':
        if len(args) > 1: raise ValueError('Use beebright backup [FILE.json].')
        file = Path(args[0] if args else f'beebright-backup-{datetime.now():%Y%m%d-%H%M%S}.json').expanduser()
        with file.open('x', encoding='utf-8') as out: json.dump(studio.backup(), out, ensure_ascii=False, indent=2)
        print(f'Backup saved: {file.resolve()}'); return True
    if command == 'restore' and args:
        if len(args) != 1: raise ValueError('Use beebright restore [FILE.json].')
        path = Path(args[0]).expanduser()
        if path.stat().st_size > 67_108_864: raise ValueError('Backup is too large.')
        studio.restore(json.loads(path.read_text(encoding='utf-8')))
        print('Backup restored. Reopen BeeBright to use it.'); return True
    if command == 'remind' and args:
        if len(args) != 1: raise ValueError('Use beebright remind [HH:MM | off].')
        value = set_reminder(args[0]); print(f"Practice reminder: {value['time']}. Reminders run while you are signed in; reopen BeeBright after restarting your computer."); return True
    if command == 'stats':
        events = studio.read('studio.json', {}).get('events', [])
        right = sum(bool(e.get('correct')) for e in events)
        print(f"Answers: {len(events)} | Accuracy: {round(100*right/len(events)) if events else 0}% | Words practiced: {len({e['word'] for e in events})}"); return True
    if command == 'lists':
        events = studio.read('studio.json', {}).get('events', [])
        mastered = {e['word'] for e in events if e.get('correct')}
        lists, _, _ = engine.load_catalog()
        for r in lists:
            print(r['title'])
            for level, words in r['levels'].items():
                print(f"  {level.replace('_',' ').title()}: {len(words)} words | {round(100*len(mastered.intersection(words))/len(words))}% practiced correctly")
        return True
    if args: raise ValueError(f'beebright {command} opens its controls without extra arguments.')
    return False


def launch(command=None, args=None, web=False, port=8765):
    if command and terminal(command, args or []): return
    if not command:
        reminder = engine.read_json('reminder.json', {}).get('time', 'off')
        if reminder != 'off': set_reminder(reminder)
    if web or sys.platform != 'win32':
        from .web import run_web
        run_web(port, command)
    else:
        from .app import run
        run(feature=command)
