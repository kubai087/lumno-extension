import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enMessages from '../../../_locales/en/messages.json';
import { createBrowserFake } from '../../fakes/browser';
import { installFontFaceApi, removeFontFaceApi } from '../../fakes/font-faces';
import { registerEarlyOverlayFontFaces } from '../../../src/shared/overlay-font-faces';

// The overlay keeps the faces the page registered while it loaded, and
// replaces only an early CJK face whose glyph forms the language setting
// does not use.

const FONT_FACES_STYLE_ID = '_x_extension_overlay_font_faces_2026_unique_';
const CJK_STYLE_ID = '_x_extension_overlay_cjk_font_faces_2026_unique_';
const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
const TABS = [{ id: 1, windowId: 1, index: 0, url: 'https://page.example/', title: 'Page', active: true, pinned: false }];

async function settle(passes = 8): Promise<void> {
  await act(async () => {
    for (let pass = 0; pass < passes; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

async function openOverlay(language: string) {
  const browser = createBrowserFake({
    tabs: TABS,
    sync: { _x_extension_language_2024_unique_: language },
    respond: ({ action }) => (action === 'getTabsForOverlay' ? { tabs: TABS, currentTabId: 1 } : undefined)
  });
  vi.stubGlobal('chrome', browser);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {}
  }));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => enMessages })));
  const added = installFontFaceApi();
  registerEarlyOverlayFontFaces(window, { getUrl: browser.runtime.getURL, lang: 'zh-CN' });
  vi.resetModules();
  const app = await import('../../../src/overlay/overlay-app');
  await act(async () => {
    app.run({ type: 'toggle', tabs: TABS, context: { currentTabId: 1, currentTabUrl: 'https://page.example/' } });
  });
  for (let attempt = 0; attempt < 30 && !document.getElementById(OVERLAY_HOST_ID); attempt += 1) {
    await settle(2);
  }
  await settle(30);
  return added;
}

afterEach(() => {
  document.head.replaceChildren();
  removeFontFaceApi();
});

describe('Overlay font faces', () => {
  it('declares no faces the page already registered and keeps a matching CJK face', async () => {
    const added = await openOverlay('zh_CN');
    expect(document.getElementById(OVERLAY_HOST_ID)).not.toBeNull();
    expect(document.getElementById(FONT_FACES_STYLE_ID)).toBeNull();
    expect(document.getElementById(CJK_STYLE_ID)).toBeNull();
    expect(added.size).toBe(5);
  });

  it('installs its own CJK face for a language with other glyph forms', async () => {
    const added = await openOverlay('ja');
    expect(document.getElementById(CJK_STYLE_ID)?.textContent).toMatch(/HiraginoSans-W5/);
    // The early CJK face makes way for it.
    expect(added.size).toBe(4);
  });
});
