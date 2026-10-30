import { describe, expect, it } from 'vitest';
import { focusWindowAndActivateTab } from './focus';
import { installWorkerFake } from '../../../tests/fakes/worker';

describe('switching to a tab in another window', () => {
  it('brings the window forward before it activates the tab', async () => {
    const fake = installWorkerFake({ tabs: [{ id: 42, windowId: 22 }], windows: [{ id: 1, focused: true }, { id: 22 }] });

    expect(await focusWindowAndActivateTab(chrome, { tabId: 42, windowId: 22 })).toEqual({ ok: true, tabId: 42, windowId: 22 });
    expect(fake.chrome.windows.update.mock.calls.map(([id, info]) => [id, info])).toEqual([[22, { focused: true }]]);
    expect(fake.chrome.tabs.update.mock.calls.map(([id, info]) => [id, info])).toEqual([[42, { active: true }]]);
    expect(fake.chrome.windows.update.mock.invocationCallOrder[0]).toBeLessThan(fake.chrome.tabs.update.mock.invocationCallOrder[0]);
  });
});
