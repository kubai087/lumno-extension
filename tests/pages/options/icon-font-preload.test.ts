import { afterEach, describe, expect, it, vi } from 'vitest';
import optionsHtml from '../../../src/options/options.html?raw';
import { createBrowserFake } from '../../fakes/browser';
import { runPageBundle } from '../page-bundles';

// Options warms the icon font before its stylesheets.

// The page's theme preload keeps watching the document for as long as the
// page lives, so the browser stays stubbed to the end of the file.
afterEach(() => {
  document.head.querySelectorAll('link[rel="preload"]').forEach((link) => link.remove());
});

describe('Options icon font preload', () => {
  it('runs its preload, which warms the icon font, before its first stylesheet', async () => {
    const parsed = new DOMParser().parseFromString(optionsHtml, 'text/html');
    const preload = parsed.querySelector('script[src="../../build/options-preload.js"]');
    const firstStylesheet = parsed.querySelector('link[rel="stylesheet"]');
    expect(preload && firstStylesheet && preload.compareDocumentPosition(firstStylesheet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    vi.stubGlobal('chrome', createBrowserFake());
    vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} }));
    vi.resetModules();
    await runPageBundle('options-preload');
    expect(document.getElementById('_x_extension_remixicon_font_preload_2026_unique_')).not.toBeNull();
    // The theme preload finishes reading storage before the page goes.
  });
});
