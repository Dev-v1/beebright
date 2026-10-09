"""Platform-independent terminal flags and verified POSIX updates."""
import importlib.util
import io
import json
import hashlib
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('bee_bootstrap', Path(__file__).parent / 'bootstrap.py')
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)


class TerminalTests(unittest.TestCase):
    def test_all_version_aliases_without_ui(self):
        cwd = Path(__file__).parent
        for flag in ('-v', '--v', '--version', '-version'):
            result = subprocess.run([sys.executable, '-m', 'beebright_local', flag], cwd=cwd, capture_output=True, text=True, check=True)
            self.assertEqual(result.stdout.strip(), 'BeeBright ' + json.loads((cwd / 'release.json').read_text())['version'])
        with tempfile.TemporaryDirectory() as tmp:
            current = Path(tmp) / 'current'; current.mkdir()
            (current / 'release.json').write_text('{"version":"1.8"}')
            with patch.object(bootstrap, 'CURRENT', current), patch.object(bootstrap, 'update', side_effect=AssertionError('Version must work offline')), patch.object(bootstrap.webbrowser, 'open', side_effect=AssertionError('Version must not open UI')):
                for flag in ('-v', '--v', '--version', '-version'):
                    with patch('sys.stdout', new_callable=io.StringIO) as output:
                        bootstrap.main([flag])
                        self.assertEqual(output.getvalue().strip(), 'BeeBright 1.8')

    def test_help_and_uninstall_are_offline_and_scoped(self):
        with patch.object(bootstrap, 'download', side_effect=AssertionError('No network for help')), patch('sys.stdout', new_callable=io.StringIO) as output:
            bootstrap.main(['help'])
            self.assertIn('beebright uninstall', output.getvalue())
            self.assertIn('beebright create web', output.getvalue())
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            root = home / '.local/share/BeeBright'; root.mkdir(parents=True)
            (root / 'runtime-3.15').mkdir(); (root / 'userdata').mkdir()
            command = home / '.local/bin/beebright'; command.parent.mkdir(parents=True); command.write_text('launcher')
            unrelated = home / '.local/bin/other'; unrelated.write_text('keep')
            profile = home / '.zshrc'; profile.write_text('keep this\nexport PATH="$HOME/.local/bin:$PATH" # BeeBright\n')
            with patch.object(bootstrap, 'ROOT', root), patch.object(Path, 'home', return_value=home), patch.object(bootstrap, 'download', side_effect=AssertionError('No network for uninstall')):
                bootstrap.main(['uninstall'])
            self.assertFalse(root.exists()); self.assertFalse(command.exists())
            self.assertEqual(unrelated.read_text(), 'keep')
            self.assertEqual(profile.read_text(), 'keep this\n')

    def test_verified_update_preserves_data_and_rejects_tampering(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); current = root / 'current'
            data = root / 'userdata'; data.mkdir(); (data / 'progress.json').write_text('keep')
            version = 'a' * 40
            stream = io.BytesIO()
            with zipfile.ZipFile(stream, 'w') as z:
                z.writestr('version.json', json.dumps({'version': version}))
                z.writestr('beebright_local/web.py', '# bundled server')
                z.writestr('bootstrap.py', '# new launcher')
            archive = stream.getvalue()
            manifest = {'version': version, 'sha256': hashlib.sha256(archive).hexdigest(), 'url': 'https://beebright.vercel.app/local/beebright-local.zip'}
            def download(url):
                return archive if url.endswith('.zip') else json.dumps(manifest).encode()
            with patch.object(bootstrap, 'ROOT', root), patch.object(bootstrap, 'CURRENT', current), patch.object(bootstrap, 'download', side_effect=download):
                bootstrap.update()
                self.assertEqual((data / 'progress.json').read_text(), 'keep')
                self.assertTrue((current / 'beebright_local/web.py').exists())
                manifest['version'] = 'b' * 40; manifest['sha256'] = '0' * 64
                with self.assertRaisesRegex(RuntimeError, 'checksum'):
                    bootstrap.update()
                self.assertEqual(json.loads((current / 'version.json').read_text())['version'], version)

    def test_same_revision_repairs_incomplete_installation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); current = root / 'current'; current.mkdir()
            version = 'a' * 40
            (current / 'version.json').write_text(json.dumps({'version': version}))
            stream = io.BytesIO()
            with zipfile.ZipFile(stream, 'w') as package:
                package.writestr('version.json', json.dumps({'version': version}))
                package.writestr('beebright_local/web.py', '# server')
                package.writestr('bootstrap.py', '# launcher')
            archive = stream.getvalue()
            manifest = {'version': version, 'sha256': hashlib.sha256(archive).hexdigest(), 'url': 'https://beebright.vercel.app/local/beebright-local.zip'}
            with patch.object(bootstrap, 'ROOT', root), patch.object(bootstrap, 'CURRENT', current), patch.object(bootstrap, 'download', side_effect=lambda url: archive if url.endswith('.zip') else json.dumps(manifest).encode()):
                bootstrap.update()
            self.assertTrue((current / 'beebright_local/web.py').is_file())


if __name__ == '__main__':
    unittest.main()
