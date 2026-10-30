import { describe, expect, it } from 'vitest';
import lumnoNewtabHtml from '../../../src/newtab/lumno-newtab.html?raw';

// The standalone fallback page only redirects: one external script (extension
// pages allow no inline ones), nothing painted or booted on the way.
const page = new DOMParser().parseFromString(lumnoNewtabHtml, 'text/html');

describe('standalone Lumno New Tab markup', () => {
  it('loads its redirect from an external script and nothing inline', () => {
    const scripts = Array.from(page.querySelectorAll('script'));

    expect(scripts.map((script) => script.getAttribute('src'))).toEqual(['../../build/lumno-newtab.js']);
    expect(scripts.every((script) => !(script.textContent || '').trim())).toBe(true);
  });

  it('neither paints a wallpaper nor repeats the New Tab runtime', () => {
    expect(lumnoNewtabHtml).not.toMatch(/wallpaper-preload\.js/);
    expect(lumnoNewtabHtml).not.toMatch(/data-page-entry|build\/newtab(?:-preload)?\.js/);
  });
});
