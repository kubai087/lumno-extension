import { describe, expect, it, vi } from 'vitest';
import { tabSwitcherEnabled, tabSwitcherThumbnail, tabSwitcherThumbnails } from '../../domain/settings/features';
import type { WorkerFake, WorkerTab } from '../../../tests/fakes/worker';
import { browserTab, installWorkerFake, settleWorker } from '../../../tests/fakes/worker';

// The browser events that take tab switcher thumbnails, counting
// chrome.tabs.captureVisibleTab calls by the tab they capture.

const SETTLE_WAIT_MS = 1100;
const JPEG = 'data:image/jpeg;base64,AAAA';
const STATE_KEY = tabSwitcherThumbnails.key;

function createTabs(): WorkerTab[] {
  return [
    { id: 11, windowId: 1, index: 0, active: true, url: 'https://mail.example.com/', title: 'Mail', status: 'complete' },
    { id: 12, windowId: 1, index: 1, active: false, url: 'https://news.example.com/', title: 'News', status: 'complete' },
    { id: 13, windowId: 1, index: 2, active: false, url: 'https://docs.example.com/', title: 'Docs', status: 'complete' }
  ];
}

interface BootOptions {
  enabled?: boolean;
  windowFocused?: boolean;
  session?: Record<string, unknown>;
}

async function bootCapture(options: BootOptions = {}) {
  const fake = installWorkerFake({ tabs: createTabs(), sync: { [tabSwitcherEnabled.key]: options.enabled !== false }, session: options.session });
  const captures: (number | null)[] = [];
  fake.chrome.tabs.captureVisibleTab.mockImplementation((windowId, optionsOrCallback, maybeCallback) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    const activeTab = fake.tabs.find((tab) => tab.windowId === windowId && tab.active);
    captures.push(activeTab ? activeTab.id : null);
    setTimeout(() => callback && callback(JPEG), 0);
    return undefined;
  });
  fake.chrome.windows.get.mockImplementation((windowId, optionsOrCallback, maybeCallback) => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    setTimeout(() => callback && callback({ id: windowId, focused: options.windowFocused !== false }), 0);
    return undefined;
  });
  await import('../background');
  await settleWorker(30);
  const activate = (tabId: number) => {
    fake.tabs.forEach((tab) => {
      tab.active = tab.id === tabId;
    });
    fake.chrome.tabs.onActivated.fire({ tabId, windowId: 1 });
  };
  const tab = (tabId: number) => {
    const found = fake.tabs.find((each) => each.id === tabId);
    if (!found) throw new Error(`no tab ${tabId}`);
    return browserTab(found);
  };
  return { fake, captures, activate, tab };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// The state record lists the tabs with thumbnails; each thumbnail has its own key.
function storedThumbnailTabIds(fake: WorkerFake): unknown[] {
  const values = fake.storage.session.values;
  const state = values[STATE_KEY];
  const tabIds: unknown[] = isRecord(state) && Array.isArray(state.thumbnailTabIds) ? state.thumbnailTabIds : [];
  return tabIds
    .map((tabId) => values[tabSwitcherThumbnail.keyFor(String(tabId))])
    .filter((entry): entry is Record<string, unknown> => isRecord(entry) && Boolean(entry.dataUrl))
    .map((entry) => entry.tabId)
    .sort();
}

function writtenSessionKeys(fake: WorkerFake, fromCall = 0): string[] {
  return fake.chrome.storage.session.set.mock.calls.slice(fromCall).flatMap(([payload]) => Object.keys(payload));
}

