import { describe, expect, it } from 'vitest';
import { updateNoticeState } from '../domain/settings/features';
import { isSameVersionReload } from './dev-extension-startup';
import type { WorkerTab } from '../../tests/fakes/worker';
import { bootWorker, injectionsInto, settleWorker } from '../../tests/fakes/worker';

// Reloading an unpacked extension fires onInstalled with reason "update" and
// the same version. That reload is not announced as an update, while a real
// version change is; a browser restart does not sweep open tabs.
const openTabs: WorkerTab[] = [{ id: 1, windowId: 1, active: true, url: 'https://open.example.com/', status: 'complete' }];

function bootOffline() {
  return bootWorker({ version: '0.9.22', tabs: openTabs, fetch: () => Promise.reject(new Error('offline')) });
}

function noticeWrites(fake: Awaited<ReturnType<typeof bootWorker>>) {
  return [fake.chrome.storage.sync, fake.chrome.storage.local]
    .flatMap((area) => area.set.mock.calls.map(([payload]) => payload))
    .filter((payload) => updateNoticeState.key in payload);
}

function observerSweeps(fake: Awaited<ReturnType<typeof bootWorker>>) {
  return injectionsInto(fake).filter((injection) => (injection.files || []).includes('build/shortcut-key-observer.js'));
}

describe('development extension startup', () => {
  it('tells a same-version reload from an update', () => {
    expect(isSameVersionReload({ reason: 'update', previousVersion: '0.9.22' }, '0.9.22')).toBe(true);
    expect(isSameVersionReload({ reason: 'update', previousVersion: '0.9.21' }, '0.9.22')).toBe(false);
    expect(isSameVersionReload({ reason: 'chrome_update', previousVersion: '0.9.22' }, '0.9.22')).toBe(false);
  });

  it('announces no update on a same-version reload but still prepares the shortcut observer in open tabs', async () => {
    const fake = await bootOffline();
    fake.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '0.9.22' });
    await settleWorker(100);

    expect(noticeWrites(fake)).toEqual([]);
    expect(observerSweeps(fake)).toHaveLength(1);
  });

  it('announces a new version', async () => {
    const fake = await bootOffline();
    fake.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '0.9.21' });
    await settleWorker(100);

    expect(noticeWrites(fake)[0]?.[updateNoticeState.key]).toMatchObject({ previousVersion: 'v0.9.21' });
  });

  it('does not sweep the tabs a browser restart restores', async () => {
    const fake = await bootWorker({ version: '0.9.22', tabs: openTabs });
    fake.chrome.scripting.executeScript.mockClear();
    fake.chrome.runtime.onStartup.fire();
    await settleWorker(100);

    expect(observerSweeps(fake)).toEqual([]);
  });
});
