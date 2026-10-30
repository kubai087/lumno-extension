// Renders an Options view inside the page context it reads, with the page's
// real owners over in-memory settings (tests/fakes/options-settings.ts) and
// stand-ins for the browser, the toast and the tooltip.
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import type { StorageItems } from '../../src/domain/storage-port';
import { OptionsPageContext, type OptionsPage } from '../../src/options/app/context';
import { AggregateSearches } from '../../src/options/features/aggregate-search/searches';
import { PageTheme } from '../../src/options/features/appearance/page-theme';
import { SurfaceLocale } from '../../src/shared/i18n/surface-locale';
import { loadExtensionLocaleMessages } from '../../src/shared/i18n/locale-messages';
import { BrowserCommands } from '../../src/options/features/shortcuts/browser-commands';
import { SiteSearchProviders } from '../../src/options/features/site-search/providers';
import { createSearchSourceOrderController } from '../../src/options/options-search-source-order';
import { createOptionsTestSettings } from './options-settings';
import { getTestPortals } from './portals';

interface OptionsViewOptions {
  sync?: StorageItems;
  local?: StorageItems;
  page?: Partial<OptionsPage>;
}

const mounted: Array<() => void> = [];

// The chrome members the views reach: assets, the manifest, messages to the
// worker and the browser's own copy, which answers nothing here.
function stubChrome() {
  const sendMessage = vi.fn((_message: unknown, callback?: (reply: unknown) => void) => {
    if (callback) callback({ ok: true });
  });
  vi.stubGlobal('chrome', {
    runtime: {
      getURL: (path: string) => `chrome-extension://lumno/${path}`,
      getManifest: () => ({ version: '1.0.0' }),
      lastError: null,
      sendMessage
    },
    i18n: { getMessage: () => '', getUILanguage: () => 'en' }
  });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {}
  }));
  return sendMessage;
}

function renderOptionsView(view: ReactNode, options: OptionsViewOptions = {}) {
  const sendMessage = stubChrome();
  const settings = createOptionsTestSettings({ sync: options.sync, local: options.local });
  const sourceOrder = createSearchSourceOrderController({ write: () => Promise.resolve() });
  const showToast = vi.fn<OptionsPage['showToast']>();
  const notifyNewtab = vi.fn<OptionsPage['notifyNewtab']>();
  const page: OptionsPage = {
    portals: getTestPortals(),
    settingsStore: settings.store,
    locale: new SurfaceLocale(settings.store, loadExtensionLocaleMessages),
    commands: new BrowserCommands(),
    siteSearchProviders: new SiteSearchProviders(settings.store, () => {}),
    aggregateSearches: new AggregateSearches(settings.store, { getActiveAreaName: () => 'sync' }, () => {}),
    sourceOrder,
    pageTheme: new PageTheme(settings.store, {
      doc: document,
      win: window,
      animatePanel: (mutateLayout) => mutateLayout()
    }),
    // The account cards reach browser storage and the worker as they start;
    // tests of them build their own.
    get account(): OptionsPage['account'] {
      throw new Error('This Options view test has no account');
    },
    showToast,
    notifyNewtab,
    hideTooltip: vi.fn(),
    bindTooltips: vi.fn(),
    onSearchSourcesDrawn: vi.fn(),
    getViewportTopInset: () => 0,
    isMacPlatform: false,
    browserFamily: 'chromium',
    ...options.page
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(<OptionsPageContext.Provider value={page}>{view}</OptionsPageContext.Provider>);
  });
  mounted.push(() => {
    act(() => root.unmount());
    sourceOrder.destroy();
  });
  return { host, page, settings, writes: settings.writes, localWrites: settings.localWrites, sendMessage, showToast, notifyNewtab };
}

// Unmounts every view and puts the globals back.
function cleanUpOptionsViews(): void {
  mounted.splice(0).forEach((unmount) => unmount());
  document.body.textContent = '';
  vi.unstubAllGlobals();
}

export { cleanUpOptionsViews, renderOptionsView };
