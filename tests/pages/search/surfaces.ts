// The two search surfaces, the overlay on a web page and the New Tab page,
// booted for real (tests/pages/overlay/boot.ts, tests/pages/newtab/boot.ts)
// behind one interface, so a search behaviour can be checked on both.
//
//   const surface = await openSearchSurface('overlay' | 'newtab', options);
//   await surface.type('dev app');
//   surface.press('Enter');
//   await surface.settle(120);
//   surface.navigation()   { url } or { search } the surface asked for
//
// The overlay runs on fake timers and the New Tab on real ones; settle(ms)
// lets that much of the surface's time pass either way.
import { act } from 'react';
import { afterEach, vi } from 'vitest';
import { createBrowserFake, type FakeTab } from '../../fakes/browser';
import { getElements } from '../../fakes/dom';
import { fetchPackaged } from '../../fakes/packaged-fetch';
import { dispatchTrusted, trustedKey } from '../../fakes/trusted-events';
import { bootReadyNewtab, settle as settleNewtab, waitFor as waitForNewtab } from '../newtab/boot';
import { bootOverlayPage, bundledSiteSearchProviders } from '../overlay/boot';

export type SurfaceName = 'overlay' | 'newtab';
export const SURFACES: readonly SurfaceName[] = ['overlay', 'newtab'];

const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
const NEWTAB_INPUT_ID = '_x_extension_newtab_search_input_2024_unique_';
const NEWTAB_TOAST_ID = '_x_extension_toast_2024_unique_';
const OVERLAY_INPUT_ID = '_x_extension_search_input_2024_unique_';

type Values = Record<string, unknown>;

// A message the surface sent the worker.
export interface SurfaceMessage {
  action: string;
  [key: string]: unknown;
}

export interface SurfaceOptions {
  // Stored settings over each surface's defaults (English, no motion).
  settings?: Values;
  // browser.storage.local, for what a surface keeps on this device.
  local?: Values;
  // The worker's answer to a message; undefined gives the empty answers.
  respond?(message: SurfaceMessage): unknown;
  userAgent?: string;
  // navigator.platform on the New Tab ('MacIntel' unless given).
  platform?: string;
  // Whether the overlay's page prefers a dark color scheme.
  darkSystem?: boolean;
  // What the worker passes the overlay as it opens: the window's tabs and
  // more; the bundled site searches unless given.
  openContext?: Values;
}

export type Navigation = { url: unknown } | { search: unknown } | null;

function isRecord(value: unknown): value is Values {
  return typeof value === 'object' && value !== null;
}

function readMessage(message: unknown): SurfaceMessage {
  const fields = isRecord(message) ? message : {};
  return { ...fields, action: typeof fields.action === 'string' ? fields.action : '' };
}

// The worker's answers when a test gives none, as the New Tab expects them.
function defaultAnswer(message: SurfaceMessage): unknown {
  if (message.action === 'getSearchSuggestions') return { suggestions: [] };
  if (message.action === 'getSearchEngineSuggestions') {
    return { suggestions: Array.isArray(message.localSuggestions) ? message.localSuggestions : [], hasRemoteSuggestions: false };
  }
  if (message.action === 'getTabs') return { tabs: [] };
  return { ok: true };
}

// A test that ends with the overlay's scope panel open leaves a host the
// boot's own clean-up does not close in time; the next test's toggle would
// close that instead of opening. Every host goes first.
afterEach(() => {
  document.querySelectorAll(`#${OVERLAY_HOST_ID}`).forEach((host) => host.remove());
});

// The suggestion a result row stands for.
export function suggestionOf(row: Element): Values {
  const suggestion: unknown = Reflect.get(row, '_xSuggestion');
  return isRecord(suggestion) ? suggestion : {};
}

interface Backend {
  root(): ShadowRoot | Document;
  input(): HTMLInputElement;
  activeElement(): Element | null;
  messages: SurfaceMessage[];
  settle(ms: number): Promise<void>;
  waitFor(check: () => unknown, message: string): Promise<void>;
  navigation(): Navigation;
  toast(): Element | null;
  // A stored setting changed by another page or Settings.
  changeSetting(key: string, value: unknown): void;
  rowSelector: string;
}

