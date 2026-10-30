import { describe, expect, it } from 'vitest';
import type { WorkerTab } from '../../../tests/fakes/worker';
import { bootWorker, settleWorker } from '../../../tests/fakes/worker';

const OBSERVER_FILES = ['build/shortcut-key-observer.js'];

// Boots the worker with its observer injections answering after a moment,
// counting how many run at once.
async function bootSweep(tabs: WorkerTab[]) {
  const fake = await bootWorker({ tabs, version: '1.0.0' });
  const observed: { tabId: number; allFrames: boolean | undefined }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  fake.chrome.scripting.executeScript.mockImplementation((injection, callback) => {
    const files = 'files' in injection ? injection.files : undefined;
    if (JSON.stringify(files) !== JSON.stringify(OBSERVER_FILES)) {
      if (callback) setTimeout(() => callback([]), 0);
      return undefined;
    }
    observed.push({ tabId: injection.target.tabId, allFrames: injection.target.allFrames });
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    setTimeout(() => {
      inFlight -= 1;
      if (callback) callback([]);
    }, 5);
    return undefined;
  });
  return { fake, observed, maxInFlight: () => maxInFlight };
}

describe('preparing the shortcut observer in open tabs', () => {
  it('sweeps loaded web and file tabs after an update, active tabs first and a few at a time', async () => {
    const sweep = await bootSweep([
      { id: 1, windowId: 1, active: false, status: 'complete', url: 'https://a.example/' },
      { id: 2, windowId: 1, active: false, status: 'complete', url: 'https://b.example/', discarded: true },
      { id: 3, windowId: 1, active: false, status: 'unloaded', url: 'https://c.example/' },
      { id: 4, windowId: 1, active: false, status: 'complete', url: 'chrome://extensions/' },
      { id: 5, windowId: 1, active: true, status: 'complete', url: 'https://d.example/' },
      { id: 6, windowId: 2, active: false, status: 'loading', url: 'https://e.example/' },
      { id: 7, windowId: 2, active: false, status: 'complete', url: 'https://f.example/' },
      { id: 8, windowId: 2, active: false, status: 'complete', url: 'https://g.example/' },
      { id: 9, windowId: 2, active: true, status: 'complete', url: 'file:///Users/me/notes.html' }
    ]);
    sweep.fake.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '1.0.0' });
    await settleWorker(120);
    const tabIds = sweep.observed.map((entry) => entry.tabId);

    expect(tabIds.slice(0, 2).sort()).toEqual([5, 9]);
    expect(tabIds.slice().sort((a, b) => a - b)).toEqual([1, 5, 6, 7, 8, 9]);
    expect(sweep.observed.every((entry) => entry.allFrames === true)).toBe(true);
    expect(sweep.maxInFlight()).toBeLessThanOrEqual(3);

    sweep.observed.length = 0;
    sweep.fake.chrome.runtime.onStartup.fire();
    await settleWorker(60);
    expect(sweep.observed).toEqual([]);
  });

  it('installs the observer into loaded web tabs of one window in order, the active tab first', async () => {
    const sweep = await bootSweep([
      { id: 41, windowId: 1, active: false, url: 'https://a.example.com/', status: 'complete' },
      { id: 42, windowId: 1, active: true, url: 'https://b.example.com/', status: 'complete' },
      { id: 43, windowId: 1, active: false, url: 'chrome://extensions/', status: 'complete' },
      { id: 44, windowId: 1, active: false, url: 'https://c.example.com/', status: 'unloaded' },
      { id: 45, windowId: 1, active: false, url: 'https://d.example.com/', status: 'complete', discarded: true }
    ]);
    sweep.fake.chrome.runtime.onInstalled.fire({ reason: 'update', previousVersion: '1.0.0' });
    await settleWorker(100);

    expect(sweep.observed).toEqual([{ tabId: 42, allFrames: true }, { tabId: 41, allFrames: true }]);
  });
});
