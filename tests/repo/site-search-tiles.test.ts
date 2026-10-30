import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isRecord, readRepoJson, repoPath } from './repository';
import { SITE_SEARCH_PINNED_ICON_ASSETS } from '../../src/domain/favicon/shortcut-favicon/bundled-icons';
import { getDefaultSiteSearchProviders } from '../../src/domain/search/utils/site-search-providers';

// The bundled site-search providers' icons are packaged tiles: one per
// built-in provider, shipped and reachable from web pages, with no remote
// icon to fall back to. How a surface draws them is covered by
// src/domain/favicon/shortcut-favicon/bundled-icons.test.ts and the overlay's
// tests/pages/overlay/site-search-icons.test.ts.

const TILE_PATTERN = 'assets/images/site-search/*.png';

function catalog(): Record<string, unknown>[] {
  const items = readRepoJson('assets/data/site-search.json').items;
  return Array.isArray(items) ? items.filter(isRecord) : [];
}

function webAccessibleResources(): unknown[] {
  const entries = readRepoJson('manifest.json').web_accessible_resources;
  return Array.isArray(entries) ? entries.flatMap((entry) => (isRecord(entry) && Array.isArray(entry.resources) ? entry.resources : [])) : [];
}

describe('site search provider tiles', () => {
  it('gives every built-in provider its own local tile, and no other provider one', () => {
    const providers = catalog();
    const expected = Object.fromEntries(providers.map((provider) => [provider.key, `assets/images/site-search/tile-${String(provider.key)}.png`]));
    expect(SITE_SEARCH_PINNED_ICON_ASSETS).toEqual(expected);
  });

  it('keeps no remote icon for a built-in provider, in the catalog or its fallback', () => {
    catalog().forEach((provider) => {
      expect(provider.icon, String(provider.key)).toBeFalsy();
      expect(provider.iconUrl, String(provider.key)).toBeFalsy();
    });
    getDefaultSiteSearchProviders().forEach((provider) => {
      expect(Reflect.get(provider, 'icon'), provider.key).toBeFalsy();
      expect(Reflect.get(provider, 'iconUrl'), provider.key).toBeFalsy();
    });
  });

  it('lets web pages load every tile through one manifest pattern', () => {
    expect(webAccessibleResources()).toContain(TILE_PATTERN);
  });

  it('ships each tile as a 144px RGBA PNG', () => {
    new Set(Object.values(SITE_SEARCH_PINNED_ICON_ASSETS)).forEach((resourcePath) => {
      expect(resourcePath).toMatch(/^assets\/images\/site-search\/tile-[a-z0-9]+\.png$/);
      expect(existsSync(repoPath(resourcePath)), resourcePath).toBe(true);
      const header = readFileSync(repoPath(resourcePath)).subarray(0, 33);
      expect([...header.subarray(0, 8)], resourcePath).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(header.readUInt32BE(16), resourcePath).toBe(144);
      expect(header.readUInt32BE(20), resourcePath).toBe(144);
      // Colour type 6: RGBA, which keeps the rounded corners.
      expect(header[25], resourcePath).toBe(6);
    });
  });
});
