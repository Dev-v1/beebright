import unittest
from beebright_local.engine import load_catalog, new_session, hint_for, choices_for, check

class PracticeTests(unittest.TestCase):
    def test_study_lists_and_hint_parity(self):
        lists, hints, wrong = load_catalog()
        study = next(r for r in lists if r['id'] == 'study-2027')
        self.assertEqual(set(study['levels']), {'one_bee','two_bee','three_bee'})
        for level, words in study['levels'].items():
            self.assertEqual(len(words), 150)
            s = new_session(study, level, 'choice')
            self.assertEqual(set(s['words']),set(words))
            self.assertNotEqual(s['words'],words)
            for word in words:
                hint = hint_for(word,hints)
                self.assertEqual(hint['sentence'].count('___'),1,word)
                self.assertTrue(hint['definition'] and hint['origin'],word)
                self.assertEqual(len(set(choices_for(word,wrong))),4,word)

    def test_scoring_only_once_and_matching_unicode(self):
        s={'words':['piñata'],'index':0,'checked':False,'correct':0,'streak':0,'best':0}
        self.assertTrue(check(s,' PIÑATA '))
        self.assertIsNone(check(s,'piñata'))
        self.assertEqual(s['correct'],1)


class DesktopBridgeTests(unittest.TestCase):
    def test_paging_and_no_cloud_routes(self):
        from beebright_local.app import DesktopApi
        api=DesktopApi()
        a=api.request('/api/practice?word_list_id=study-2027&level=three_bee')
        b=api.request('/api/practice?word_list_id=study-2027&level=three_bee&offset=100&shuffle_seed='+a['shuffle_seed'])
        self.assertEqual(len(a['words']),100)
        self.assertEqual(len(b['words']),50)
        self.assertFalse({w['word'] for w in a['words']} & {w['word'] for w in b['words']})
        for route in ['/api/admin/overview','/api/access','/api/word-list-requests','https://example.com/api/progress']:
            self.assertIn('error',api.request(route))

    def test_progress_and_theme_survive_restart(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        from beebright_local.app import DesktopApi
        with tempfile.TemporaryDirectory() as directory, patch('beebright_local.engine.USER_DATA',Path(directory)):
            api=DesktopApi()
            session={'words':[{'word':'sky'}], 'index':0, 'correct':1}
            api.request('/api/progress','PUT',{'session':session})
            api.settings({'theme':'dark'})
            restarted=DesktopApi()
            self.assertEqual(restarted.request('/api/progress')['session'],session)
            self.assertEqual(restarted.settings()['theme'],'dark')
            restarted.request('/api/progress','DELETE')
            self.assertIsNone(restarted.request('/api/progress')['session'])

if __name__=='__main__': unittest.main()
