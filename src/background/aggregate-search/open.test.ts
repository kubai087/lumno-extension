import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SiteSearchProvider } from '../../domain/search/types';
import { openAggregateSearch } from './open';
import { ACTIVATION_FEEDBACK_DELAY_MS } from './tabs';
import type { ScheduleActivation } from './types';

interface TabsFakeOptions {
  failUrls?: string[];
  failAllCreates?: boolean;
  groupError?: string;
  titleError?: string;
  activateError?: string;
  omitGroupApi?: boolean;
  omitTabGroupsApi?: boolean;
}

// The tab calls an aggregate search makes, as the global chrome the worker
// passes it; each call answers with runtime.lastError set as Chrome does.
function installTabsFake(options: TabsFakeOptions = {}) {
  const runtime: { lastError: { message: string } | null } = { lastError: null };
  let nextTabId = 100;
  const answer = <T>(error: string | undefined, callback: (value: T) => void, value: T) => {
    runtime.lastError = error ? { message: error } : null;
    callback(value);
    runtime.lastError = null;
  };
  const create = vi.fn((properties: chrome.tabs.CreateProperties, callback: (tab: object | null) => void) => {
    if (options.failAllCreates || (options.failUrls || []).includes(String(properties.url))) {
      answer('create failed', callback, null);
      return;
    }
    nextTabId += 1;
    answer('', callback, { id: nextTabId, windowId: properties.windowId, url: properties.url, active: properties.active });
  });
  const update = vi.fn((tabId: number, properties: chrome.tabs.UpdateProperties, callback: (tab: object) => void) => {
    answer(options.activateError, callback, { id: tabId, ...properties });
  });
  const group = vi.fn((properties: { tabIds: number[] }, callback: (groupId: number) => void) => {
    answer(options.groupError, callback, 44);
  });
  const titleGroup = vi.fn((groupId: number, _properties: { title?: string }, callback: (group: object) => void) => {
    answer(options.titleError, callback, { id: groupId });
  });
  vi.stubGlobal('chrome', {
    runtime,
    tabs: options.omitGroupApi ? { create, update } : { create, update, group },
    ...(options.omitTabGroupsApi ? {} : { tabGroups: { update: titleGroup } })
  });
  return {
    created: () => create.mock.calls.map(([properties]) => properties),
    grouped: () => group.mock.calls.map(([properties]) => properties.tabIds),
    titled: () => titleGroup.mock.calls.map(([groupId, properties]) => ({ groupId, title: properties.title })),
    activated: () => update.mock.calls.map(([tabId, properties]) => ({ tabId, ...properties }))
  };
}

const google: SiteSearchProvider = { key: 'google', template: 'https://www.google.com/search?q={query}' };
const chatgpt: SiteSearchProvider = {
  key: 'chatgpt',
  template: 'https://chatgpt.com/',
  action: 'openAndSubmit',
  submitStrategy: 'chatgptPrompt'
};

function getEntryUrl(provider: SiteSearchProvider, query: string): string {
  return String(provider.template || '').replace('{query}', encodeURIComponent(query));
}

function isInteractiveProvider(provider: SiteSearchProvider): boolean {
  return provider.action === 'openAndSubmit';
}

// Activations the search leaves for later, to run from the test.
function createActivationQueue() {
  const tasks: { task: () => void; delayMs: number }[] = [];
  const schedule: ScheduleActivation = (task, delayMs) => {
    tasks.push({ task, delayMs });
  };
  return { tasks, schedule };
}

