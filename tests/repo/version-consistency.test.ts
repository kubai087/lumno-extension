import { describe, expect, it } from 'vitest';
import { readRepoJson, recordField, stringField } from './repository';

// The release version lives in three files; a bump that misses one ships a
// package whose manifest disagrees with npm metadata (or the reverse).
describe('release version', () => {
  it('is one dotted number across the manifest, package.json and package-lock.json', () => {
    const manifestVersion = stringField(readRepoJson('manifest.json'), 'version');
    const lock = readRepoJson('package-lock.json');

    expect(manifestVersion).toMatch(/^\d+(\.\d+){0,3}$/);
    expect(stringField(readRepoJson('package.json'), 'version')).toBe(manifestVersion);
    expect(stringField(lock, 'version')).toBe(manifestVersion);
    expect(stringField(recordField(recordField(lock, 'packages'), ''), 'version')).toBe(manifestVersion);
  });
});
