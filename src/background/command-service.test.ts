import { describe, expect, it } from 'vitest';
import { restrictedAction } from '../domain/settings/overlay-panel';
import { bootWorker, browserTab, injectedModules, injectionsInto, installWorkerFake, settleWorker } from '../../tests/fakes/worker';

const COPY_URL_FILES = ['build/injected/copy-url-listener.js'];

describe('copying the current page URL', () => {
  it("injects the copy listener into a tab's top frame on the first copy, and reuses it", async () => {
    const fake = await bootWorker();
    const tab = browserTab({ id: 7, windowId: 1, url: 'https://example.com/' });
    let listenerInstalled = false;
    fake.chrome.tabs.sendMessage.mockImplementation((_tabId, _message, optionsOrCallback, maybeCallback) => {
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
      setTimeout(() => {
        if (!callback) return;
        if (listenerInstalled) {
          callback({ ok: true });
          return;
        }
        fake.chrome.runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' };
        callback(undefined);
        fake.chrome.runtime.lastError = null;
      }, 0);
      return undefined;
    });
    fake.chrome.scripting.executeScript.mockImplementation((injection, callback) => {
      if (JSON.stringify(injectedModules(injection)) === JSON.stringify(COPY_URL_FILES)) listenerInstalled = true;
      if (callback) setTimeout(() => callback([]), 0);
      return undefined;
    });
    const copyInjections = () => injectionsInto(fake).filter((injection) =>
      JSON.stringify(injectedModules(injection)) === JSON.stringify(COPY_URL_FILES));

    expect(await fake.sendMessage({ action: 'copyCurrentPageUrl' }, { tab, url: tab.url })).toEqual({ ok: true });
    expect(copyInjections()).toHaveLength(1);
    expect(copyInjections()[0].target).toEqual({ tabId: 7 });

    expect(await fake.sendMessage({ action: 'copyCurrentPageUrl' }, { tab, url: tab.url })).toEqual({ ok: true });
    expect(copyInjections()).toHaveLength(1);
  });

  it('answers that it could not copy on a page scripts cannot reach', async () => {
    const fake = await bootWorker();
    const fail = (message: string, callback?: (value: never[]) => void) => {
      setTimeout(() => {
        fake.chrome.runtime.lastError = { message };
        if (callback) callback([]);
        fake.chrome.runtime.lastError = null;
      }, 0);
      return undefined;
    };
    fake.chrome.tabs.sendMessage.mockImplementation((_tabId, _message, optionsOrCallback, maybeCallback) =>
      fail('Receiving end does not exist.', typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback));
    fake.chrome.scripting.executeScript.mockImplementation((_injection, callback) => fail('Cannot access a chrome:// URL', callback));

    expect(await fake.sendMessage({ action: 'copyCurrentPageUrl' },
      { tab: browserTab({ id: 8, windowId: 1, url: 'chrome://settings/' }), url: 'https://example.com/' })).toEqual({ ok: false });
  });
});

describe('the search shortcut on a page the extension cannot run on', () => {
  // A worker woken by the shortcut, before its stored settings arrive.
  async function pressOnSettings(storedAction: string) {
    const fake = installWorkerFake({
      tabs: [{ id: 21, windowId: 1, index: 0, active: true, url: 'chrome://settings/', title: 'Settings' }],
      sync: { [restrictedAction.key]: storedAction },
      storage: { sync: { hold: true } }
    });
    await import('./background');
    fake.chrome.commands.onCommand.fire('show-search');
    await settleWorker(20);
    fake.storage.sync.release();
    await settleWorker(50);
    return fake.chrome.tabs.create.mock.calls.map(([properties]) => properties);
  }

  it("opens the browser's New Tab provider for the browser-setting action stored before the wake", async () => {
    const created = await pressOnSettings('none');

    expect(created).toHaveLength(1);
    expect(created[0].url).toBeUndefined();
  });

  it("opens Lumno's New Tab for the default action", async () => {
    const created = await pressOnSettings('default');

    expect(created).toHaveLength(1);
    expect(String(created[0].url)).toMatch(/newtab\.html/);
  });
});

describe('the search shortcut on a New Tab', () => {
  it('focuses the New Tab\'s own search box instead of opening the overlay there', async () => {
    const fake = await bootWorker({ tabs: [{ id: 61, windowId: 1, active: true, url: 'chrome://newtab/', status: 'complete' }] });
    fake.chrome.runtime.sendMessage.mockClear();
    fake.chrome.commands.onCommand.fire('show-search');
    await settleWorker(100);
    const focus = fake.chrome.runtime.sendMessage.mock.calls.map(([message]) => message)
      .filter((message) => message && typeof message === 'object' && Reflect.get(message, 'action') === 'lumno:newtab-focus-input');

    expect(focus.map((message) => Reflect.get(Object(message), 'tabId'))).toEqual([61]);
    expect(injectionsInto(fake, 61).some((injection) => injectedModules(injection).includes('build/injected/overlay.js'))).toBe(false);
  });
});
