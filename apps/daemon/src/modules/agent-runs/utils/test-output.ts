function parseArray(raw: string, key: string): unknown[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON');
  }
  if (!data || typeof data !== 'object' || !(key in data)) {
    throw new Error(`Missing ${key} array`);
  }
  const values = (data as Record<string, unknown>)[key];
  if (!Array.isArray(values)) throw new Error(`${key} must be an array`);
  return values;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Each entry must be an object');
  }
  return value as Record<string, unknown>;
}

export function parseTestCases(
  raw: string
): { title: string; steps: string; expected: string }[] {
  const cases = parseArray(raw, 'cases');
  if (!cases.length || cases.length > 100)
    throw new Error('cases must contain 1–100 entries');
  return cases.map(value => {
    const item = record(value);
    const field = (key: string): string => {
      const text = item[key];
      if (typeof text !== 'string' || !text.trim())
        throw new Error(`${key} must be a non-empty string`);
      const trimmed = text.trim();
      if (key === 'title' && trimmed.length > 512)
        throw new Error('title must be at most 512 characters');
      return trimmed;
    };
    return {
      title: field('title'),
      steps: field('steps'),
      expected: field('expected')
    };
  });
}

export function parseTestResults(
  raw: string,
  positions: number[]
): { position: number; passed: boolean; detail: string }[] {
  const remaining = new Set(positions);
  const results = parseArray(raw, 'results').map(value => {
    const item = record(value);
    const { position, passed, detail = '' } = item;
    if (typeof position !== 'number' || !remaining.delete(position)) {
      throw new Error(`Unexpected or duplicate position ${position}`);
    }
    if (typeof passed !== 'boolean')
      throw new Error(`passed must be boolean for position ${position}`);
    if (typeof detail !== 'string')
      throw new Error(`detail must be a string for position ${position}`);
    return { position, passed, detail };
  });
  if (remaining.size)
    throw new Error(`Missing positions: ${[...remaining].join(', ')}`);
  return results;
}
