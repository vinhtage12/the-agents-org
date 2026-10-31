import tempfile
import unittest
from pathlib import Path

from create_module import scaffold


class ScaffoldTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = self.root / 'src/modules/app.module.ts'
        self.app.parent.mkdir(parents=True)
        self.app.write_text("import { Module } from '@nestjs/common';\n@Module({\n  imports: [\n  ],\n})\nexport class AppModule {}\n")

    def test_scaffolds_and_registers_a_kebab_case_module(self):
        paths = scaffold(self.root, 'audit-logs')
        module = self.root / 'src/modules/audit-logs'
        self.assertEqual(len(paths), 7)
        self.assertIn('export class AuditLogsModule', (module / 'audit-logs.module.ts').read_text())
        self.assertIn("@Controller('audit-logs')", (module / 'controllers/audit-logs.controller.ts').read_text())
        self.assertIn('TestingModule', (module / 'services/audit-logs.service.spec.ts').read_text())
        self.assertTrue((module / 'dtos/.gitkeep').exists())
        self.assertTrue((module / 'entities/.gitkeep').exists())
        self.assertIn('    AuditLogsModule,', self.app.read_text())
        self.assertIn("from './audit-logs/audit-logs.module'", self.app.read_text())

    def test_rejects_invalid_names_and_existing_modules_without_writing(self):
        for name in ['../escape', 'BadName', 'a_b', 'x;touch', '1module', 'two--words']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                scaffold(self.root, name)
        scaffold(self.root, 'audit-logs')
        before = self.app.read_text()
        with self.assertRaises(ValueError):
            scaffold(self.root, 'audit-logs')
        self.assertEqual(self.app.read_text(), before)

    def test_dry_run_and_unrecognized_app_leave_files_untouched(self):
        before = self.app.read_text()
        scaffold(self.root, 'preview', dry_run=True)
        self.assertEqual(self.app.read_text(), before)
        self.assertFalse((self.app.parent / 'preview').exists())
        self.app.write_text('export class AppModule {}')
        with self.assertRaises(ValueError):
            scaffold(self.root, 'example')
        self.assertFalse((self.app.parent / 'example').exists())


if __name__ == '__main__':
    unittest.main()
