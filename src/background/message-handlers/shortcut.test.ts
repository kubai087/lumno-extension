import { describe, expect, it } from 'vitest';
import { bootWorker, browserTab, settleWorker } from '../../../tests/fakes/worker';

const senderTab = browserTab({ id: 5, windowId: 1, url: 'https://example.com/', title: 'Example', active: true });
const pressed = (key: string) => ({
  action: 'triggerShowSearchFromPageHotkey',
  requiresShortcutVerification: true,
  observedShortcut: { ctrlKey: false, altKey: false, shiftKey: true, metaKey: true, key }
});

function bootWithShortcuts() {
  return bootWorker({
    tabs: [{ ...senderTab }],
    commands: [{ name: 'show-search', shortcut: '⌘⇧K' }, { name: 'show-tab-switcher', shortcut: 'Alt+Q' }]
  });
}

describe('the page hotkey of a cold worker', () => {
  it("opens Lumno only for the browser's live shortcut", async () => {
    const fake = await bootWithShortcuts();

    expect(await fake.sendMessage(pressed('j'), { tab: senderTab })).toMatchObject({ ok: false, reason: 'shortcut-mismatch' });
    expect(await fake.sendMessage(pressed('k'), { tab: senderTab })).toMatchObject({ ok: true, shortcut: expect.any(String) });
  });

  // Zen's empty state is a tab hidden from extensions, so the page hotkey
  // arrives without sender.tab; it opens New Tab like the command's no-tab path.
  it('opens one Lumno New Tab for the live shortcut from a page without a tab', async () => {
    const fake = await bootWithShortcuts();
    fake.chrome.tabs.create.mockClear();

    expect(await fake.sendMessage(pressed('j'), {})).toMatchObject({ ok: false });
    await settleWorker(30);
    expect(fake.chrome.tabs.create).not.toHaveBeenCalled();

    expect(await fake.sendMessage(pressed('k'), {})).toMatchObject({ ok: true });
    await settleWorker(30);
    const created = fake.chrome.tabs.create.mock.calls.map(([properties]) => properties);
    expect(created).toHaveLength(1);
    expect(String(created[0].url)).toMatch(/newtab\.html/);
  });
});
