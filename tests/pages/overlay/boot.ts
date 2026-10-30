// Boots the real overlay on a web page, as the worker does with each toggle
// (src/overlay/overlay-app.ts), against an in-memory browser
// (tests/fakes/browser.ts), for tests of the whole overlay. Each boot gets
// fresh module instances and runs on fake timers: settle(ms) moves the page's
// clock on, and the timers and frames due by then run in order.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { afterEach, vi } from 'vitest';
import { createBrowserFake, type BrowserFake } from '../../fakes/browser';
import { REPO_ROOT } from '../../fakes/css';
import { FakeAnimation } from '../../fakes/animation';
import { getElements } from '../../fakes/dom';
import { dispatchTrusted, trustedKey } from '../../fakes/trusted-events';

export const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
export const OVERLAY_ID = '_x_extension_overlay_2024_unique_';
export const OVERLAY_INPUT_ID = '_x_extension_search_input_2024_unique_';
const CONTEXT_TOKEN_ATTRIBUTE = 'data-lumno-overlay-context-token';

type Values = Record<string, unknown>;

// A message the overlay sent the worker.
export interface OverlayMessage {
  action: string;
  [key: string]: unknown;
}

export interface OverlayPageOptions {
  // Stored settings, over the defaults (English, no motion, no open tabs
  // shown by default). Without `local` both storage areas hold them.
  settings?: Values;
  // browser.storage.local, when it holds values of its own.
  local?: Values;
  // The worker's answer to a message; undefined falls back to empty results.
  // A promise answers when it settles.
  respond?(message: OverlayMessage): unknown;
  // The host page's markup, put in place before the overlay loads.
  html?: string;
  userAgent?: string;
  // Whether prefers-color-scheme: dark matches.
  darkSystem?: boolean;
  // How long a storage read takes to answer.
  storageDelayMs?: number;
  // When the overlay's stylesheets load, in ms after it listens for them;
  // false (JSDOM's own behaviour) leaves them loading.
  stylesheetsLoad?: number | false;
}

// The keys of one storage read, and the area it read.
export interface StorageRead {
  area: string;
  keys: string[];
}

export interface RecordedAnimation {
  target: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
  animation: FakeAnimation;
}

interface ListenerEntry {
  label: string;
  type: string;
  listener: EventListenerOrEventListenerObject;
  capture: boolean;
}

const DEFAULT_SETTINGS: Values = {
  _x_extension_language_2024_unique_: 'en',
  _x_extension_motion_effects_enabled_2026_unique_: false,
  _x_extension_overlay_open_tabs_default_visible_2026_unique_: false
};

function isRecord(value: unknown): value is Values {
  return typeof value === 'object' && value !== null;
}

function readMessage(message: unknown): OverlayMessage {
  const fields = isRecord(message) ? message : {};
  return { ...fields, action: typeof fields.action === 'string' ? fields.action : '' };
}

function defaultAnswer(message: OverlayMessage): unknown {
  if (message.action === 'getSearchSuggestions') {
    return { suggestions: [] };
  }
  if (message.action === 'getSearchEngineSuggestions') {
    return { suggestions: Array.isArray(message.localSuggestions) ? message.localSuggestions : [], hasRemoteSuggestions: false };
  }
  if (message.action === 'getTabs') {
    return { tabs: [] };
  }
  return {};
}

function readKeys(keys: unknown, values: Values): string[] {
  if (typeof keys === 'string') {
    return [keys];
  }
  if (Array.isArray(keys)) {
    return keys.filter((key): key is string => typeof key === 'string');
  }
  return Object.keys(isRecord(keys) ? keys : values);
}

function captureOf(options: unknown): boolean {
  return typeof options === 'boolean' ? options : isRecord(options) && options.capture === true;
}

function isListener(value: unknown): value is EventListenerOrEventListenerObject {
  return typeof value === 'function' || (isRecord(value) && typeof value.handleEvent === 'function');
}

