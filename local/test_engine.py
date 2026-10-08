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

if __name__=='__main__': unittest.main()
