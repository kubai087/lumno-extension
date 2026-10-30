import { describe, expect, it } from 'vitest';
import type { ProgressHistoryMap } from './progress-history';
import { MAX_VERSIONS, recordVersion, restoreVersion } from './progress-history';

describe('progress history', () => {
  function twelveVersions(): ProgressHistoryMap {
    let map: ProgressHistoryMap = {};
    for (let index = 1; index <= 12; index += 1) {
      map = recordVersion(map, 'site', { url: `https://site/${index}`, title: `${index}`, updatedAt: index });
    }
    return map;
  }

  it('keeps the ten latest versions, newest first', () => {
    const map = twelveVersions();

    expect(map.site).toHaveLength(MAX_VERSIONS);
    expect(MAX_VERSIONS).toBe(10);
    expect(map.site[0].url).toBe('https://site/12');
  });

  it('restores a version and keeps the one left behind, which can be restored back', () => {
    const restored = restoreVersion(twelveVersions(), 'site', 2, { url: 'https://site/13', title: '13', updatedAt: 13 });

    expect(restored.version && restored.version.url).toBe('https://site/10');
    expect(restored.map.site[0].url).toBe('https://site/13');
    expect(restored.map.site.map((version) => version.url)).not.toContain('https://site/10');
  });

  it('restores nothing past the end', () => {
    expect(restoreVersion(twelveVersions(), 'site', 99, null).version).toBeNull();
  });
});
