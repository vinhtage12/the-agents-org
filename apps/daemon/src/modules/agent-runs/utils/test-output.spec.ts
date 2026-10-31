import { parseTestCases, parseTestResults } from './test-output';

it('parses test cases and rejects malformed ones', () => {
  expect(
    parseTestCases('{"cases":[{"title":" A ","steps":"s","expected":"e"}]}')
  ).toEqual([{ title: 'A', steps: 's', expected: 'e' }]);
  expect(() => parseTestCases('nope')).toThrow('JSON');
  expect(() => parseTestCases('{"cases":[]}')).toThrow('cases');
  expect(() =>
    parseTestCases('{"cases":[{"title":"","steps":"s","expected":"e"}]}')
  ).toThrow('title');
});
it('requires exactly one result per case', () => {
  expect(
    parseTestResults(
      '{"results":[{"position":1,"passed":false,"detail":"x"},{"position":2,"passed":true}]}',
      [1, 2]
    )
  ).toEqual([
    { position: 1, passed: false, detail: 'x' },
    { position: 2, passed: true, detail: '' }
  ]);
  expect(() =>
    parseTestResults('{"results":[{"position":1,"passed":true}]}', [1, 2])
  ).toThrow('2');
  expect(() =>
    parseTestResults(
      '{"results":[{"position":1,"passed":true},{"position":1,"passed":true}]}',
      [1]
    )
  ).toThrow('1');
  expect(() =>
    parseTestResults('{"results":[{"position":1,"passed":"yes"}]}', [1])
  ).toThrow('passed');
});

it('rejects missing arrays, excessive cases and non-string fields', () => {
  expect(() => parseTestCases('{}')).toThrow('cases');
  expect(() => parseTestCases('{"cases":{}}')).toThrow('cases');
  expect(() =>
    parseTestCases(
      JSON.stringify({
        cases: Array(101).fill({ title: 't', steps: 's', expected: 'e' })
      })
    )
  ).toThrow('cases');
  for (const field of ['title', 'steps', 'expected']) {
    for (const value of ['', '  ', 1, null]) {
      expect(() =>
        parseTestCases(
          JSON.stringify({
            cases: [{ title: 't', steps: 's', expected: 'e', [field]: value }]
          })
        )
      ).toThrow(field);
    }
  }
});

it('rejects extra positions and malformed result envelopes', () => {
  expect(() => parseTestResults('nope', [1])).toThrow('JSON');
  expect(() => parseTestResults('{}', [1])).toThrow('results');
  expect(() =>
    parseTestResults('{"results":[{"position":3,"passed":true}]}', [1])
  ).toThrow('3');
});

it('rejects case titles longer than 512 characters', () => {
  expect(() =>
    parseTestCases(
      JSON.stringify({
        cases: [{ title: 'x'.repeat(513), steps: 's', expected: 'e' }]
      })
    )
  ).toThrow('title must be at most 512 characters');
});