// Follows the listeners a page target has, so a test can tell what an
// overlay session left behind.
function trackListeners(target: Window | Document, label: string, active: ListenerEntry[]): void {
  const nativeAdd = target.addEventListener;
  const nativeRemove = target.removeEventListener;
  const indexOf = (entry: ListenerEntry) => active.findIndex((each) => each.label === entry.label &&
    each.type === entry.type && each.listener === entry.listener && each.capture === entry.capture);
  vi.spyOn(target, 'addEventListener').mockImplementation((type: string, listener: unknown, options?: unknown) => {
    if (isListener(listener)) {
      const entry = { label, type, listener, capture: captureOf(options) };
      if (indexOf(entry) < 0) {
        active.push(entry);
      }
    }
    Reflect.apply(nativeAdd, target, [type, listener, options]);
  });
  vi.spyOn(target, 'removeEventListener').mockImplementation((type: string, listener: unknown, options?: unknown) => {
    if (isListener(listener)) {
      const index = indexOf({ label, type, listener, capture: captureOf(options) });
      if (index >= 0) {
        active.splice(index, 1);
      }
    }
    Reflect.apply(nativeRemove, target, [type, listener, options]);
  });
}

function setPageHtml(html: string): void {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const copyAttributes = (from: Element, to: Element) => Array.from(from.attributes)
    .forEach((attribute) => to.setAttribute(attribute.name, attribute.value));
  copyAttributes(parsed.documentElement, document.documentElement);
  copyAttributes(parsed.body, document.body);
  Array.from(parsed.head.childNodes).forEach((node) => document.head.appendChild(document.importNode(node, true)));
  document.body.replaceChildren(...Array.from(parsed.body.childNodes, (node) => document.importNode(node, true)));
}

// Moves the page's clock on by `ms`, running what comes due, inside act().
export async function settle(ms = 30): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// Moves the clock on in small steps until check() holds; fails after
// `timeoutMs` of the page's time.
export async function waitFor(check: () => unknown, message: string, timeoutMs = 5000): Promise<void> {
  for (let waited = 0; waited <= timeoutMs; waited += 10) {
    if (check()) {
      return;
    }
    await settle(10);
  }
  throw new Error(message);
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length) {
    const cleanup = cleanups.pop();
    if (cleanup) {
      await cleanup();
    }
  }
});

