import { describe, expect, it } from 'vitest';
import { bootWorker, settleWorker } from '../../tests/fakes/worker';
import type { WorkerFake } from '../../tests/fakes/worker';
import { defaultSearchEngine, searchResultTabPosition } from '../domain/settings/search';

// Where a search result opens: next to the tab the search came from, before
// it, or at the end of the strip, as Settings says, and in that tab's group.
// The worker answers the messages the search surfaces send.

const SOURCE = { id: 10, index: 5, windowId: 3, groupId: 42, url: 'https://page.test/' };
// The page's own view of its tab is older; the worker should ask again.
const SENDER: chrome.runtime.MessageSender = {
  tab: {
    ...SOURCE,
    index: 1,
    active: true,
    pinned: false,
    highlighted: true,
    incognito: false,
    selected: true,
    discarded: false,
    autoDiscardable: true,
    frozen: false,
    lastAccessed: 0
  },
  url: SOURCE.url
};

interface WorkerOptions {
  position?: string;
  closedSource?: boolean;
  createError?: boolean;
  noSearchApi?: boolean;
  searchError?: boolean;
  searchThrows?: boolean;
}

function readReply(value: unknown): { ok?: unknown } {
  return typeof value === 'object' && value !== null ? value : {};
}

async function createWorker(options: WorkerOptions = {}) {
  const fake: WorkerFake = await bootWorker({
    tabs: options.closedSource ? [] : [{ ...SOURCE }],
    sync: options.position ? { [searchResultTabPosition.key]: options.position } : {}
  });
  const { chrome } = fake;
  const searched: object[] = [];
  chrome.tabs.create.mockImplementation((properties, callback) => {
    setTimeout(() => {
      if (options.createError) {
        chrome.runtime.lastError = { message: 'create failed' };
      }
      callback?.({ ...properties, id: 100, groupId: -1, windowId: properties.windowId ?? 1 });
      chrome.runtime.lastError = null;
    }, 0);
    return undefined;
  });
  chrome.search.query.mockImplementation((properties, callback) => {
    searched.push({ ...(typeof properties === 'object' ? properties : {}) });
    if (options.searchThrows) throw new Error('search unavailable');
    setTimeout(() => {
      chrome.runtime.lastError = options.searchError ? { message: 'search failed' } : null;
      callback?.();
      chrome.runtime.lastError = null;
    }, 0);
    return undefined;
  });
  if (options.noSearchApi) {
    Reflect.deleteProperty(chrome, 'search');
  }
  const send = async (message: object, sender = SENDER) => readReply(await fake.sendMessage(message, sender, 1000));
  return {
    fake,
    search: (request: { query: string; disposition?: string }) => send({ action: 'searchOrNavigate', ...request }),
    open: (request: { url: string; disposition?: string }) => send({ action: 'createTab', ...request }),
    created: () => chrome.tabs.create.mock.calls.map(([properties]) => properties),
    updated: () => chrome.tabs.update.mock.calls.map(([id, properties]) => ({ id, ...properties })),
    grouped: () => chrome.tabs.group.mock.calls.map(([properties]) => properties),
    searched
  };
}

