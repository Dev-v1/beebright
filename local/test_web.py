import http.client
import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

from beebright_local.web import LocalServer


class LocalWebTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.data = patch('beebright_local.engine.USER_DATA', Path(self.temp.name))
        self.data.start()
        self.server = LocalServer(0)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.data.stop()
        self.temp.cleanup()

    def send(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        defaults = {'Host': f'beebright.localhost:{self.port}',
                    'Content-Type': 'application/json', 'X-BeeBright-Token': self.server.token}
        defaults.update(headers or {})
        conn.request(method, path, json.dumps(body) if body is not None else None, defaults)
        response = conn.getresponse()
        result = response.status, response.read(), dict(response.getheaders())
        conn.close()
        return result

    def call(self, operation, **payload):
        status, raw, _ = self.send('POST', '/__beebright/bridge', {'operation': operation, **payload})
        return status, json.loads(raw)

    def test_browser_ui_and_local_progress(self):
        status, html, headers = self.send('GET', '/')
        self.assertEqual(status, 200)
        self.assertIn(self.server.token.encode(), html)
        self.assertIn(b'beebright-local-web', html)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertEqual(self.server.server_address[0], '127.0.0.1')
        status, lists = self.call('request', path='/api/word-lists')
        self.assertEqual(status, 200)
        self.assertTrue(any(row['id'] == 'study-2027' for row in lists))
        status, practice = self.call('request', path='/api/practice?level=one_bee&word_list_id=study-2027')
        self.assertEqual(status, 200)
        self.assertEqual(len(practice['words']), 100)
        word = practice['words'][0]['word']
        status, hint = self.call('request', path='/api/dictionary/' + word)
        self.assertEqual(status, 200)
        self.assertIn('___', hint['sentence'])
        session = {'words': practice['words'], 'index': 3}
        self.assertEqual(self.call('request', path='/api/progress', method='PUT', payload={'session': session})[0], 200)
        self.assertEqual(self.call('request', path='/api/progress')[1]['session'], session)
        self.assertEqual(self.call('settings', value={'theme': 'dark'})[1]['theme'], 'dark')
        self.assertEqual(json.loads((Path(self.temp.name) / 'settings.json').read_text())['theme'], 'dark')

    def test_reject_cross_site_and_private_files(self):
        body = {'operation': 'settings', 'value': {'theme': 'dark'}}
        for headers in ({'Origin': 'https://example.com'}, {'Host': 'example.com'},
                        {'X-BeeBright-Token': ''}, {'Sec-Fetch-Site': 'cross-site'}):
            self.assertEqual(self.send('POST', '/__beebright/bridge', body, headers)[0], 403)
        self.assertEqual(self.send('GET', '/../app.py')[0], 404)
        self.assertEqual(self.call('request', path='/api/admin/lists')[0], 400)
        self.assertEqual(self.call('request', path='https://example.com')[0], 400)
        self.assertEqual(self.call('__getattribute__', name='token')[0], 400)
