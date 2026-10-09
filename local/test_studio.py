import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from beebright_local import studio, engine
from beebright_local.app import DesktopApi
from beebright_local.commands import terminal, set_reminder

class StudioTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.patch = patch.object(engine, 'USER_DATA', self.root); self.patch.start()
    def tearDown(self):
        self.patch.stop(); self.tmp.cleanup()
    def test_players_isolate_progress_theme_and_history(self):
        api=DesktopApi()
        first={'words':[{'word':'sky'}], 'index':0}
        api.request('/api/progress','PUT',{'session':first})
        api.settings({'theme':'dark'})
        api.request('/api/studio','PUT',{'events':[{'word':'sky','correct':False}], 'favorites':['sky']})
        registry=api.request('/api/studio/profiles','PUT',{'action':'add','name':'Sibling'})
        self.assertNotEqual(registry['active'],'default')
        self.assertIsNone(api.request('/api/progress')['session'])
        self.assertEqual(api.settings()['theme'],'light')
        self.assertEqual(api.request('/api/studio'),{})
        api.request('/api/progress','PUT',{'session':{'words':[{'word':'bronze'}], 'index':0}})
        api.request('/api/studio/profiles','PUT',{'action':'switch','name':'Me'})
        self.assertEqual(api.request('/api/progress')['session'],first)
        self.assertEqual(api.settings()['theme'],'dark')
        self.assertEqual(api.request('/api/studio')['favorites'],['sky'])
    def test_backup_round_trip_and_path_rejection(self):
        studio.save('studio.json',{'favorites':['piñata']})
        studio.change_profile('add','New player')
        studio.save('progress.json',{'words':[{'word':'piñata'}], 'index':0})
        backup=studio.backup()
        studio.save('progress.json',None)
        studio.restore(json.loads(json.dumps(backup)))
        self.assertEqual(studio.read('progress.json')['words'][0]['word'],'piñata')
        self.assertEqual(DesktopApi().settings()['theme'], 'light')
        with patch('builtins.print'): self.assertTrue(terminal('stats', []))
        backup['profiles']['players'][0]['id']='../../escape'
        before=(self.root/'profiles.json').read_text()
        with self.assertRaises(ValueError):studio.restore(backup)
        self.assertEqual((self.root/'profiles.json').read_text(),before)
    def test_terminal_tools_do_not_open_ui_or_use_cloud(self):
        with patch('builtins.print'), patch('webbrowser.open',side_effect=AssertionError('No UI')):
            for command in ('doctor','stats','lists','changelog'):
                self.assertTrue(terminal(command,[]))
            self.assertTrue(terminal('backup',[str(self.root/'backup.json')]))
            self.assertTrue(terminal('restore',[str(self.root/'backup.json')]))
            terminal('profile',['add','Practice player'])
            terminal('profile',['list'])
            terminal('profile',['switch','Me'])
        self.assertTrue((self.root/'backup.json').is_file())
    def test_reminder_validation_and_detached_worker(self):
        with patch('subprocess.Popen') as spawn:
            spawn.return_value.pid=12345
            with self.assertRaises(ValueError):set_reminder('24:75')
            self.assertEqual(set_reminder('18:30'),{'time':'18:30'})
            self.assertIn('--reminder-worker',spawn.call_args.args[0])
            self.assertEqual(set_reminder('off'),{'time':'off'})
    def test_all_twenty_ui_commands_dispatch_without_launching_in_test(self):
        self.assertEqual(len(studio.COMMANDS),20)
        from beebright_local.commands import launch
        with patch('beebright_local.commands.terminal',return_value=False), patch('beebright_local.web.run_web') as web:
            for command in studio.COMMANDS:
                launch(command,[],web=True)
                self.assertEqual(web.call_args.args,(8765,command))

if __name__=='__main__':unittest.main()
