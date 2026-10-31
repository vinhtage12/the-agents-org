"""Run daemon unit, e2e, or coverage tests from any working directory."""
import argparse
import shlex
import subprocess
import sys
from pathlib import Path


def command(mode: str, pattern: str | None) -> list[str]:
    scripts = {'unit': 'test', 'e2e': 'test:e2e', 'cov': 'test:cov'}
    return ['pnpm', '--filter', 'daemon', scripts[mode]] + (['--', pattern] if pattern else [])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['unit', 'e2e', 'cov'], nargs='?', default='unit')
    parser.add_argument('pattern', nargs='?', help='Optional Jest test path pattern')
    parser.add_argument('--dry-run', action='store_true', help='Print command without executing')
    args = parser.parse_args(argv)
    args_command = command(args.mode, args.pattern)
    print(shlex.join(args_command), flush=True)
    if args.dry_run:
        return 0
    try:
        return subprocess.run(args_command, cwd=Path(__file__).resolve().parents[4], check=False).returncode
    except FileNotFoundError:
        print('pnpm is not available on PATH', file=sys.stderr)
        return 127


if __name__ == '__main__':
    sys.exit(main())