describe('search result tab position', () => {
  it('reads the position setting, at the end by default', () => {
    expect(searchResultTabPosition.parse(undefined)).toBe('end');
    expect(searchResultTabPosition.parse('invalid')).toBe('end');
    expect(searchResultTabPosition.parse('beforeCurrent')).toBe('beforeCurrent');
  });

  it.each([
    ['afterCurrent', 'newTab', 6],
    ['afterCurrent', 'backgroundTab', 6],
    ['beforeCurrent', 'newTab', 5],
    ['beforeCurrent', 'backgroundTab', 5]
  ])('%s opens a %s search at the source tab current index, in its group', async (position, disposition, index) => {
    const worker = await createWorker({ position });
    const reply = await worker.search({ query: 'hello', disposition });
    expect(reply.ok).toBe(true);
    expect(worker.created()).toEqual([{ url: 'about:blank', active: disposition === 'newTab', index, windowId: 3 }]);
    expect(worker.searched).toEqual([{ text: 'hello', tabId: 100 }]);
    expect(worker.grouped()).toEqual([{ tabIds: 100, groupId: 42 }]);
  });

  it('opens a typed URL beside the source tab too', async () => {
    const worker = await createWorker({ position: 'afterCurrent' });
    await worker.search({ query: 'https://example.test/' });
    expect(worker.created()[0]?.index).toBe(6);
    expect(worker.searched).toHaveLength(0);
  });

  it('without a preference keeps the browser NEW_TAB search', async () => {
    const worker = await createWorker();
    await worker.search({ query: 'hello' });
    expect(worker.created()).toHaveLength(0);
    expect(worker.searched).toEqual([{ text: 'hello', disposition: 'NEW_TAB' }]);
  });

  it('without a preference opens a background search at the engine URL directly', async () => {
    const worker = await createWorker();
    await worker.search({ query: 'hello', disposition: 'backgroundTab' });
    const [tab] = worker.created();
    expect([tab?.active, tab?.windowId, tab?.index]).toEqual([false, 3, undefined]);
    expect(tab?.url).toMatch(/hello/);
    expect(worker.searched).toHaveLength(0);
  });

  it('without a preference opens links at the end', async () => {
    const worker = await createWorker();
    await worker.open({ url: 'https://example.test/' });
    expect(worker.created()[0]?.index).toBeUndefined();
  });

  it('opens at the end of the strip when that is the explicit choice', async () => {
    const worker = await createWorker({ position: 'end' });
    await worker.search({ query: 'https://example.test/' });
    expect(worker.created()[0]?.index).toBeUndefined();
  });

  it('opens a background link from a page beside its tab', async () => {
    const worker = await createWorker({ position: 'afterCurrent' });
    await worker.open({ url: 'https://example.test/', disposition: 'backgroundTab' });
    expect(worker.created()[0]).toEqual({ url: 'https://example.test/', active: false, index: 6, windowId: 3 });
  });

  it('reuses the source tab for a current-tab link', async () => {
    const worker = await createWorker({ position: 'afterCurrent' });
    await worker.open({ url: 'https://example.test/', disposition: 'currentTab' });
    expect(worker.created()).toHaveLength(0);
    expect(worker.updated()).toEqual([{ id: 10, url: 'https://example.test/', active: true }]);
  });

  it('runs a current-tab search in the source tab, whose results page still teaches the default engine', async () => {
    const worker = await createWorker({ position: 'afterCurrent' });
    await worker.search({ query: 'hello', disposition: 'currentTab' });
    expect(worker.created()).toHaveLength(0);
    expect(worker.searched).toEqual([{ text: 'hello', tabId: 10 }]);
    worker.fake.chrome.tabs.onUpdated.fire(10, { url: 'https://www.bing.com/search?q=hello' }, { ...SOURCE });
    await settleWorker(30);
    expect(worker.fake.storage.sync.values[defaultSearchEngine.key]).toMatchObject({ id: 'bing' });
  });

  it('loads a typed URL in the source tab for a current-tab search', async () => {
    const worker = await createWorker({ position: 'afterCurrent' });
    await worker.search({ query: 'https://example.test/', disposition: 'currentTab' });
    expect(worker.created()).toHaveLength(0);
    expect(worker.updated()).toEqual([{ id: 10, url: 'https://example.test/' }]);
  });

  it('loads the engine URL in the source tab for a current-tab search without the search API', async () => {
    const worker = await createWorker({ position: 'afterCurrent', noSearchApi: true });
    await worker.search({ query: 'hello', disposition: 'currentTab' });
    const [update] = worker.updated();
    expect(update?.id).toBe(10);
    expect(update?.url).toMatch(/hello/);
  });

  it('leaves no stale index or group when the source tab has closed', async () => {
    const worker = await createWorker({ position: 'afterCurrent', closedSource: true });
    await worker.open({ url: 'https://example.test/' });
    expect(worker.created()[0]?.index).toBeUndefined();
    expect(worker.grouped()).toHaveLength(0);
  });

  it.each([[{ searchError: true }], [{ searchThrows: true }]])('loads the engine URL into the placed tab when the browser search fails (%j)', async (failure) => {
    const worker = await createWorker({ position: 'afterCurrent', ...failure });
    const reply = await worker.search({ query: 'hello' });
    expect(reply.ok).toBe(true);
    expect(worker.created()).toHaveLength(1);
    const [update] = worker.updated();
    expect(update?.id).toBe(100);
    expect(update?.url).toMatch(/hello/);
  });

  it('opens the engine URL in place without the search API', async () => {
    const worker = await createWorker({ position: 'afterCurrent', noSearchApi: true });
    await worker.search({ query: 'hello' });
    expect(worker.created()[0]?.index).toBe(6);
    expect(worker.created()[0]?.url).toMatch(/hello/);
  });

  it('fails without searching when the tab cannot be created', async () => {
    const worker = await createWorker({ position: 'afterCurrent', createError: true });
    const reply = await worker.search({ query: 'hello' });
    expect(reply.ok).toBe(false);
    expect(worker.searched).toHaveLength(0);
  });
});
