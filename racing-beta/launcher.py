"""Frozen standalone racing beta. Serves only bundled assets on loopback."""
from __future__ import annotations
import argparse, functools, http.server, json, os, sys, threading, time
from pathlib import Path

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
    root=Path(getattr(sys,'_MEIPASS',Path(__file__).parent))/'dist'
    if not (root/'index.html').is_file():raise RuntimeError('Bundled racing interface is missing.')
    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_GET(self):
            if self.path.split('?')[0].endswith('.py'):self.send_error(404);return
            super().do_GET()
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
    server.daemon_threads=True;threading.Thread(target=server.serve_forever,daemon=True).start()
    import webview
    url=f'http://127.0.0.1:{server.server_port}/index.html'
    window=webview.create_window('Beta Car Racing Game · 0.1.0',url,width=1280,height=900,min_size=(850,650))
    failure=[]
    def test():
        try:
            end=time.monotonic()+40
            while time.monotonic()<end:
                try:
                    if window.evaluate_js("document.querySelector('#track').options.length===4"):break
                except Exception:pass
                time.sleep(.2)
            else:raise AssertionError('Standalone interface did not load')
            for quality in ['high','light']:
                window.evaluate_js(f"document.querySelector('#quality').value='{quality}';document.querySelector('#start').click()")
                end=time.monotonic()+60
                while time.monotonic()<end:
                    if window.evaluate_js("document.querySelector('#status').innerText.includes('Place')"):break
                    if window.evaluate_js("document.querySelector('#graphics').innerText.includes('Unable')"):raise AssertionError(window.evaluate_js("document.querySelector('#graphics').innerText"))
                    time.sleep(.2)
                else:raise AssertionError('Racing engine failed to start')
                window.evaluate_js("window.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));")
                time.sleep(1)
                window.evaluate_js("window.dispatchEvent(new KeyboardEvent('keyup',{key:'w',bubbles:true}));document.querySelector('#camera').click();")
                time.sleep(.4)
                assert window.evaluate_js("document.querySelector('#status').innerText.includes('Cockpit')")
                assert not window.evaluate_js("document.querySelector('#status').innerText.includes('NaN')")
                assert window.evaluate_js("document.querySelector('#result').hidden"),window.evaluate_js("document.querySelector('#result').innerText")
                # Capture in the render frame. WebGL normally clears its back buffer
                # after presentation, so an arbitrary later toDataURL is black.
                window.evaluate_js("window.racingCapture=null;requestAnimationFrame(()=>{const source=document.querySelector('canvas'),copy=document.createElement('canvas');copy.width=800;copy.height=500;const c=copy.getContext('2d');c.drawImage(source,0,0);const pixels=c.getImageData(0,0,800,500).data,colors=new Set();let bright=0;for(let i=0;i<pixels.length;i+=400){colors.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);if(pixels[i]+pixels[i+1]+pixels[i+2]>90)bright++;}window.racingCapture={url:copy.toDataURL('image/png'),colors:colors.size,bright};})")
                end=time.monotonic()+15
                while time.monotonic()<end and not window.evaluate_js('window.racingCapture!==null'):time.sleep(.1)
                capture=window.evaluate_js('window.racingCapture')
                assert capture and capture['colors']>100 and capture['bright']>100, f'Blank rendered racing frame: {capture and (capture["colors"],capture["bright"])}'
                folder=os.environ.get('RACING_TEST_OUTPUT')
                if folder:
                    import base64
                    Path(folder).mkdir(parents=True,exist_ok=True)
                    data=capture['url'].split(',')[1]
                    Path(folder,f'{quality}-cockpit.png').write_bytes(base64.b64decode(data))
                print('Executable UI passed:',quality,window.evaluate_js("document.querySelector('#graphics').innerText"),flush=True)
        except Exception as error:failure.append(str(error));print('Self-test failed:',error,flush=True)
        finally:window.destroy()
    try:webview.start(test if args.self_test else None,gui='edgechromium' if sys.platform=='win32' else None,private_mode=True)
    finally:server.shutdown();server.server_close()
    if failure:raise SystemExit(1)

if __name__=='__main__':main()
