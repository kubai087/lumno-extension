import { describe, expect, it } from 'vitest';
import newtabHtml from '../../../newtab.html?raw';
import legacyNewtabHtml from '../../../src/newtab/newtab.html?raw';
import { parseCss } from '../../fakes/css';
import { expectElement, getElement } from '../../fakes/dom';

// The New Tab markup as shipped: the paint gate that hides the page until
// its focus route and wallpaper are settled, the old path, and stylesheets.
const page = new DOMParser().parseFromString(newtabHtml, 'text/html');

describe('New Tab markup', () => {
  it('keeps the New Tab resource base at the short root entry', () => {
    expect(getElement(page, 'base').getAttribute('href')).toBe('src/newtab/');
  });

  it('parses the paint gate before the preload that can show the wallpaper', () => {
    const gate = getElement(page, 'style[data-nt-focus-paint-gate="true"]');
    const preload = expectElement(page.querySelector('script[src="../../build/newtab-preload.js"]'), 'the New Tab preload');

    expect(gate.compareDocumentPosition(preload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides the body wallpaper while the route is pending or the wallpaper is not ready', () => {
    const css = parseCss(getElement(page, 'style[data-nt-focus-paint-gate="true"]').textContent || '');
    const gate = css.rule('html[data-nt-focus-route-pending="true"] body');

    expect(gate?.get('visibility')).toBe('hidden');
    expect(gate?.get('background-image')).toBe('none');
    expect(gate?.priority('background-image')).toBe('important');
    expect(css.entries.some((entry) => entry.selectors.includes('body:not([data-nt-wallpaper-ready="1"])') &&
      entry.selectors.includes('html[data-nt-focus-route-pending="true"] body'))).toBe(true);
  });

  it('keeps the previous New Tab path as a redirect to the short route', () => {
    const legacy = new DOMParser().parseFromString(legacyNewtabHtml, 'text/html');

    expect(legacy.querySelector('script[src="../../build/newtab-route-redirect.js"]')).not.toBeNull();
  });

  it('styles the progress history dialog', () => {
    expect(page.querySelector('link[rel="stylesheet"][href$="recent-history-dialog.css"]')).not.toBeNull();
  });
});
