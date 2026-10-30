import { describe, expect, it } from 'vitest';
import type { RegisteredScript } from './content-script-registration';
import type { RegistrationChromeApi } from './selection-script-registration';
import { RUN_AT, SCRIPT_FILES, SCRIPT_ID, createSelectionScriptRegistration } from './selection-script-registration';
import { browserTab } from '../../tests/fakes/worker';

interface StubOptions {
  registered?: RegisteredScript[];
  tabs?: chrome.tabs.Tab[];
  failTabId?: number;
}

function createScriptingStub(options: StubOptions = {}) {
  let registered = (options.registered || []).slice();
  const calls: string[] = [];
  const injected: { tabId: number; files: string[] }[] = [];
  const runtime: { lastError: { message: string } | null } = { lastError: null };
  const chromeApi: RegistrationChromeApi = {
    runtime,
    scripting: {
      getRegisteredContentScripts(filter, callback) {
        calls.push('get');
        callback(registered.filter((script) => filter.ids.includes(script.id)));
      },
      registerContentScripts(scripts, callback) {
        calls.push('register');
        registered = registered.concat(scripts);
        callback();
      },
      updateContentScripts(scripts, callback) {
        calls.push('update');
        registered = registered.map((script) => scripts.find((next) => next.id === script.id) || script);
        callback();
      },
      unregisterContentScripts(filter, callback) {
        calls.push('unregister');
        registered = registered.filter((script) => !filter.ids.includes(script.id));
        callback();
      },
      executeScript(injection, callback) {
        calls.push('execute');
        injected.push({ tabId: injection.target.tabId, files: injection.files });
        if (options.failTabId === injection.target.tabId) {
          runtime.lastError = { message: 'Cannot access contents of the page' };
          callback();
          runtime.lastError = null;
          return;
        }
        callback();
      }
    },
    tabs: {
      query(_queryInfo, callback) {
        calls.push('query');
        callback(options.tabs || []);
      }
    }
  };
  return { chromeApi, calls, injected, runtime, registered: () => registered };
}

describe('selection script registration', () => {
  it('only checks the registration while it stays off', async () => {
    const stub = createScriptingStub();

    expect(await createSelectionScriptRegistration({ chromeApi: stub.chromeApi }).sync(false)).toBe(false);
    expect(stub.calls).toEqual(['get']);
  });

  it('registers the toolbar for every page, top frame only, without injecting at worker start', async () => {
    const stub = createScriptingStub({ tabs: [browserTab({ id: 1, url: 'https://example.com/' })] });
    const registration = createSelectionScriptRegistration({ chromeApi: stub.chromeApi });

    expect(await registration.sync(true)).toBe(true);
    expect(stub.calls).toEqual(['get', 'register']);
    expect(stub.registered()).toEqual([expect.objectContaining({
      id: SCRIPT_ID,
      js: Array.from(SCRIPT_FILES),
      matches: ['<all_urls>'],
      runAt: RUN_AT,
      allFrames: false,
      persistAcrossSessions: true
    })]);

    await registration.sync(true);
    expect(stub.calls.filter((call) => call === 'register')).toHaveLength(1);
  });

  it('reaches open web and file pages when turned on, past pages that refuse it', async () => {
    const stub = createScriptingStub({
      tabs: [
        browserTab({ id: 1, url: 'https://example.com/' }),
        browserTab({ id: 2, url: 'chrome://settings/' }),
        browserTab({ id: 3, url: 'file:///Users/me/notes.html' }),
        browserTab({ id: 4, url: 'http://broken.example/' }),
        browserTab({ id: 5 })
      ],
      failTabId: 4
    });

    expect(await createSelectionScriptRegistration({ chromeApi: stub.chromeApi }).sync(true, { injectOpenTabs: true })).toBe(true);
    expect(stub.injected).toEqual([1, 3, 4].map((tabId) => ({ tabId, files: Array.from(SCRIPT_FILES) })));
    expect(stub.runtime.lastError).toBeNull();
  });

  it('updates a registration an older version left', async () => {
    const stale = { id: SCRIPT_ID, matches: ['<all_urls>'], js: ['src/content/selection-quick-actions.ts'], runAt: 'document_end' };
    const stub = createScriptingStub({ registered: [stale] });
    await createSelectionScriptRegistration({ chromeApi: stub.chromeApi }).sync(true);

    expect(stub.calls).toEqual(['get', 'update']);
    expect(stub.registered()[0].js).toEqual(Array.from(SCRIPT_FILES));
  });

  it('unregisters after the syncs before it finish', async () => {
    const stub = createScriptingStub({ registered: [{ id: SCRIPT_ID, js: Array.from(SCRIPT_FILES), runAt: RUN_AT }] });
    const registration = createSelectionScriptRegistration({ chromeApi: stub.chromeApi });
    const first = registration.sync(true);
    const second = registration.sync(false);

    expect(await first).toBe(true);
    expect(await second).toBe(false);
    expect(stub.registered()).toEqual([]);
  });

  it('does not throw in a browser without scripting', async () => {
    expect(await createSelectionScriptRegistration({ chromeApi: { runtime: {} } }).sync(true)).toBe(true);
  });
});
