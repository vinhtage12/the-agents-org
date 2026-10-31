import unittest
from pathlib import Path
from unittest.mock import patch

from run_tests import command, main


class TestRunnerTests(unittest.TestCase):
    def test_modes_and_optional_pattern(self):
        for mode, script in [('unit', 'test'), ('e2e', 'test:e2e'), ('cov', 'test:cov')]:
            self.assertEqual(command(mode, 'tickets'), ['pnpm', '--filter', 'daemon', script, '--', 'tickets'])
        self.assertEqual(command('unit', None), ['pnpm', '--filter', 'daemon', 'test'])

    def test_preserves_failure_exit_code_and_uses_daemon_directory(self):
        with patch('run_tests.subprocess.run') as run:
            run.return_value.returncode = 7
            self.assertEqual(main(['unit']), 7)
            self.assertEqual(run.call_args.kwargs['cwd'].name, 'daemon')
            self.assertIsInstance(run.call_args.kwargs['cwd'], Path)

    def test_dry_run_does_not_execute(self):
        with patch('run_tests.subprocess.run') as run:
            self.assertEqual(main(['cov', 'service', '--dry-run']), 0)
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
