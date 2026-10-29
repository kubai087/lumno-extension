// An in-memory browser for whole-page tests: storage areas that tell of
// their changes, a bookmarks tree, history, top sites, the window's tabs and
// a worker that answers every message with { ok: true }. A test reads what a
// page wrote and drives changes from "elsewhere" through it.
import { vi } from 'vitest';
import enMessages from '../../_locales/en/messages.json';

type StorageValues = Record<string, unknown>;
type StorageChanges = Record<string, { newValue?: unknown; oldValue?: unknown }>;
type ChangeListener = (changes: StorageChanges, area: string) => void;
type Listener = (...args: never[]) => unknown;

interface FakeBookmark {
  id: string;
  parentId?: string;
  index?: number;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: FakeBookmark[];
}

interface FakeTab {
  id: number;
  windowId: number;
  index: number;
  url: string;
  title: string;
  active: boolean;
  pinned: boolean;
  favIconUrl?: string;
  lastAccessed?: number;
}

interface FakeHistoryItem {
  url: string;
  title: string;
  lastVisitTime: number;
  visitCount: number;
}

interface BrowserFakeOptions {
  sync?: StorageValues;
  local?: StorageValues;
  bookmarksBar?: FakeBookmark[];
  history?: FakeHistoryItem[];
  tabs?: FakeTab[];
  // The worker's reply to a message, by its action; { ok: true } otherwise.
  respond?(message: { action?: unknown }): unknown;
}

// An event's listeners, which a test can fire.
function createEvent() {
  const listeners = new Set<Listener>();
  return {
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
    hasListener: (listener: Listener) => listeners.has(listener),
    fire: (...args: unknown[]) => listeners.forEach((listener) => Reflect.apply(listener, undefined, args))
  };
}

function pick(values: StorageValues, keys: unknown): StorageValues {
  if (keys === null || keys === undefined) {
    return { ...values };
  }
  if (typeof keys === 'string') {
    return keys in values ? { [keys]: values[keys] } : {};
  }
  if (Array.isArray(keys)) {
    return Object.fromEntries(keys.filter((key): key is string => typeof key === 'string' && key in values).map((key) => [key, values[key]]));
  }
  if (typeof keys === 'object') {
    return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, key in values ? values[key] : fallback]));
  }
  return {};
}

// A storage area; a call answers through its callback or its promise, after
// the current task, as Chrome's do.
function createArea(name: string, values: StorageValues, listeners: Set<ChangeListener>) {
  const emit = (changes: StorageChanges) => {
    if (Object.keys(changes).length) {
      listeners.forEach((listener) => listener(changes, name));
    }
  };
  const answer = <T>(value: T, callback?: (value: T) => void): Promise<T> | undefined => {
    if (callback) {
      queueMicrotask(() => callback(value));
      return undefined;
    }
    return Promise.resolve(value);
  };
  const write = (payload: StorageValues): StorageChanges => {
    const changes: StorageChanges = {};
    Object.entries(payload).forEach(([key, value]) => {
      changes[key] = { newValue: value, oldValue: values[key] };
      values[key] = value;
    });
    return changes;
  };
  return {
    values,
    get: (keys: unknown, callback?: (result: StorageValues) => void) => answer(pick(values, keys), callback),
    set(payload: StorageValues, callback?: () => void) {
      const changes = write(payload);
      queueMicrotask(() => emit(changes));
      return answer(undefined, callback);
    },
    remove(keys: string | string[], callback?: () => void) {
      const changes: StorageChanges = {};
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        if (key in values) {
          changes[key] = { oldValue: values[key] };
          delete values[key];
        }
      });
      queueMicrotask(() => emit(changes));
      return answer(undefined, callback);
    },
    getBytesInUse: (_keys: unknown, callback?: (bytes: number) => void) => answer(0, callback),
    // A change another page made.
    externalSet(payload: StorageValues) {
      emit(write(payload));
    }
  };
}

function createBookmarks(bar: FakeBookmark[]) {
  const root: FakeBookmark = {
    id: '0',
    title: '',
    children: [
      { id: '1', parentId: '0', index: 0, title: 'Bookmarks bar', children: bar.map((item, index) => ({ parentId: '1', index, ...item })) },
      { id: '2', parentId: '0', index: 1, title: 'Other bookmarks', children: [] }
    ]
  };
  const isBookmark = (node: FakeBookmark | null): node is FakeBookmark => node !== null;
  const find = (id: string, node: FakeBookmark = root): FakeBookmark | null => {
    if (node.id === id) return node;
    for (const child of node.children || []) {
      const found = find(id, child);
      if (found) return found;
    }
    return null;
  };
  const answer = <T>(value: T, callback?: (value: T) => void) => {
    if (callback) {
      queueMicrotask(() => callback(value));
      return undefined;
    }
    return Promise.resolve(value);
  };
  return {
    getTree: (callback?: (tree: FakeBookmark[]) => void) => answer([root], callback),
    getSubTree: (id: string, callback?: (tree: FakeBookmark[]) => void) => answer([find(id)].filter(isBookmark), callback),
    getChildren: (id: string, callback?: (children: FakeBookmark[]) => void) => answer((find(id) || {}).children || [], callback),
    get: (id: string | string[], callback?: (nodes: FakeBookmark[]) => void) => answer(
      (Array.isArray(id) ? id : [id]).map((each) => find(each)).filter(isBookmark), callback),
    search: (_query: unknown, callback?: (nodes: FakeBookmark[]) => void) => answer([], callback),
    onCreated: createEvent(),
    onRemoved: createEvent(),
    onChanged: createEvent(),
    onMoved: createEvent(),
    onChildrenReordered: createEvent(),
    onImportBegan: createEvent(),
    onImportEnded: createEvent()
  };
}

