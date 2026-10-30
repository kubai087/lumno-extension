// A New Tab whose shortcuts get their icons from the real worker service
// (background/favicon/shortcut-icons.ts) over a fake network, as the
// extension runs them: the page asks the worker, keeps the icon as a saved
// snapshot and edits it in the shortcut editor.
import { act } from 'react';
import { onTestFinished, vi } from 'vitest';
import enMessages from '../../../_locales/en/messages.json';
import { DEFAULTS } from '../../../src/domain/favicon/favicon-cache';
import { faviconEnhancedFetchEnabled, faviconRequestBlacklist } from '../../../src/domain/settings';
import { newtabShortcutFaviconCache } from '../../../src/domain/settings/newtab-shortcuts';
import { createShortcutStoragePlan } from '../../../src/domain/shortcuts/storage-plan';
import type { ShortcutIconSource } from '../../../src/domain/shortcuts/types';
import { normalizeCacheMap } from '../../../src/domain/favicon/shortcut-favicon/persisted';
import type { CachedIconMap } from '../../../src/domain/favicon/shortcut-favicon/types';
import { createBrowserFake, type BrowserFake } from '../../fakes/browser';
import { getElement, getTag } from '../../fakes/dom';
import { createFaviconNetwork, type FaviconNetwork, type FaviconNetworkOptions } from '../../fakes/favicon-network';
import { bootNewtab, settle } from './boot';

const SNAPSHOT_KEY = newtabShortcutFaviconCache.key;
const PERSISTED_DATA_KEY = DEFAULTS.faviconDataPersistStorageKey;
const CONTEXT_MENU = '#_x_extension_newtab_shortcut_context_menu_2026_unique__menu';
const TILE = '.x-nt-shortcut-tile[aria-label="Open Example"]';
const ICON_SOURCE_MENU = '#_x_extension_newtab_shortcut_dialog_2026_unique__icon_source_menu';

type IconService = typeof import('../../../src/background/favicon/shortcut-icons');

interface IconRequest {
  action?: unknown;
  pageUrl?: unknown;
  refresh?: unknown;
  iconSource?: unknown;
}

interface AcquisitionOptions extends FaviconNetworkOptions {
  enhanced?: boolean;
  excluded?: boolean;
}

interface Acquisition {
  network: FaviconNetwork;
  sync: Record<string, unknown>;
  service: IconService | null;
}

interface FrontendOptions {
  iconSource?: ShortcutIconSource;
  initialSnapshots?: CachedIconMap;
  persistedEntries?: Record<string, unknown>;
  // Keeps the page favicon cache read waiting until release().
  holdFaviconCache?: boolean;
}

function isIconRequest(value: unknown): value is IconRequest {
  return typeof value === 'object' && value !== null;
}

// The worker and its network, shared by every New Tab a test opens.
// `enhanced: false` turns enhanced fetching off; `excluded` adds chrome.com
// to the favicon request exclusions.
function createAcquisition(options: AcquisitionOptions = {}): Acquisition {
  return {
    network: createFaviconNetwork(options),
    sync: {
      [faviconEnhancedFetchEnabled.key]: options.enhanced !== false,
      ...(options.excluded ? { [faviconRequestBlacklist.key]: [{ pattern: 'chrome.com', matchModes: ['suffix'] }] } : {})
    },
    service: null
  };
}

function pageFetch(network: FaviconNetwork) {
  return async (url: string, init?: RequestInit) => (url.includes('/_locales/')
    ? { ok: true, json: async () => enMessages }
    : { ...(await network.fetch(url, init)), json: async () => ({}) });
}

function click(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
}

// Lets the page's timers run for `ms`, for checks that something did not
// happen.
async function pause(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
  await settle();
}

// Waits for the page to get there. A page's icon arrives through several
// timers and worker round trips, slower than boot.ts's waitFor allows when
// the machine is busy.
async function waitFor(check: () => boolean, message: string, timeoutMs = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(message);
    await pause(25);
  }
}

// The width a data: PNG's header names, as the browser reads it once the
// image is decoded; 0 for anything else.
function decodedWidth(image: HTMLImageElement): number {
  const src = image.getAttribute('src') || '';
  if (!src.startsWith('data:image/png;base64,')) return 0;
  const bytes = Buffer.from(src.slice(src.indexOf(',') + 1), 'base64');
  return bytes.length >= 24 ? bytes.readUInt32BE(16) : 0;
}

