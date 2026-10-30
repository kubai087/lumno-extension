// An in-memory browser for the service worker's modules: tabs and windows,
// tab groups, scripting, runtime messaging, commands, context menus, alarms,
// the toolbar action, storage areas and the worker's fetch. Every call a
// module makes into it is a vi.fn a test can read; events are fired from the
// test. installWorkerFake puts it in place of the worker's globals before a
// module is imported; bootWorker imports the worker entry (background.ts) the
// way the browser starts it.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pinyin } from 'pinyin-pro';
import { afterEach, vi } from 'vitest';
import { publishWorkerLazyModule } from '../../src/platform/worker-lazy';
import manifest from '../../manifest.json';

type StorageValues = Record<string, unknown>;
type StorageChanges = Record<string, { newValue?: unknown; oldValue?: unknown }>;
type StorageKeys = string | string[] | StorageValues | null | undefined;

const EXTENSION_ORIGIN = 'chrome-extension://lumno-test';
const REPO_ROOT = resolve(import.meta.dirname, '..', '..');

// A tab as the fake answers it: what a test leaves out reads as Chrome's
// defaults for an ordinary loaded tab.
type WorkerTab = Partial<chrome.tabs.Tab> & { id: number };

interface WorkerWindow {
  id: number;
  type?: string;
  focused?: boolean;
  incognito?: boolean;
  state?: string;
}

interface WorkerTabGroup {
  id: number;
  windowId: number;
  title?: string;
  color?: string;
  collapsed?: boolean;
}

interface FakeResponse {
  ok: boolean;
  status: number;
  url?: string;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
  blob?(): Promise<Blob>;
  arrayBuffer?(): Promise<ArrayBuffer>;
}

type FetchHandler = (url: string, init?: RequestInit) => Promise<FakeResponse> | FakeResponse;

interface AreaOptions {
  // While held, reads wait as they do while a freshly woken worker's browser
  // is still reading storage; release() lets them through.
  hold?: boolean;
}

interface WorkerFakeOptions {
  sync?: StorageValues;
  local?: StorageValues;
  session?: StorageValues;
  storage?: { sync?: AreaOptions; local?: AreaOptions; session?: AreaOptions };
  tabs?: WorkerTab[];
  windows?: WorkerWindow[];
  tabGroups?: WorkerTabGroup[];
  commands?: { name: string; shortcut?: string; description?: string }[];
  version?: string;
  os?: string;
  uiLanguage?: string;
  manifest?: Record<string, unknown>;
  // Answers the worker's fetches. By default the worker reads its own
  // packaged files (chrome-extension:// URLs) and every other request fails.
  fetch?: FetchHandler;
}

// The options argument a call may take before its callback.
interface CallOptions {
  [option: string]: unknown;
}

type Listener<Args extends unknown[]> = (...args: Args) => unknown;

// A browser event a test fires; fire answers what each listener returned.
interface FakeEvent<Args extends unknown[]> {
  listeners: Listener<Args>[];
  // What each listener was added with after itself (a webRequest filter).
  addedWith: Map<Listener<Args>, unknown[]>;
  addListener(listener: Listener<Args>, ...details: unknown[]): void;
  removeListener(listener: Listener<Args>): void;
  hasListener(listener: Listener<Args>): boolean;
  hasListeners(): boolean;
  fire(...args: Args): unknown[];
}

function createEvent<Args extends unknown[]>(): FakeEvent<Args> {
  const listeners: Listener<Args>[] = [];
  const addedWith = new Map<Listener<Args>, unknown[]>();
  return {
    listeners,
    addedWith,
    addListener(listener, ...details) {
      listeners.push(listener);
      addedWith.set(listener, details);
    },
    removeListener(listener) {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
      addedWith.delete(listener);
    },
    hasListener: (listener) => listeners.includes(listener),
    hasListeners: () => listeners.length > 0,
    fire: (...args) => listeners.slice().map((listener) => listener(...args))
  };
}

function copy<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

function isCallback(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === 'function';
}

function readKeys(keys: StorageKeys, values: StorageValues): string[] {
  if (keys === null || keys === undefined) return Object.keys(values);
  if (typeof keys === 'string') return [keys];
  if (Array.isArray(keys)) return keys;
  return Object.keys(keys);
}

