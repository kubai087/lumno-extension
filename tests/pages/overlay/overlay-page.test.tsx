import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enMessages from '../../../_locales/en/messages.json';
import { createBrowserFake } from '../../fakes/browser';

// Runs the real overlay app on a web page against an in-memory browser, as
// the worker does with each toggle, and checks it by what it shows: it opens
// on the window's tabs, offers a web search for what is typed, and the next
// toggle closes it.

const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
const OVERLAY_INPUT_ID = '_x_extension_search_input_2024_unique_';

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

async function waitFor(check: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return;
    await settle(2);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  throw new Error(message);
}

async function loadOverlay() {
  // The worker lists the window's tabs as it does for the overlay.
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
  const toggle = async () => {
    let reply: unknown = null;
    await act(async () => {
      reply = app.run({ type: 'toggle', tabs: TABS, context: { currentTabId: 1, currentTabUrl: 'https://page.example/' } });
    });
    await settle();
    return reply;
  };
  // The panel sits in a closed shadow root; its own nodes still reach it.
  const panelRoot = () => {
    const panel = shell.findOverlayPanel(document);
    const root = panel ? panel.getRootNode() : null;
    return root instanceof ShadowRoot ? root : null;
  };
  return { toggle, panelRoot };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('Overlay page', () => {
  it('opens on the window tabs, offers a search for what is typed and closes on the next toggle', async () => {
    const { toggle, panelRoot } = await loadOverlay();

    const reply = await toggle();
    expect(reply).toEqual({ ok: true, overlayOpen: true });
    await waitFor(() => Boolean(panelRoot()?.getElementById(OVERLAY_INPUT_ID)), 'the overlay input did not mount');
    const root = panelRoot();
    const input = root ? root.getElementById(OVERLAY_INPUT_ID) : null;
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('Expected the overlay input');
    }

    const rowTexts = () => Array.from(root?.querySelectorAll('.x-ov-suggestion-item') || []).map((row) => row.textContent || '');
    await waitFor(() => rowTexts().some((text) => text.includes('Lumno fixture page')), 'the overlay did not list the window tabs');

    await act(async () => {
      input.focus();
      input.value = 'Lumno fixture';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await waitFor(() => rowTexts().some((text) => text.includes('Search "Lumno fixture"')), 'the overlay did not offer a web search');

    await toggle();
    await waitFor(() => !document.getElementById(OVERLAY_HOST_ID), 'the next toggle did not close the overlay');
  });
});
