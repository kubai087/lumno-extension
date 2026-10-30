import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listRepoFiles, repoPath } from './repository';

// Repository rule (no lint covers it): each of these helpers has one owner
// module, and no page entry or feature carries a copy of its own.

function filesDefining(directory: string, pattern: RegExp, definition: RegExp): string[] {
  const files = listRepoFiles(directory, pattern).filter((file) => !/\.test\.tsx?$/.test(file));
  expect(files.length).toBeGreaterThan(0);
  return files.filter((file) => definition.test(readFileSync(repoPath(file), 'utf8')));
}

const RUNTIME_FILES = /\.(?:js|ts|tsx)$/;

describe('single owners', () => {
  it.each([
    ['browser detection', /function getBrowserInternalScheme\(/, 'src/platform/browser-profile.ts'],
    ['client-hint brand selection', /function getClientHintBrowserName\(/, 'src/platform/browser-profile.ts'],
    ['configured shortcut parsing', /function parseShortcut\(/, 'src/domain/shortcut-key-matcher.ts'],
    ['bounded cache writes', /function setBoundedCacheEntry\s*[<(]/, 'src/domain/bounded-cache.ts'],
    ['bookmark folder SVG and morph logic', /function describeFolderIcon\(/, 'src/newtab/bookmarks/bookmark-folder-icon.ts']
  ])('keeps %s in one module', (_concern, definition, owner) => {
    expect(filesDefining('src', RUNTIME_FILES, definition)).toEqual([owner]);
  });

  it('draws onboarding icons with the shared RemixIcon component', () => {
    expect(filesDefining('src/onboarding/react', /\.tsx$/, /function Icon\(/)).toEqual([]);
  });
});