type MessageSender = chrome.runtime.MessageSender;
type MessageListenerArgs = [message: unknown, sender: MessageSender, sendResponse: (response?: unknown) => void];

function noLastError(): chrome.runtime.LastError | null {
  return null;
}

function createWorkerFake(options: WorkerFakeOptions = {}) {
  const tabs: WorkerTab[] = (options.tabs || []).map((tab) => ({ ...tab }));
  const windows: WorkerWindow[] = (options.windows || [{ id: 1, type: 'normal', focused: true, incognito: false }])
    .map((window) => ({ ...window }));
  const tabGroups: WorkerTabGroup[] = (options.tabGroups || []).map((group) => ({ ...group }));
  const storageChanged = createEvent<[changes: StorageChanges, areaName: string]>();
  let nextTabId = 9000;

  const runtime = {
    id: 'lumno-test',
    lastError: noLastError(),
    getURL: vi.fn((path: string) => `${EXTENSION_ORIGIN}/${String(path || '').replace(/^\//, '')}`),
    getManifest: vi.fn(() => ({
      manifest_version: 3,
      name: 'Lumno',
      version: options.version || manifest.version,
      ...(options.manifest || {})
    })),
    getPlatformInfo: vi.fn((callback?: (info: { os: string }) => void) => answer({ os: options.os || 'mac' }, callback)),
    sendMessage: vi.fn((_message: unknown, callback?: (response: unknown) => void) => answer(undefined, callback)),
    setUninstallURL: vi.fn((_url: string, callback?: () => void) => answer(undefined, callback)),
    openOptionsPage: vi.fn((callback?: () => void) => answer(undefined, callback)),
    reload: vi.fn(),
    onMessage: createEvent<MessageListenerArgs>(),
    onMessageExternal: createEvent<MessageListenerArgs>(),
    onInstalled: createEvent<[details: { reason: string; previousVersion?: string }]>(),
    onStartup: createEvent<[]>(),
    onSuspend: createEvent<[]>(),
    onConnect: createEvent<[port: unknown]>()
  };

  // Answers through the callback after the current task, as Chrome does, or
  // through a promise without one.
  function answer<T>(value: T, callback?: (value: T) => void): Promise<T> | undefined {
    if (isCallback(callback)) {
      setTimeout(() => callback(value), 0);
      return undefined;
    }
    return Promise.resolve(value);
  }

  // Answers with runtime.lastError set during the callback, or a rejection.
  function fail<T>(message: string, callback?: (value: T | undefined) => void): Promise<T> | undefined {
    if (isCallback(callback)) {
      setTimeout(() => {
        runtime.lastError = { message };
        try {
          callback(undefined);
        } finally {
          runtime.lastError = null;
        }
      }, 0);
      return undefined;
    }
    return Promise.reject(new Error(message));
  }

  function createArea(name: string, initial: StorageValues | undefined, areaOptions: AreaOptions = {}) {
    const values: StorageValues = copy({ ...(initial || {}) });
    const pending: (() => void)[] = [];
    const emit = (changes: StorageChanges) => {
      if (Object.keys(changes).length) storageChanged.fire(changes, name);
    };
    const write = (payload: StorageValues): StorageChanges => {
      const changes: StorageChanges = {};
      Object.entries(copy(payload)).forEach(([key, value]) => {
        changes[key] = { newValue: value, oldValue: values[key] };
        values[key] = value;
      });
      return changes;
    };
    const area = {
      values,
      held: areaOptions.hold === true,
      // Lets reads made while held through, in order.
      release() {
        area.held = false;
        pending.splice(0).forEach((run) => run());
      },
      get: vi.fn((keys: StorageKeys, callback?: (items: StorageValues) => void) => {
        const read = () => {
          const items: StorageValues = {};
          readKeys(keys, values).forEach((key) => {
            if (Object.hasOwn(values, key)) {
              items[key] = copy(values[key]);
            } else if (keys && typeof keys === 'object' && !Array.isArray(keys)) {
              items[key] = keys[key];
            }
          });
          return items;
        };
        if (!area.held) return answer(read(), callback);
        return new Promise<StorageValues>((done) => {
          pending.push(() => {
            const items = read();
            if (isCallback(callback)) setTimeout(() => callback(items), 0);
            done(items);
          });
        });
      }),
      set: vi.fn((payload: StorageValues, callback?: () => void) => {
        const changes = write(payload);
        setTimeout(() => emit(changes), 0);
        return answer(undefined, callback);
      }),
      remove: vi.fn((keys: string | string[], callback?: () => void) => {
        const changes: StorageChanges = {};
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
          if (Object.hasOwn(values, key)) {
            changes[key] = { oldValue: values[key] };
            delete values[key];
          }
        });
        setTimeout(() => emit(changes), 0);
        return answer(undefined, callback);
      }),
      clear: vi.fn((callback?: () => void) => {
        const changes: StorageChanges = {};
        Object.keys(values).forEach((key) => {
          changes[key] = { oldValue: values[key] };
          delete values[key];
        });
        setTimeout(() => emit(changes), 0);
        return answer(undefined, callback);
      }),
      getBytesInUse: vi.fn((_keys: StorageKeys, callback?: (bytes: number) => void) => answer(0, callback)),
      setAccessLevel: vi.fn((_options: { accessLevel: string }) => Promise.resolve()),
      // A change another context made.
      externalSet(payload: StorageValues) {
        emit(write(payload));
      }
    };
    return area;
  }

  const storage = {
    sync: createArea('sync', options.sync, options.storage?.sync),
    local: createArea('local', options.local, options.storage?.local),
    session: createArea('session', options.session, options.storage?.session),
    onChanged: storageChanged
  };

  function readTab(tab: WorkerTab): WorkerTab {
    return copy({
      index: 0,
      windowId: 1,
      highlighted: false,
      active: false,
      pinned: false,
      incognito: false,
      discarded: false,
      autoDiscardable: true,
      frozen: false,
      selected: false,
      groupId: -1,
      status: 'complete',
      ...tab
    });
  }

  function findTab(tabId: unknown): WorkerTab | undefined {
    return tabs.find((tab) => tab.id === tabId);
  }

  function matchesQuery(tab: WorkerTab, query: Record<string, unknown>): boolean {
    return Object.entries(query).every(([key, expected]) => {
      if (key === 'currentWindow' || key === 'lastFocusedWindow') return true;
      if (key === 'windowId' && expected === -2) return true;
      if (key === 'url') return expected === undefined || tab.url === expected;
      return Reflect.get(tab, key) === expected;
    });
  }

  const tabsApi = {
    TAB_ID_NONE: -1,
    query: vi.fn((query: Record<string, unknown> = {}, callback?: (found: WorkerTab[]) => void) =>
      answer(tabs.map(readTab).filter((tab) => matchesQuery(tab, query || {})), callback)),
    get: vi.fn((tabId: number, callback?: (tab: WorkerTab | undefined) => void) => {
      const tab = findTab(tabId);
      return tab ? answer(readTab(tab), callback) : fail(`No tab with id: ${tabId}.`, callback);
    }),
    create: vi.fn((properties: chrome.tabs.CreateProperties, callback?: (tab: WorkerTab) => void) => {
      nextTabId += 1;
      const created: WorkerTab = { id: nextTabId, windowId: properties.windowId ?? 1, ...readCreated(properties) };
      return answer(readTab(created), callback);
    }),
    update: vi.fn((tabId: number | undefined, properties: chrome.tabs.UpdateProperties, callback?: (tab: WorkerTab) => void) => {
      const tab = findTab(tabId);
      if (tab) Object.assign(tab, readUpdated(properties));
      return answer(readTab(tab || { id: Number(tabId), windowId: 1, ...readUpdated(properties) }), callback);
    }),
    remove: vi.fn((_tabIds: number | number[], callback?: () => void) => answer(undefined, callback)),
    move: vi.fn((tabId: number, properties: { index: number; windowId?: number }, callback?: (tab: WorkerTab) => void) =>
      answer(readTab({ ...(findTab(tabId) || { id: tabId }), ...properties }), callback)),
    reload: vi.fn((_tabId?: number, _properties?: unknown, callback?: () => void) => answer(undefined, callback)),
    sendMessage: vi.fn((_tabId: number, _message: unknown, optionsOrCallback?: CallOptions | ((response: unknown) => void), maybeCallback?: (response: unknown) => void) => {
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
      return answer(undefined, callback);
    }),
    getZoom: vi.fn((_tabId: number, callback?: (zoom: number) => void) => answer(1, callback)),
    captureVisibleTab: vi.fn((_windowId?: number, optionsOrCallback?: CallOptions | ((dataUrl: string) => void), callback?: (dataUrl: string) => void) =>
      answer('', typeof optionsOrCallback === 'function' ? optionsOrCallback : callback)),
    group: vi.fn((_options: chrome.tabs.GroupOptions, callback?: (groupId: number) => void) => answer(1, callback)),
    ungroup: vi.fn((_tabIds: number | number[], callback?: () => void) => answer(undefined, callback)),
    discard: vi.fn((tabId?: number, callback?: (tab: WorkerTab | undefined) => void) =>
      answer(tabId === undefined ? undefined : readTab(findTab(tabId) || { id: tabId }), callback)),
    onCreated: createEvent<[tab: WorkerTab]>(),
    onUpdated: createEvent<[tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: WorkerTab]>(),
    onRemoved: createEvent<[tabId: number, removeInfo: chrome.tabs.OnRemovedInfo]>(),
    onActivated: createEvent<[activeInfo: chrome.tabs.OnActivatedInfo]>(),
    onReplaced: createEvent<[addedTabId: number, removedTabId: number]>(),
    onMoved: createEvent<[tabId: number, moveInfo: unknown]>(),
    onAttached: createEvent<[tabId: number, attachInfo: unknown]>(),
    onDetached: createEvent<[tabId: number, detachInfo: unknown]>(),
    onHighlighted: createEvent<[highlightInfo: unknown]>(),
    onZoomChange: createEvent<[zoomChangeInfo: unknown]>()
  };

  function readCreated(properties: chrome.tabs.CreateProperties): Omit<WorkerTab, 'id'> {
    return {
      url: properties.url,
      index: properties.index,
      active: properties.active !== false,
      pinned: properties.pinned === true,
      openerTabId: properties.openerTabId
    };
  }

  function readUpdated(properties: chrome.tabs.UpdateProperties): Omit<WorkerTab, 'id'> {
    const updated: Omit<WorkerTab, 'id'> = {};
    if (properties.url !== undefined) updated.url = properties.url;
    if (properties.active !== undefined) updated.active = properties.active;
    if (properties.pinned !== undefined) updated.pinned = properties.pinned;
    if (properties.autoDiscardable !== undefined) updated.autoDiscardable = properties.autoDiscardable;
    return updated;
  }

  function readWindow(window: WorkerWindow): WorkerWindow {
    return copy({ focused: false, incognito: false, alwaysOnTop: false, type: 'normal', state: 'normal', ...window });
  }

  function lastFocusedWindow(): WorkerWindow {
    return windows.find((window) => window.focused) || windows[0] || { id: 1 };
  }

  const windowsApi = {
    WINDOW_ID_NONE: -1,
    WINDOW_ID_CURRENT: -2,
    get: vi.fn((windowId: number, optionsOrCallback?: CallOptions | ((window: WorkerWindow | undefined) => void), maybeCallback?: (window: WorkerWindow | undefined) => void) => {
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
      const window = windows.find((each) => each.id === windowId);
      return window ? answer(readWindow(window), callback) : fail(`No window with id: ${windowId}.`, callback);
    }),
    getCurrent: vi.fn((optionsOrCallback?: CallOptions | ((window: WorkerWindow) => void), maybeCallback?: (window: WorkerWindow) => void) =>
      answer(readWindow(lastFocusedWindow()), typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback)),
    getLastFocused: vi.fn((optionsOrCallback?: CallOptions | ((window: WorkerWindow) => void), maybeCallback?: (window: WorkerWindow) => void) =>
      answer(readWindow(lastFocusedWindow()), typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback)),
    getAll: vi.fn((optionsOrCallback?: CallOptions | ((all: WorkerWindow[]) => void), maybeCallback?: (all: WorkerWindow[]) => void) =>
      answer(windows.map(readWindow), typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback)),
    create: vi.fn((properties: Record<string, unknown> = {}, callback?: (window: WorkerWindow) => void) => {
      const id = Math.max(0, ...windows.map((window) => window.id)) + 1;
      const type = typeof properties.type === 'string' ? properties.type : 'normal';
      windows.push({ id, type, focused: properties.focused !== false });
      return answer(readWindow({ id, type }), callback);
    }),
    update: vi.fn((windowId: number, properties: Record<string, unknown>, callback?: (window: WorkerWindow) => void) => {
      const window = windows.find((each) => each.id === windowId);
      if (window && typeof properties.focused === 'boolean') window.focused = properties.focused;
      return answer(readWindow(window || { id: windowId }), callback);
    }),
    remove: vi.fn((_windowId: number, callback?: () => void) => answer(undefined, callback)),
    onFocusChanged: createEvent<[windowId: number]>(),
    onCreated: createEvent<[window: WorkerWindow]>(),
    onRemoved: createEvent<[windowId: number]>(),
    onBoundsChanged: createEvent<[window: WorkerWindow]>()
  };

  const tabGroupsApi = {
    TAB_GROUP_ID_NONE: -1,
    get: vi.fn((groupId: number, callback?: (group: WorkerTabGroup | undefined) => void) => {
      const group = tabGroups.find((each) => each.id === groupId);
      return group ? answer(copy(group), callback) : fail(`No group with id: ${groupId}.`, callback);
    }),
    query: vi.fn((query: Record<string, unknown> = {}, callback?: (groups: WorkerTabGroup[]) => void) =>
      answer(tabGroups.filter((group) => Object.entries(query).every(([key, value]) => Reflect.get(group, key) === value))
        .map(copy), callback)),
    update: vi.fn((groupId: number, properties: Partial<WorkerTabGroup>, callback?: (group: WorkerTabGroup | undefined) => void) => {
      const group = tabGroups.find((each) => each.id === groupId);
      if (group) Object.assign(group, properties);
      return answer(group ? copy(group) : undefined, callback);
    }),
    onCreated: createEvent<[group: WorkerTabGroup]>(),
    onUpdated: createEvent<[group: WorkerTabGroup]>(),
    onRemoved: createEvent<[group: WorkerTabGroup]>()
  };

  const contextMenuItems = new Map<string, Record<string, unknown>>();
  const contextMenus = {
    items: contextMenuItems,
    create: vi.fn((properties: Record<string, unknown>, callback?: () => void) => {
      contextMenuItems.set(String(properties.id), { ...properties });
      answer(undefined, callback);
      return properties.id;
    }),
    update: vi.fn((id: string, properties: Record<string, unknown>, callback?: () => void) => {
      const item = contextMenuItems.get(id);
      if (!item) return fail(`Cannot find menu item with id ${id}`, callback);
      Object.assign(item, properties);
      return answer(undefined, callback);
    }),
    remove: vi.fn((id: string, callback?: () => void) => {
      contextMenuItems.delete(id);
      return answer(undefined, callback);
    }),
    removeAll: vi.fn((callback?: () => void) => {
      contextMenuItems.clear();
      return answer(undefined, callback);
    }),
    onClicked: createEvent<[info: chrome.contextMenus.OnClickData, tab?: WorkerTab]>()
  };

  const alarms = {
    create: vi.fn((_name: string, _info: Record<string, unknown>) => Promise.resolve()),
    clear: vi.fn((_name?: string, callback?: (cleared: boolean) => void) => answer(true, callback)),
    get: vi.fn((_name?: string, callback?: (alarm: unknown) => void) => answer<unknown>(undefined, callback)),
    getAll: vi.fn((callback?: (all: unknown[]) => void) => answer<unknown[]>([], callback)),
    onAlarm: createEvent<[alarm: { name: string; scheduledTime: number }]>()
  };

  const scripting = {
    executeScript: vi.fn((_injection: chrome.scripting.ScriptInjection<unknown[], unknown>, callback?: (results: unknown[]) => void) =>
      answer<unknown[]>([], callback)),
    insertCSS: vi.fn((_injection: unknown, callback?: () => void) => answer(undefined, callback)),
    removeCSS: vi.fn((_injection: unknown, callback?: () => void) => answer(undefined, callback)),
    registerContentScripts: vi.fn((_scripts: unknown[], callback?: () => void) => answer(undefined, callback)),
    updateContentScripts: vi.fn((_scripts: unknown[], callback?: () => void) => answer(undefined, callback)),
    unregisterContentScripts: vi.fn((filterOrCallback?: CallOptions | (() => void), callback?: () => void) =>
      answer(undefined, typeof filterOrCallback === 'function' ? filterOrCallback : callback)),
    getRegisteredContentScripts: vi.fn((filterOrCallback?: CallOptions | ((scripts: unknown[]) => void), maybeCallback?: (scripts: unknown[]) => void) =>
      answer<unknown[]>([], typeof filterOrCallback === 'function' ? filterOrCallback : maybeCallback))
  };

  const chromeFake = {
    runtime,
    storage,
    tabs: tabsApi,
    windows: windowsApi,
    tabGroups: tabGroupsApi,
    contextMenus,
    alarms,
    scripting,
    commands: {
      getAll: vi.fn((callback?: (commands: { name: string; shortcut?: string }[]) => void) =>
        answer(copy(options.commands || []), callback)),
      onCommand: createEvent<[command: string, tab?: WorkerTab]>()
    },
    action: {
      setIcon: vi.fn((_details: unknown, callback?: () => void) => answer(undefined, callback)),
      setTitle: vi.fn((_details: unknown, callback?: () => void) => answer(undefined, callback)),
      setBadgeText: vi.fn((_details: unknown, callback?: () => void) => answer(undefined, callback)),
      openPopup: vi.fn(() => Promise.resolve()),
      onClicked: createEvent<[tab: WorkerTab]>()
    },
    history: {
      search: vi.fn((_query: unknown, callback?: (items: chrome.history.HistoryItem[]) => void) =>
        answer<chrome.history.HistoryItem[]>([], callback)),
      getVisits: vi.fn((_details: unknown, callback?: (visits: unknown[]) => void) => answer([], callback)),
      deleteUrl: vi.fn((_details: unknown, callback?: () => void) => answer(undefined, callback)),
      onVisited: createEvent<[item: chrome.history.HistoryItem]>(),
      onVisitRemoved: createEvent<[removed: { allHistory: boolean; urls?: string[] }]>()
    },
    topSites: {
      get: vi.fn((callback?: (sites: chrome.topSites.MostVisitedURL[]) => void) => answer([], callback))
    },
    bookmarks: {
      search: vi.fn((_query: unknown, callback?: (nodes: chrome.bookmarks.BookmarkTreeNode[]) => void) => answer([], callback)),
      getTree: vi.fn((callback?: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void) =>
        answer([{ id: '0', title: '', syncing: false, children: [] }], callback)),
      getSubTree: vi.fn((_id: string, callback?: (tree: chrome.bookmarks.BookmarkTreeNode[]) => void) => answer([], callback)),
      getChildren: vi.fn((_id: string, callback?: (nodes: chrome.bookmarks.BookmarkTreeNode[]) => void) => answer([], callback)),
      onCreated: createEvent<[id: string, node: unknown]>(),
      onRemoved: createEvent<[id: string, info: unknown]>(),
      onChanged: createEvent<[id: string, info: unknown]>(),
      onMoved: createEvent<[id: string, info: unknown]>(),
      onChildrenReordered: createEvent<[id: string, info: unknown]>(),
      onImportBegan: createEvent<[]>(),
      onImportEnded: createEvent<[]>()
    },
    search: {
      query: vi.fn((_options: unknown, callback?: () => void) => answer(undefined, callback))
    },
    permissions: {
      contains: vi.fn((_permissions: unknown, callback?: (granted: boolean) => void) => answer(true, callback)),
      request: vi.fn((_permissions: unknown, callback?: (granted: boolean) => void) => answer(true, callback)),
      onAdded: createEvent<[permissions: unknown]>(),
      onRemoved: createEvent<[permissions: unknown]>()
    },
    i18n: {
      getUILanguage: () => options.uiLanguage || 'en',
      getMessage: (_key: string) => ''
    },
    declarativeNetRequest: {
      updateSessionRules: vi.fn((_options: chrome.declarativeNetRequest.UpdateRuleOptions, callback?: () => void) =>
        answer(undefined, callback)),
      getSessionRules: vi.fn((callback?: (rules: chrome.declarativeNetRequest.Rule[]) => void) => answer([], callback))
    },
    webRequest: {
      onBeforeRedirect: createEvent<[details: chrome.webRequest.OnBeforeRedirectDetails]>(),
      onHeadersReceived: createEvent<[details: unknown]>(),
      onCompleted: createEvent<[details: unknown]>(),
      onErrorOccurred: createEvent<[details: unknown]>()
    }
  };

  const fetchFake = vi.fn(async (input: unknown, init?: RequestInit): Promise<FakeResponse> => {
    const url = String(input);
    if (options.fetch) return options.fetch(url, init);
    if (url.startsWith(`${EXTENSION_ORIGIN}/`)) return packagedFile(url);
    throw new Error(`network disabled in the worker fake: ${url}`);
  });

  // Delivers a runtime message to the worker the way Chrome does: from an
  // extension page unless a sender is given. Resolves with the answer, or
  // undefined when no listener keeps the channel open or the answer does not
  // come within timeoutMs.
  function sendMessage(message: unknown, sender: MessageSender = { url: `${EXTENSION_ORIGIN}/newtab.html` }, timeoutMs = 500): Promise<unknown> {
    return new Promise((resolveAnswer) => {
      let settled = false;
      const finish = (response?: unknown) => {
        if (settled) return;
        settled = true;
        resolveAnswer(response);
      };
      const results = runtime.onMessage.fire(message, sender, finish);
      if (!results.some((result) => result === true)) setTimeout(() => finish(undefined), 0);
      setTimeout(() => finish(undefined), timeoutMs);
    });
  }

  // The worker's importScripts: the lazily loaded scripts publish what their
  // build would.
  const importScripts = vi.fn((...urls: string[]) => {
    urls.forEach((url) => {
      if (url.endsWith('build/pinyin-data.js')) publishWorkerLazyModule('pinyin', { pinyin });
    });
  });

  return {
    chrome: chromeFake,
    storage,
    tabs,
    windows,
    tabGroups,
    fetch: fetchFake,
    importScripts,
    sendMessage,
    extensionUrl: (path: string) => `${EXTENSION_ORIGIN}/${path.replace(/^\//, '')}`
  };
}

