import argparse

parser = argparse.ArgumentParser(prog='beebright')
parser.add_argument('--web', action='store_true', help='Serve the offline UI in your browser')
parser.add_argument('--port', type=int, default=8765)
args = parser.parse_args()
if args.web:
    from .web import run_web
    run_web(args.port)
else:
    from .app import run
    run()
