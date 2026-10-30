import { describe, expect, it, vi } from 'vitest';
import * as settings from '../../domain/settings';
import { createProviderStorageRuntime } from '../../platform/provider-storage';
import { DAV_CONFIG, STATE_PATH, createDavServer, createDevice, emptyState, storageSet } from '../../../tests/fakes/webdav';

const theme = settings.themeMode.key;
const language = settings.language.key;
const customSearch = settings.siteSearchCustom.key;
const engine = (name: string) => [{ name, url: `https://${name}.example/?q=%s` }];
const quiet = { logger: { warn() {} } };

describe('applying a merged state to this device', () => {
  // The next round merges from what both sides then share, instead of
  // reporting this device's already-published list edit as a conflict.
  it('recovers from an edit that landed between publishing and applying, without a false conflict', async () => {
    const server = createDavServer();
    const device = createDevice(server, { sync: { [theme]: 'light', [language]: 'en', [customSearch]: engine('base') } }, { extra: quiet });
    await device.controller.handle({ operation: 'connect', config: DAV_CONFIG });
    await storageSet(device.chrome.storage.sync, { [customSearch]: engine('local') });
    server.replaceState({ ...server.state().raw, data: { ...server.state().data, [language]: 'ja' } });
    let edited = false;
    server.afterPut = async (path) => {
      if (!edited && path.endsWith('/state.json')) {
        edited = true;
        await storageSet(device.chrome.storage.sync, { [customSearch]: engine('later') });
      }
    };

    await expect(device.controller.handle({ operation: 'sync' })).rejects.toThrow(/local-changed/);
    server.afterPut = null;
    expect(server.state().data[customSearch]).toEqual(engine('local'));
    expect(await device.controller.handle({ operation: 'sync' })).toEqual({ ok: true });
    expect(server.state().data[customSearch]).toEqual(engine('later'));
    expect(device.chrome.storage.sync.values[language]).toBe('ja');
  });

  it('retries a browser sync write the write quota refused once', async () => {
    const server = createDavServer();
    server.replaceState(emptyState({ [theme]: 'dark' }));
    let refusals = 1;
    const device = createDevice(server, { sync: { [theme]: 'light' } }, { extra: { ...quiet, storageRetryDelayMs: 0 } });
    const set = device.chrome.storage.sync.set;
    device.chrome.storage.sync.set = (payload, callback) => {
      if (refusals > 0) {
        refusals -= 1;
        device.chrome.runtime.lastError = { message: 'This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota.' };
        if (callback) callback();
        device.chrome.runtime.lastError = null;
        return;
      }
      set(payload, callback);
    };
    await device.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'remote' });

    expect(refusals).toBe(0);
    expect(device.chrome.storage.sync.values[theme]).toBe('dark');
  });

  // The settings might come from the wrong area.
  it('publishes nothing while the storage mode cannot be read', async () => {
    const server = createDavServer();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const device = createDevice(server, { sync: { [theme]: 'light' } }, {
      extra: quiet,
      configure: (deviceChrome) => {
        const get = deviceChrome.storage.local.get;
        deviceChrome.storage.local.get = (keys, callback) => {
          if (Array.isArray(keys) && keys.length === 1 && keys[0] === settings.localPrimary.key) {
            deviceChrome.runtime.lastError = { message: 'IO error' };
            callback(undefined);
            deviceChrome.runtime.lastError = null;
            return;
          }
          get(keys, callback);
        };
        createProviderStorageRuntime(deviceChrome, { modeRetryDelaysMs: [] });
      }
    });

    await expect(device.controller.handle({ operation: 'connect', config: DAV_CONFIG })).rejects.toThrow(/local-storage-failed/);
    expect(server.files.has(STATE_PATH)).toBe(false);
  });
});