// The extension's own file at a chrome-extension:// URL.
function packagedFile(url: string): FakeResponse {
  const path = resolve(REPO_ROOT, `.${new URL(url).pathname}`);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { ok: false, status: 404, url, json: async () => null, text: async () => '' };
  }
  return { ok: true, status: 200, url, json: async () => JSON.parse(text), text: async () => text };
}

// A whole chrome.tabs.Tab, for modules typed against the browser's own tab:
// what a test leaves out reads as an ordinary loaded background tab.
function browserTab(tab: Partial<chrome.tabs.Tab> & { id: number }): chrome.tabs.Tab & { id: number } {
  return {
    index: 0,
    windowId: 1,
    groupId: -1,
    highlighted: false,
    active: false,
    pinned: false,
    incognito: false,
    selected: false,
    discarded: false,
    autoDiscardable: true,
    frozen: false,
    lastAccessed: 0,
    ...tab
  };
}

// A chrome.events.Event a test fires; rules are not supported.
function createChromeEvent<Args extends unknown[]>() {
  const listeners: ((...args: Args) => void)[] = [];
  const event: chrome.events.Event<(...args: Args) => void> = {
    addListener: (listener) => {
      listeners.push(listener);
    },
    removeListener: (listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
    hasListener: (listener) => listeners.includes(listener),
    hasListeners: () => listeners.length > 0,
    getRules: () => {},
    addRules: () => {},
    removeRules: () => {}
  };
  return { event, fire: (...args: Args) => listeners.slice().forEach((listener) => listener(...args)) };
}

// A runtime port an extension page opened to the worker: what the worker
// posts collects in sent; receive and disconnect act as the page.
function createPort(name: string, sender: MessageSender = { url: `${EXTENSION_ORIGIN}/newtab.html` }) {
  const sent: unknown[] = [];
  const onMessage = createChromeEvent<[message: unknown, port: chrome.runtime.Port]>();
  const onDisconnect = createChromeEvent<[port: chrome.runtime.Port]>();
  const port: chrome.runtime.Port = {
    name,
    sender,
    postMessage: (message: unknown) => {
      sent.push(message);
    },
    disconnect: () => onDisconnect.fire(port),
    onMessage: onMessage.event,
    onDisconnect: onDisconnect.event
  };
  return {
    port,
    sent,
    receive: (message: unknown) => onMessage.fire(message, port),
    disconnect: () => onDisconnect.fire(port)
  };
}

// A JSON answer from a fetch handler.
function jsonResponse(body: unknown, status = 200): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => copy(body),
    text: async () => JSON.stringify(body)
  };
}

