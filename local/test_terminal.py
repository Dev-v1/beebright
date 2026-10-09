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
            self.assertEqual(result.stdout.strip(), 'BeeBright 1.7')
        with tempfile.TemporaryDirectory() as tmp:
            current = Path(tmp) / 'current'; current.mkdir()
            (current / 'release.json').write_text('{"version":"1.7"}')
            with patch.object(bootstrap, 'CURRENT', current), patch.object(bootstrap, 'update', side_effect=AssertionError('Version must work offline')), patch.object(bootstrap.webbrowser, 'open', side_effect=AssertionError('Version must not open UI')):
                for flag in ('-v', '--v', '--version', '-version'):
                    with patch('sys.stdout', new_callable=io.StringIO) as output:
                        bootstrap.main([flag])
                        self.assertEqual(output.getvalue().strip(), 'BeeBright 1.7')

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


if __name__ == '__main__':
    unittest.main()
