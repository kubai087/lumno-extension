import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { isRecord } from './repository';

// The path matching scripts/check/check-manifest-resources.js checks the
// manifest's resources with.
interface ManifestResourceCheck {
  normalizeManifestResourcePath(path: string): string;
  manifestResourcePatternMatchesPath(pattern: string, path: string): boolean;
}

function isManifestResourceCheck(value: unknown): value is ManifestResourceCheck {
  return isRecord(value) && typeof value.normalizeManifestResourcePath === 'function' &&
    typeof value.manifestResourcePatternMatchesPath === 'function';
}

const exported: unknown = createRequire(import.meta.url)('../../scripts/check/check-manifest-resources.js');
if (!isManifestResourceCheck(exported)) {
  throw new Error('scripts/check/check-manifest-resources.js exports no path matchers');
}
const check = exported;

describe('manifest resource paths', () => {
  it('normalizes Windows paths to the manifest form', () => {
    expect(check.normalizeManifestResourcePath('assets\\images\\site-search\\tile-gg.png')).toBe('assets/images/site-search/tile-gg.png');
  });

  it('matches a wildcard resource against a Windows path by extension', () => {
    expect(check.manifestResourcePatternMatchesPath('assets/images/site-search/*.png', 'assets\\images\\site-search\\tile-gg.png')).toBe(true);
    expect(check.manifestResourcePatternMatchesPath('assets/images/site-search/*.svg', 'assets\\images\\site-search\\tile-gg.png')).toBe(false);
  });
});
