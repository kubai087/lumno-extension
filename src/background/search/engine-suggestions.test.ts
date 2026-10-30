import { describe, expect, it, vi } from 'vitest';
import { bootSearchWorker, engineSuggestions, onAbort, requestSuggestions, suggestionQuery, wait } from '../../../tests/fakes/worker-search';
import type { FetchHandler } from '../../../tests/fakes/worker';

const KEYWORD_SUGGESTIONS = ['什么东西', '什么东西补血', '什么东西解酒', '什么东西补钙', '什么东西补铁', '什么东西越剪越大', '什么东西养胃', '什么东西化痰'];

// The suggestion service with an answer for each query it knows; it fails
// for any other.
function suggestionService(answers: Record<string, string[]>, delayMs: Record<string, number> = {}) {
  const asked: string[] = [];
  const handler: FetchHandler = async (url) => {
    const query = suggestionQuery(url);
    if (query === null || !answers[query]) throw new Error(`network disabled: ${url}`);
    asked.push(query);
    if (delayMs[query]) await wait(delayMs[query]);
    return engineSuggestions(query, answers[query]);
  };
  return { asked, handler };
}

function isEngineRow(item: { type?: string }): boolean {
  return item.type === 'googleSuggest';
}

describe('merging search engine suggestions into the local results', () => {
  const service = () => suggestionService({
    github: ['github', 'github login', 'github desktop', 'github copilot', 'github actions', 'github pages'],
    小红书: ['小红书薯币购买', '小红书薯条购买', '小红书网页版']
  });

  it('keeps the local results first and adds up to three engine suggestions after them', async () => {
    const { search, engine, defaultEngine } = await bootSearchWorker({ fetch: service().handler });
    defaultEngine.setDefaultSearchEngineState({
      id: 'google',
      name: 'Google',
      host: 'www.google.com',
      searchTemplate: 'https://www.google.com/search?q={query}'
    }, false);
    const local = await search.getSearchSuggestions('github');

    const merged = await engine.getSearchEngineSuggestions('github', local);

    expect(local.filter(isEngineRow)).toHaveLength(0);
    expect(merged.filter(isEngineRow)).toHaveLength(3);
    const mergedUrls = new Set(merged.filter((item) => !isEngineRow(item)).map((item) => item.url));
    local.forEach((item) => expect(mergedUrls.has(item.url)).toBe(true));
    const firstEngine = merged.findIndex(isEngineRow);
    const lastLocal = merged.reduce((last, item, index) => (isEngineRow(item) ? last : index), -1);
    expect(merged.findIndex((item) => !isEngineRow(item))).toBe(0);
    expect(firstEngine).toBeGreaterThan(lastLocal);
  });

  it('reserves five engine suggestions after the exact-title row when search comes first', async () => {
    const { search, engine } = await bootSearchWorker({ fetch: service().handler });
    const local = await search.getSearchSuggestions('github');

    const merged = await engine.getSearchEngineSuggestions('github', local, { searchFirst: true });

    expect(merged.filter(isEngineRow)).toHaveLength(5);
    expect(merged[0].title).toBe('GitHub');
    expect(merged.slice(1, 6).every(isEngineRow)).toBe(true);
  });

  it('keeps the official brand site first, the open brand tab next and the webpages before the suggestions', async () => {
    const { search, engine } = await bootSearchWorker({ fetch: service().handler });
    const local = await search.getSearchSuggestions('小红书');

    const merged = await engine.getSearchEngineSuggestions('小红书', local);

    expect(merged[0].url).toBe('https://www.xiaohongshu.com/');
    expect(merged[1]._xMatchedTabId).toBe(26);
    const firstEngine = merged.findIndex(isEngineRow);
    const lastLocal = merged.reduce((last, item, index) => (isEngineRow(item) ? last : index), -1);
    expect(firstEngine).toBeGreaterThan(lastLocal);
  });

  it('asks the engine only for the separate remote request, and keeps its order without the query itself', async () => {
    const remote = suggestionService({ 什么东西: KEYWORD_SUGGESTIONS }, { 什么东西: 240 });
    const { search, engine } = await bootSearchWorker({ fetch: remote.handler });

    const local = await search.getSearchSuggestions('什么东西');

    expect(remote.asked).toEqual([]);
    expect(local.every((item) => !isEngineRow(item))).toBe(true);
    const merged = await engine.getSearchEngineSuggestions('什么东西', local);
    expect(remote.asked).toEqual(['什么东西']);
    expect(merged.filter(isEngineRow).map((item) => item.title))
      .toEqual(['什么东西补血', '什么东西解酒', '什么东西补钙', '什么东西补铁', '什么东西越剪越大']);
  });
});

