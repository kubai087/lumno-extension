import { createRequire } from 'node:module';

// Runs an entry from scripts/build/entries.js the way the page runs it, as a
// module. Call vi.resetModules() before a page's first entry so each boot gets
// fresh module instances. The page's later entries reuse them here, where the
// extension's built scripts carry copies of their own; what crosses between
// them travels through the boot handoff either way.
const require = createRequire(import.meta.url);

interface Entry {
  name: string;
  source: string;
}

function isEntry(value: unknown): value is Entry {
  return typeof value === 'object' && value !== null &&
    'name' in value && typeof value.name === 'string' &&
    'source' in value && typeof value.source === 'string';
}

function readEntries(moduleExports: unknown): Entry[] {
  const entries = typeof moduleExports === 'object' && moduleExports !== null && 'ENTRIES' in moduleExports
    ? moduleExports.ENTRIES
    : null;
  if (!Array.isArray(entries) || !entries.every(isEntry)) {
    throw new Error('scripts/build/entries.js exports no ENTRIES list.');
  }
  return entries;
}

const ENTRIES = readEntries(require('../../scripts/build/entries.js'));

export async function runPageBundle(name: string): Promise<void> {
  const entry = ENTRIES.find((candidate) => candidate.name === name);
  if (!entry) {
    throw new Error(`No entry named ${name} in scripts/build/entries.js`);
  }
  await import(/* @vite-ignore */ `../../${entry.source}`);
}
