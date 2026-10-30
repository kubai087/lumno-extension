import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserFake, type BrowserFake } from '../../fakes/browser';
import { fetchPackaged } from '../../fakes/packaged-fetch';
import { trustedKey } from '../../fakes/trusted-events';
import { HOST_ID as QR_DIALOG_ID } from '../../../src/shared/ui/community-qr-dialog';
import { language } from '../../../src/domain/settings';
import siteSearch from '../../../assets/data/site-search.json';

// The overlay's Help Center search offers the WeChat group when nothing
// matched, and opens its QR in a dialog on the page rather than in a tab.

const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
const OVERLAY_INPUT_ID = '_x_extension_search_input_2024_unique_';
const TABS = [
  { id: 1, windowId: 1, index: 0, url: 'https://page.example/', title: 'Page', active: true, pinned: false }
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

async function openChineseOverlay() {
  const browser = createBrowserFake({
    sync: { [language.key]: 'zh-CN' },
    local: { [language.key]: 'zh-CN' },
    tabs: TABS,
    respond: ({ action }) => {
      if (action === 'getTabsForOverlay') return { tabs: TABS, currentTabId: 1 };
      if (action === 'getHelpCenterSearchResults') return { items: [] };
      return undefined;
    }
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
  vi.stubGlobal('fetch', vi.fn(fetchPackaged));
  vi.resetModules();
  const app = await import('../../../src/overlay/overlay-app');
  const shell = await import('../../../src/overlay/react/shell');
  await act(async () => {
    app.run({ type: 'toggle', tabs: TABS, context: { currentTabId: 1, currentTabUrl: 'https://page.example/', siteSearchProviders: siteSearch.items } });
  });
  await settle();
  const panelRoot = () => {
    const panel = shell.findOverlayPanel(document);
    const root = panel ? panel.getRootNode() : null;
    return root instanceof ShadowRoot ? root : null;
  };
  await waitFor(() => Boolean(panelRoot()?.getElementById(OVERLAY_INPUT_ID)), 'the overlay input did not mount');
  const input = () => {
    const found = panelRoot()?.getElementById(OVERLAY_INPUT_ID);
    if (!(found instanceof HTMLInputElement)) {
      throw new Error('Expected the overlay input');
    }
    return found;
  };
  const rows = () => Array.from(panelRoot()?.querySelectorAll('.x-ov-suggestion-item') || []);
  return { browser, input, rows };
}

function openedTab(browser: BrowserFake): boolean {
  return browser.runtime.sendMessage.mock.calls.some(([message]) =>
    typeof message === 'object' && message !== null && 'action' in message && message.action === 'createTab');
}

afterEach(() => {
  document.body.replaceChildren();
  document.getElementById(QR_DIALOG_ID)?.remove();
  document.getElementById(OVERLAY_HOST_ID)?.remove();
  vi.unstubAllGlobals();
});

describe('Overlay Help Center search', () => {
  it.each(['click', 'Enter'])('opens the WeChat QR dialog by %s when nothing matched', async (how) => {
    const { browser, input, rows } = await openChineseOverlay();
    const type = async (text: string) => {
      await act(async () => {
        input().focus();
        input().value = text;
        input().dispatchEvent(new Event('input', { bubbles: true }));
      });
      await settle();
    };
    const press = async (key: string) => {
      await act(async () => {
        trustedKey(input(), 'keydown', { key });
      });
      await settle();
    };

    await type('lm');
    await press('Tab');
    await type('zzz');
    const community = () => rows().findIndex((row) => (row.textContent || '').includes('加入反馈群'));
    await waitFor(() => community() > 0, 'an unmatched help search did not offer the WeChat group');

    if (how === 'click') {
      await act(async () => {
        rows()[community()].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, button: 0 }));
      });
    } else {
      const target = community();
      for (let step = 0; step < target; step += 1) {
        await press('ArrowDown');
      }
      await press('Enter');
    }
    await waitFor(() => Boolean(document.getElementById(QR_DIALOG_ID)), 'the QR dialog did not open');
    expect(openedTab(browser)).toBe(false);
  });
});