export async function bootOverlayPage(options: OverlayPageOptions = {}) {
  vi.useFakeTimers();
  const headBefore = new Set(Array.from(document.head.childNodes));
  if (options.html) {
    setPageHtml(options.html);
  }
  // Answers that arrive after the test ended go nowhere.
  let live = true;
  const settings: Values = { ...DEFAULT_SETTINGS, ...(options.settings || {}) };
  const browser: BrowserFake = createBrowserFake({ sync: settings, local: options.local || {} });
  if (!options.local) {
    browser.storage.local = browser.storage.sync;
  }

  const storageReads: StorageRead[] = [];
  const storageWrites: Values[] = [];
  const delay = Number(options.storageDelayMs) || 0;
  const followStorage = (area: typeof browser.storage.sync, name: string) => {
    const fakeGet = area.get;
    const fakeSet = area.set;
    area.get = (keys: unknown, callback?: (result: Values) => void) => {
      storageReads.push({ area: name, keys: readKeys(keys, area.values) });
      return new Promise<Values>((resolve) => {
        setTimeout(() => {
          void Promise.resolve(fakeGet(keys)).then((result) => {
            const values = result || {};
            if (live) {
              callback?.(values);
            }
            resolve(values);
          });
        }, delay);
      });
    };
    area.set = (payload: Values, callback?: () => void) => {
      storageWrites.push(structuredClone(payload));
      return fakeSet(payload, callback);
    };
  };
  followStorage(browser.storage.sync, 'sync');
  if (options.local) {
    followStorage(browser.storage.local, 'local');
  }

  const storageListeners = new Set<unknown>();
  const { onChanged } = browser.storage;
  const fakeAddChange = onChanged.addListener;
  const fakeRemoveChange = onChanged.removeListener;
  onChanged.addListener = (listener) => {
    storageListeners.add(listener);
    return fakeAddChange(listener);
  };
  onChanged.removeListener = (listener) => {
    storageListeners.delete(listener);
    return fakeRemoveChange(listener);
  };

  const messages: OverlayMessage[] = [];
  browser.runtime.sendMessage = vi.fn((sent: unknown, callback?: (response: unknown) => void): Promise<unknown> | undefined => {
    const message = readMessage(sent);
    messages.push(message);
    const answered = options.respond ? options.respond(message) : undefined;
    const response = Promise.resolve(answered === undefined ? defaultAnswer(message) : answered);
    void response.then((value) => live && setTimeout(() => live && callback?.(value), 0));
    return response;
  });

  const mediaListeners = new Set<unknown>();
  let systemDark = Boolean(options.darkSystem);
  vi.stubGlobal('chrome', browser);
  vi.stubGlobal('matchMedia', (media: string) => ({
    get matches() {
      return systemDark && /prefers-color-scheme:\s*dark/.test(media);
    },
    media,
    onchange: null,
    addEventListener: (_type: string, listener: unknown) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: unknown) => mediaListeners.delete(listener),
    addListener: (listener: unknown) => mediaListeners.add(listener),
    removeListener: (listener: unknown) => mediaListeners.delete(listener),
    dispatchEvent: () => true
  }));
  // The overlay reads only its own packaged files.
  vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'chrome-extension:') {
      throw new Error(`The overlay fetched ${String(url)}, outside the extension.`);
    }
    const file = join(REPO_ROOT, decodeURIComponent(parsed.pathname));
    if (!existsSync(file)) {
      return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    }
    const text = readFileSync(file, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(text), text: async () => text };
  }));
  if (options.userAgent) {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(options.userAgent);
  }

  if (options.stylesheetsLoad !== undefined && options.stylesheetsLoad !== false) {
    const loadAfter = options.stylesheetsLoad;
    const scheduled = new WeakSet<HTMLLinkElement>();
    const nativeAdd = HTMLLinkElement.prototype.addEventListener;
    vi.spyOn(HTMLLinkElement.prototype, 'addEventListener').mockImplementation(function (
      this: HTMLLinkElement, type: string, listener: unknown, listenerOptions?: unknown
    ) {
      Reflect.apply(nativeAdd, this, [type, listener, listenerOptions]);
      if (type === 'load' && this.rel === 'stylesheet' && !scheduled.has(this)) {
        scheduled.add(this);
        setTimeout(() => this.dispatchEvent(new Event('load')), loadAfter);
      }
    });
  }

  // Web Animations, which JSDOM lacks, recorded as the overlay plays them.
  const animations: RecordedAnimation[] = [];
  const animateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
  Element.prototype.animate = function (this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
    animationOptions?: number | KeyframeAnimationOptions) {
    const animation = new FakeAnimation();
    animations.push({
      target: this,
      keyframes: Array.isArray(keyframes) ? structuredClone(keyframes) : [],
      options: typeof animationOptions === 'object' ? structuredClone(animationOptions) : { duration: animationOptions },
      animation
    });
    return animation;
  };

  vi.resetModules();
  // The settings storage runtime keeps one storage-mode listener for the
  // page's lifetime; made up front, it is part of the page, not a session.
  const providerStorage = await import('../../../src/platform/provider-storage');
  providerStorage.createProviderStorageRuntime(browser);
  const app = await import('../../../src/overlay/overlay-app');
  const shell = await import('../../../src/overlay/react/shell');
  await settle();
  const baselineStorageListeners = new Set(storageListeners);

  const activeListeners: ListenerEntry[] = [];
  trackListeners(window, 'window', activeListeners);
  trackListeners(document, 'document', activeListeners);

  const panel = () => shell.findOverlayPanel(document);
  const root = (): ShadowRoot | null => {
    const found = panel();
    const node = found ? found.getRootNode() : null;
    return node instanceof ShadowRoot ? node : null;
  };
  const input = (): HTMLInputElement | null => {
    const found = root()?.getElementById(OVERLAY_INPUT_ID);
    return found instanceof HTMLInputElement ? found : null;
  };
  const host = () => document.getElementById(OVERLAY_HOST_ID);

  const run = (command: unknown) => {
    let reply: unknown = null;
    act(() => {
      reply = app.run(command);
    });
    return reply;
  };
  // context.tabs is the open-tab list the worker passes along.
  const toggle = (context: Values = {}) => {
    const { tabs, ...rest } = context;
    return run({
      type: 'toggle',
      tabs: Array.isArray(tabs) ? tabs : [],
      context: { currentTabId: 1, currentTabUrl: location.href, ...rest }
    });
  };

  const page = {
    browser,
    settings,
    messages,
    storageReads,
    storageWrites,
    animations,
    mediaListeners,
    run,
    toggle,
    host,
    panel,
    root,
    input,
    hostCount: () => document.querySelectorAll(`#${OVERLAY_HOST_ID}`).length,
    // What the overlay tells the worker in the content registry.
    overlayOpen: (): unknown => {
      const registry: unknown = Reflect.get(globalThis, '__lumnoContent');
      return isRecord(registry) ? registry.overlayOpen : undefined;
    },
    // The window and document listeners added since the boot, as
    // "window:keydown:capture".
    listeners: () => activeListeners
      .filter((entry) => !(entry.label === 'document' && entry.type === 'selectionchange'))
      .map((entry) => `${entry.label}:${entry.type}${entry.capture ? ':capture' : ''}`)
      .sort(),
    // chrome.storage.onChanged listeners added since the boot.
    sessionStorageListenerCount: () => Array.from(storageListeners)
      .filter((listener) => !baselineStorageListeners.has(listener)).length,
    // A stored setting changed by another page or Settings.
    changeSetting(key: string, value: unknown, area: 'sync' | 'local' = 'sync') {
      act(() => {
        (area === 'local' ? browser.storage.local : browser.storage.sync).externalSet({ [key]: value });
      });
    },
    setSystemDark(dark: boolean) {
      systemDark = dark;
      act(() => {
        mediaListeners.forEach((listener) => {
          if (typeof listener === 'function') {
            Reflect.apply(listener, undefined, [{ matches: dark, media: '(prefers-color-scheme: dark)' }]);
          }
        });
      });
    },
    // Marks the mounted overlay as one an earlier extension context left in
    // the page, which the next toggle replaces instead of closing.
    markOverlayFromOtherContext() {
      [host(), panel()].forEach((element) => element?.setAttribute(CONTEXT_TOKEN_ATTRIBUTE, 'earlier-context'));
    },
    // Opens the overlay and waits until its input has focus.
    async open(context: Values = {}): Promise<ShadowRoot> {
      toggle(context);
      await waitFor(() => {
        const shadow = root();
        return shadow !== null && shadow.activeElement !== null && shadow.activeElement === input();
      }, 'the overlay did not finish opening');
      await settle();
      const shadow = root();
      if (!shadow) {
        throw new Error('the overlay closed while opening');
      }
      return shadow;
    },
    async type(query: string) {
      const field = input();
      if (!field) {
        throw new Error('the overlay has no input to type into');
      }
      act(() => {
        field.value = query;
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await settle(60);
    },
    suggestions: (): HTMLElement[] => {
      const shadow = root();
      return shadow ? getElements(shadow, '.x-ov-suggestion-item') : [];
    },
    // A trusted key press at the focused element, as the keyboard gives it.
    press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
      const target = root()?.activeElement || document.activeElement || document.body;
      let event = new KeyboardEvent('keydown');
      act(() => {
        event = trustedKey(target, 'keydown', { key, ...init });
      });
      return event;
    },
    // A trusted event at any element, along its composed path.
    trusted<E extends Event>(target: EventTarget, event: E): E {
      act(() => {
        dispatchTrusted(target, event);
      });
      return event;
    }
  };

  cleanups.push(async () => {
    // Close what is still open, so its observers and listeners go with it.
    // An open scope panel takes the first toggle, so this may take a few;
    // the clock runs async so the worker's answers to the close arrive while
    // chrome is still in place.
    for (let attempt = 0; attempt < 3 && host(); attempt += 1) {
      try {
        await act(async () => {
          toggle();
          await vi.advanceTimersByTimeAsync(2000);
        });
      } catch {
        break;
      }
    }
    host()?.remove();
    activeListeners.splice(0).forEach((entry) => {
      const target = entry.label === 'window' ? window : document;
      target.removeEventListener(entry.type, entry.listener, entry.capture);
    });
    Array.from(document.head.childNodes).filter((node) => !headBefore.has(node)).forEach((node) => node.remove());
    Array.from(document.documentElement.attributes).forEach((attribute) => document.documentElement.removeAttribute(attribute.name));
    Array.from(document.body.attributes).forEach((attribute) => document.body.removeAttribute(attribute.name));
    Reflect.deleteProperty(globalThis, '__lumnoContent');
    if (animateDescriptor) {
      Object.defineProperty(Element.prototype, 'animate', animateDescriptor);
    } else {
      Reflect.deleteProperty(Element.prototype, 'animate');
    }
    live = false;
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  return page;
}

export type OverlayPage = Awaited<ReturnType<typeof bootOverlayPage>>;

// The suggestion a result row stands for.
export function suggestionOf(row: Element): Values {
  const suggestion: unknown = Reflect.get(row, '_xSuggestion');
  return isRecord(suggestion) ? suggestion : {};
}

// The provider list the worker passes the overlay on open.
export function bundledSiteSearchProviders(): unknown[] {
  const data: unknown = JSON.parse(readFileSync(join(REPO_ROOT, 'assets/data/site-search.json'), 'utf8'));
  return isRecord(data) && Array.isArray(data.items) ? data.items : [];
}

// A click as the pointer gives it.
export function click(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
  });
}
