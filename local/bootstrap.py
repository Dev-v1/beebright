"""macOS/Linux terminal launcher and verified offline package updater."""
from __future__ import annotations
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import urllib.request
import webbrowser
import zipfile

ROOT = Path(__file__).resolve().parent
CURRENT = ROOT / 'current'
MANIFESTS = ('https://beebright.vercel.app/local/manifest.json',
             'https://raw.githubusercontent.com/Dev-v1/beebright-local/main/update-manifest.json')


def download(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read()


def update():
    manifest = None
    for url in MANIFESTS:
        try:
            manifest = json.loads(download(url))
            break
        except (OSError, ValueError):
            continue
    if not manifest:
        raise RuntimeError('Could not check updates. Connect to the internet and try again.')
    version, digest, url = (manifest.get(k, '') for k in ('version', 'sha256', 'url'))
    if (not re.fullmatch('[a-f0-9]{40}', version) or not re.fullmatch('[a-f0-9]{64}', digest)
        or not (url == 'https://beebright.vercel.app/local/beebright-local.zip'
                or re.fullmatch(r'https://github\.com/Dev-v1/beebright-local/releases/download/desktop-[a-f0-9]{12}/beebright-local-source\.zip', url))):
        raise RuntimeError('Invalid update manifest.')
    if (CURRENT / 'version.json').exists() and json.loads((CURRENT / 'version.json').read_text())['version'] == version:
        print('BeeBright is already up to date.')
        return
    archive = download(url)
    if hashlib.sha256(archive).hexdigest() != digest:
        raise RuntimeError('Update checksum did not match.')
    with tempfile.TemporaryDirectory(prefix='stage-', dir=ROOT) as tmp:
        stage = (Path(tmp) / 'current').resolve()
        stage.mkdir()
        with zipfile.ZipFile(io.BytesIO(archive)) as package:
            for member in package.infolist():
                if not (stage / member.filename).resolve().is_relative_to(stage):
                    raise RuntimeError('Invalid archive path.')
            package.extractall(stage)
        if not (stage / 'beebright_local/web.py').is_file() or json.loads((stage / 'version.json').read_text())['version'] != version:
            raise RuntimeError('Invalid update package.')
        previous = ROOT / 'previous'
        shutil.rmtree(previous, ignore_errors=True)
        if CURRENT.exists():
            CURRENT.rename(previous)
        try:
            stage.rename(CURRENT)
        except OSError:
            if previous.exists():
                previous.rename(CURRENT)
            raise
        launcher = ROOT / 'bootstrap.new.py'
        shutil.copyfile(CURRENT / 'bootstrap.py', launcher)
        launcher.replace(ROOT / 'bootstrap.py')
    print('BeeBright is up to date.')


def main(args=None):
    args = sys.argv[1:] if args is None else args
    if args in (['-v'], ['--v'], ['--version'], ['-version']):
        release = json.loads((CURRENT / 'release.json').read_text())
        print(f"BeeBright {release['version']}")
        return
    if args == ['web']:
        webbrowser.open('https://beebright.vercel.app/')
        return
    if args not in ([], ['update'], ['create', 'web']):
        raise RuntimeError('Usage: beebright [update | web | create web | --version]')
    ROOT.mkdir(parents=True, exist_ok=True)
    # Serialize package swaps without locking the whole practice session.
    import fcntl
    with (ROOT / 'update.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            update()
        except (OSError, ValueError, RuntimeError, zipfile.BadZipFile) as exc:
            if args == ['update'] or not (CURRENT / 'beebright_local/web.py').exists():
                raise
            print(f'Update unavailable; opening installed offline practice. {exc}')
    if args == ['update']:
        return
    os.environ['BEEBRIGHT_DATA_DIR'] = str(ROOT / 'userdata')
    sys.path.insert(0, str(CURRENT))
    from beebright_local.web import run_web
    run_web()


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile) as exc:
        print(f'BeeBright: {exc}', file=sys.stderr)
        sys.exit(1)
