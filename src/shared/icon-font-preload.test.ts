import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserFake } from '../../tests/fakes/browser';
import { getTag, getTags } from '../../tests/fakes/dom';
import { parseCss, readRepoFile } from '../../tests/fakes/css';

// The icon font and the first-frame icon masks, warmed before the overlay,
// the tab switcher or Options draw, so their first icons show at once.

const FONT_PRELOAD_ID = '_x_extension_remixicon_font_preload_2026_unique_';
const FALLBACK_SVGS = [
  'assets/remixicon/icons/search-line.svg',
  'assets/remixicon/icons/settings-line.svg',
  'assets/remixicon/icons/brush-2-line.svg'
];

async function runPreload(): Promise<void> {
  vi.resetModules();
  await import('./icon-font-preload');
}

afterEach(() => {
  document.head.querySelectorAll('link[rel="preload"]').forEach((link) => link.remove());
  vi.unstubAllGlobals();
});

describe('Icon font preload', () => {
  it('warms the icon font and the first-frame icon masks once, however often it runs', async () => {
    const browser = createBrowserFake();
    vi.stubGlobal('chrome', browser);
    await runPreload();
    await runPreload();

    const links = getTags(document.head, 'link[rel="preload"]', 'link');
    expect(links).toHaveLength(4);
    const font = getTag(document.head, `#${FONT_PRELOAD_ID}`, 'link');
    expect([font.as, font.type, font.crossOrigin, Reflect.get(font, 'fetchPriority'), font.href])
      .toEqual(['font', 'font/woff2', 'anonymous', 'high', browser.runtime.getURL('assets/remixicon/fonts/remixicon.woff2')]);
    const masks = links.filter((link) => link.as === 'image');
    expect(masks.map((link) => link.href)).toEqual(FALLBACK_SVGS.map((path) => browser.runtime.getURL(path)));
    masks.forEach((link) => {
      expect([link.type, Reflect.get(link, 'fetchPriority')]).toEqual(['image/svg+xml', 'high']);
    });
  });

  it('warms nothing outside the extension', async () => {
    await runPreload();
    expect(document.head.querySelectorAll('link[rel="preload"]')).toHaveLength(0);
  });

  it('warms the very files the overlay asks for', () => {
    // The theme-tintable official Remix SVGs, which the overlay's shadow root can load.
    FALLBACK_SVGS.forEach((path) => {
      expect(readRepoFile(path)).toMatch(/^<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http:\/\/www\.w3\.org\/2000\/svg">/);
    });
    const manifest: unknown = JSON.parse(readRepoFile('manifest.json'));
    const resources = typeof manifest === 'object' && manifest !== null && 'web_accessible_resources' in manifest &&
      Array.isArray(manifest.web_accessible_resources) ? manifest.web_accessible_resources : [];
    expect(resources.some((entry: unknown) => typeof entry === 'object' && entry !== null && 'resources' in entry &&
      Array.isArray(entry.resources) && entry.resources.includes('assets/remixicon/icons/*.svg'))).toBe(true);
    // remixicon.css requests the exact URL that was preloaded.
    const face = parseCss(readRepoFile('assets/remixicon/fonts/remixicon.css')).entries
      .find((entry) => entry.selectors.length === 0 && /remixicon/.test(entry.style.getPropertyValue('font-family')));
    expect(face?.style.getPropertyValue('src')).toMatch(/url\("?remixicon\.woff2"?\) format\("woff2"\)/);
  });

  it('is not loaded into ordinary pages before an overlay is asked for', () => {
    const manifest: unknown = JSON.parse(readRepoFile('manifest.json'));
    const scripts = typeof manifest === 'object' && manifest !== null && 'content_scripts' in manifest &&
      Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
    const startup = scripts.find((entry: unknown) => typeof entry === 'object' && entry !== null &&
      'matches' in entry && Array.isArray(entry.matches) && entry.matches.includes('<all_urls>') &&
      'run_at' in entry && entry.run_at === 'document_start');
    const files: unknown = typeof startup === 'object' && startup !== null && 'js' in startup ? startup.js : [];
    expect(files).toContain('build/shortcut-key-observer.js');
    expect(JSON.stringify(scripts)).not.toContain('icon-font-preload');
  });
});
