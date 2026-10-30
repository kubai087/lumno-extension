import { describe, expect, it } from 'vitest';
import { loadAggregateSearches } from './aggregate-search-storage';
import { readStorageValue, writeStorageValue } from './settings-storage';
import { aggregateSearches } from '../domain/settings/search';
import type { StorageItems } from '../domain/storage-port';

const PROVIDERS = [{ id: 'source-1', key: 'legacy', name: 'Legacy' }, { id: 'kept-id', key: 'kept', name: 'Kept' }];

function chromeApi(): { runtime: { lastError: { message?: string } | null } } {
  return { runtime: { lastError: null } };
}

describe('aggregate search storage', () => {
  it('keeps a failed read apart from an empty list', async () => {
    await expect(loadAggregateSearches({
      get: () => Promise.reject(new Error('temporary sync failure')),
      set() {}
    }, aggregateSearches.key, chromeApi())).rejects.toThrow(/temporary sync failure/);
  });

  it('reads a stored value, and rejects when the runtime reports a read error', async () => {
    await expect(readStorageValue({
      get(_keys, callback) {
        if (callback) callback({ providers: PROVIDERS });
      },
      set() {}
    }, chromeApi(), 'providers')).resolves.toEqual(PROVIDERS);

    const failing = chromeApi();
    await expect(readStorageValue({
      get(_keys, callback) {
        failing.runtime.lastError = { message: 'read failed' };
        if (callback) callback(undefined);
      },
      set() {}
    }, failing, 'providers')).rejects.toThrow(/read failed/);
  });

  it('writes a value through a callback or a promise and resolves with it', async () => {
    const written: StorageItems[] = [];
    await expect(writeStorageValue({
      get() {},
      set(payload: StorageItems, callback?: () => void) {
        written.push(payload);
        if (callback) callback();
      }
    }, chromeApi(), 'providers', PROVIDERS)).resolves.toEqual(PROVIDERS);
    await expect(writeStorageValue({
      get() {},
      set(payload: StorageItems) {
        written.push(payload);
        return Promise.resolve();
      }
    }, chromeApi(), 'providers', [PROVIDERS[1]])).resolves.toEqual([PROVIDERS[1]]);
    expect(written).toEqual([{ providers: PROVIDERS }, { providers: [PROVIDERS[1]] }]);
  });

  it('rejects a write that throws, reports a runtime error or rejects', async () => {
    await expect(writeStorageValue({
      get() {},
      set() {
        throw new Error('synchronous storage failure');
      }
    }, chromeApi(), 'providers', PROVIDERS)).rejects.toThrow(/synchronous storage failure/);

    const failing = chromeApi();
    await expect(writeStorageValue({
      get() {},
      set(_payload: StorageItems, callback?: () => void) {
        failing.runtime.lastError = { message: 'quota exceeded' };
        if (callback) callback();
      }
    }, failing, 'providers', PROVIDERS)).rejects.toThrow(/quota exceeded/);

    await expect(writeStorageValue({
      get() {},
      set: () => Promise.reject(new Error('sync unavailable'))
    }, chromeApi(), 'providers', PROVIDERS)).rejects.toThrow(/sync unavailable/);
  });
});