async function openOverlay(options: SurfaceOptions): Promise<Backend> {
  const page = await bootOverlayPage({
    settings: options.settings,
    local: options.local,
    respond: options.respond,
    userAgent: options.userAgent,
    darkSystem: options.darkSystem,
    stylesheetsLoad: 5
  });
  const root = await page.open({ siteSearchProviders: bundledSiteSearchProviders(), ...(options.openContext || {}) });
  return {
    root: () => root,
    input: () => {
      const input = root.getElementById(OVERLAY_INPUT_ID);
      if (!(input instanceof HTMLInputElement)) throw new Error('The overlay has no search input.');
      return input;
    },
    activeElement: () => root.activeElement,
    messages: page.messages,
    async settle(ms) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    },
    async waitFor(check, message) {
      for (let waited = 0; waited <= 5000; waited += 10) {
        if (check()) return;
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10);
        });
      }
      throw new Error(message);
    },
    navigation() {
      const last = page.messages.slice().reverse().find((message) => message.action === 'createTab' || message.action === 'searchOrNavigate');
      if (!last) return null;
      return last.action === 'createTab' ? { url: last.url } : { search: last.query };
    },
    toast: () => root.querySelector('.x-lumno-toast'),
    changeSetting: (key, value) => page.changeSetting(key, value),
    rowSelector: '.x-ov-suggestion-item'
  };
}

async function openNewtab(options: SurfaceOptions): Promise<Backend> {
  const browser = createBrowserFake({
    sync: {
      _x_extension_language_2024_unique_: 'en',
      _x_extension_motion_effects_enabled_2026_unique_: false,
      ...(options.settings || {})
    },
    local: options.local
  });
  const messages: SurfaceMessage[] = [];
  browser.runtime.sendMessage = vi.fn((sent: unknown, callback?: (response: unknown) => void): Promise<unknown> | undefined => {
    const message = readMessage(sent);
    messages.push(message);
    const answered = options.respond ? options.respond(message) : undefined;
    const response = Promise.resolve(answered === undefined ? defaultAnswer(message) : answered);
    if (callback) {
      void response.then((value) => setTimeout(() => callback(value), 0));
      return undefined;
    }
    return response;
  });
  // The New Tab's own tab, which the window's tab list leaves out.
  browser.tabs.getCurrent = (callback?: (tab: FakeTab | undefined) => void) => {
    const tab: FakeTab = { id: 42, windowId: 1, index: 0, url: 'chrome-extension://lumno/newtab.html', title: 'New Tab', active: true, pinned: false };
    if (!callback) return Promise.resolve(tab);
    setTimeout(() => callback(tab), 0);
    return undefined;
  };
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(options.platform || 'MacIntel');
  if (options.userAgent) {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(options.userAgent);
  }
  await bootReadyNewtab(browser, { fetch: fetchPackaged });
  const input = () => {
    const found = document.getElementById(NEWTAB_INPUT_ID);
    if (!(found instanceof HTMLInputElement)) throw new Error('The New Tab has no search input.');
    return found;
  };
  await act(async () => {
    input().focus();
  });
  const arg = (call: unknown[], index: number): Values => {
    const value = call[index];
    return isRecord(value) ? value : {};
  };
  return {
    root: () => document,
    input,
    activeElement: () => document.activeElement,
    messages,
    async settle(ms) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
      });
      await settleNewtab(2);
    },
    waitFor: (check, message) => waitForNewtab(() => Boolean(check()), message),
    navigation() {
      const searches = browser.search.query.mock.calls;
      const lastSearch = searches[searches.length - 1];
      if (lastSearch) return { search: arg(lastSearch, 0).text };
      const opened = browser.tabs.update.mock.calls.map((call) => arg(call, 1))
        .concat(browser.tabs.create.mock.calls.map((call) => arg(call, 0)));
      const last = opened[opened.length - 1];
      return last ? { url: last.url } : null;
    },
    toast: () => document.getElementById(NEWTAB_TOAST_ID),
    changeSetting(key, value) {
      act(() => {
        browser.storage.sync.externalSet({ [key]: value });
      });
    },
    rowSelector: '.x-nt-suggestion-item'
  };
}