describe('opening an aggregate search', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens every source in a named group, activates the first and types the prompt into the AI source', async () => {
    const tabs = installTabsFake();
    const waitForTabComplete = vi.fn(async (tabId: number) => ({ id: tabId, status: 'complete' }));
    const submitPromptInTab = vi.fn(async () => ({ ok: true, method: 'content-script' }));

    const result = await openAggregateSearch(chrome, {
      definition: { id: 'ai', key: '', name: '人工智能', sourceRefs: [], autoCreateTabGroup: false },
      query: 'Lumno 聚合搜索',
      providers: [google, chatgpt],
      autoCreateTabGroup: true,
      windowId: 7,
      disposition: 'newTab',
      getEntryUrl,
      isInteractiveProvider,
      waitForTabComplete,
      submitPromptInTab
    });

    expect(result).toMatchObject({
      ok: true,
      openedCount: 2,
      failedCount: 0,
      grouped: true,
      groupId: 44,
      groupTitleApplied: true,
      activatedTabId: 101,
      interactiveRequestedCount: 1,
      interactiveSucceededCount: 1
    });
    expect(tabs.created()).toEqual([
      { url: 'https://www.google.com/search?q=Lumno%20%E8%81%9A%E5%90%88%E6%90%9C%E7%B4%A2', active: false, windowId: 7 },
      { url: 'https://chatgpt.com/', active: false, windowId: 7 }
    ]);
    expect(tabs.grouped()).toEqual([[101, 102]]);
    expect(tabs.titled()).toEqual([{ groupId: 44, title: '人工智能：Lumno 聚合搜索' }]);
    expect(tabs.activated()).toEqual([{ tabId: 101, active: true }]);
    expect(waitForTabComplete.mock.calls).toEqual([[102, 15000]]);
    expect(submitPromptInTab.mock.calls).toEqual([[chrome, 102, 'Lumno 聚合搜索', 'chatgptPrompt', 'https://chatgpt.com/']]);
  });

  it('keeps the results consecutive and in order when a source fails to open', async () => {
    const tabs = installTabsFake({ failUrls: ['https://failed.test/?q=ordered'] });

    await openAggregateSearch(chrome, {
      query: 'ordered',
      providers: [
        { key: 'first', template: 'https://first.test/?q={query}' },
        { key: 'failed', template: 'https://failed.test/?q={query}' },
        { key: 'last', template: 'https://last.test/?q={query}' }
      ],
      autoCreateTabGroup: false,
      windowId: 7,
      insertIndex: 4,
      getEntryUrl,
      disposition: 'backgroundTab'
    });

    expect(tabs.created().map((properties) => properties.index)).toEqual([4, 5, 5]);
    expect(tabs.activated()).toEqual([]);
  });

  it.each([
    [undefined, '测试'],
    [{}, '测试'],
    [{ name: '' }, '测试'],
    [{ name: ' \n\t ' }, '测试'],
    [{ name: '  人工智能  ' }, '人工智能：测试'],
    [{ name: 'AI 🔎' }, 'AI 🔎：测试']
  ])('titles the group of definition %j as %s', async (named, title) => {
    const tabs = installTabsFake();
    const definition = named === undefined ? undefined
      : { id: 'named', key: '', sourceRefs: [], autoCreateTabGroup: true, name: '', ...named };

    const result = await openAggregateSearch(chrome, {
      definition,
      query: '  测试  ',
      providers: [google],
      autoCreateTabGroup: true,
      disposition: 'backgroundTab',
      getEntryUrl
    });

    expect(result.groupTitleApplied).toBe(true);
    expect(tabs.titled()).toEqual([{ groupId: 44, title }]);
    expect(tabs.created()[0].url).toBe('https://www.google.com/search?q=%E6%B5%8B%E8%AF%95');
  });

  it('neither groups, names nor activates background results with grouping off', async () => {
    const tabs = installTabsFake();

    const result = await openAggregateSearch(chrome, {
      definition: { id: 'ai', key: '', name: '人工智能', sourceRefs: [], autoCreateTabGroup: true },
      query: 'quiet',
      providers: [google],
      autoCreateTabGroup: false,
      disposition: 'backgroundTab',
      getEntryUrl
    });

    expect(result).toMatchObject({ ok: true, grouped: false, activatedTabId: null });
    expect(tabs.activated()).toEqual([]);
    expect(tabs.grouped()).toEqual([]);
    expect(tabs.titled()).toEqual([]);
  });

  it('still opens the search tabs when grouping fails', async () => {
    const tabs = installTabsFake({ groupError: 'group denied' });

    const result = await openAggregateSearch(chrome, {
      query: 'degraded',
      providers: [google, chatgpt],
      autoCreateTabGroup: true,
      disposition: 'backgroundTab',
      getEntryUrl
    });

    expect(result).toMatchObject({ ok: true, openedCount: 2, grouped: false, groupId: null, reason: 'group denied' });
    expect(tabs.created().map((properties) => properties.active)).toEqual([false, false]);
    expect(tabs.titled()).toEqual([]);
  });

  it('groups what opened and leaves the activation for after the feedback delay when a source fails', async () => {
    const tabs = installTabsFake({ failUrls: ['https://www.google.com/search?q=partial'] });
    const activations = createActivationQueue();

    const result = await openAggregateSearch(chrome, {
      query: 'partial',
      providers: [google, chatgpt],
      autoCreateTabGroup: true,
      getEntryUrl,
      isInteractiveProvider,
      scheduleActivation: activations.schedule,
      submitPromptInTab: async () => ({ ok: true })
    });

    expect(result).toMatchObject({
      ok: true,
      requestedCount: 2,
      openedCount: 1,
      failedCount: 1,
      reason: 'partial-tab-create-failure',
      activationDeferred: true,
      activationDelayMs: ACTIVATION_FEEDBACK_DELAY_MS
    });
    expect(tabs.grouped()).toEqual([[101]]);
    expect(tabs.activated()).toEqual([]);
    expect(activations.tasks.map((task) => task.delayMs)).toEqual([ACTIVATION_FEEDBACK_DELAY_MS]);
  });

  it('fails without grouping, naming or activating when no source opens', async () => {
    const tabs = installTabsFake({ failAllCreates: true });

    const result = await openAggregateSearch(chrome, {
      query: 'nothing opened',
      providers: [google, chatgpt],
      autoCreateTabGroup: true,
      getEntryUrl,
      isInteractiveProvider
    });

    expect(result).toMatchObject({ ok: false, requestedCount: 2, openedCount: 0, failedCount: 2, reason: 'tab-create-failed' });
    expect(tabs.grouped()).toEqual([]);
    expect(tabs.titled()).toEqual([]);
    expect(tabs.activated()).toEqual([]);
  });

  it('defers the activation when the group cannot be named', async () => {
    const tabs = installTabsFake({ titleError: 'title denied' });
    const activations = createActivationQueue();

    const result = await openAggregateSearch(chrome, {
      query: 'title failure',
      providers: [google],
      autoCreateTabGroup: true,
      getEntryUrl,
      scheduleActivation: activations.schedule
    });

    expect(result).toMatchObject({
      ok: true,
      grouped: true,
      groupId: 44,
      groupTitleApplied: false,
      reason: 'title denied',
      activationDeferred: true
    });
    expect(activations.tasks.map((task) => task.delayMs)).toEqual([ACTIVATION_FEEDBACK_DELAY_MS]);
    activations.tasks[0].task();
    expect(tabs.activated()).toEqual([{ tabId: 101, active: true }]);
  });

  it('reports a refused activation as a warning', async () => {
    const tabs = installTabsFake({ activateError: 'activation denied' });

    const result = await openAggregateSearch(chrome, { query: 'activation failure', providers: [google], getEntryUrl });

    expect(result).toMatchObject({
      ok: true,
      activatedTabId: null,
      activationDeferred: false,
      activationDelayMs: 0,
      reason: 'activation denied',
      warnings: ['activation denied']
    });
    expect(tabs.activated()).toEqual([{ tabId: 101, active: true }]);
  });

  it('activates at once when the activation cannot be scheduled', async () => {
    const tabs = installTabsFake({ groupError: 'group denied' });

    const result = await openAggregateSearch(chrome, {
      query: 'scheduler failure',
      providers: [google],
      autoCreateTabGroup: true,
      getEntryUrl,
      scheduleActivation() {
        throw new Error('scheduler failed');
      }
    });

    expect(result).toMatchObject({
      ok: true,
      activatedTabId: 101,
      activationDeferred: false,
      activationDelayMs: 0,
      warnings: ['group denied', 'scheduler failed']
    });
    expect(tabs.activated()).toEqual([{ tabId: 101, active: true }]);
  });

  it('activates the static result rather than an AI source whose prompt failed', async () => {
    const tabs = installTabsFake();
    const activations = createActivationQueue();

    const result = await openAggregateSearch(chrome, {
      query: 'mixed result',
      providers: [chatgpt, google],
      getEntryUrl,
      isInteractiveProvider,
      scheduleActivation: activations.schedule,
      submitPromptInTab: async () => ({ ok: false, reason: 'injection-failed' })
    });

    expect(result).toMatchObject({ ok: true, interactiveFailedCount: 1, activationDeferred: true });
    expect(activations.tasks).toHaveLength(1);
    activations.tasks[0].task();
    expect(tabs.activated()).toEqual([{ tabId: 102, active: true }]);
  });

  it('opens ungrouped where the browser has no tab groups', async () => {
    const tabs = installTabsFake({ omitGroupApi: true });

    const result = await openAggregateSearch(chrome, {
      query: 'ungrouped',
      providers: [google],
      autoCreateTabGroup: true,
      disposition: 'backgroundTab',
      getEntryUrl
    });

    expect(result).toMatchObject({ ok: true, grouped: false, reason: 'tab-group-api-unavailable' });
    expect(tabs.created()).toHaveLength(1);
  });

  it('fails without a tabs API', async () => {
    vi.stubGlobal('chrome', {});

    expect(await openAggregateSearch(chrome, { query: 'test', providers: [google, chatgpt], getEntryUrl }))
      .toMatchObject({ ok: false, reason: 'tabs-api-unavailable' });
  });

  it('opens nothing for a blank query', async () => {
    const tabs = installTabsFake();

    expect(await openAggregateSearch(chrome, { query: '   ', providers: [google, chatgpt], getEntryUrl }))
      .toMatchObject({ ok: false, reason: 'invalid-query' });
    expect(tabs.created()).toEqual([]);
  });

  it('never opens an address that is not http or https', async () => {
    const tabs = installTabsFake();

    const result = await openAggregateSearch(chrome, {
      query: 'unsafe',
      providers: [{ key: 'unsafe', template: 'data:text/html,unsafe' }],
      getEntryUrl
    });

    expect(result).toMatchObject({ ok: false, reason: 'provider-url-unavailable' });
    expect(tabs.created()).toEqual([]);
  });

  it('fails and activates nothing when the only source is an AI page that took no prompt', async () => {
    const tabs = installTabsFake();

    const result = await openAggregateSearch(chrome, {
      query: 'not submitted',
      providers: [chatgpt],
      getEntryUrl,
      isInteractiveProvider,
      submitPromptInTab: async () => ({ ok: false, reason: 'injection-failed' })
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'interactive-submit-failed',
      interactiveFailedCount: 1,
      activationDeferred: false,
      activationDelayMs: 0
    });
    expect(tabs.activated()).toEqual([]);
  });
});
