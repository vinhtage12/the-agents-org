#!/usr/bin/env python3
"""Run format, lint and type checks for the pnpm workspace apps.

Usage:
  python3 .agents/skills/repo-quality-checks/scripts/check.py                 # check only, all apps
  python3 .agents/skills/repo-quality-checks/scripts/check.py web --fix       # apply Biome format/lint fixes first
  python3 .agents/skills/repo-quality-checks/scripts/check.py --only typecheck
  python3 .agents/skills/repo-quality-checks/scripts/check.py --self-test
"""
import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
STEPS = ('format', 'lint', 'typecheck')


def plan(app, fix):
    pnpm = ['pnpm', '--filter', app, 'exec']
    write = ['--write'] if fix else []
    steps = {
        'format': pnpm + ['biome', 'format', *write, '.'],
        'lint': pnpm + ['biome', 'lint', *write, '.'],
        'typecheck': pnpm + ['tsc', '--noEmit', '-p', 'tsconfig.json'],
    }
    if app == 'web':
        # House rules that Biome cannot express (portals, one component per file, apiManager context).
        steps['lint'] = [steps['lint'], ['pnpm', '--filter', 'web', 'audit:codestyle']]
    return {name: cmd if isinstance(cmd[0], list) else [cmd] for name, cmd in steps.items()}


def run(apps, only, fix):
    results = []
    for app in apps:
        for step, commands in plan(app, fix).items():
            if only and step not in only:
                continue
            ok = True
            for cmd in commands:
                print(f'$ {" ".join(cmd)}', flush=True)
                ok = subprocess.run(cmd, cwd=REPO_ROOT).returncode == 0 and ok
            results.append((app, step, ok))
    print('\nSummary')
    for app, step, ok in results:
        print(f'  {"PASS" if ok else "FAIL"}  {app:8} {step}')
    return all(ok for *_, ok in results)


def self_test():
    web = plan('web', fix=False)
    assert web['format'] == [['pnpm', '--filter', 'web', 'exec', 'biome', 'format', '.']]
    assert ['pnpm', '--filter', 'web', 'audit:codestyle'] in web['lint']
    assert '--write' in plan('daemon', fix=True)['lint'][0]
    assert len(plan('daemon', fix=False)['lint']) == 1
    print('self-test ok')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('apps', nargs='*', metavar='{web,daemon}')
    parser.add_argument('--only', action='append', choices=STEPS, help='repeatable; default runs all steps')
    parser.add_argument('--fix', action='store_true', help='let Biome write format/lint fixes')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if set(args.apps) - {'web', 'daemon'}:
        parser.error('apps must be web and/or daemon')
    if args.self_test:
        self_test()
        sys.exit(0)
    sys.exit(0 if run(args.apps or ['web', 'daemon'], args.only, args.fix) else 1)
