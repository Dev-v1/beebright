"""Smoke-test the actual native UI with the installed Tkinter runtime."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
from beebright_local.app import BeeBright, MODES

app = BeeBright()
try:
    for mode in MODES:
        app.home()
        app.mode_var.set(mode)
        app.start()
        app.update()
        for hint in ('definition', 'origin', 'sentence'):
            app.show_hint(hint)
            app.update()
        word = app.session['words'][0]
        if mode == 'Flash Cards':
            app.reveal(word)
        else:
            app.choice_var.set(word)
            app.submit()
            assert app.session['correct'] == 1
        app.next()
        app.update()
    app.preferences()
    app.toggle_theme()
    app.update()
finally:
    app.exit()
print('All four native practice modes and settings opened successfully.')