function createBrowserFake(options: BrowserFakeOptions = {}) {
  const storageListeners = new Set<ChangeListener>();
  const tabs = options.tabs || [];
  const history = options.history || [];
  const messages: Record<string, { message: string }> = enMessages;
  const answer = <T>(value: T, callback?: (value: T) => void) => {
    if (callback) {
      queueMicrotask(() => callback(value));
      return undefined;
    }
    return Promise.resolve(value);
  };
  const reply = (message: unknown): unknown => {
    const action = typeof message === 'object' && message !== null && 'action' in message ? message.action : undefined;
    const answered = options.respond ? options.respond({ action }) : undefined;
    return answered === undefined ? { ok: true } : answered;
  };
  const sendMessage = vi.fn((message: unknown, callback?: (response: unknown) => void) => answer(reply(message), callback));
  const chrome = {
    bookmarks: createBookmarks(options.bookmarksBar || []),
    commands: { getAll: (callback?: (commands: object[]) => void) => answer([], callback) },
    history: {
      search: (_query: unknown, callback?: (items: FakeHistoryItem[]) => void) => answer(history.slice(), callback),
      getVisits: (_query: unknown, callback?: (items: object[]) => void) => answer([], callback),
      onVisited: createEvent(),
      onVisitRemoved: createEvent()
    },
    i18n: {
      getMessage: (key: string) => (messages[key] ? messages[key].message : ''),
      getUILanguage: () => 'en'
    },
    permissions: {
      contains: (_permissions: unknown, callback?: (granted: boolean) => void) => answer(true, callback),
      onAdded: createEvent(),
      onRemoved: createEvent()
    },
    runtime: {
      getManifest: () => ({ version: '1.0.0', manifest_version: 3 }),
      getURL: (path: string) => `chrome-extension://lumno/${String(path).replace(/^\//, '')}`,
      id: 'lumno',
      lastError: null,
      onMessage: createEvent(),
      onConnect: createEvent(),
      sendMessage,
      connect: () => ({ onMessage: createEvent(), onDisconnect: createEvent(), postMessage() {}, disconnect() {} })
    },
    search: { query: vi.fn((_options: unknown, callback?: () => void) => answer(undefined, callback)) },
    storage: {
      local: createArea('local', { ...(options.local || {}) }, storageListeners),
      sync: createArea('sync', { ...(options.sync || {}) }, storageListeners),
      session: createArea('session', {}, storageListeners),
      onChanged: {
        addListener: (listener: ChangeListener) => storageListeners.add(listener),
        removeListener: (listener: ChangeListener) => storageListeners.delete(listener),
        hasListener: (listener: ChangeListener) => storageListeners.has(listener)
      }
    },
    tabs: {
      query: (_query: unknown, callback?: (found: FakeTab[]) => void) => answer(tabs.slice(), callback),
      getCurrent: (callback?: (tab: FakeTab | undefined) => void) => answer(tabs.find((tab) => tab.active), callback),
      get: (id: number, callback?: (tab: FakeTab | undefined) => void) => answer(tabs.find((tab) => tab.id === id), callback),
      create: vi.fn((properties: object, callback?: (tab: object) => void) => answer({ id: 99, ...properties }, callback)),
      update: vi.fn((_id: unknown, properties: object, callback?: (tab: object) => void) => answer({ ...properties }, callback)),
      onActivated: createEvent(),
      onUpdated: createEvent(),
      onRemoved: createEvent(),
      onCreated: createEvent(),
      onMoved: createEvent(),
      onReplaced: createEvent()
    },
    topSites: { get: (callback?: (sites: object[]) => void) => answer([], callback) },
    windows: {
      getCurrent: (_options: unknown, callback?: (window: object) => void) => answer({ id: 1, focused: true },
        typeof _options === 'function' ? undefined : callback),
      WINDOW_ID_CURRENT: -2,
      onFocusChanged: createEvent()
    }
  };
  return chrome;
}

type BrowserFake = ReturnType<typeof createBrowserFake>;

export { createBrowserFake };
export type { BrowserFake, FakeBookmark, FakeHistoryItem, FakeTab };
