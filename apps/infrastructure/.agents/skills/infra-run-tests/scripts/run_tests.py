#!/usr/bin/env python3
"""Test apps/infrastructure services.

Usage:
  python3 run_tests.py                         # static: `docker compose config` for every service with .env.example
  python3 run_tests.py --smoke <service> --env development
                                               # up via make, wait until every container is running/healthy, then down
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

INFRA_ROOT = Path(__file__).resolve().parents[4]


def services():
    return sorted(p.parent for p in INFRA_ROOT.glob('*/docker-compose.yml'))


def static():
    failed = []
    for directory in services():
        env = directory / '.env.example'
        if not env.is_file():
            failed.append(f'{directory.name}: missing .env.example')
            continue
        result = subprocess.run(
            ['docker', 'compose', '--env-file', str(env), '-f', str(directory / 'docker-compose.yml'),
             'config', '--quiet'],
            capture_output=True, text=True,
        )
        status = 'ok' if result.returncode == 0 else 'FAIL'
        print(f'{status:4} {directory.name}')
        if result.returncode:
            failed.append(f'{directory.name}: {result.stderr.strip()}')
    return failed


def smoke(service, environment, timeout):
    project = f'agents-{service}-{environment}'
    directory = INFRA_ROOT / service
    base = ['docker', 'compose', '--project-name', project, '--env-file', str(directory / f'.env.{environment}'),
            '-f', str(directory / 'docker-compose.yml')]
    def rows():
        out = subprocess.check_output(base + ['ps', '--format', 'json'], text=True)
        # Compose prints either a JSON array or one object per line depending on version.
        return json.loads(out) if out.strip().startswith('[') else [json.loads(l) for l in out.splitlines() if l]

    # A service that is already up belongs to someone (e.g. the daemon's database): check it, never stop it.
    already_up = bool(rows())
    if not already_up:
        subprocess.run(['make', f'up-{service}', '--', f'--{environment}'], cwd=INFRA_ROOT, check=True)
    try:
        deadline = time.time() + timeout
        while time.time() < deadline:
            states = [(r.get('State'), r.get('Health') or '') for r in rows()]
            print('states:', states)
            if states and all(s == 'running' and h in ('', 'healthy') for s, h in states):
                return []
            if any(s in ('exited', 'dead') or h == 'unhealthy' for s, h in states):
                break
            time.sleep(3)
        logs = subprocess.run(base + ['logs', '--tail', '50'], capture_output=True, text=True).stdout
        return [f'{service}: not healthy within {timeout}s\n{logs}']
    finally:
        # down keeps the data directory; never call remove from tests.
        if not already_up:
            subprocess.run(['make', f'down-{service}', '--', f'--{environment}'], cwd=INFRA_ROOT, check=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--smoke', metavar='SERVICE')
    parser.add_argument('--env', default='development')
    parser.add_argument('--timeout', type=int, default=90)
    args = parser.parse_args()
    failures = smoke(args.smoke, args.env, args.timeout) if args.smoke else static()
    for failure in failures:
        print(failure, file=sys.stderr)
    sys.exit(1 if failures else 0)
