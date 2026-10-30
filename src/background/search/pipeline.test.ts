import { describe, expect, it } from 'vitest';
import { bootSearchWorker, requestSuggestions } from '../../../tests/fakes/worker-search';
import type { SearchWorker } from '../../../tests/fakes/worker-search';

const DEVELOPER_DASHBOARD = {
  title: 'Chrome 应用商店开发者信息中心',
  url: 'https://chrome.google.com/webstore/devconsole/test-dashboard?hl=zh-CN'
};
const EDGE_USER_AGENT = 'Mozilla/5.0 (Macintosh) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0';

// The favicon each suggestion for "alpha" shows, by host.
async function requestFavicons(worker: SearchWorker): Promise<Record<string, string>> {
  const reply = await worker.fake.sendMessage({ action: 'getSearchSuggestions', query: 'alpha' }, undefined, 2000);
  const suggestions: unknown = reply && typeof reply === 'object' ? Reflect.get(reply, 'suggestions') : undefined;
  const items: unknown[] = Array.isArray(suggestions) ? suggestions : [];
  return Object.fromEntries(items.map((item) => {
    const read = (name: string) => String(item && typeof item === 'object' ? Reflect.get(item, name) || '' : '');
    return [hostOf(read('url')), read('favicon')];
  }));
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

describe('local search suggestions by source', () => {
  it('keeps a bookmark or history scope to that source', async () => {
    const { search } = await bootSearchWorker();

    const bookmarks = await search.getSearchSuggestions('github', { sourceTypes: ['bookmark'], includeOpenTabs: false });
    const history = await search.getSearchSuggestions('github', { sourceTypes: ['history'], includeOpenTabs: false });

    expect(bookmarks.length).toBeGreaterThan(0);
    expect(bookmarks.every((item) => item.type === 'bookmark')).toBe(true);
    expect(history.length).toBeGreaterThan(0);
    expect(history.every((item) => item.type === 'history')).toBe(true);
  });

  it('keeps a frequent-site scope asked for by message to top sites', async () => {
    const worker = await bootSearchWorker();

    const reply = await requestSuggestions(worker, {
      action: 'getSearchSuggestions',
      query: 'github',
      sourceTypes: ['topSite'],
      includeOpenTabs: false
    });

    expect(reply.suggestions.length).toBeGreaterThan(0);
    expect(reply.suggestions.every((item) => item.type === 'topSite')).toBe(true);
  });

  it("never offers Edge's promoted top sites, but keeps its history", async () => {
    const { search } = await bootSearchWorker({ userAgent: EDGE_USER_AGENT });

    expect(await search.getSearchSuggestions('github', { sourceTypes: ['topSite'], includeOpenTabs: false })).toHaveLength(0);
    const all = await search.getSearchSuggestions('github', { includeOpenTabs: false });
    expect(all.some((item) => item.type === 'history')).toBe(true);
    expect(all.every((item) => item.type !== 'topSite' && !item.isTopSite)).toBe(true);
  });

  it('does not bring back history the user turned off as a result source', async () => {
    const { search } = await bootSearchWorker({ sync: { _x_extension_search_result_source_types_2026_unique_: ['bookmark'] } });

    const history = await search.getSearchSuggestions('github', { sourceTypes: ['history'], includeOpenTabs: false });

    expect(history.filter((item) => item.type === 'history')).toHaveLength(0);
  });

  it('keeps open tabs in a scoped search unless told to leave them out', async () => {
    const { search } = await bootSearchWorker();
    const openTabUrl = 'https://app.testmu.com/enterprise-cloud';

    expect((await search.getSearchSuggestions('testmu', { sourceTypes: ['history'] }))
      .some((item) => item.url === openTabUrl)).toBe(true);
    expect((await search.getSearchSuggestions('testmu', { sourceTypes: ['history'], includeOpenTabs: false }))
      .some((item) => item.url === openTabUrl)).toBe(false);
  });

  it('answers with local browser results of the enabled sources', async () => {
    const { search } = await bootSearchWorker();

    const suggestions = await search.getSearchSuggestions('github');

    expect(suggestions.some((item) => item.url === 'https://github.com/')).toBe(true);
    expect(suggestions.some((item) => ['bookmark', 'history', 'topSite'].includes(String(item.type)))).toBe(true);
  });
});

describe('finding pages by their title', () => {
  it('finds a history page by a Chinese title fragment and leaves search result pages out', async () => {
    const { search } = await bootSearchWorker();

    const suggestions = await search.getSearchSuggestions('开发者信息中心', { sourceTypes: ['history'], includeOpenTabs: false });

    expect(suggestions.some((item) => item.type === 'history' && item.url === DEVELOPER_DASHBOARD.url)).toBe(true);
    expect(suggestions.some((item) => String(item.url).startsWith('https://www.google.com/search?'))).toBe(false);
  });

  it.each(['newtab', 'overlay'])('keeps the history match in %s search messages', async (surface) => {
    const worker = await bootSearchWorker();

    const reply = await requestSuggestions(worker, {
      action: 'getSearchSuggestions',
      query: '开发者信息中心',
      context: surface,
      includeOpenTabs: false
    });

    expect(reply.suggestions.some((item) => item.url === DEVELOPER_DASHBOARD.url)).toBe(true);
  });

  it('finds the page among bookmarks', async () => {
    const { search } = await bootSearchWorker({ bookmarks: [{ id: '11', parentId: '1', ...DEVELOPER_DASHBOARD }] });

    const suggestions = await search.getSearchSuggestions('开发者信息中心', { sourceTypes: ['bookmark'], includeOpenTabs: false });

    expect(suggestions.some((item) => item.type === 'bookmark' && item.url === DEVELOPER_DASHBOARD.url)).toBe(true);
  });

  it('finds the page as an open tab, leaving unrelated tabs out', async () => {
    const { search } = await bootSearchWorker({
      openTabs: [
        { id: 27, windowId: 1, ...DEVELOPER_DASHBOARD },
        { id: 28, windowId: 1, title: '账户安全中心 - Example', url: 'https://example.test/settings/security/account' },
        { id: 29, windowId: 1, title: 'Unrelated page', url: 'https://example.test/other' }
      ]
    });

    const dashboard = await search.getSearchSuggestions('开发者信息中心', { sourceTypes: ['bookmark'] });
    const security = await search.getSearchSuggestions('账户安全', { sourceTypes: ['bookmark'] });

    expect(dashboard).toHaveLength(1);
    expect(dashboard[0]).toMatchObject({ type: 'openTab', url: DEVELOPER_DASHBOARD.url, _xMatchedTabId: 27 });
    expect(security.some((item) => item._xMatchedTabId === 28 && Number(item.score) > 0)).toBe(true);
  });

  it('shows a visited page that is also bookmarked once, as the bookmark, without lowering its rank', async () => {
    const historyOnly = await bootSearchWorker();
    const historyRow = (await historyOnly.search.getSearchSuggestions('github', { includeOpenTabs: false }))
      .find((item) => item.url === 'https://github.com/');
    const bookmarked = await bootSearchWorker({ bookmarks: [{ id: '12', parentId: '1', title: 'GitHub Home', url: 'https://github.com/' }] });

    const rows = (await bookmarked.search.getSearchSuggestions('github', { includeOpenTabs: false }))
      .filter((item) => item.url === 'https://github.com/');

    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('bookmark');
    expect(rows[0].visitCount).toBe(18);
    expect(Number(rows[0].score)).toBeGreaterThanOrEqual(Number(historyRow ? historyRow.score : Infinity));
  });
});

describe('composing the local results', () => {
  it('leads a pure brand query with the official site and caps the brand at three rows', async () => {
    const { search } = await bootSearchWorker();

    const suggestions = await search.getSearchSuggestions('小红书');

    expect(suggestions[0].url).toBe('https://www.xiaohongshu.com/');
    expect(suggestions.filter((item) => hostOf(String(item.url)).endsWith('xiaohongshu.com')).length).toBeLessThanOrEqual(3);
    expect(suggestions.some((item) => item._xMatchedTabId === 26)).toBe(true);
  });

  it('requires every term of the query', async () => {
    const { search } = await bootSearchWorker();

    const suggestions = await search.getSearchSuggestions('codex 最爱', { sourceTypes: ['history'], includeOpenTabs: false });

    expect(suggestions.map((item) => item.url)).toEqual(['https://example.com/codex-favorite']);
  });

  it('matches a dotted query against the whole host', async () => {
    const { search } = await bootSearchWorker();

    const suggestions = await search.getSearchSuggestions('code.0', { includeOpenTabs: false });

    expect(suggestions.some((item) => item.url === 'https://code.0http.com/')).toBe(true);
    expect(suggestions.some((item) => item.url === 'http://127.0.0.1:4321/')).toBe(false);
  });

  it('offers nothing when nothing matches', async () => {
    const { search } = await bootSearchWorker();

    expect(await search.getSearchSuggestions('definitely-no-local-match-xyz')).toHaveLength(0);
  });

  it('matches camel-case and multi-word title initials', async () => {
    const { search } = await bootSearchWorker();

    expect((await search.getSearchSuggestions('fcc')).some((item) => item.url === 'https://apps.apple.com/final-cut-camera')).toBe(true);
  });

  it('matches the initials of an open tab title', async () => {
    const { search } = await bootSearchWorker();

    expect((await search.getSearchSuggestions('DETC'))
      .some((item) => item.url === 'https://app.testmu.com/enterprise-cloud' && item._xMatchedTabId === 25)).toBe(true);
  });
});

describe('the local sources over time', () => {
  it('forgets a page once its history is deleted', async () => {
    const worker = await bootSearchWorker();
    await worker.search.getSearchSuggestions('github');

    const reply = await worker.fake.sendMessage({ action: 'deleteHistoryUrl', url: 'https://github.com/' });

    expect(reply).toMatchObject({ ok: true, url: 'https://github.com/' });
    expect((await worker.search.getSearchSuggestions('github')).some((item) => item.url === 'https://github.com/')).toBe(false);
  });

  it('answers before the full history and bookmark indexes warm, and matches fuzzily once they have', async () => {
    let warmColdIndexes = () => {};
    const coldIndexGate = new Promise<void>((resolve) => {
      warmColdIndexes = resolve;
    });
    const { search } = await bootSearchWorker({ coldIndexGate });

    const first = await search.getSearchSuggestions('github');

    expect(first.some((item) => item.url === 'https://github.com/')).toBe(true);
    warmColdIndexes();
    await expect.poll(async () => (await search.getSearchSuggestions('fcc'))
      .some((item) => item.url === 'https://apps.apple.com/final-cut-camera'), { timeout: 5000 }).toBe(true);
  });
});

// A worker woken by a search has not read the favicon settings yet; its
// first suggestions must already leave excluded sites out of third-party
// favicon fetches. Without the browser's favicon cache (an extension base
// that is no chrome-extension:// URL) the favicon service comes first.
describe('suggestion favicons on a cold worker', () => {
  it('applies the favicon exclusion to the first suggestions', async () => {
    const worker = await bootSearchWorker({
      sync: {
        _x_extension_favicon_request_blacklist_2026_unique_: ['secret.example.test'],
        _x_extension_favicon_enhanced_fetch_enabled_2026_unique_: true
      },
      history: (now) => [
        { url: 'https://secret.example.test/page', title: 'alpha secret', visitCount: 5, typedCount: 0, lastVisitTime: now },
        { url: 'https://open.example.test/page', title: 'alpha open', visitCount: 5, typedCount: 0, lastVisitTime: now }
      ],
      settingsDelayMs: 50,
      configure: (fake) => fake.chrome.runtime.getURL.mockImplementation((path) => `/lumno/${path}`)
    });

    const reply = await requestFavicons(worker);

    expect(reply['secret.example.test']).not.toMatch(/gstatic/);
    expect(reply['open.example.test']).toMatch(/gstatic/);
  });
});

describe('suggestion favicons', () => {
  it("takes browser pages' and excluded sites' icons from the browser, and shows Lumno's icon for its own pages", async () => {
    const options = 'chrome-extension://lumno-test/src/options/options.html';
    const worker = await bootSearchWorker({
      sync: {
        _x_extension_favicon_request_blacklist_2026_unique_: ['secret.example.test'],
        _x_extension_favicon_enhanced_fetch_enabled_2026_unique_: true
      },
      history: (now) => [
        { url: 'chrome://settings/alpha', title: 'alpha settings', visitCount: 5, typedCount: 0, lastVisitTime: now },
        { url: 'https://secret.example.test/page', title: 'alpha secret', visitCount: 5, typedCount: 0, lastVisitTime: now },
        { url: 'https://open.example.test/page', title: 'alpha open', visitCount: 5, typedCount: 0, lastVisitTime: now },
        { url: options, title: 'alpha settings page', visitCount: 5, typedCount: 0, lastVisitTime: now }
      ]
    });
    const reply = await worker.fake.sendMessage({ action: 'getSearchSuggestions', query: 'alpha' }, undefined, 2000);
    const suggestions: unknown = reply && typeof reply === 'object' ? Reflect.get(reply, 'suggestions') : undefined;
    const favicons = new Map((Array.isArray(suggestions) ? suggestions : []).map((item: unknown) => {
      const read = (name: string) => String(item && typeof item === 'object' ? Reflect.get(item, name) || '' : '');
      return [read('url'), read('favicon')];
    }));
    const browserCache = (pageUrl: string) => `chrome-extension://lumno-test/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=128`;

    expect(favicons.get('chrome://settings/alpha')).toBe(browserCache('chrome://settings/alpha'));
    expect(favicons.get('https://secret.example.test/page')).toBe(`${browserCache('https://secret.example.test/page')}&fallbackToHost=0`);
    expect(favicons.get('https://open.example.test/page')).toBe(`${browserCache('https://open.example.test/page')}&fallbackToHost=0`);
    expect(favicons.get(options)).toBe('chrome-extension://lumno-test/assets/images/lumno.png');
  });
});