type WorkerFake = ReturnType<typeof createWorkerFake>;

// Puts a fresh fake in place of the worker's globals and forgets loaded
// modules, so the next import of a worker module runs it against this fake.
// Timers the worker's modules started since their fake was installed. They
// are cleared when the test ends, so a worker's late timer never runs
// against the next test's fake, or after the globals are gone.
const workerTimers = new Set<ReturnType<typeof setTimeout>>();

let trackingWorkerTimers = false;

function trackWorkerTimers(): void {
  if (trackingWorkerTimers) return;
  trackingWorkerTimers = true;
  const startTimeout = globalThis.setTimeout;
  const startInterval = globalThis.setInterval;
  vi.stubGlobal('setTimeout', (handler: unknown, ms?: number, ...args: unknown[]) => {
    const id = startTimeout(() => {
      workerTimers.delete(id);
      if (typeof handler === 'function') Reflect.apply(handler, undefined, args);
    }, ms);
    workerTimers.add(id);
    return id;
  });
  vi.stubGlobal('setInterval', (handler: unknown, ms?: number, ...args: unknown[]) => {
    const id = startInterval(() => {
      if (typeof handler === 'function') Reflect.apply(handler, undefined, args);
    }, ms);
    workerTimers.add(id);
    return id;
  });
}

