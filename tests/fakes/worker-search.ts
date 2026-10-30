// The worker started over a browsing profile for its search tests: history,
// top sites, bookmarks and open tabs a search finds, the browser it runs in,
// and the search engine suggestion service it may ask.
import { vi } from 'vitest';
import { installWorkerFake, jsonResponse, settleWorker } from './worker';
import type { FakeResponse, FetchHandler, WorkerFake } from './worker';

interface HistoryEntry {
  title: string;
  url: string;
  visitCount: number;
  typedCount: number;
  lastVisitTime: number;
}

interface PageEntry {
  id: number | string;
  title: string;
  url: string;
  windowId?: number;
  parentId?: string;
}

interface SearchWorkerOptions {
  sync?: Record<string, unknown>;
  userAgent?: string;
  // Answers the worker's requests; the suggestion service fails otherwise.
  fetch?: FetchHandler;
  // Replaces the profile's history, or adds to it.
  history?: (now: number) => HistoryEntry[];
  extraHistory?: (now: number) => HistoryEntry[];
  bookmarks?: PageEntry[];
  openTabs?: PageEntry[];
  // How long the browser takes to answer a history search for a word.
  historySearchDelayMs?: number;
  // The full-history and bookmark-tree reads that warm the worker's indexes
  // answer once this resolves.
  coldIndexGate?: Promise<void>;
  // Stored settings arrive this long after the worker woke.
  settingsDelayMs?: number;
  // Changes the browser before the worker starts.
  configure?(fake: WorkerFake): void;
}

const OPEN_TABS: PageEntry[] = [
  {
    id: 25,
    windowId: 1,
    title: 'Digital Experience Testing Cloud | TestMu AI (Formerly LambdaTest) Enterprise Cloud',
    url: 'https://app.testmu.com/enterprise-cloud'
  },
  { id: 26, windowId: 1, title: '小红书 - 你的生活兴趣社区', url: 'https://www.xiaohongshu.com/explore/6a4dcb39000000001' }
];

const BOOKMARKS: PageEntry[] = [{ id: '10', parentId: '1', title: 'GitHub Bookmark', url: 'https://github.com/notifications' }];

const CHROME_USER_AGENT = 'Mozilla/5.0 (Macintosh) Chrome/149.0.0.0 Safari/537.36';

function visit(title: string, url: string, visitCount: number, typedCount: number, lastVisitTime: number): HistoryEntry {
  return { title, url, visitCount, typedCount, lastVisitTime };
}

