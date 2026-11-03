"""Keep privileged review and third-party action trust boundaries explicit."""
from pathlib import Path
import re
import unittest

WORKFLOWS=Path(__file__).resolve().parents[4]/'.github/workflows'


class WorkflowPolicyTests(unittest.TestCase):
    def test_privileged_review_never_checks_out_untrusted_heads_or_persists_pat(self):
        text=(WORKFLOWS/'claude.yml').read_text()
        events=text.split('jobs:',1)[0]
        self.assertNotIn('issue_comment:',events)
        condition=text.split('    if: >-',1)[1].split('    runs-on:',1)[0]
        self.assertIn('github.event.pull_request.head.repo.full_name == github.repository &&',condition)
        self.assertIn("fromJSON('[\"OWNER\",\"MEMBER\",\"COLLABORATOR\"]')",condition)
        self.assertNotIn('||',condition)
        checkout=text.split('- name: Checkout repository',1)[1].split('- name: Run Claudit Action',1)[0]
        self.assertIn('github.event.pull_request.base.sha',checkout)
        self.assertIn('persist-credentials: false',checkout)
        self.assertNotIn('head.sha',checkout)
        self.assertNotIn('secrets.',checkout)

    def test_third_party_actions_are_pinned_to_immutable_commits(self):
        count=0
        for file in WORKFLOWS.glob('*.yml'):
            for action in re.findall(r'^\s*(?:-\s*)?uses:\s*([^\s#]+)',file.read_text(),re.M):
                count+=1
                self.assertRegex(action,r'^[\w.-]+/[\w./-]+@[a-f0-9]{40}$',str(file))
        self.assertGreater(count,0)