describe('remote suggestion requests', () => {
  it('aborts the fetch of a request a newer one from the same surface replaced', async () => {
    const aborted = vi.fn();
    const worker = await bootSearchWorker({
      fetch: (url, init) => {
        const query = suggestionQuery(url);
        if (query === 'slow-abort') {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve(engineSuggestions(query, ['slow-abort result'])), 500);
            onAbort(init, () => {
              clearTimeout(timer);
              aborted();
              reject(new Error('aborted'));
            });
          });
        }
        if (query === 'fast-replacement') return engineSuggestions(query, ['fast replacement result']);
        throw new Error('network disabled');
      }
    });

    const slow = requestSuggestions(worker, { action: 'getSearchEngineSuggestions', query: 'slow-abort', context: 'overlay', localSuggestions: [] }, 1200);
    await wait(20);
    const replacement = await requestSuggestions(worker, {
      action: 'getSearchEngineSuggestions',
      query: 'fast-replacement',
      context: 'overlay',
      localSuggestions: []
    }, 1200);

    expect(aborted).toHaveBeenCalledTimes(1);
    expect((await slow).aborted).toBe(true);
    expect(replacement.aborted).toBe(false);
    expect(replacement.hasRemoteSuggestions).toBe(true);
    expect(replacement.suggestions.some(isEngineRow)).toBe(true);
  });

  it('tells the page to keep its local results when the engine has nothing', async () => {
    const worker = await bootSearchWorker();

    const reply = await requestSuggestions(worker, {
      action: 'getSearchEngineSuggestions',
      query: 'no-remote-results',
      context: 'newtab',
      localSuggestions: []
    }, 1200);

    expect(reply.hasRemoteSuggestions).toBe(false);
  });

  it('aborts a fetch that runs past the timeout', async () => {
    const aborted = vi.fn();
    const worker = await bootSearchWorker({
      fetch: (url, init) => new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(engineSuggestions(String(suggestionQuery(url)), ['late result'])), 1100);
        onAbort(init, () => {
          clearTimeout(timer);
          aborted();
          reject(new Error('timed out'));
        });
      })
    });

    const reply = await requestSuggestions(worker, {
      action: 'getSearchEngineSuggestions',
      query: 'timeout-abort',
      context: 'newtab',
      localSuggestions: []
    }, 1500);

    expect(aborted).toHaveBeenCalledTimes(1);
    expect(reply.hasRemoteSuggestions).toBe(false);
  });

  it('waits for the stored default engine on a cold start', async () => {
    const remote = suggestionService({ 什么东西: ['什么东西可以解辣', '什么东西意味着'] });
    const worker = await bootSearchWorker({
      sync: {
        _x_extension_default_search_engine_2024_unique_: {
          id: 'google',
          name: 'Google',
          host: 'www.google.com',
          searchTemplate: 'https://www.google.com/search?q={query}'
        }
      },
      settingsDelayMs: 160,
      fetch: remote.handler
    });

    const reply = await requestSuggestions(worker, { action: 'getSearchEngineSuggestions', query: '什么东西', context: 'newtab', localSuggestions: [] });

    expect(remote.asked).toEqual(['什么东西']);
    expect(reply.hasRemoteSuggestions).toBe(true);
    expect(reply.suggestions.filter(isEngineRow).length).toBeGreaterThan(1);
  });

  it('asks Google when no search engine was stored', async () => {
    const remote = suggestionService({ 什么东西: ['什么东西可以解辣', '什么东西意味着'] });
    const worker = await bootSearchWorker({ fetch: remote.handler });

    const reply = await requestSuggestions(worker, { action: 'getSearchEngineSuggestions', query: '什么东西', context: 'newtab', localSuggestions: [] });

    expect(remote.asked).toEqual(['什么东西']);
    expect(reply.hasRemoteSuggestions).toBe(true);
  });

  // The prefill hotkey opens the overlay with the full current URL; neither
  // it nor any other URL, host or path may reach the suggestion provider.
  it('never sends an address, host or path to the suggestion provider', async () => {
    const asked: (string | null)[] = [];
    const worker = await bootSearchWorker({
      fetch: (url) => {
        const query = suggestionQuery(url);
        if (query === null) throw new Error('unexpected request');
        asked.push(query);
        return engineSuggestions(query, ['remote keyword']);
      }
    });
    const addresses = [
      'https://wiki.corp.example/private/page?token=secret',
      'https://wiki.corp.example/private/page?token=secret more words',
      'file:///Users/someone/Documents/contract.pdf',
      'jira.internal/browse/SEC-1',
      '10.0.0.8:8080/admin'
    ];

    for (const query of addresses) {
      await worker.fake.sendMessage({ action: 'getSearchSuggestions', query, context: 'overlay' }, undefined, 200);
      const reply = await requestSuggestions(worker, { action: 'getSearchEngineSuggestions', query, context: 'overlay', localSuggestions: [] });
      expect(reply.hasRemoteSuggestions).toBe(false);
    }
    expect(asked).toEqual([]);
    await requestSuggestions(worker, { action: 'getSearchEngineSuggestions', query: 'weather tomorrow', context: 'overlay', localSuggestions: [] });
    expect(asked).toEqual(['weather tomorrow']);
  });
});

