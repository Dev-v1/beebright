"""Exercise first-run native startup without a JavaScript API injection."""
import json
import tempfile
import unittest
import urllib.request
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

from beebright_local import app, engine


class NativeStartupTest(unittest.TestCase):
    def test_first_run_serves_bridge_and_closes_server(self):
        with tempfile.TemporaryDirectory() as tmp:
            data = Path(tmp) / 'userdata'
            observed = {}
            def create_window(title, url, **options):
                self.assertNotIn('js_api', options)
                observed['url'] = url
                return object()
            def start(*args, **kwargs):
                self.assertFalse((data / 'settings.json').exists())
                page = urllib.request.urlopen(observed['url']).read().decode()
                token = page.split('name="beebright-local-web" content="')[1].split('"')[0]
                req = urllib.request.Request(observed['url'] + '__beebright/bridge',
                    data=json.dumps({'operation': 'settings', 'value': None}).encode(),
                    headers={'Content-Type': 'application/json', 'X-BeeBright-Token': token})
                self.assertEqual(json.load(urllib.request.urlopen(req)), {'theme': 'light'})
            fake = SimpleNamespace(create_window=create_window, start=start)
            with patch.object(app.sys, 'version_info', (3, 14)), patch.dict('sys.modules', {'webview': fake}), patch.object(app, 'USER_DATA', data), patch.object(engine, 'USER_DATA', data):
                app.run()
            with self.assertRaises(OSError):
                urllib.request.urlopen(observed['url'], timeout=1)


if __name__ == '__main__':
    unittest.main()
