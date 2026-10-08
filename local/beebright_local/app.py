from __future__ import annotations

import base64
import shutil
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import ttk, messagebox

from .engine import (load_catalog, new_session, hint_for, choices_for,
                     check, save_json, read_json)

MODES = {'Multiple Choice': 'choice', 'Fill in the Blank': 'blank',
         'Type the Word': 'type', 'Flash Cards': 'flash'}
LABELS = {'one_bee': 'One Bee', 'two_bee': 'Two Bee', 'three_bee': 'Three Bee', 'random': 'Random'}


def speak(word):
    # Never pass a practice word through shell interpolation.
    if sys.platform == 'win32':
        script = "Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Rate=-2; $s.Speak([Console]::In.ReadToEnd())"
        args = ['powershell.exe', '-NoProfile', '-EncodedCommand', base64.b64encode(script.encode('utf-16le')).decode()]
        subprocess.run(args, input=word, text=True, creationflags=subprocess.CREATE_NO_WINDOW, timeout=60, check=True)
    elif sys.platform == 'darwin':
        subprocess.run(['say', '--', word], check=True, timeout=60)
    elif shutil.which('espeak'):
        subprocess.run(['espeak', '-s', '130', '--', word], check=True, timeout=60)
    else:
        raise RuntimeError('No local speech voice was found. Install espeak on Linux.')


