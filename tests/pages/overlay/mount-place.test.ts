import { afterEach, describe, expect, it } from 'vitest';
import { bootOverlayPage } from './boot';

// Where the overlay mounts: reader extensions such as SimpRead hide the page
// body and show their reading surface under <html>, and a fullscreen
// element shows alone; the overlay stays visible in both.

afterEach(() => {
  Reflect.deleteProperty(document, 'fullscreenElement');
});

describe('Overlay mount place', () => {
  it('mounts outside a body reader mode hid', async () => {
    const page = await bootOverlayPage({
      html: '<!doctype html><html><head></head><body class="simpread-hidden" style="display: none"><p>Article</p></body></html>'
    });
    await page.open();
    const host = page.host();
    expect(host?.parentNode).toBe(document.documentElement);
    expect(host ? document.body.contains(host) : true).toBe(false);
  });

  it('mounts inside the fullscreen element while one shows', async () => {
    const fullscreen = document.body.appendChild(document.createElement('section'));
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreen });
    const page = await bootOverlayPage();
    await page.open();
    expect(page.host()?.parentNode).toBe(fullscreen);
  });
});
