import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INJECTED_APP_PATHS } from '../../src/domain/injected-commands';
import { EXTENSION_DIR, entryOutputPath, isRecord, isStringArray, readBuildEntries, readRepoJson } from './repository';

// The worker imports its in-page scripts by the paths in
// src/domain/injected-commands.ts; each must be an injected entry the build
// writes, and pages must be able to load them (web_accessible_resources).
describe('injected entries', () => {
  it('names every injected entry by the path the build writes it to, and nothing else', () => {
    const injected = readBuildEntries().filter((entry) => entry.kind === 'injected');

    expect(Object.entries(INJECTED_APP_PATHS).sort()).toEqual(injected.map((entry) => [entry.name, entryOutputPath(entry)]).sort());
  });

  it.each(Object.values(INJECTED_APP_PATHS))('builds %s with the run() the worker calls', (file) => {
    const built = join(EXTENSION_DIR, file);
    expect(existsSync(built), `${file} should be built; run npm run build first`).toBe(true);
    if (!file.endsWith('icon-font-preload.js')) {
      expect(readFileSync(built, 'utf8')).toMatch(/\bexport\s*\{[^}]*\brun\b/);
    }
  });

  it('lets web pages import the injected modules', () => {
    const resources = readRepoJson('manifest.json').web_accessible_resources;
    expect(Array.isArray(resources) && resources.some((entry) => isRecord(entry) &&
      isStringArray(entry.matches) && entry.matches.includes('<all_urls>') &&
      isStringArray(entry.resources) && entry.resources.includes('build/injected/*'))).toBe(true);
  });
});
