"""Serve the bundled offline UI on loopback, with the same local practice bridge."""
from __future__ import annotations

import hmac
import json
import mimetypes
import secrets
import subprocess
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

from .app import DesktopApi


class LocalServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port=8765, api=None, ui=None):
        self.api = api or DesktopApi()
        self.ui = (Path(ui) if ui else Path(__file__).parent / 'ui').resolve()
        self.token = secrets.token_urlsafe(32)
        super().__init__(('127.0.0.1', port), LocalHandler)
        port = self.server_address[1]
        self.hosts = {f'{host}:{port}' for host in ('beebright.localhost', 'localhost', '127.0.0.1')}


class LocalHandler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _allowed(self):
        host = self.headers.get('Host', '').lower()
        origin = self.headers.get('Origin')
        return (host in self.server.hosts
                and (not origin or origin == f'http://{host}')
                and self.headers.get('Sec-Fetch-Site') != 'cross-site')

    def _send(self, status, data, content_type='application/json; charset=utf-8'):
        if not isinstance(data, bytes):
            data = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if not self._allowed():
            return self._send(403, {'error': 'Use the local BeeBright address.'})
        route = unquote(urlsplit(self.path).path)
        if route == '/__beebright/health':
            return self._send(200, {'app': 'BeeBright local web'})
        if route in ('/', '/local.html'):
            file = self.server.ui / 'local.html'
        else:
            file = (self.server.ui / route.lstrip('/')).resolve()
        if not file.is_relative_to(self.server.ui) or not file.is_file():
            return self._send(404, {'error': 'File not found.'})
        data = file.read_bytes()
        if file.name == 'local.html':
            meta = f'<meta name="beebright-local-web" content="{self.server.token}">'
            data = data.replace(b'</head>', meta.encode() + b'</head>')
        kind = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2'}.get(file.suffix) or mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
        self._send(200, data, kind)

    def do_POST(self):
        if (not self._allowed() or self.path != '/__beebright/bridge'
                or not hmac.compare_digest(self.headers.get('X-BeeBright-Token', ''), self.server.token)):
            return self._send(403, {'error': 'Open BeeBright locally to use practice.'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 1_048_576 or self.headers.get_content_type() != 'application/json':
                raise ValueError('Invalid local request.')
            data = json.loads(self.rfile.read(size))
            if not isinstance(data, dict):
                raise ValueError('Invalid local request.')
            operation = data.get('operation')
            if operation == 'request':
                path, method = data.get('path'), data.get('method', 'GET')
                if not isinstance(path, str) or method not in ('GET', 'PUT', 'DELETE'):
                    raise ValueError('Invalid practice route.')
                result = self.server.api.request(path, method, data.get('payload'))
            elif operation == 'settings':
                result = self.server.api.settings(data.get('value'))
            elif operation == 'speak':
                result = self.server.api.speak(data.get('word'))
            else:
                raise ValueError('Unknown local operation.')
            self._send(400 if isinstance(result, dict) and result.get('error') else 200, result)
        except (ValueError, TypeError, AttributeError, RuntimeError, OSError, subprocess.SubprocessError) as exc:
            self._send(400, {'error': str(exc)})


def run_web(port=8765):
    if not 1 <= port <= 65535:
        raise ValueError('Choose a port from 1 to 65535.')
    for candidate in range(port, min(port + 20, 65536)):
        try:
            server = LocalServer(candidate)
            break
        except OSError:
            continue
    else:
        raise RuntimeError('The local ports are busy. Close other servers and try again.')
    url = f'http://beebright.localhost:{server.server_address[1]}/'
    print(f'BeeBright local web: {url}', flush=True)
    print(f'Alternative: http://127.0.0.1:{server.server_address[1]}/', flush=True)
    print('Keep this terminal open. Press Ctrl+C to stop. Progress stays on this computer.', flush=True)
    try:
        webbrowser.open(url)
        server.serve_forever(poll_interval=.25)
    except KeyboardInterrupt:
        print('\nBeeBright local web stopped.')
    finally:
        server.server_close()