// JSDOM decodes no image, so a saved data: icon would never count as
// loaded and New Tab would give up on it once its load timeout passed. Here
// data: images decode at once, as they do in the browser.
let decodingDataImages = false;

function decodeDataImages(): void {
  if (decodingDataImages) return;
  decodingDataImages = true;
  const prototype = HTMLImageElement.prototype;
  const names = ['complete', 'naturalWidth', 'naturalHeight'];
  const original: Array<[string, PropertyDescriptor | undefined]> = names.map((name) => [name, Object.getOwnPropertyDescriptor(prototype, name)]);
  Object.defineProperty(prototype, 'complete', { configurable: true, get(this: HTMLImageElement) { return decodedWidth(this) > 0; } });
  Object.defineProperty(prototype, 'naturalWidth', { configurable: true, get(this: HTMLImageElement) { return decodedWidth(this); } });
  Object.defineProperty(prototype, 'naturalHeight', { configurable: true, get(this: HTMLImageElement) { return decodedWidth(this); } });
  onTestFinished(() => {
    original.forEach(([name, descriptor]) => {
      if (descriptor) Object.defineProperty(prototype, name, descriptor);
      else Reflect.deleteProperty(prototype, name);
    });
    decodingDataImages = false;
  });
}

// Each New Tab starts as in a fresh window: no markup, nothing in the
// window's own storage and no boot handoff from an earlier page.
function closeNewtab(): void {
  window.localStorage.clear();
  window.sessionStorage.clear();
  Reflect.deleteProperty(globalThis, '__lumnoBoot');
  document.head.replaceChildren();
  Array.from(document.documentElement.attributes).forEach((attribute) => document.documentElement.removeAttribute(attribute.name));
  document.body.replaceChildren();
  Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
  // boot.ts follows the listeners each boot adds; a second boot in one test
  // starts from the document's and the window's own methods again.
  [document.addEventListener, window.addEventListener].forEach((add) => {
    if (vi.isMockFunction(add)) add.mockRestore();
  });
}