class BeeBright(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('BeeBright • Local Spelling Practice')
        self.geometry('980x760')
        self.minsize(740, 650)
        self.lists, self.hints, self.distractors = load_catalog()
        self.session = read_json('progress.json')
        self.settings = read_json('settings.json', {'dark': False})
        self.protocol('WM_DELETE_WINDOW', self.exit)
        self.home()

    def clear(self):
        for child in self.winfo_children():
            child.destroy()
        self.bg = '#141b2c' if self.settings.get('dark') else '#fffaf0'
        self.fg = '#f6f0dd' if self.settings.get('dark') else '#1e293b'
        self.configure(bg=self.bg)
        canvas = tk.Canvas(self, bg=self.bg, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self, orient='vertical', command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side='right', fill='y')
        canvas.pack(side='left', fill='both', expand=True)
        self.panel = tk.Frame(canvas, bg=self.bg)
        window = canvas.create_window((0, 0), window=self.panel, anchor='nw')
        self.panel.bind('<Configure>', lambda e: canvas.configure(scrollregion=canvas.bbox('all')))
        canvas.bind('<Configure>', lambda e: canvas.itemconfigure(window, width=e.width))
        self.panel.configure(padx=36, pady=24)
        canvas.bind('<MouseWheel>', lambda e: canvas.yview_scroll(-int(e.delta / 120), 'units'))

    def text(self, value, size=14, bold=False, parent=None):
        widget = tk.Label(parent or self.panel, text=value, bg=self.bg, fg=self.fg,
                          font=('Segoe UI', size, 'bold' if bold else 'normal'),
                          wraplength=max(500, self.winfo_width() - 100), justify='center')
        widget.pack(pady=8)
        return widget

    def button(self, text, command, parent=None, primary=False):
        widget = tk.Button(parent or self.panel, text=text, command=command,
                           bg='#f8c94c' if primary else '#ede7d8', fg='#1e293b',
                           activebackground='#ffd96c', relief='flat', cursor='hand2',
                           font=('Segoe UI', 12, 'bold'), padx=18, pady=10)
        widget.pack(pady=5, fill='x')
        return widget

    def home(self):
        self.clear()
        self.text('🐝 BeeBright', 30, True)
        self.text('A little practice. A brighter speller.', 19)
        self.text('Practice locally • No account • Progress stays on this laptop', 11)
        self.list_var = tk.StringVar(value=self.lists[-1]['title'])
        combo = ttk.Combobox(self.panel, textvariable=self.list_var,
                             values=[r['title'] for r in self.lists], state='readonly', font=('Segoe UI', 13))
        combo.pack(pady=14, fill='x')
        self.level_frame = tk.Frame(self.panel, bg=self.bg)
        self.level_frame.pack(fill='x')
        self.level_var = tk.StringVar()
        combo.bind('<<ComboboxSelected>>', lambda event: self.levels())
        self.levels()
        self.mode_var = tk.StringVar(value='Multiple Choice')
        ttk.Combobox(self.panel, textvariable=self.mode_var, values=list(MODES),
                     state='readonly', font=('Segoe UI', 13)).pack(pady=12, fill='x')
        self.button('Start practice →', self.start, primary=True)
        if self.session and self.valid_session():
            self.button('Resume saved practice', self.question)
        self.button('Settings', self.preferences)
        self.text('CC BY-NC-SA 4.0 • Dictionary attribution is shown with hints.', 10)

    def record(self):
        return next(r for r in self.lists if r['title'] == self.list_var.get())

    def levels(self):
        for child in self.level_frame.winfo_children():
            child.destroy()
        record = self.record()
        keys = [key for key, words in record['levels'].items() if words]
        self.level_var.set(keys[0])
        for key in keys:
            description = record.get('level_descriptions', {}).get(key, '')
            text = LABELS.get(key, key) + ('\n' + description if description else '')
            text += f"\n{len(record['levels'][key]):,} words"
            tk.Radiobutton(self.level_frame, text=text, value=key, variable=self.level_var,
                indicatoron=False, bg='#f8c94c', selectcolor='#e7ae19', fg='#1e293b',
                font=('Segoe UI', 12, 'bold'), padx=14, pady=12).pack(side='left', fill='x', expand=True, padx=4)

    def valid_session(self):
        try:
            s = self.session
            return bool(s['words']) and 0 <= s['index'] < len(s['words']) and s['mode'] in MODES.values()
        except (KeyError, TypeError):
            return False

    def start(self):
        self.session = new_session(self.record(), self.level_var.get(), MODES[self.mode_var.get()])
        self.save()
        self.question()

    def save(self):
        if self.session:
            save_json('progress.json', self.session)

    def question(self):
        s = self.session
        if s['index'] >= len(s['words']):
            return self.results()
        self.clear()
        word = s['words'][s['index']]
        self.hint = hint_for(word, self.hints)
        self.text(f"{LABELS.get(s['level'])} • Question {s['index'] + 1} of {len(s['words'])}", 12)
        self.score_label = self.text(f"✓ {s['correct']} correct     🔥 {s['streak']} streak", 11)
        self.button('🔊 Listen', lambda: self.audio(word))
        self.choice_var = tk.StringVar()
        self.answer_widgets = []
        if s['mode'] == 'flash':
            self.card = self.text(self.hint['definition'], 22, True)
            self.text(self.hint['sentence'], 16)
            self.card.bind('<Double-Button-1>', lambda event: self.reveal(word))
            self.button('Reveal card', lambda: self.reveal(word))
        elif s['mode'] == 'choice':
            self.text('Which spelling is correct?', 22, True)
            for value in choices_for(word, self.distractors):
                widget = tk.Radiobutton(self.panel, text=value, value=value, variable=self.choice_var,
                    indicatoron=False, bg='#ede7d8', selectcolor='#f8c94c', font=('Segoe UI', 14), padx=20, pady=10)
                widget.pack(fill='x', pady=3)
                self.answer_widgets.append(widget)
        else:
            self.text(self.hint['sentence'] if s['mode'] == 'blank' else 'Type the word you hear.', 20, True)
            self.entry = ttk.Entry(self.panel, textvariable=self.choice_var, font=('Segoe UI', 20))
            self.entry.pack(fill='x', pady=12)
            self.entry.focus_set()
            self.entry.bind('<Return>', lambda event: self.submit())
            self.answer_widgets.append(self.entry)
        if s['mode'] != 'flash':
            self.check_button = self.button('Check answer', self.submit, primary=True)
        self.feedback = self.text('', 16, True)
        hint_row = tk.Frame(self.panel, bg=self.bg)
        hint_row.pack(fill='x')
        for key, title in [('definition', 'Definition'), ('origin', 'Word origin'), ('sentence', 'In a sentence')]:
            tk.Button(hint_row, text=title, command=lambda k=key: self.show_hint(k),
                      bg='#f8c94c', relief='flat', padx=12, pady=8).pack(side='left', expand=True, fill='x', padx=3)
        self.hint_label = self.text('', 12)
        self.next_button = self.button('Next word →', self.next)
        if not s['checked'] and s['mode'] != 'flash':
            self.next_button.config(state='disabled')
        self.button('Save & exit to menu', self.home)
        if s['checked'] and s['mode'] != 'flash':
            self.lock_answer()
            self.feedback.config(text=f'Answer: {word}')

    def reveal(self, word):
        self.card.config(text=word)

    def audio(self, word):
        def worker():
            try:
                speak(word)
            except (OSError, RuntimeError, subprocess.SubprocessError) as exc:
                self.after(0, lambda error=str(exc): messagebox.showerror('Speech unavailable', error))
        threading.Thread(target=worker, daemon=True).start()

    def show_hint(self, key):
        note = self.hint.get(key, '')
        source = self.hint.get('source', '')
        license = self.hint.get('license', '')
        self.hint_label.config(text=note + '\n' + source + (' • ' + license if license else ''))

    def lock_answer(self):
        for widget in self.answer_widgets:
            widget.config(state='disabled')
        self.check_button.config(state='disabled')
        self.next_button.config(state='normal')

    def submit(self):
        answer = self.choice_var.get()
        if not answer.strip() or self.session['checked']:
            return
        correct = check(self.session, answer)
        word = self.session['words'][self.session['index']]
        self.feedback.config(text='Correct!' if correct else f'The correct spelling is: {word}')
        self.lock_answer()
        s = self.session
        self.score_label.config(text=f"✓ {s['correct']} correct     🔥 {s['streak']} streak")
        self.save()

    def next(self):
        if not self.session['checked'] and self.session['mode'] != 'flash':
            return
        self.session['index'] += 1
        self.session['checked'] = False
        self.save()
        self.question()

    def results(self):
        self.clear()
        s = self.session
        self.text('You finished strong.', 30, True)
        self.text(f"{s['correct']} correct • Best streak {s['best']} • {len(s['words'])} words", 18)
        self.button('Choose another practice', self.home, primary=True)

    def preferences(self):
        self.clear()
        self.text('Your settings', 26, True)
        self.button('Switch to ' + ('light' if self.settings.get('dark') else 'dark') + ' mode', self.toggle_theme)
        self.button('Clear saved practice', self.clear_progress)
        self.text('Progress is saved only on this laptop. Updates preserve it.', 12)
        self.button('Back', self.home)

    def toggle_theme(self):
        self.settings['dark'] = not self.settings.get('dark')
        save_json('settings.json', self.settings)
        self.preferences()

    def clear_progress(self):
        if messagebox.askyesno('Clear progress', 'Clear the saved practice session on this laptop?'):
            self.session = None
            save_json('progress.json', None)
            self.home()

    def exit(self):
        self.save()
        self.destroy()


def run():
    BeeBright().mainloop()
