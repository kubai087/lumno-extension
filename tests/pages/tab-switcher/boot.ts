// Boots the real tab switcher on a page, as the worker injects it into a web
// page (src/shared/tab-switcher/tab-switcher-app.ts) or an extension page
// imports it with its page bridge, against an in-memory browser
// (tests/fakes/browser.ts). Each boot gets fresh module instances and runs
// on fake timers; keys reach the page as trusted input.
import { act } from 'react';
import { afterEach, vi } from 'vitest';
import { createBrowserFake, type BrowserFake, type FakeTab } from '../../fakes/browser';
import { getElements } from '../../fakes/dom';
import { parseCss } from '../../fakes/css';
import { trustedKey } from '../../fakes/trusted-events';

export const HOST_ID = '_x_extension_tab_switcher_host_2026_unique_';
export const PANEL_ID = '_x_extension_tab_switcher_panel_2026_unique_';
export const THEME_KEY = '_x_extension_theme_mode_2024_unique_';

type Values = Record<string, unknown>;

export interface SwitcherMessage {
  action: string;
  [key: string]: unknown;
}

export interface Viewport {
  width: number;
  height: number;
  scale: number;
  offsetLeft: number;
  offsetTop: number;
}

export interface TabSwitcherPageOptions {
  // browser.storage.sync values.
  sync?: Values;
  // <meta> tags added to the page's head (theme metadata).
  meta?: Array<{ name: string; content: string }>;
  darkSystem?: boolean;
  viewport?: Partial<Viewport>;
  // The worker's answer to a message; { ok: true } otherwise.
  respond?(message: SwitcherMessage): unknown;
  // Also run the extension pages' bridge (src/shared/tab-switcher/page-bridge.ts).
  bridge?: boolean;
  // The extension page's own tab, which chrome.tabs.getCurrent answers.
  currentTab?: { id: number; windowId: number };
}

interface ListenerEntry {
  label: string;
  type: string;
  listener: unknown;
  capture: boolean;
}

function isRecord(value: unknown): value is Values {
  return typeof value === 'object' && value !== null;
}

function readMessage(message: unknown): SwitcherMessage {
  const fields = isRecord(message) ? message : {};
  return { ...fields, action: typeof fields.action === 'string' ? fields.action : '' };
}

function captureOf(options: unknown): boolean {
  return typeof options === 'boolean' ? options : isRecord(options) && options.capture === true;
}

// Follows what a page target listens for, so a test can tell what a closed
// switcher left behind.
function trackListeners(target: Window | Document, label: string, active: ListenerEntry[]): void {
  const nativeAdd = target.addEventListener;
  const nativeRemove = target.removeEventListener;
  const indexOf = (entry: ListenerEntry) => active.findIndex((each) => each.label === entry.label &&
    each.type === entry.type && each.listener === entry.listener && each.capture === entry.capture);
  vi.spyOn(target, 'addEventListener').mockImplementation((type: string, listener: unknown, options?: unknown) => {
    const entry = { label, type, listener, capture: captureOf(options) };
    if (listener && indexOf(entry) < 0) {
      active.push(entry);
    }
    Reflect.apply(nativeAdd, target, [type, listener, options]);
  });
  vi.spyOn(target, 'removeEventListener').mockImplementation((type: string, listener: unknown, options?: unknown) => {
    const index = indexOf({ label, type, listener, capture: captureOf(options) });
    if (index >= 0) {
      active.splice(index, 1);
    }
    Reflect.apply(nativeRemove, target, [type, listener, options]);
  });
}

// Moves the page's clock on by `ms`, running what comes due, inside act().
export async function settle(ms = 10): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// Recent tabs as the worker sends them.
export function switcherTabs(count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    id: index + 1,
    windowId: 1,
    title: `Tab ${index + 1}`,
    url: `https://site${index + 1}.example.test/`
  }));
}

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length) {
    cleanups.pop()?.();
  }
});