// A New Tab with one shortcut "Example" to `pageUrl` that asks the
// acquisition's worker for its icon.
async function openFrontend(acquisition: Acquisition, pageUrl: string, options: FrontendOptions = {}) {
  closeNewtab();
  decodeDataImages();
  const shortcuts = createShortcutStoragePlan({
    items: [{ id: 's1', title: 'Example', url: pageUrl, ...(options.iconSource ? { iconSource: options.iconSource } : {}) }]
  });
  const local: Record<string, unknown> = {};
  if (options.initialSnapshots) local[SNAPSHOT_KEY] = options.initialSnapshots;
  if (options.persistedEntries) local[PERSISTED_DATA_KEY] = { version: 3, entries: options.persistedEntries };
  const browser: BrowserFake = createBrowserFake({ sync: { ...acquisition.sync, ...shortcuts.payload }, local });
  const fetch = pageFetch(acquisition.network);
  if (!acquisition.service) {
    vi.stubGlobal('chrome', browser);
    vi.stubGlobal('fetch', vi.fn(fetch));
    vi.resetModules();
    acquisition.service = await import('../../../src/background/favicon/shortcut-icons');
  }
  const service = acquisition.service;
  const requests: IconRequest[] = [];
  browser.runtime.sendMessage = vi.fn((message: unknown, callback?: (response: unknown) => void) => {
    const request = isIconRequest(message) ? message : {};
    const reply: Promise<unknown> = request.action === 'getShortcutFaviconData'
      ? service.fetchShortcutFaviconData(request.pageUrl, '', '', request.refresh === true, request.iconSource)
        .then((result) => result || { data: '', sourceUrl: '', width: 0, height: 0, vector: false })
      : Promise.resolve({ ok: true });
    if (request.action === 'getShortcutFaviconData') requests.push(request);
    if (callback) {
      void reply.then(callback);
      return undefined;
    }
    return reply;
  });
  let failWrites = false;
  const [, localSet] = [browser.storage.sync, browser.storage.local].map((area) => {
    const set = area.set;
    return vi.spyOn(area, 'set').mockImplementation((payload, callback) => {
      if (failWrites) throw new Error('QUOTA_BYTES quota exceeded');
      return set(payload, callback);
    });
  });
  let releaseCache: (() => void) | null = null;
  if (options.holdFaviconCache) {
    const area = browser.storage.local;
    const get = area.get;
    vi.spyOn(area, 'get').mockImplementation((keys, callback) => {
      const list = Array.isArray(keys) ? keys : [keys];
      if (!list.includes(PERSISTED_DATA_KEY)) return get(keys, callback);
      return new Promise<Record<string, unknown>>((resolve) => {
        releaseCache = () => {
          const answer = get(keys, callback);
          if (answer) void answer.then(resolve);
          else resolve({});
        };
      });
    });
  }
  await bootNewtab(browser, { fetch });
  await settle(20);

  const tile = () => getElement(document, TILE);
  const dialog = () => getElement(document, '.x-nt-shortcut-dialog-backdrop');
  // The saved snapshots, as a page reads them back.
  const snapshots = (): CachedIconMap => normalizeCacheMap(browser.storage.local.values[SNAPSHOT_KEY]);
  const tileIcon = () => {
    const image = tile().querySelector('img');
    const src = image ? image.getAttribute('src') || '' : '';
    return src.startsWith('data:') ? src : '';
  };

  return {
    browser,
    // The icon requests the page sent the worker.
    messages: () => requests,
    writes: () => localSet.mock.calls.filter(([payload]) => Object.hasOwn(payload, SNAPSHOT_KEY)).length,
    snapshots,
    tileIcon,
    waitForTileIcon: () => waitFor(() => tileIcon() !== '', 'The shortcut tile shows no saved icon'),
    waitForWrite: () => waitFor(() => localSet.mock.calls.some(([payload]) => Object.hasOwn(payload, SNAPSHOT_KEY)),
      'New Tab saved no shortcut icon'),
    async release() {
      await act(async () => {
        if (releaseCache) releaseCache();
      });
      await settle(20);
    },
    async removeShortcut() {
      // Another page saves the list without it, one key at a time.
      for (const [key, value] of Object.entries(createShortcutStoragePlan({ items: [] }).payload)) {
        await act(async () => browser.storage.sync.externalSet({ [key]: value }));
      }
      await waitFor(() => !document.querySelector(TILE), 'The removed shortcut is still drawn');
    },
    async openEditor() {
      await act(async () => {
        tile().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20, button: 2 }));
      });
      await settle();
      await act(async () => click(getElement(document, `${CONTEXT_MENU} [role="menuitem"][data-value="edit"]`)));
      await settle(20);
    },
    editorSource: () => getTag(dialog(), '.x-nt-shortcut-icon-source-select select', 'select').value,
    editorSources: () => Array.from(getTag(dialog(), '.x-nt-shortcut-icon-source-select select', 'select').options, (option) => option.value),
    // The icon the editor previews, or ''.
    editorIcon() {
      const image = dialog().querySelector('.x-nt-shortcut-icon-panel img');
      return image ? image.getAttribute('src') || '' : '';
    },
    async chooseSource(source: string) {
      const trigger = getElement(dialog(), '.x-nt-shortcut-icon-source-select button');
      if (trigger.getAttribute('aria-expanded') !== 'true') {
        await act(async () => trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
        await settle();
      }
      await act(async () => click(getElement(document, `${ICON_SOURCE_MENU} [role="option"][data-value="${source}"]`)));
      await settle(20);
    },
    async refresh() {
      await act(async () => getElement(dialog(), '.x-nt-shortcut-icon-refresh').dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })));
      await waitFor(() => requests.some((request) => request.refresh === true), 'The editor sent no refresh');
      await settle(20);
    },
    async setUrl(url: string) {
      const input = getTag(dialog(), 'input[inputmode="url"]', 'input');
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (setter && setter.set) setter.set.call(input, url);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await settle();
    },
    // Saves the editor; with `failing`, the shortcut write fails. Resolves
    // whether the editor closed.
    async save(failing: boolean) {
      failWrites = failing;
      await act(async () => getTag(dialog(), 'form', 'form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await settle(20);
      const backdrop = document.querySelector('.x-nt-shortcut-dialog-backdrop');
      return !backdrop || backdrop.getAttribute('data-open') === 'false' || backdrop.hasAttribute('hidden');
    }
  };
}

export { closeNewtab, createAcquisition, decodeDataImages, openFrontend, pause, waitFor };
export type { Acquisition };