function clearWorkerTimers(): void {
  workerTimers.forEach((id) => {
    clearTimeout(id);
    clearInterval(id);
  });
  workerTimers.clear();
}

function installWorkerFake(options: WorkerFakeOptions = {}): WorkerFake {
  const fake = createWorkerFake(options);
  clearWorkerTimers();
  trackWorkerTimers();
  vi.stubGlobal('chrome', fake.chrome);
  vi.stubGlobal('fetch', fake.fetch);
  vi.stubGlobal('importScripts', fake.importScripts);
  vi.stubGlobal('__lumnoWorkerLazy', undefined);
  vi.resetModules();
  return fake;
}

// Starts the worker entry against a fresh fake and lets its start-up reads
// settle (unless a storage area is held).
async function bootWorker(options: WorkerFakeOptions = {}): Promise<WorkerFake> {
  const fake = installWorkerFake(options);
  await import('../../src/background/background');
  await settleWorker();
  return fake;
}

// Lets the worker's pending callbacks and timers of a few milliseconds run.
async function settleWorker(ms = 20): Promise<void> {
  await new Promise((done) => setTimeout(done, ms));
}

// The modules an executeScript call imports into a page, as extension paths
// (build/injected/<name>.js): the worker injects its in-page scripts as a
// function that imports them (src/platform/injection.ts). Empty for any other
// injection.
function injectedModules(injection: unknown): string[] {
  const args = injection && typeof injection === 'object' ? Reflect.get(injection, 'args') : undefined;
  const urls: unknown = Array.isArray(args) ? args[0] : undefined;
  if (!Array.isArray(urls)) return [];
  return urls
    .map((url) => String(url).replace(/^.*?(build\/injected\/[\w-]+\.js)$/, '$1'))
    .filter((path) => /^build\/injected\/[\w-]+\.js$/.test(path));
}

// The command an executeScript call sends the last module it imports.
function injectedCommand(injection: unknown): unknown {
  const args = injection && typeof injection === 'object' ? Reflect.get(injection, 'args') : undefined;
  return Array.isArray(args) ? args[1] : undefined;
}

// The injections the worker made into a tab (any tab without tabId).
function injectionsInto(fake: WorkerFake, tabId?: number): chrome.scripting.ScriptInjection<unknown[], unknown>[] {
  return fake.chrome.scripting.executeScript.mock.calls
    .map(([injection]) => injection)
    .filter((injection) => tabId === undefined || injection.target.tabId === tabId);
}

afterEach(() => {
  clearWorkerTimers();
  trackingWorkerTimers = false;
  vi.unstubAllGlobals();
});

export {
  EXTENSION_ORIGIN,
  bootWorker,
  browserTab,
  createEvent,
  createPort,
  createWorkerFake,
  injectedCommand,
  injectedModules,
  injectionsInto,
  installWorkerFake,
  jsonResponse,
  settleWorker
};
export type { FakeEvent, FakeResponse, FetchHandler, WorkerFake, WorkerFakeOptions, WorkerTab, WorkerTabGroup, WorkerWindow };
