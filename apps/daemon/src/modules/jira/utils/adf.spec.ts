import { adfToText } from './adf';

it('flattens paragraphs and hard breaks', () => {
  expect(
    adfToText({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'A' },
            { type: 'hardBreak' },
            { type: 'text', text: 'B' }
          ]
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'C' }] }
      ]
    })
  ).toBe('A\nB\nC');
  expect(adfToText(null)).toBe('');
});
