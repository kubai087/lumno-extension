import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enMessages from '../../../_locales/en/messages.json';
import { createBrowserFake } from '../../fakes/browser';
import { required } from '../../fakes/dom';

// In the overlay the input's action icons share one cursor tooltip, styled
// from the extension's stylesheet inside the overlay's shadow root. (JSDOM
// has no :hover, so the bubble's text shows which control it belongs to.)

const OVERLAY_INPUT_ID = '_x_extension_search_input_2024_unique_';
const CURSOR_TOOLTIP_ID = '_x_extension_overlay_cursor_tooltip_2026_unique_';
const TABS = [
  { id: 1, windowId: 1, index: 0, url: 'https://page.example/', title: 'Page', active: true, pinned: false },
  { id: 2, windowId: 1, index: 1, url: 'https://fixture.example/', title: 'Lumno fixture page', active: false, pinned: false }
];

async function settle(passes = 8): Promise<void> {
  await act(async () => {
    for (let pass = 0; pass < passes; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

async function openOverlay(): Promise<ShadowRoot> {
  vi.stubGlobal('chrome', createBrowserFake({
    tabs: TABS,
    respond: ({ action }) => (action === 'getTabsForOverlay' ? { tabs: TABS, currentTabId: 1 } : undefined)
  }));
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {}
  }));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => enMessages })));
  vi.resetModules();
  const app = await import('../../../src/overlay/overlay-app');
  const shell = await import('../../../src/overlay/react/shell');
  await act(async () => {
    app.run({ type: 'toggle', tabs: TABS, context: { currentTabId: 1, currentTabUrl: 'https://page.example/' } });
  });
  const panelRoot = () => {
    const panel = shell.findOverlayPanel(document);
    const root = panel ? panel.getRootNode() : null;
    return root instanceof ShadowRoot && root.getElementById(OVERLAY_INPUT_ID) ? root : null;
  };
  for (let attempt = 0; attempt < 60 && !panelRoot(); attempt += 1) {
    await settle(2);
  }
  await settle(30);
  return required(panelRoot(), 'overlay panel');
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('Overlay cursor tooltips', () => {
  it('loads the cursor tooltip stylesheet from the extension and names each input action', async () => {
    const root = await openOverlay();
    const hrefs = Array.from(root.querySelectorAll('link'), (link) => link.getAttribute('href') || '');
    expect(hrefs.some((href) => /^chrome-extension:\/\/[^/]+\/src\/shared\/ui\/tooltip\.css$/.test(href))).toBe(true);
    expect(hrefs.some((href) => /^chrome-extension:\/\/[^/]+\/src\/shared\/ui\/cursor-tooltip\.css$/.test(href))).toBe(true);

    let x = 200;
    const hover = async (id: string): Promise<string> => {
      const element = required(root.getElementById(id), id);
      x += 11;
      await act(async () => {
        ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove'].forEach((type) => {
          element.dispatchEvent(new MouseEvent(type, { bubbles: !/enter/.test(type), composed: true, clientX: x, clientY: 40 }));
        });
      });
      await settle(30);
      return root.getElementById(CURSOR_TOOLTIP_ID)?.textContent || '';
    };
    expect(await hover('_x_extension_search_right_icon_2024_unique_')).toBe('Open settings');
    expect(await hover('_x_extension_search_close_other_tabs_2026_unique_')).toBe('Close other tabs');
  });
});
