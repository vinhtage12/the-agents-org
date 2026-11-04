import { homedir } from 'node:os';

import { expandHome, outputFileName } from './output-file';

describe('outputFileName', () => {
  it('uses the local scheduled date and slug', () => {
    expect(outputFileName('eod', new Date(2026, 10, 2, 8, 30))).toBe(
      '2026-11-02-eod.md'
    );
  });
});

describe('expandHome', () => {
  it('expands a home-relative path', () => {
    expect(expandHome('~/Reports')).toBe(`${homedir()}/Reports`);
  });

  it('leaves an absolute path unchanged', () => {
    expect(expandHome('/abs')).toBe('/abs');
  });
});
