import { describe, expect, it, vi } from 'vitest';
import { pinnedTabRecoveryEnabled, pinnedTabSnapshot } from '../domain/settings/features';
import type { WorkerFakeOptions, WorkerTab } from '../../tests/fakes/worker';
import { browserTab, installWorkerFake, settleWorker } from '../../tests/fakes/worker';

const tabs: WorkerTab[] = [
  { id: 11, windowId: 1, index: 0, active: true, pinned: true, url: 'https://mail.example.com/', title: 'Mail' },
  { id: 12, windowId: 1, index: 1, active: false, pinned: false, url: 'https://news.example.com/', title: 'News' }
];

// A worker woken by an event: its start-up storage reads have not answered
// when the waking event fires.
async function wake(options: WorkerFakeOptions) {
  const fake = installWorkerFake({ tabs, ...options });
  await import('./background');
  return fake;
}

describe('the pinned tab snapshot', () => {
  it('records the pin change that woke the worker', async () => {
    const fake = await wake({ sync: { [pinnedTabRecoveryEnabled.key]: true }, storage: { sync: { hold: true } } });
    fake.chrome.tabs.onUpdated.fire(11, { pinned: true }, browserTab(tabs[0]));
    await settleWorker(20);
    fake.storage.sync.release();

    await vi.waitFor(() => expect(fake.storage.local.values[pinnedTabSnapshot.key])
      .toMatchObject({ urls: ['https://mail.example.com/'] }), { timeout: 2000 });
  });

  it('stays off while recovery is off', async () => {
    const fake = await wake({ sync: { [pinnedTabRecoveryEnabled.key]: false }, storage: { sync: { hold: true } } });
    fake.chrome.tabs.onUpdated.fire(11, { pinned: true }, browserTab(tabs[0]));
    fake.storage.sync.release();
    await settleWorker(900);

    expect(fake.storage.local.values[pinnedTabSnapshot.key]).toBeUndefined();
  });

  it('writes a pending snapshot at once when the worker is unloaded', async () => {
    const fake = await wake({ sync: { [pinnedTabRecoveryEnabled.key]: true } });
    await settleWorker(30);
    fake.chrome.tabs.onMoved.fire(11, {});
    fake.chrome.runtime.onSuspend.fire();
    await settleWorker(50);

    expect(fake.storage.local.values[pinnedTabSnapshot.key]).toBeTruthy();
  });
});
