// Web pages for the worker fake to inject into. Each tab has a Document of
// its own: an injected module (src/platform/injection.ts) loads once per
// Document, as the browser keeps one instance of each, and a function the
// worker injects runs against that Document's state in the test document.
// The overlay is a stand-in that records how the worker opens it and
// publishes its state in the content registry. Navigating a tab replaces its
// Document, so whatever was injected is gone, as after a real page load.
import type { WorkerFake } from './worker';
import { browserTab } from './worker';

const OVERLAY_HOST_ID = '_x_extension_overlay_host_2026_unique_';
const OVERLAY_MODULE = 'build/injected/overlay.js';

interface OverlayInvocation {
  tabs: unknown;
  context: Record<string, unknown>;
}

interface TabPage {
  id: number;
  tabId: number;
  overlayOpen: boolean;
  invocations: OverlayInvocation[];
  // The injected modules this Document loaded, by extension path.
  loadedModules: string[];
  // When set, injecting into this Document fails as for a page still being
  // replaced.
  unavailable: boolean;
  registry: Record<string, unknown> | null;
}

interface PageLogEntry {
  tabId: number;
  documentId: number;
  kind: 'import' | 'files' | 'func';
  files: string[];
  command: unknown;
  injectImmediately: boolean;
  failed: boolean;
}

type FrameResult = { frameId: number; documentId: string; result: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function plain(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

// The extension path an injected module's URL names.
function modulePath(url: unknown): string {
  return String(url).replace(/^chrome-extension:\/\/[^/]+\//, '').replace(/^.*?(build\/injected\/)/, '$1');
}

// Runs fn with the test document and global scope showing this Document.
function inPage<T>(page: TabPage, fn: () => T): T {
  const host = page.overlayOpen ? document.createElement('div') : null;
  if (host) {
    host.id = OVERLAY_HOST_ID;
    document.body.appendChild(host);
  }
  Reflect.set(globalThis, '__lumnoContent', page.registry === null ? undefined : page.registry);
  try {
    return fn();
  } finally {
    if (host) host.remove();
    Reflect.deleteProperty(globalThis, '__lumnoContent');
  }
}

function createTabPages(fake: WorkerFake) {
  const documents = new Map<number, TabPage>();
  const log: PageLogEntry[] = [];
  let documentCount = 0;

  function createDocument(tabId: number): TabPage {
    documentCount += 1;
    const page: TabPage = {
      id: documentCount, tabId, overlayOpen: false, invocations: [], loadedModules: [], unavailable: false, registry: null
    };
    documents.set(tabId, page);
    return page;
  }

  function current(tabId: number): TabPage {
    return documents.get(tabId) || createDocument(tabId);
  }

  function runOverlay(page: TabPage, command: unknown): Record<string, unknown> {
    const context = isRecord(command) && isRecord(command.context) ? command.context : {};
    page.invocations.push({ tabs: isRecord(command) ? command.tabs : undefined, context });
    page.overlayOpen = !(page.overlayOpen && context.ensureOpen !== true);
    if (page.registry) page.registry.overlayOpen = page.overlayOpen;
    return { ok: true, overlayOpen: page.overlayOpen };
  }

  function inject(injection: chrome.scripting.ScriptInjection<unknown[], unknown>): FrameResult[] | Error {
    const tabId = injection.target.tabId;
    const page = current(tabId);
    const entry = (kind: PageLogEntry['kind'], files: string[], command: unknown = undefined, failed = false): PageLogEntry => ({
      tabId, documentId: page.id, kind, files, command, injectImmediately: injection.injectImmediately === true, failed
    });
    const frame = (result: unknown): FrameResult[] => [{ frameId: 0, documentId: String(page.id), result: plain(result) }];
    const files = 'files' in injection && Array.isArray(injection.files) ? injection.files : null;
    if (page.unavailable) {
      log.push(entry(files ? 'files' : 'func', files || [], undefined, true));
      return new Error('Frame with ID 0 is showing error page');
    }
    if (files) {
      log.push(entry('files', files));
      return frame(undefined);
    }
    const func = 'func' in injection ? injection.func : undefined;
    const args = plain('args' in injection ? injection.args : []);
    const argList = Array.isArray(args) ? args : [];
    if (typeof func !== 'function') return [];
    const urls: unknown = argList[0];
    if (Array.isArray(urls) && urls.length > 0 && urls.every((url) => /\.js$/.test(String(url)))) {
      const paths = urls.map(modulePath);
      const loaded = paths.filter((path) => !page.loadedModules.includes(path));
      page.loadedModules.push(...loaded);
      if (loaded.includes(OVERLAY_MODULE)) page.registry = { claimed: {}, overlayOpen: false };
      const result = paths[paths.length - 1] === OVERLAY_MODULE ? runOverlay(page, argList[1]) : { ok: true };
      log.push(entry('import', paths, argList[1]));
      return frame(result);
    }
    try {
      const result: unknown = inPage(page, () => Reflect.apply(func, undefined, argList));
      log.push(entry('func', []));
      return frame(result);
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }

  fake.chrome.scripting.executeScript.mockImplementation((injection, callback) => {
    const results = inject(injection);
    setTimeout(() => {
      if (results instanceof Error) fake.chrome.runtime.lastError = { message: results.message };
      try {
        if (callback) callback(results instanceof Error ? [] : results);
      } finally {
        fake.chrome.runtime.lastError = null;
      }
    }, 0);
    return undefined;
  });

  function tabState(tabId: number) {
    const tab = fake.tabs.find((each) => each.id === tabId);
    if (!tab) throw new Error(`No tab ${tabId} in the fake`);
    return tab;
  }

  return {
    log,
    page: current,
    // Starts loading url in the tab: a new Document replaces the old one.
    navigate(tabId: number, url: string) {
      const tab = tabState(tabId);
      tab.url = url;
      tab.status = 'loading';
      createDocument(tabId);
      fake.chrome.tabs.onUpdated.fire(tabId, { status: 'loading', url }, browserTab(tab));
    },
    complete(tabId: number) {
      const tab = tabState(tabId);
      tab.status = 'complete';
      fake.chrome.tabs.onUpdated.fire(tabId, { status: 'complete' }, browserTab(tab));
    }
  };
}

export { OVERLAY_HOST_ID, createTabPages };
export type { OverlayInvocation, PageLogEntry, TabPage };
