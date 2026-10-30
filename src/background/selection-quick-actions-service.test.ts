import { describe, expect, it, vi } from 'vitest';
import { selectionQuickActionsEnabled, selectionQuickActionsGroupEnabled, selectionQuickActionsProvider } from '../domain/settings/features';
import { siteSearchDisabled } from '../domain/settings/search';
import type { WorkerTab } from '../../tests/fakes/worker';
import { browserTab, installWorkerFake, settleWorker } from '../../tests/fakes/worker';

// The selection toolbar's runSelectionQuickAction message, sent to the
// worker from a web page: which provider it opens, in which tab or group,
// and when it refuses.
const SOURCE_TAB: WorkerTab = { id: 5, windowId: 2, index: 0, active: true, url: 'https://article.example.com/', status: 'complete' };

async function bootSelectionWorker(sync: Record<string, unknown>, extraTabs: WorkerTab[] = []) {
  const fake = installWorkerFake({ tabs: [{ ...SOURCE_TAB }, ...extraTabs], sync });
  fake.chrome.tabGroups.query.mockImplementation((_query, callback) => {
    if (callback) setTimeout(() => callback([]), 0);
    return undefined;
  });
  fake.chrome.tabs.group.mockImplementation((_options, callback) => {
    if (callback) setTimeout(() => callback(40), 0);
    return undefined;
  });
  await import('./background');
  await settleWorker();
  const run = (request: Record<string, unknown> = {}) => fake.sendMessage(
    { action: 'runSelectionQuickAction', text: 'What does idempotent mean?', intent: 'explain', locale: 'en', ...request },
    { tab: browserTab(SOURCE_TAB), url: SOURCE_TAB.url || '' },
    3000
  );
  const created = () => fake.chrome.tabs.create.mock.calls.map(([properties]) => properties);
  const groupUpdates = () => fake.chrome.tabGroups.update.mock.calls.map(([, properties]) => properties);
  return { fake, run, created, groupUpdates };
}

describe('selection quick actions in the worker', () => {
  it.each([undefined, 'true', 1])('stays off unless the toolbar is turned on (%j)', async (value) => {
    const worker = await bootSelectionWorker(value === undefined ? {} : { [selectionQuickActionsEnabled.key]: value });

    expect(await worker.run()).toEqual({ ok: false, reason: 'selection-quick-actions-disabled' });
    expect(worker.created()).toEqual([]);
  });

  it('opens the chosen provider in front, even when it is hidden from the search sources', async () => {
    const worker = await bootSelectionWorker({
      [selectionQuickActionsEnabled.key]: true, [selectionQuickActionsProvider.key]: 'gm', [siteSearchDisabled.key]: ['gm']
    });
    await worker.run();
    const [tab] = worker.created();

    expect(new URL(String(tab.url)).hostname).toBe('gemini.google.com');
    expect(tab).toMatchObject({ active: true, openerTabId: SOURCE_TAB.id, windowId: SOURCE_TAB.windowId });
  });

  it('opens a grouped query in the background, in the AI group named in its language', async () => {
    const chinese = await bootSelectionWorker({
      [selectionQuickActionsEnabled.key]: true, [selectionQuickActionsProvider.key]: 'gpt', [selectionQuickActionsGroupEnabled.key]: true
    });
    await chinese.run({ locale: 'zh_CN' });

    expect(chinese.created()[0].active).toBe(false);
    expect(chinese.groupUpdates()[0]).toMatchObject({ title: 'AI 查询', color: 'blue' });

    const english = await bootSelectionWorker({
      [selectionQuickActionsEnabled.key]: true, [selectionQuickActionsProvider.key]: 'gpt', [selectionQuickActionsGroupEnabled.key]: true
    });
    await english.run({ locale: 'en' });
    expect(english.groupUpdates()[0]).toMatchObject({ title: 'AI Search' });
  });

  it('reuses an open page of the provider first, and opens one fresh tab when the prompt cannot be sent there', async () => {
    const worker = await bootSelectionWorker(
      { [selectionQuickActionsEnabled.key]: true, [selectionQuickActionsProvider.key]: 'gpt', [selectionQuickActionsGroupEnabled.key]: true },
      [{ id: 9, windowId: 2, index: 1, active: false, url: 'https://chatgpt.com/c/older', status: 'complete' }]
    );
    const response = await worker.run();

    await vi.waitFor(() => expect(worker.created()).toHaveLength(1));
    expect(worker.fake.chrome.tabs.group.mock.calls[0][0].tabIds).toBe(9);
    expect(new URL(String(worker.created()[0].url)).hostname).toBe('chatgpt.com');
    expect(response).toMatchObject({ ok: false });
  });

  it('refuses empty or oversized text', async () => {
    const worker = await bootSelectionWorker({ [selectionQuickActionsEnabled.key]: true });

    expect(await worker.run({ text: '   ' })).toMatchObject({ reason: 'invalid-selection-text' });
    expect(await worker.run({ text: 'x'.repeat(5000) })).toMatchObject({ reason: 'invalid-selection-text' });
    expect(worker.created()).toEqual([]);
  });
});
