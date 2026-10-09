import argparse
import json
from pathlib import Path
from .studio import COMMANDS

parser = argparse.ArgumentParser(prog='beebright')
release = json.loads((Path(__file__).parent.parent / 'release.json').read_text(encoding='utf-8'))
parser.add_argument('-v', '--v', '--version', '-version', action='version', version=f"BeeBright {release['version']}")
parser.add_argument('--web', action='store_true', help='Serve the offline UI in your browser')
parser.add_argument('--port', type=int, default=8765)
parser.add_argument('--reminder-worker', action='store_true', help=argparse.SUPPRESS)
parser.add_argument('command', nargs='?', choices=COMMANDS)
parser.add_argument('arguments', nargs='*')
args = parser.parse_args()
try:
    from .commands import launch, reminder_worker
    if args.reminder_worker: reminder_worker()
    else: launch(args.command, args.arguments, args.web, args.port)
except (OSError, ValueError, RuntimeError) as exc:
    parser.exit(1, f'BeeBright: {exc}\n')
