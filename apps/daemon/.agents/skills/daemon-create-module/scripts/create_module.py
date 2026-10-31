"""Scaffold a daemon domain module using only the Python standard library."""
import argparse
import re
import sys
from pathlib import Path


def scaffold(root: Path, name: str, dry_run: bool = False) -> list[Path]:
    if not re.fullmatch(r'[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*', name):
        raise ValueError('Module name must be lowercase kebab-case, starting with a letter')
    base = root / 'src/modules' / name
    if base.exists():
        raise ValueError(f'Module already exists: {name}')
    symbol = ''.join(part.capitalize() for part in name.split('-'))
    app = root / 'src/modules/app.module.ts'
    source = app.read_text()
    if f'{symbol}Module' in source:
        raise ValueError(f'Module is already registered: {symbol}Module')
    registration = re.search(r'\bimports:\s*\[', source)
    if not registration:
        raise ValueError('Cannot locate the imports array in modules/app.module.ts')
    updated = source[:registration.end()] + f'\n    {symbol}Module,' + source[registration.end():]
    updated = f"import {{ {symbol}Module }} from './{name}/{name}.module';\n" + updated
    files = {
        f'{name}.module.ts': f"""import {{ Module }} from '@nestjs/common';

import {{ {symbol}Controller }} from './controllers/{name}.controller';
import {{ {symbol}Service }} from './services/{name}.service';

@Module({{
  controllers: [{symbol}Controller],
  providers: [{symbol}Service]
}})
export class {symbol}Module {{}}
""",
        f'controllers/{name}.controller.ts': f"""import {{ Controller }} from '@nestjs/common';
import {{ ApiTags }} from '@nestjs/swagger';

import {{ {symbol}Service }} from '../services/{name}.service';

@Controller('{name}')
@ApiTags('{name}')
export class {symbol}Controller {{
  constructor(readonly service: {symbol}Service) {{}}
}}
""",
        f'controllers/{name}.controller.spec.ts': f"""import {{ Test, TestingModule }} from '@nestjs/testing';

import {{ {symbol}Service }} from '../services/{name}.service';
import {{ {symbol}Controller }} from './{name}.controller';

describe('{symbol}Controller', () => {{
  it('resolves its service', async () => {{
    const service = {{}};
    const module: TestingModule = await Test.createTestingModule({{
      controllers: [{symbol}Controller],
      providers: [{{ provide: {symbol}Service, useValue: service }}]
    }}).compile();
    try {{
      expect(module.get({symbol}Controller).service).toBe(service);
    }} finally {{
      await module.close();
    }}
  }});
}});
""",
        f'services/{name}.service.ts': f"""import {{ Injectable }} from '@nestjs/common';

@Injectable()
export class {symbol}Service {{}}
""",
        f'services/{name}.service.spec.ts': f"""import {{ Test, TestingModule }} from '@nestjs/testing';

import {{ {symbol}Service }} from './{name}.service';

describe('{symbol}Service', () => {{
  it('can be injected', async () => {{
    const module: TestingModule = await Test.createTestingModule({{
      providers: [{symbol}Service]
    }}).compile();
    try {{
      expect(module.get({symbol}Service)).toBeInstanceOf({symbol}Service);
    }} finally {{
      await module.close();
    }}
  }});
}});
""",
        'dtos/.gitkeep': '',
        f'entities/{name}.entity.ts': f"""export class {symbol}Entity {{}}
""",
    }
    if not dry_run:
        for relative, content in files.items():
            path = base / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        app.write_text(updated)
    return [base / relative for relative in files]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('name', help='Lowercase kebab-case domain name')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing files')
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[4]
    try:
        files = scaffold(root, args.name, args.dry_run)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    for path in files:
        print(path.relative_to(root))
    print('Update src/modules/app.module.ts' + (' (dry run)' if args.dry_run else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
