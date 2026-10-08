"""Test the actual installed React desktop window and Python bridge."""
import sys, time
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
        time.sleep(.5)
        print('Shared website UI, four modes, hints, feedback and local settings passed.')
    except Exception as e: failure.append(e)
    finally: w.destroy()
run(test)
if failure: raise failure[0]
