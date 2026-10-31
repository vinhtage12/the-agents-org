export function adfToText(doc: unknown): string {
  function flatten(node: unknown): string {
    if (!node || typeof node !== 'object') return '';
    const value = node as { type?: string; text?: string; content?: unknown[] };
    if (value.type === 'text') return value.text || '';
    if (value.type === 'hardBreak') return '\n';
    const text = Array.isArray(value.content)
      ? value.content.map(flatten).join('')
      : '';
    return ['paragraph', 'heading', 'listItem'].includes(value.type || '')
      ? `${text.replace(/\n+$/, '')}\n`
      : text;
  }
  return flatten(doc).trim();
}
