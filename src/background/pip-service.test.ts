import { describe, expect, it, vi } from 'vitest';
import { documentPipEnabled } from '../domain/settings/features';
import { bootWorker, browserTab, injectedCommand, injectedModules, injectionsInto, settleWorker } from '../../tests/fakes/worker';

const senderTab = browserTab({ id: 5, windowId: 1, url: 'https://example.com/', title: 'Example', active: true });
const pickerInjected = (fake: Awaited<ReturnType<typeof bootWorker>>) => injectionsInto(fake, senderTab.id)
  .some((injection) => injectedModules(injection).includes('build/injected/pip-picker.js'));

describe('web clip', () => {
  it("opens the picker on the sender's tab while it is on", async () => {
    const fake = await bootWorker({ tabs: [{ ...senderTab }], sync: { [documentPipEnabled.key]: true } });

    expect(await fake.sendMessage({ action: 'openDocumentPipPicker' }, { tab: senderTab })).toEqual({ ok: true, enabled: true });
    await vi.waitFor(() => expect(injectionsInto(fake, senderTab.id).length).toBeGreaterThan(0));
    expect(await fake.sendMessage({ action: 'openDocumentPipPicker' }, {})).toEqual({ ok: false, reason: 'no-sender-tab' });
  });

  it('opens Settings at the web clip switch while it is off', async () => {
    const fake = await bootWorker({ tabs: [{ ...senderTab }], sync: { [documentPipEnabled.key]: false } });
    fake.chrome.tabs.create.mockClear();

    expect(await fake.sendMessage({ action: 'openDocumentPipPicker' }, { tab: senderTab })).toEqual({ ok: false, enabled: false });
    await settleWorker(50);
    expect(injectionsInto(fake, senderTab.id)).toEqual([]);
    expect(fake.chrome.tabs.create.mock.calls.map(([properties]) => properties))
      .toEqual([{ url: 'chrome-extension://lumno-test/src/options/options.html#labs:document-pip', active: true }]);
  });

  it('waits for the stored setting in a worker woken by the clip command', async () => {
    const fake = await bootWorker({ tabs: [{ ...senderTab }], sync: { [documentPipEnabled.key]: true }, storage: { sync: { hold: true } } });
    const answer = fake.sendMessage({ action: 'openDocumentPipPicker' }, { tab: senderTab }, 2000);
    await settleWorker(100);

    expect(pickerInjected(fake)).toBe(false);
    fake.storage.sync.release();
    expect(await answer).toEqual({ ok: true, enabled: true });
    await vi.waitFor(() => expect(pickerInjected(fake)).toBe(true), { timeout: 2000 });
  });

  it.each([true, false])('tells the overlay the search command opens whether web clip is on (%s)', async (enabled) => {
    const fake = await bootWorker({ tabs: [{ ...senderTab }], sync: { [documentPipEnabled.key]: enabled } });
    fake.chrome.commands.onCommand.fire('show-search');

    await vi.waitFor(() => expect(injectionsInto(fake).some((injection) =>
      injectedModules(injection).includes('build/injected/overlay.js'))).toBe(true), { timeout: 2000 });
    const open = injectionsInto(fake).find((injection) => injectedModules(injection).includes('build/injected/overlay.js'));
    expect(injectedCommand(open)).toMatchObject({ context: { documentPipEnabled: enabled } });
  });
});
