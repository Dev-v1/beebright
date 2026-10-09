import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(prog='beebright')
release = json.loads((Path(__file__).parent.parent / 'release.json').read_text(encoding='utf-8'))
parser.add_argument('-v', '--v', '--version', '-version', action='version', version=f"BeeBright {release['version']}")
parser.add_argument('--web', action='store_true', help='Serve the offline UI in your browser')
parser.add_argument('--port', type=int, default=8765)
args = parser.parse_args()
if args.web:
    from .web import run_web
    run_web(args.port)
else:
    from .app import run
    run()