function profileHistory(now: number): HistoryEntry[] {
  return [
    visit('GitHub', 'https://github.com/', 18, 4, now - 1000),
    visit('GitHub Lumno Repo', 'https://github.com/kubai087/lumno-extension', 7, 1, now - 2000),
    visit('小红书', 'https://mall.xiaohongshu.com/finance/cashier/web', 80, 4, now - 500),
    visit('小红书 - 你的生活兴趣社区', 'https://www.xiaohongshu.com/explore?channel_id=homefeed', 40, 2, now - 1000),
    visit('小红书创作服务平台', 'https://creator.xiaohongshu.com/', 20, 1, now - 1500),
    visit('小红书 - 你的生活兴趣社区', 'https://www.xiaohongshu.com/explore/6a4dcb39000000001', 30, 1, now - 2000),
    visit('Example', 'https://example.com/', 1, 0, now - 3000),
    visit('微信读书', 'https://weread.qq.com/', 4, 0, now - 5000),
    visit('Codex workspace', 'https://example.com/codex-only', 2, 0, now - 6000),
    visit('Codex 最爱 workspace', 'https://example.com/codex-favorite', 2, 0, now - 7000),
    visit('Home - 0HTTP', 'https://code.0http.com/', 2, 0, now - 8000),
    visit('Chrome 应用商店开发者信息中心', 'https://chrome.google.com/webstore/devconsole/test-dashboard?hl=zh-CN', 12, 1, now - 9000),
    visit('开发者信息中心 - Google 搜索',
      'https://www.google.com/search?q=%E5%BC%80%E5%8F%91%E8%80%85%E4%BF%A1%E6%81%AF%E4%B8%AD%E5%BF%83', 20, 2, now - 9500),
    ...Array.from({ length: 260 }, (_, index) =>
      visit(`Filler History ${index + 1}`, `https://filler.example.com/${index + 1}`, 1, 0, now - 10_000 - index)),
    visit('Final Cut Camera', 'https://apps.apple.com/final-cut-camera', 3, 0, now - 20_000)
  ];
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readQuery(query: unknown): { text: string; startTime: number; maxResults: number | null } {
  const record = query && typeof query === 'object' ? query : {};
  const text = Reflect.get(record, 'text');
  const maxResults = Reflect.get(record, 'maxResults');
  return {
    text: typeof text === 'string' ? text.toLowerCase() : '',
    startTime: readNumber(Reflect.get(record, 'startTime'), 0),
    maxResults: typeof maxResults === 'number' ? Math.max(0, Math.floor(maxResults)) : null
  };
}

// The search engine suggestion service's answer for a query.
function engineSuggestions(query: string, suggestions: string[]): FakeResponse {
  return jsonResponse([query, suggestions]);
}

// The query a request to Google's suggestion service asks about, or null for
// any other request.
function suggestionQuery(url: string): string | null {
  const parsed = new URL(url);
  return parsed.hostname === 'suggestqueries.google.com' ? parsed.searchParams.get('q') : null;
}

// Rejects when the request is aborted.
function onAbort(init: RequestInit | undefined, abort: () => void): void {
  const signal = init ? init.signal : null;
  if (signal) signal.addEventListener('abort', abort, { once: true });
}

function wait(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

interface SearchWorker {
  fake: WorkerFake;
  history: HistoryEntry[];
  search: typeof import('../../src/background/search/pipeline');
  engine: typeof import('../../src/background/search/engine-suggestions');
  defaultEngine: typeof import('../../src/background/search/default-engine');
}

async function bootSearchWorker(options: SearchWorkerOptions = {}): Promise<SearchWorker> {
  const now = Date.now();
  const history = (options.history ? options.history(now) : profileHistory(now))
    .concat(options.extraHistory ? options.extraHistory(now) : []);
  const topSites = [
    { title: 'GitHub', url: 'https://github.com/' },
    { title: 'Lumno | 浏览器命令栏、聚焦搜索与极简新标签页', url: 'http://127.0.0.1:4321/' }
  ];
  const bookmarks = options.bookmarks || BOOKMARKS;
  const openTabs = options.openTabs || OPEN_TABS;
  const coldIndex = (run: () => void) => {
    if (options.coldIndexGate) void options.coldIndexGate.then(run);
    else setTimeout(run, 0);
  };
  const fake = installWorkerFake({
    sync: options.sync,
    storage: { sync: { hold: Boolean(options.settingsDelayMs) } },
    fetch: options.fetch || ((url) => {
      throw new Error(`network disabled in the search tests: ${url}`);
    })
  });
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(options.userAgent || CHROME_USER_AGENT);
  fake.chrome.history.search.mockImplementation((query, callback) => {
    const { text, startTime, maxResults } = readQuery(query);
    const items = history
      .filter((item) => !text || item.title.toLowerCase().includes(text) || item.url.toLowerCase().includes(text))
      .filter((item) => item.lastVisitTime >= startTime)
      .slice(0, maxResults === null ? history.length : maxResults)
      .map((item) => ({ id: item.url, ...item }));
    if (!callback) return Promise.resolve(items);
    if (text) setTimeout(() => callback(items), options.historySearchDelayMs || 0);
    else coldIndex(() => callback(items));
    return undefined;
  });
  fake.chrome.history.deleteUrl.mockImplementation((details, callback) => {
    const url = details && typeof details === 'object' ? Reflect.get(details, 'url') : undefined;
    [history, topSites].forEach((list) => {
      for (let index = list.length - 1; index >= 0; index -= 1) {
        if (list[index].url === url) list.splice(index, 1);
      }
    });
    if (callback) callback();
    return undefined;
  });
  fake.chrome.topSites.get.mockImplementation((callback) => {
    if (callback) setTimeout(() => callback(topSites.slice()), 0);
    return undefined;
  });
  fake.chrome.bookmarks.search.mockImplementation((_query, callback) => {
    const nodes = bookmarks.map((bookmark) => ({ syncing: false, ...bookmark, id: String(bookmark.id) }));
    if (callback) setTimeout(() => callback(nodes), 0);
    return undefined;
  });
  fake.chrome.bookmarks.getTree.mockImplementation((callback) => {
    const bar = bookmarks.map((bookmark) => ({ syncing: false, ...bookmark, id: String(bookmark.id) }));
    const tree = [{
      id: '0',
      title: '',
      syncing: false,
      children: [{ id: '1', parentId: '0', title: 'Bookmarks bar', syncing: false, children: bar }]
    }];
    if (callback) coldIndex(() => callback(tree));
    return undefined;
  });
  fake.chrome.tabs.query.mockImplementation((_query, callback) => {
    const tabs = openTabs.map((tab, index) => ({ windowId: 1, index, ...tab, id: Number(tab.id) }));
    if (callback) setTimeout(() => callback(tabs), 0);
    return undefined;
  });
  if (options.configure) options.configure(fake);
  await import('../../src/background/background');
  if (options.settingsDelayMs) {
    setTimeout(() => fake.storage.sync.release(), options.settingsDelayMs);
  } else {
    await settleWorker();
  }
  return {
    fake,
    history,
    search: await import('../../src/background/search/pipeline'),
    engine: await import('../../src/background/search/engine-suggestions'),
    defaultEngine: await import('../../src/background/search/default-engine')
  };
}

// A search request from a page, answered with its suggestions.
interface SuggestionsReply {
  suggestions: { url: string; type?: string; title?: string; _xMatchedTabId?: number }[];
  hasRemoteSuggestions?: boolean;
  aborted?: boolean;
}

function readSuggestionsReply(reply: unknown): SuggestionsReply {
  const suggestions: unknown = reply && typeof reply === 'object' ? Reflect.get(reply, 'suggestions') : undefined;
  if (!reply || typeof reply !== 'object' || !Array.isArray(suggestions)) {
    throw new Error(`not a suggestions reply: ${JSON.stringify(reply)}`);
  }
  const flag = (name: string) => {
    const value: unknown = Reflect.get(reply, name);
    return typeof value === 'boolean' ? value : undefined;
  };
  return {
    suggestions: suggestions.map((item: unknown) => {
      const read = (name: string) => (item && typeof item === 'object' ? Reflect.get(item, name) : undefined);
      const tabId = read('_xMatchedTabId');
      return {
        url: String(read('url') || ''),
        type: typeof read('type') === 'string' ? String(read('type')) : undefined,
        title: typeof read('title') === 'string' ? String(read('title')) : undefined,
        _xMatchedTabId: typeof tabId === 'number' ? tabId : undefined
      };
    }),
    hasRemoteSuggestions: flag('hasRemoteSuggestions'),
    aborted: flag('aborted')
  };
}

async function requestSuggestions(worker: SearchWorker, message: Record<string, unknown>, timeoutMs = 1000): Promise<SuggestionsReply> {
  return readSuggestionsReply(await worker.fake.sendMessage(message, undefined, timeoutMs));
}

export { bootSearchWorker, engineSuggestions, onAbort, requestSuggestions, suggestionQuery, visit, wait };
export type { HistoryEntry, PageEntry, SearchWorker, SearchWorkerOptions, SuggestionsReply };
