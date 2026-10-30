import { describe, expect, it } from 'vitest';
import { restrictedAction, restrictedActionAutoBrowserSettingDone } from '../domain/settings/overlay-panel';
import type { WorkerFake } from '../../tests/fakes/worker';
import { bootWorker, browserTab, settleWorker } from '../../tests/fakes/worker';

const OTHER_NEWTAB = 'chrome-extension://another-extension-id/newtab.html';

// A new tab that turns out to be another extension's New Tab.
async function openOtherNewtab(fake: WorkerFake, tabId: number) {
  const created = browserTab({ id: tabId, windowId: 1, url: '', status: 'loading' });
  fake.chrome.tabs.onCreated.fire(created);
  fake.chrome.tabs.onUpdated.fire(tabId, { url: OTHER_NEWTAB }, { ...created, url: OTHER_NEWTAB, status: 'complete' });
  await settleWorker(50);
}

function automaticChoices(fake: WorkerFake): unknown[] {
  return fake.chrome.storage.sync.set.mock.calls.map(([payload]) => payload)
    .filter((payload) => restrictedActionAutoBrowserSettingDone.key in payload);
}

describe("another extension's New Tab", () => {
  it('picks the browser setting for restricted pages once', async () => {
    const fake = await bootWorker();
    await openOtherNewtab(fake, 51);

    expect(automaticChoices(fake)).toEqual([{ [restrictedAction.key]: 'none', [restrictedActionAutoBrowserSettingDone.key]: true }]);
    await openOtherNewtab(fake, 52);
    expect(automaticChoices(fake)).toHaveLength(1);
  });

  it('leaves a choice made before as it is', async () => {
    const fake = await bootWorker({ sync: { [restrictedActionAutoBrowserSettingDone.key]: true } });
    await openOtherNewtab(fake, 51);

    expect(automaticChoices(fake)).toEqual([]);
  });
});
