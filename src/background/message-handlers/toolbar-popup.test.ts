import { describe, expect, it, vi } from 'vitest';
import { documentPipEnabled } from '../../domain/settings/features';
import { injectedModules, injectionsInto, installWorkerFake } from '../../../tests/fakes/worker';

describe('the toolbar popup', () => {
  // A frozen tab (tab freezing, Memory Saver) never runs the injected
  // "is a video already in picture-in-picture?" check.
  it('opens web clip even when other tabs cannot answer whether they play picture-in-picture', async () => {
    const fake = installWorkerFake({
      tabs: [
        { id: 5, windowId: 1, index: 0, url: 'https://example.com/', title: 'Example', active: true },
        { id: 6, windowId: 1, index: 1, url: 'https://frozen.example/', title: 'Frozen', frozen: true },
        { id: 7, windowId: 1, index: 2, url: 'https://discarded.example/', title: 'Discarded', discarded: true },
        { id: 8, windowId: 1, index: 3, url: 'https://silent.example/', title: 'Silent' }
      ],
      sync: { [documentPipEnabled.key]: true }
    });
    const answer = fake.chrome.scripting.executeScript.getMockImplementation();
    fake.chrome.scripting.executeScript.mockImplementation((injection, callback) => (
      injection.target.tabId === 8 || !answer ? undefined : answer(injection, callback)));
    await import('../background');

    expect(await fake.sendMessage({ action: 'popupOpenDocumentPipPicker', tabId: 5 })).toEqual({ ok: true });
    await vi.waitFor(() => expect(injectionsInto(fake, 5).some((injection) =>
      injectedModules(injection).includes('build/injected/pip-picker.js'))).toBe(true), { timeout: 2000 });
    expect(injectionsInto(fake, 6)).toEqual([]);
    expect(injectionsInto(fake, 7)).toEqual([]);
    expect(injectionsInto(fake, 8).length).toBeGreaterThan(0);
  });
});