export async function openSearchSurface(name: SurfaceName, options: SurfaceOptions = {}) {
  const backend = name === 'overlay' ? await openOverlay(options) : await openNewtab(options);
  const prefix = () => backend.root().querySelector('[data-search-input-mode-prefix]');
  const surface = {
    name,
    root: backend.root,
    input: backend.input,
    messages: backend.messages,
    settle: (ms = 30) => backend.settle(ms),
    waitFor: backend.waitFor,
    navigation: backend.navigation,
    changeSetting: backend.changeSetting,
    async type(query: string): Promise<void> {
      const input = backend.input();
      act(() => {
        input.focus();
        input.value = query;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await backend.settle(60);
    },
    // A trusted key event at the focused element (or init.target), heard by
    // every listener along its path, the page window included.
    key(type: 'keydown' | 'keyup', key: string, init: KeyboardEventInit & { target?: EventTarget } = {}): KeyboardEvent {
      const { target, ...rest } = init;
      const at = target || backend.activeElement() || backend.input();
      let event = new KeyboardEvent(type);
      act(() => {
        event = trustedKey(at, type, { key, ...rest });
      });
      return event;
    },
    press: (key: string, init: KeyboardEventInit & { target?: EventTarget } = {}) => surface.key('keydown', key, init),
    keyup: (key: string, init: KeyboardEventInit & { target?: EventTarget } = {}) => surface.key('keyup', key, init),
    // A trusted event at any element, along its composed path.
    trusted<E extends Event>(target: EventTarget, event: E): E {
      act(() => {
        dispatchTrusted(target, event);
      });
      return event;
    },
    click(element: Element): void {
      act(() => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, button: 0 }));
      });
    },
    suggestions: (): HTMLElement[] => getElements(backend.root(), backend.rowSelector),
    // The index of the highlighted result, or -1.
    selectedIndex: () => surface.suggestions().findIndex((row) => row.getAttribute('data-row-state') === 'active'),
    scopeMenuOpen: () => prefix()?.getAttribute('data-menu-open') === 'true',
    // A click that lands before the surface has wired its scope button does
    // nothing, so the surface settles first and a click that opened nothing
    // is repeated.
    async openScopeMenu(): Promise<void> {
      await backend.settle(0);
      for (let attempt = 0; attempt < 3 && !surface.scopeMenuOpen(); attempt += 1) {
        const button = backend.root().querySelector('[data-search-scope-action="true"]');
        if (button) surface.click(button);
        await backend.settle(30);
      }
      await backend.waitFor(() => surface.scopeMenuOpen(), `the ${name} scope menu did not open`);
    },
    async chooseScope(modeId: string): Promise<void> {
      if (!surface.scopeMenuOpen()) {
        await surface.openScopeMenu();
      }
      const find = () => backend.root().querySelector(`[data-mode-id="${modeId}"]`);
      await backend.waitFor(find, `the ${name} scope menu did not list ${modeId}`);
      const option = find();
      if (option) surface.click(option);
      await backend.settle(80);
    },
    // The visible name of the active scope tag; the prefix keeps a hidden
    // "current" label for assistive technology after it.
    scopeLabel(): string {
      const label = prefix()?.querySelector('[data-search-input-mode-prefix-text]');
      return label ? String(label.textContent || '').trim() : '';
    },
    toast() {
      const element = backend.toast();
      return { shown: element?.getAttribute('data-show') === 'true', text: element ? String(element.textContent || '').trim() : '' };
    }
  };
  return surface;
}

export type SearchSurface = Awaited<ReturnType<typeof openSearchSurface>>;