export async function bootTabSwitcherPage(options: TabSwitcherPageOptions = {}) {
  vi.useFakeTimers();
  let live = true;
  const headBefore = new Set(Array.from(document.head.childNodes));
  (options.meta || []).forEach(({ name, content }) => {
    const meta = document.head.appendChild(document.createElement('meta'));
    meta.name = name;
    meta.content = content;
  });
  const browser: BrowserFake = createBrowserFake({ sync: options.sync || {} });

  const messages: SwitcherMessage[] = [];
  browser.runtime.sendMessage = vi.fn((sent: unknown, callback?: (response: unknown) => void): Promise<unknown> | undefined => {
    const message = readMessage(sent);
    messages.push(message);
    const answered = options.respond ? options.respond(message) : undefined;
    const response = answered === undefined ? { ok: true } : answered;
    setTimeout(() => {
      if (live) {
        act(() => callback?.(response));
      }
    }, 0);
    return Promise.resolve(response);
  });
  // The bridge's port to the worker, one per connect.
  const ports: ReturnType<typeof createPort>[] = [];
  const connect = vi.fn((info: unknown) => {
    const port = createPort(info);
    ports.push(port);
    return port.port;
  });
  const runtime: Values = browser.runtime;
  runtime.connect = connect;
  if (options.currentTab) {
    const currentTab: FakeTab = { index: 0, url: location.href, title: '', active: true, pinned: false, ...options.currentTab };
    browser.tabs.getCurrent = (callback?: (tab: FakeTab | undefined) => void) => {
      callback?.(currentTab);
      return undefined;
    };
  }

  const messageListeners = new Set<unknown>();
  const { onMessage } = browser.runtime;
  const fakeAddMessageListener = onMessage.addListener;
  const fakeRemoveMessageListener = onMessage.removeListener;
  onMessage.addListener = (listener) => {
    messageListeners.add(listener);
    return fakeAddMessageListener(listener);
  };
  onMessage.removeListener = (listener) => {
    messageListeners.delete(listener);
    return fakeRemoveMessageListener(listener);
  };

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

  // JSDOM has no visual viewport; the page gets one it can resize.
  const visualViewport = Object.assign(new EventTarget(),
    { width: 1024, height: 640, scale: 1, offsetLeft: 0, offsetTop: 0 }, options.viewport || {});
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport });
  vi.spyOn(window, 'innerWidth', 'get').mockImplementation(() => visualViewport.width);
  vi.spyOn(window, 'innerHeight', 'get').mockImplementation(() => visualViewport.height);

  // The switcher's shadow root is closed; keep it as it is attached.
  const shadowRoots = new Map<Element, ShadowRoot>();
  const nativeAttachShadow = Element.prototype.attachShadow;
  vi.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (this: Element, init: ShadowRootInit) {
    const root: ShadowRoot = Reflect.apply(nativeAttachShadow, this, [init]);
    shadowRoots.set(this, root);
    return root;
  });

  const activeListeners: ListenerEntry[] = [];
  trackListeners(window, 'window', activeListeners);
  trackListeners(document, 'document', activeListeners);

  vi.resetModules();
  const app = await import('../../../src/shared/tab-switcher/tab-switcher-app');
  const switcher = await import('../../../src/shared/tab-switcher/tab-switcher');
  if (options.bridge) {
    await import('../../../src/shared/tab-switcher/page-bridge');
  }
  await settle(0);

  const host = () => document.getElementById(HOST_ID);
  const shadow = () => {
    const found = host();
    return found ? shadowRoots.get(found) || null : null;
  };
  const cards = (): HTMLElement[] => {
    const root = shadow();
    return root ? getElements(root, '.x-tab-switcher-card') : [];
  };
  const reply = (run: () => unknown): unknown => {
    let answer: unknown = null;
    act(() => {
      answer = run();
    });
    return answer;
  };

  const page = {
    browser,
    messages,
    ports,
    connect,
    mediaListeners,
    // The runtime.onMessage listeners the page's modules added.
    messageListenerCount: () => messageListeners.size,
    visualViewport,
    host,
    shadow,
    cards,
    panel: () => shadow()?.getElementById(PANEL_ID) || null,
    selectedIndex: () => cards().findIndex((card) => card.getAttribute('data-active') === 'true'),
    // The worker's toggle command.
    open: (context: Values) => reply(() => app.run({ type: 'toggle', context })),
    // What an extension page calls itself.
    toggle: (context: Values) => reply(() => switcher.toggleTabSwitcher(context)),
    // A runtime message from the worker, and the answer the page gave.
    message(request: Values): unknown {
      let response: unknown;
      act(() => {
        browser.runtime.onMessage.fire(request, {}, (value: unknown) => {
          response = value;
        });
      });
      return response;
    },
    switches: () => messages.filter((message) => message.action === 'switchToTab'),
    lastSwitch(): SwitcherMessage | null {
      const switches = page.switches();
      return switches.length ? switches[switches.length - 1] : null;
    },
    // The window and document listeners added since the boot, by type.
    listenerCount: (type: string) => activeListeners.filter((entry) => entry.type === type).length,
    press(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
      let event = new KeyboardEvent('keydown');
      act(() => {
        event = trustedKey(document.body, 'keydown', { key, ...init });
      });
      return event;
    },
    release(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
      let event = new KeyboardEvent('keyup');
      act(() => {
        event = trustedKey(document.body, 'keyup', { key, ...init });
      });
      return event;
    },
    changeStorage(key: string, value: unknown, area: 'sync' | 'local' = 'sync') {
      act(() => {
        browser.storage[area].externalSet({ [key]: value });
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
    // The stylesheet the open switcher put in its shadow root; `#panel` in a
    // selector stands for the panel's id.
    styles() {
      const style = shadow()?.querySelector('style');
      const css = parseCss(style ? style.textContent || '' : '');
      const expand = (selector: string) => selector.replace(/#panel\b/g, `#${PANEL_ID}`);
      return {
        rule: (selector: string, condition?: string | RegExp) => css.rule(expand(selector), condition),
        selectors: () => css.selectors()
      };
    }
  };

  cleanups.push(() => {
    live = false;
    if (host()) {
      page.press('Escape');
      host()?.remove();
    }
    activeListeners.splice(0).forEach((entry) => {
      if (typeof entry.listener === 'function' || isRecord(entry.listener)) {
        const target = entry.label === 'window' ? window : document;
        Reflect.apply(target.removeEventListener, target, [entry.type, entry.listener, entry.capture]);
      }
    });
    Array.from(document.head.childNodes).filter((node) => !headBefore.has(node)).forEach((node) => node.remove());
    Array.from(document.documentElement.attributes).forEach((attribute) => document.documentElement.removeAttribute(attribute.name));
    Reflect.deleteProperty(window, 'visualViewport');
    Reflect.deleteProperty(document, 'fullscreenElement');
    Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
    Reflect.deleteProperty(globalThis, '__lumnoContent');
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  return page;
}

export type TabSwitcherPage = Awaited<ReturnType<typeof bootTabSwitcherPage>>;

// A port the bridge holds to the worker: what it posted, and the worker's
// side of it.
function createPort(info: unknown) {
  const sent: Values[] = [];
  const messageListeners: Array<(message: unknown) => void> = [];
  const disconnectListeners: Array<() => void> = [];
  return {
    info,
    sent,
    port: {
      name: isRecord(info) && typeof info.name === 'string' ? info.name : '',
      postMessage: (message: unknown) => sent.push(isRecord(message) ? structuredClone(message) : {}),
      onMessage: { addListener: (listener: (message: unknown) => void) => messageListeners.push(listener) },
      onDisconnect: { addListener: (listener: () => void) => disconnectListeners.push(listener) },
      disconnect() {}
    },
    deliver(message: Values) {
      act(() => {
        messageListeners.forEach((listener) => listener(message));
      });
    },
    disconnect() {
      act(() => {
        disconnectListeners.forEach((listener) => listener());
      });
    }
  };
}
