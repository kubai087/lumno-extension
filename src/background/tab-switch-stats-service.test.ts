import { describe, expect, it } from 'vitest';
import { tabSwitchStats } from '../domain/settings/features';
import type { WorkerFakeOptions } from '../../tests/fakes/worker';
import { installWorkerFake, settleWorker } from '../../tests/fakes/worker';

// A worker woken by a tab event before its stored stats were read back.
async function wake(options: WorkerFakeOptions) {
  const fake = installWorkerFake({
    tabs: [
      { id: 11, windowId: 1, index: 0, active: true, url: 'https://mail.example.com/', title: 'Mail' },
      { id: 12, windowId: 1, index: 1, active: false, url: 'https://news.example.com/', title: 'News' }
    ],
    storage: { session: { hold: true } },
    ...options
  });
  await import('./background');
  return fake;
}

function storedStatTabs(values: Record<string, unknown>): string[] {
  const stored = values[tabSwitchStats.key];
  return stored && typeof stored === 'object' ? Object.keys(stored).sort() : [];
}

describe('tab switch stats on wake', () => {
  const earlier = Date.now() - 60 * 1000;

  it('keeps the stats saved before the worker slept when recording the waking switch', async () => {
    const fake = await wake({ session: { [tabSwitchStats.key]: { 7: { events: [earlier], lastSwitchAt: earlier } } } });
    fake.chrome.tabs.onActivated.fire({ tabId: 12, windowId: 1 });
    await settleWorker(20);
    fake.storage.session.release();
    await settleWorker(50);

    expect(storedStatTabs(fake.storage.session.values)).toEqual(['12', '7']);
  });

  it('does not bring back the stats of a tab closed before they were merged', async () => {
    const fake = await wake({
      session: {
        [tabSwitchStats.key]: {
          7: { events: [earlier], lastSwitchAt: earlier },
          12: { events: [earlier], lastSwitchAt: earlier }
        }
      }
    });
    fake.chrome.tabs.onActivated.fire({ tabId: 11, windowId: 1 });
    fake.chrome.tabs.onRemoved.fire(12, { windowId: 1, isWindowClosing: false });
    await settleWorker(20);
    fake.storage.session.release();
    await settleWorker(50);

    expect(storedStatTabs(fake.storage.session.values)).toEqual(['11', '7']);
  });
});
