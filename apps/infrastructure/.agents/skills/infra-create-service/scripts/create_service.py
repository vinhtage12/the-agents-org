#!/usr/bin/env python3
"""Scaffold apps/infrastructure/<name>/ (docker-compose.yml + .env.example) from the postgres layout.

Usage:
  python3 create_service.py <name> --image <image> --port <container-port> [--data-dir <container-path>] [--dry-run]
  python3 create_service.py --self-test
"""
import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

INFRA_ROOT = Path(__file__).resolve().parents[4]
NAME_RE = re.compile(r'^[a-z][a-z0-9]*(-[a-z0-9]+)*$')


def render(name, image, port, data_dir):
    env = name.replace('-', '_').upper()
    compose = []
    if data_dir:
        compose.append('x-volume-path: ${VOLUME_PATH:?VOLUME_PATH is required}')
    compose += [
        'services:',
        f'  {name}:',
        f'    image: {image}',
        '    # Docker Desktop cannot route host traffic to container IPs; publish on loopback only.',
        '    ports:',
        f'      - "127.0.0.1:${{{env}_PORT:-{port}}}:{port}"',
    ]
    if data_dir:
        compose += [
            '    volumes:',
            '      - type: bind',
            '        source: ${VOLUME_PATH:?VOLUME_PATH is required}',
            f'        target: {data_dir}',
            '        bind:',
            '          create_host_path: false',
        ]
    compose += [
        '    restart: unless-stopped',
        '    networks:',
        '      - agent_org_network',
        '',
        'networks:',
        '  agent_org_network:',
        '    name: agent_org_network',
        '    driver: bridge',
        '',
    ]
    env_lines = [f'{env}_PORT={port}']
    if data_dir:
        env_lines += [
            '# Absolute path dedicated to this service and environment.',
            f'VOLUME_PATH=/srv/the-agents-org/development/{name}',
        ]
    return {'docker-compose.yml': '\n'.join(compose), '.env.example': '\n'.join(env_lines) + '\n'}


def create(root, name, image, port, data_dir, dry_run=False):
    if not NAME_RE.match(name):
        sys.exit(f'error: "{name}" must be kebab-case, e.g. redis or minio-console')
    if not 0 < port < 65536:
        sys.exit(f'error: invalid port {port}')
    if data_dir and not data_dir.startswith('/'):
        sys.exit('error: --data-dir must be an absolute path inside the container')
    directory = root / name
    if directory.exists():
        sys.exit(f'error: {directory} already exists')
    files = render(name, image, port, data_dir)
    for rel in files:
        print(f'create {name}/{rel}')
    if dry_run:
        return directory
    directory.mkdir()
    for rel, content in files.items():
        (directory / rel).write_text(content)
    return directory


def self_test():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        stateful = create(root, 'redis', 'redis:7-alpine', 6379, '/data')
        stateless = create(root, 'mailpit', 'axllent/mailpit:latest', 8025, None)
        assert 'x-volume-path' in (stateful / 'docker-compose.yml').read_text()
        assert 'VOLUME_PATH' not in (stateless / '.env.example').read_text()
        assert '${REDIS_PORT:-6379}:6379' in (stateful / 'docker-compose.yml').read_text()
        if shutil.which('docker'):
            for directory in (stateful, stateless):
                subprocess.run(
                    ['docker', 'compose', '--env-file', str(directory / '.env.example'),
                     '-f', str(directory / 'docker-compose.yml'), 'config', '--quiet'],
                    check=True,
                )
    print('self-test ok')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('name', nargs='?')
    parser.add_argument('--image')
    parser.add_argument('--port', type=int)
    parser.add_argument('--data-dir', help='container path to persist; omit for stateless services')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
    elif args.name and args.image and args.port:
        create(INFRA_ROOT, args.name, args.image, args.port, args.data_dir, args.dry_run)
    else:
        parser.error('name, --image and --port are required')
