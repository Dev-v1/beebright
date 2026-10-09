"""Test the actual installed React desktop window and Python bridge."""
import sys, time, os
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
from beebright_local.app import run
failure=[]
def wait(w,expr):
    end=time.monotonic()+30
    while time.monotonic()<end:
        try:
            if w.evaluate_js(expr): return
        except Exception: pass
        time.sleep(.1)
    raise AssertionError(expr)
def test(w):
    try:
        wait(w,"document.querySelector('.hero-copy h1') !== null")
        assert w.evaluate_js("!document.body.innerText.includes('Request another word list') && !document.body.innerText.includes('Admin')")
        for mode in ['Flash Cards','Fill in the Blank','Multiple Choice','Type the Word']:
            w.evaluate_js("document.querySelector('.brand').click()")
            wait(w,"document.querySelector('.mode-grid') !== null")
            w.evaluate_js("Array.from(document.querySelectorAll('.mode-grid button')).find(b=>b.innerText.includes("+repr(mode)+")).click()")
            wait(w,"document.querySelectorAll('.level-buttons button').length === 3")
            assert w.evaluate_js("document.querySelector('.word-list-picker select').value === 'study-2027'")
            w.evaluate_js("document.querySelector('.set-panel .primary').click()")
            wait(w,"document.querySelector('.practice-content') !== null")
            if mode=='Flash Cards':
                w.evaluate_js("document.querySelector('.flash-card').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))")
                wait(w,"document.querySelector('.flash-card.revealed') !== null")
            else:
                wait(w,"!document.body.innerText.includes('Loading definition...')")
                if mode=='Multiple Choice':
                    w.evaluate_js("document.querySelector('.choices button').click()")
                    w.evaluate_js("document.querySelector('.check-button').click()")
                    wait(w,"document.querySelector('.feedback') !== null")
                if mode!='Fill in the Blank':
                    w.evaluate_js("Array.from(document.querySelectorAll('.hint-controls button')).find(b=>b.innerText==='In a sentence').click()")
                    wait(w,"document.querySelector('.hint-box p').innerText.includes('___')")
        w.evaluate_js("document.querySelector('.icon-button').click()")
        wait(w,"document.querySelector('.theme-switch') !== null")
        assert w.evaluate_js("!document.querySelector('.settings-page').innerText.includes('Username')")
        w.evaluate_js("document.querySelectorAll('.theme-switch button')[1].click()")
        wait(w,"document.documentElement.dataset.theme === 'dark'")
        # Verify actual rendered contrast, including the former white-on-white button.
        w.evaluate_js("document.querySelector('.brand').click()")
        wait(w,"document.querySelector('.hero-copy h1') !== null")
        assert w.evaluate_js("""(() => {
            const rgb = s => s.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});
            const lum = s => {const c=rgb(s);return c[0]*.2126+c[1]*.7152+c[2]*.0722};
            const contrast = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
            const button = getComputedStyle(document.querySelector('.hero-buttons .primary'));
            const lead = getComputedStyle(document.querySelector('.lead'));
            const body = getComputedStyle(document.body);
            const warmup = getComputedStyle(document.querySelector('.warmup-card > button'));
            const card = getComputedStyle(document.querySelector('.warmup-card'));
            return contrast(button.color,button.backgroundColor)>=4.5 && contrast(lead.color,body.backgroundColor)>=4.5 && contrast(warmup.color,card.backgroundColor)>=4.5;
        })()""")
        time.sleep(.5)
        print('Shared website UI, four modes, hints, feedback and local settings passed.')
    except Exception as e: failure.append(e)
    finally: w.destroy()
if os.environ.get('BEEBRIGHT_TEST_LOCAL_WEB'):
    import threading, webview
    from beebright_local.web import LocalServer
    server = LocalServer(0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        window = webview.create_window('BeeBright browser test', f'http://beebright.localhost:{server.server_address[1]}/')
        webview.start(test, window, gui='edgechromium')
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
else:
    run(test)
if failure: raise failure[0]