describe('prefetching engine suggestions', () => {
  it('starts the engine request while a slow local search runs, and reuses it for the remote request', async () => {
    let fetchStartedAt = 0;
    const fetched = vi.fn();
    const worker = await bootSearchWorker({
      historySearchDelayMs: 280,
      fetch: (url) => {
        const query = suggestionQuery(url);
        if (query !== 'prefetch-engine') throw new Error('unexpected prefetch request');
        fetched();
        fetchStartedAt = Date.now();
        return engineSuggestions(query, ['prefetch engine result']);
      }
    });

    const requestedAt = Date.now();
    const local = await requestSuggestions(worker, { action: 'getSearchSuggestions', query: 'prefetch-engine', context: 'overlay' });
    const answeredAt = Date.now();

    expect(local.suggestions.some(isEngineRow)).toBe(false);
    expect(fetchStartedAt).toBeGreaterThanOrEqual(requestedAt);
    expect(fetchStartedAt).toBeLessThan(answeredAt);
    const remote = await requestSuggestions(worker, {
      action: 'getSearchEngineSuggestions',
      query: 'prefetch-engine',
      context: 'overlay',
      localSuggestions: local.suggestions
    });
    expect(fetched).toHaveBeenCalledTimes(1);
    expect(remote.hasRemoteSuggestions).toBe(true);
  });

  it('aborts a started prefetch when a newer local query from the same surface comes', async () => {
    const aborted = vi.fn();
    const worker = await bootSearchWorker({
      fetch: (url, init) => {
        const query = suggestionQuery(url);
        if (query === 'prefetch-superseded') {
          return new Promise((_resolve, reject) => {
            onAbort(init, () => {
              aborted();
              reject(new Error('prefetch superseded'));
            });
          });
        }
        if (query === 'prefetch-replacement') return engineSuggestions(query, ['prefetch replacement result']);
        throw new Error('unexpected prefetch query');
      }
    });

    await worker.fake.sendMessage({ action: 'getSearchSuggestions', query: 'prefetch-superseded', context: 'overlay' }, undefined, 1000);
    await wait(150);
    const local = await requestSuggestions(worker, { action: 'getSearchSuggestions', query: 'prefetch-replacement', context: 'overlay' });

    expect(aborted).toHaveBeenCalledTimes(1);
    const remote = await requestSuggestions(worker, {
      action: 'getSearchEngineSuggestions',
      query: 'prefetch-replacement',
      context: 'overlay',
      localSuggestions: local.suggestions
    });
    expect(remote.hasRemoteSuggestions).toBe(true);
  });
});
