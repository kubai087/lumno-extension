import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSiteThemeResolver } from './site-theme-resolver';
import { FaviconParts } from './favicon-parts';
import { createDefaultTheme, defaultAccentColor } from '../../shared/favicon/favicon-theme';
import { themeColorCache, themeHostCache } from '../../shared/favicon/theme-caches';
import { normalizeHost } from '../../domain/favicon/brand-accents';
import { parseCssColor, stableHashCode } from '../../domain/color';
import { isPlaceholderFaviconColor } from '../../domain/favicon/theme-color';
import type { SiteThemeEntry } from '../../domain/favicon/favicon-cache';
import type { ThemeRgb } from '../../domain/favicon/types';
import type { ThemeLike } from '../../shared/favicon/favicon-theme';

// Shortcut tiles must tint from the artwork they show, and Chrome/Google's
// generic globe must never become a host-wide theme.

const SNAPSHOT_URL = 'data:image/png;base64,c25hcHNob3Q=';
const GLOBE_URL = 'data:image/png;base64,Z2xvYmU=';
const RED: ThemeRgb = [255, 36, 66];
const GLOBE_GRAY: ThemeRgb = [95, 99, 104];
// The average color of each icon the resolver reads.
const averageBySource = new Map<string, ThemeRgb>([[SNAPSHOT_URL, RED], [GLOBE_URL, GLOBE_GRAY]]);

const defaultTheme = createDefaultTheme();

beforeEach(() => {
  themeHostCache.clear();
  themeColorCache.clear();
  // Icons decode as soon as they get their source.
  vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function decode(this: HTMLImageElement, value: string) {
    this.setAttribute('src', value);
    queueMicrotask(() => this.dispatchEvent(new Event('load')));
  });
});

function accentOf(theme: ThemeLike | null | undefined): string {
  return Array.from(theme && theme.accentRgb ? theme.accentRgb : []).join(',');
}

function isSiteThemeEntry(value: unknown): value is SiteThemeEntry {
  return typeof value === 'object' && value !== null && 'accentRgb' in value && 'source' in value;
}

function createResolver() {
  const persistedThemes = new Map<string, SiteThemeEntry>();
  const shortcutIconSources = new Map<string, string>([['https://www.xiaohongshu.com/', SNAPSHOT_URL]]);
  const resolver = createSiteThemeResolver({
    normalizeHost,
    parseCssColor,
    defaultAccentColor,
    defaultTheme,
    getProviderHost: () => '',
    // The site theme cache: kept entries are read back as stored.
    faviconCacheRuntime: {
      setPersistedThemeEntry: (host, entry) => {
        if (!isSiteThemeEntry(entry)) return false;
        persistedThemes.set(String(host), entry);
        return true;
      },
      ensureCachesReady: async () => {}
    },
    getPersistedSiteThemeEntry: (host) => persistedThemes.get(host) || null,
    getPageFaviconUrlResolver: () => ({ getSafeFaviconCandidateUrl: (url) => String(url || ''), resolveFaviconSource: () => '' }),
    getBrandAccentForUrl: () => null,
    extractAverageColor: (image) => averageBySource.get(image.getAttribute('src') || '') || null,
    getProviderIcon: () => '',
    isHostFaviconVisitDirty: () => false,
    stableHashCode,
    getShortcutFaviconCandidateUrl: () => '',
    getShortcutFaviconDataUrl: (url) => shortcutIconSources.get(String(url)) || '',
    getProviderFaviconPageUrl: () => '',
    areFaviconRenderCachesReady: () => true,
    // No icon data cached or fetched: themes come from the icons' own colors.
    faviconParts: new FaviconParts()
  });
  return { resolver, persistedThemes, shortcutIconSources };
}

describe('shortcut tile themes', () => {
  it('treats the generic globe like a missing icon and keeps it out of the host cache', async () => {
    const { resolver, shortcutIconSources } = createResolver();
    expect(isPlaceholderFaviconColor(GLOBE_GRAY)).toBe(true);

    expect(await resolver.getThemeForSuggestion({ type: 'shortcut', url: 'https://globe.example/' })).toBe(defaultTheme);
    shortcutIconSources.set('https://globe.example/', GLOBE_URL);
    expect(await resolver.getThemeForSuggestion({ type: 'shortcut', url: 'https://globe.example/' })).toBe(defaultTheme);
    expect(resolver.themeHostCache.has('globe.example')).toBe(false);
  });

  it('ignores a stored globe theme from older builds', () => {
    const { resolver, persistedThemes } = createResolver();
    persistedThemes.set('legacy.example', { accentRgb: GLOBE_GRAY, source: 'favicon', neutral: false, confidence: 'neutral', updatedAt: Date.now() });

    expect(resolver.getImmediateThemeForSuggestion({ type: 'recent', url: 'https://legacy.example/' })).toBe(defaultTheme);
  });

  it('tints a tile from its own snapshot over a gray host theme from elsewhere, from the first paint', async () => {
    const { resolver } = createResolver();
    resolver.themeHostCache.set('xiaohongshu.com', resolver.buildThemeFromAccent([110, 110, 120], 'favicon'));

    expect(accentOf(await resolver.getThemeForSuggestion({ type: 'shortcut', url: 'https://www.xiaohongshu.com/' }))).toBe(RED.join(','));
    expect(accentOf(resolver.getImmediateThemeForSuggestion({ type: 'shortcut', url: 'https://www.xiaohongshu.com/' }))).toBe(RED.join(','));
  });

  it('keeps a snapshot tile on its own artwork when the site theme changes, and others follow the site', async () => {
    const { resolver } = createResolver();
    const siteTheme = resolver.buildThemeFromAccent([40, 120, 200], 'meta');

    const tileTheme = await resolver.getTileThemeOnSiteChange({ type: 'shortcut', url: 'https://www.xiaohongshu.com/' }, siteTheme);
    expect(accentOf(tileTheme)).toBe(RED.join(','));
    // A tile still waiting for a snapshot.
    expect(await resolver.getTileThemeOnSiteChange({ type: 'shortcut', url: 'https://www.xiaohongshu.com/pending' }, siteTheme)).toBe(siteTheme);
  });
});