describe('tab switcher thumbnails', () => {
  it('captures once, the tab the user stops on, when cycling through tabs', async () => {
    const session = await bootCapture();
    // Ctrl+Tab held down: a new tab every 300ms, then the user stops on 12.
    for (const tabId of [13, 11, 13, 12]) {
      session.activate(tabId);
      await settleWorker(300);
    }
    await settleWorker(SETTLE_WAIT_MS);

    expect(session.captures).toEqual([12]);
  });

  it('writes only the thumbnails that changed, also after the worker restarts', async () => {
    const session = await bootCapture();
    session.activate(12);
    await vi.waitFor(() => expect(storedThumbnailTabIds(session.fake)).toEqual([12]), { timeout: 3000 });
    const writesBefore = session.fake.chrome.storage.session.set.mock.calls.length;
    session.activate(11);
    await vi.waitFor(() => expect(storedThumbnailTabIds(session.fake)).toEqual([11, 12]), { timeout: 3000 });
    await settleWorker(100);
    const written = writtenSessionKeys(session.fake, writesBefore);
    expect(written).toContain(tabSwitcherThumbnail.keyFor(11));
    expect(written).not.toContain(tabSwitcherThumbnail.keyFor(12));

    const restarted = await bootCapture({ session: structuredClone(session.fake.storage.session.values) });
    restarted.fake.chrome.tabs.onActivated.fire({ tabId: 13, windowId: 1 });
    await settleWorker(600);
    expect(storedThumbnailTabIds(restarted.fake)).toEqual([11, 12]);
    expect(writtenSessionKeys(restarted.fake).some((key) => key.startsWith(tabSwitcherThumbnail.prefix))).toBe(false);
  });

  it('moves a state an earlier version saved with inline thumbnails to the split layout', async () => {
    const now = Date.now();
    const session = await bootCapture({
      session: {
        [STATE_KEY]: {
          version: 1,
          savedAt: now,
          stack: [{ id: 12, windowId: 1, url: 'https://news.example.com/', title: 'News', visitedAt: now }],
          thumbnails: [{ tabId: 12, url: 'https://news.example.com/', dataUrl: JPEG, capturedAt: now, updatedAt: now, status: 'ok' }]
        }
      }
    });
    session.fake.chrome.tabs.onActivated.fire({ tabId: 13, windowId: 1 });
    await settleWorker(600);

    expect(storedThumbnailTabIds(session.fake)).toEqual([12]);
    const state = session.fake.storage.session.values[STATE_KEY];
    expect(isRecord(state) && Array.isArray(state.thumbnails)).toBe(false);
  });

  it('does not capture again a thumbnail under a minute old, but always after a page load', async () => {
    const session = await bootCapture();
    session.activate(12);
    await settleWorker(SETTLE_WAIT_MS);
    session.activate(13);
    await settleWorker(SETTLE_WAIT_MS);
    session.activate(12);
    await settleWorker(SETTLE_WAIT_MS);
    session.fake.chrome.windows.onFocusChanged.fire(1);
    await settleWorker(SETTLE_WAIT_MS);
    expect(session.captures).toEqual([12, 13]);

    session.fake.chrome.tabs.onUpdated.fire(12, { status: 'complete' }, session.tab(12));
    await vi.waitFor(() => expect(session.captures).toEqual([12, 13, 12]), { timeout: 3000 });
  });

  it('does not capture a tab whose window lost focus', async () => {
    const session = await bootCapture({ windowFocused: false });
    session.activate(12);
    await settleWorker(SETTLE_WAIT_MS);

    expect(session.captures).toEqual([]);
  });

  it('never captures while the switcher is off', async () => {
    const session = await bootCapture({ enabled: false });
    session.activate(12);
    session.fake.chrome.windows.onFocusChanged.fire(1);
    session.fake.chrome.tabs.onUpdated.fire(12, { status: 'complete' }, session.tab(12));
    await settleWorker(SETTLE_WAIT_MS);

    expect(session.captures).toEqual([]);
  });

  it('drops its screenshots and stops capturing when the switcher is turned off', async () => {
    const session = await bootCapture();
    session.activate(12);
    await vi.waitFor(() => expect(storedThumbnailTabIds(session.fake)).toEqual([12]), { timeout: 3000 });
    session.fake.storage.sync.externalSet({ [tabSwitcherEnabled.key]: false });
    await vi.waitFor(() => expect(storedThumbnailTabIds(session.fake)).toEqual([]), { timeout: 3000 });

    session.activate(13);
    await settleWorker(SETTLE_WAIT_MS);
    expect(session.captures).toEqual([12]);
  });

  it('takes a fresh shot of the current tab right away when the switcher opens', async () => {
    const session = await bootCapture();
    session.activate(11);
    await settleWorker(SETTLE_WAIT_MS);
    expect(session.captures).toEqual([11]);
    // Clear of Chrome's two-captures-per-second limit.
    await settleWorker(700);
    session.fake.chrome.commands.onCommand.fire('show-tab-switcher', session.tab(11));

    await vi.waitFor(() => expect(session.captures).toEqual([11, 11]), { timeout: 1000 });
  });

  it('hides an open switcher for the capture, shows it again, and hands it the fresh image', async () => {
    const session = await bootCapture();
    const order: { tabId?: number; action: unknown; hidden?: unknown; thumbnail?: unknown }[] = [];
    session.fake.chrome.tabs.sendMessage.mockImplementation((tabId, message, optionsOrCallback, maybeCallback) => {
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
      const fields = isRecord(message) ? message : {};
      order.push({ tabId, action: fields.action, hidden: fields.hidden, thumbnail: fields.thumbnail });
      const response = fields.action === 'advanceOpenTabSwitcherFromCommand' ? { ok: true, open: false, advanced: false } : { ok: true };
      setTimeout(() => callback && callback(response), 0);
      return undefined;
    });
    const capture = session.fake.chrome.tabs.captureVisibleTab.getMockImplementation();
    session.fake.chrome.tabs.captureVisibleTab.mockImplementation((windowId, optionsOrCallback, maybeCallback) => {
      order.push({ action: 'captureVisibleTab' });
      return capture ? capture(windowId, optionsOrCallback, maybeCallback) : undefined;
    });
    session.fake.chrome.commands.onCommand.fire('show-tab-switcher');
    await vi.waitFor(() => expect(order.some((step) => step.action === 'updateTabSwitcherThumbnail')).toBe(true), { timeout: 2000 });

    const steps = order.map((step) => (step.action === 'setTabSwitcherCaptureVisibility' ? `${step.action}:${String(step.hidden)}` : step.action));
    const captureAt = steps.indexOf('captureVisibleTab');
    expect(captureAt).toBeGreaterThan(0);
    expect(steps[captureAt - 1]).toBe('setTabSwitcherCaptureVisibility:true');
    expect(steps[captureAt + 1]).toBe('setTabSwitcherCaptureVisibility:false');
    const update = order.find((step) => step.action === 'updateTabSwitcherThumbnail');
    expect(update && update.tabId).toBe(11);
    expect(String(update && update.thumbnail)).toMatch(/^data:image\//);
  });
});
