import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

export async function listSpecFiles(dir: string): Promise<string[]> {
  // shortcut: no ignore list (node_modules/.git), add one if spec dirs grow large
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry =>
      relative(dir, join(entry.parentPath, entry.name)).replaceAll('\\', '/')
    )
    .sort();
}
