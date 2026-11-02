"""Isolated public-page / real-WebSocket browser fixture; no accounts or database."""
import functools
import http.server
import sys
import threading
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'BeeBright-Full-Stack/beebright-spelling-bee/backend'))
import uvicorn
from fastapi import FastAPI
from app.rally_rooms import router
app=FastAPI()
app.include_router(router)
threading.Thread(target=lambda:uvicorn.run(app,host='127.0.0.1',port=8000,log_level='warning'),daemon=True).start()
folder=root/'BeeBright-Full-Stack/beebright-spelling-bee/frontend/dist'
class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] in ('/games','/sign-in','/sign-up','/practice'):
            self.path='/index.html'
        super().do_GET()
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',5173),functools.partial(Handler,directory=str(folder)))
server.serve_forever()
