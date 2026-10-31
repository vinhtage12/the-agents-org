#!/usr/bin/env python3
"""Scaffold apps/web/src/modules/<name>/ following apps/web/.agents/rules/web-*.md.

Usage: python3 create_module.py <kebab-name> [--dry-run]
Self-check: python3 create_module.py --self-test
"""
import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parents[4]
NAME_RE = re.compile(r'^[a-z][a-z0-9]*(-[a-z0-9]+)*$')


def names(name):
    parts = name.split('-')
    return {
        'kebab': name,
        'pascal': ''.join(p.capitalize() for p in parts),
        'snake': '_'.join(parts),
        'upper': '_'.join(parts).upper(),
    }


def templates(n):
    p, s, u, k = n['pascal'], n['snake'], n['upper'], n['kebab']
    return {
        'types.ts': f"""export interface I{p} {{
  id: number;
  name: string;
}}
""",
        'constants.ts': f"""import {{ generateQueryKey }} from '@truyenmoinhu/query';

import {{ withGenerateEndpoint }} from '#utils/query';

export const {u}_QUERY_KEYS = {{
  list: generateQueryKey('{k}')
}};

export const {u}_ENDPOINTS = {{
  base: withGenerateEndpoint('{k}')
}};
""",
        'error.ts': f"""export class {p}Error extends Error {{
  constructor(readonly status?: number) {{
    super('{p} request failed');
  }}
}}
""",
        'hooks.ts': f"""import {{ useQueryEnhancer }} from '@truyenmoinhu/query';

import {{ {u}_ENDPOINTS, {u}_QUERY_KEYS }} from './constants';
import {{ {p}Error }} from './error';

import type {{ I{p} }} from './types';

export const use{p}List = () =>
  useQueryEnhancer<I{p}[]>({{
    queryKey: [{u}_QUERY_KEYS.list],
    queryFn: async ({{ apiManager }}) => {{
      const result = await apiManager?.sendRequest<I{p}[]>({{
        url: {u}_ENDPOINTS.base(),
        suppressNotifyOnError: true
      }});

      if (!result?.success || !result.payload) {{
        throw new {p}Error(result?.code);
      }}

      return result.payload;
    }}
  }});
""",
        f'{p}Page.tsx': f"""import {{ memo }} from 'react';

import {{ TmnCallout, TmnCard, TmnLoading, TmnText }} from '@truyenmoinhu/uikit';

import {{ trans }} from '#i18n';

import {{ use{p}List }} from './hooks';

const {p}Page = () => {{
  const {{ data, isLoading, isError }} = use{p}List();

  if (isLoading) {{
    return <TmnLoading />;
  }}

  if (isError) {{
    return <TmnCallout role="alert" color="red">{{trans('{s}.error')}}</TmnCallout>;
  }}

  return (
    <TmnCard header={{{{ title: trans('{s}.title') }}}}>
      {{data?.length ? (
        data.map(item => <TmnText key={{item.id}}>{{item.name}}</TmnText>)
      ) : (
        <TmnText muted>{{trans('{s}.empty')}}</TmnText>
      )}}
    </TmnCard>
  );
}};

export default memo({p}Page);
""",
        'index.ts': f"""export * from './constants';
export * from './error';
export * from './hooks';
export * from './{p}Page';
export {{ default as {p}Page }} from './{p}Page';
export * from './types';
""",
    }


I18N = {
    'en': lambda p: {'title': p, 'empty': 'Nothing here yet', 'error': f'Could not load {p.lower()}'},
    'vi': lambda p: {'title': p, 'empty': 'Chưa có dữ liệu', 'error': f'Không tải được {p.lower()}'},
}


def create(root, name, dry_run=False):
    if not NAME_RE.match(name):
        sys.exit(f'error: "{name}" is not kebab-case (e.g. agent-runs)')
    n = names(name)
    module_dir = root / 'src' / 'modules' / name
    if module_dir.exists():
        sys.exit(f'error: {module_dir} already exists')
    locales = {lang: root / 'src' / 'i18n' / 'locales' / lang / 'translation.json' for lang in I18N}
    for lang, path in locales.items():
        if n['snake'] in json.loads(path.read_text()):
            sys.exit(f'error: i18n key "{n["snake"]}" already exists in {lang}')

    files = templates(n)
    for rel in files:
        print(f'create src/modules/{name}/{rel}')
    for lang in locales:
        print(f'update src/i18n/locales/{lang}/translation.json (+{n["snake"]}.*)')
    if dry_run:
        return

    module_dir.mkdir(parents=True)
    for rel, content in files.items():
        (module_dir / rel).write_text(content)
    for lang, path in locales.items():
        data = json.loads(path.read_text())
        data[n['snake']] = I18N[lang](n['pascal'])
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')


def biome_fix(root, name):
    # Export order depends on the module name, so let Biome own sorting/formatting.
    subprocess.run(['pnpm', 'exec', 'biome', 'check', '--write', f'src/modules/{name}'], cwd=root, check=True)


def self_test():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for lang in I18N:
            loc = root / 'src' / 'i18n' / 'locales' / lang
            loc.mkdir(parents=True)
            (loc / 'translation.json').write_text('{}\n')
        create(root, 'agent-runs')
        mod = root / 'src' / 'modules' / 'agent-runs'
        assert (mod / 'AgentRunsPage.tsx').exists()
        assert 'AGENT_RUNS_QUERY_KEYS' in (mod / 'constants.ts').read_text()
        assert json.loads((root / 'src/i18n/locales/vi/translation.json').read_text())['agent_runs']['title']
        assert names('a-b2')['pascal'] == 'AB2' and not NAME_RE.match('Bad_Name')
    print('self-test ok')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('name', nargs='?')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
    elif args.name:
        create(WEB_ROOT, args.name, args.dry_run)
        if not args.dry_run:
            biome_fix(WEB_ROOT, args.name)
    else:
        parser.error('name is required')
