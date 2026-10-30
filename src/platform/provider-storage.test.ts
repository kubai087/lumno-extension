import { describe, expect, it, vi } from 'vitest';
import { localPrimary } from '../domain/settings/sync-state';
import type { StorageItems, StorageKeys } from '../domain/storage-port';
import { addStorageChangeListener, createProviderStorageRuntime, getProviderStorage } from './provider-storage';
import { writeStorageValues } from './settings-storage';

const LANGUAGE_KEY = '_x_extension_language_2024_unique_';
const RATE_LIMITED = 'This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota.';

interface Runtime {
  lastError: { message: string } | null;
}

function listOf(keys: StorageKeys | undefined, values: StorageItems): string[] {
  if (keys === null || keys === undefined) return Object.keys(values);
  if (Array.isArray(keys)) return keys;
  return typeof keys === 'string' ? [keys] : Object.keys(keys);
}

function pick(values: StorageItems, keys: StorageKeys | undefined): StorageItems {
  return Object.fromEntries(listOf(keys, values).filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]]));
}

// An area that answers at once.
function createArea(initial: StorageItems = {}) {
  const values: StorageItems = { ...initial };
  return {
    values,
    get(keys: StorageKeys, callback?: (items: StorageItems | undefined) => void) {
      callback?.(pick(values, keys));
    },
    set(payload: StorageItems, callback?: () => void) {
      Object.assign(values, payload);
      callback?.();
    },
    remove(keys: string | string[], callback?: () => void) {
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => { delete values[key]; });
      callback?.();
    },
    clear(callback?: () => void) {
      Object.keys(values).forEach((key) => { delete values[key]; });
      callback?.();
    }
  };
}

// An area whose writes fail with the next queued message, through
// runtime.lastError while the callback runs.
function createFailingArea(runtime: Runtime, failures: string[]) {
  const values: StorageItems = {};
  const area = {
    values,
    calls: 0,
    get(keys: StorageKeys, callback?: (items: StorageItems | undefined) => void) {
      callback?.(pick(values, keys));
    },
    set(payload: StorageItems, callback?: () => void) {
      area.calls += 1;
      const failure = failures.shift();
      if (failure) {
        runtime.lastError = { message: failure };
        callback?.();
        runtime.lastError = null;
        return;
      }
      Object.assign(values, payload);
      callback?.();
    },
    remove(_keys: string | string[], callback?: () => void) {
      callback?.();
    }
  };
  return area;
}

// A browser whose local area fails the storage mode read a number of times.
function createModeApi(failuresBeforeRead: number, failureMessage = 'IO error') {
  const runtime: Runtime = { lastError: null };
  let remaining = failuresBeforeRead;
  const local = {
    reads: 0,
    get(_keys: StorageKeys, callback?: (items: StorageItems | undefined) => void) {
      local.reads += 1;
      if (remaining > 0) {
        remaining -= 1;
        runtime.lastError = { message: failureMessage };
        callback?.(undefined);
        runtime.lastError = null;
        return;
      }
      callback?.({ [localPrimary.key]: true });
    },
    set(_payload: StorageItems, callback?: () => void) {
      callback?.();
    }
  };
  return { local, chromeApi: { runtime, storage: { sync: createArea(), local } } };
}

describe('provider storage', () => {
  it('reads and writes settings in browser sync, never in the device area', async () => {
    const sync = createArea({ [LANGUAGE_KEY]: 'zh_CN' });
    const local = createArea();
    const runtime = createProviderStorageRuntime({ storage: { sync, local } });
    await runtime.ready;

    expect(await runtime.area.get([LANGUAGE_KEY])).toEqual({ [LANGUAGE_KEY]: 'zh_CN' });
    await runtime.area.set({ theme: 'chrome' });
    expect(sync.values.theme).toBe('chrome');
    local.values[LANGUAGE_KEY] = 'en';
    await runtime.area.set({ theme: 'lumno' });
    expect(sync.values.theme).toBe('lumno');
    expect(local.values.theme).toBeUndefined();
    expect(runtime.isActiveAreaName('sync')).toBe(true);
    expect(await runtime.area.get([LANGUAGE_KEY])).toEqual({ [LANGUAGE_KEY]: 'zh_CN' });
  });

  it('gives each browser one runtime, in the device area without sync and even without storage', async () => {
    const chromeApi = { storage: { sync: createArea(), local: createArea() } };
    const runtime = createProviderStorageRuntime(chromeApi);
    const provider = getProviderStorage(chromeApi);
    expect(provider.runtime).toBe(runtime);
    expect(provider.area).toBe(runtime.area);
    expect(provider.areaName).toBe('sync');

    const localOnly = getProviderStorage({ storage: { local: createArea({ [LANGUAGE_KEY]: 'ja' }) } });
    expect(localOnly.areaName).toBe('local');
    expect(await localOnly.area.get([LANGUAGE_KEY])).toEqual({ [LANGUAGE_KEY]: 'ja' });

    const noStorage = getProviderStorage(null);
    expect(noStorage.runtime).toBeTruthy();
    expect(noStorage.area).toBeTruthy();
    expect(await noStorage.area.get(['x'])).toEqual({});
  });

  it('passes a storage error to the callback, with runtime.lastError still set, or rejects without one', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtimeApi: Runtime = { lastError: null };
    const failures = ['QUOTA_BYTES quota exceeded'];
    const chromeApi = { runtime: runtimeApi, storage: { sync: createFailingArea(runtimeApi, failures), local: createFailingArea(runtimeApi, []) } };
    const runtime = createProviderStorageRuntime(chromeApi, { retryDelayMs: 0 });
    await runtime.ready;

    let seen: { error?: Error; lastError: Runtime['lastError'] } | null = null;
    await runtime.area.set({ a: 1 }, (_result, error) => { seen = { error, lastError: runtimeApi.lastError }; });
    expect(seen).toMatchObject({ error: { message: expect.stringMatching(/QUOTA_BYTES/) }, lastError: { message: expect.stringMatching(/QUOTA_BYTES/) } });

    failures.push('QUOTA_BYTES quota exceeded');
    await expect(runtime.area.set({ a: 2 })).rejects.toThrow(/QUOTA_BYTES/);
  });

  it('retries a write the write quota refused once, and drops one a newer write replaced', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtimeApi: Runtime = { lastError: null };
    const failures: string[] = [];
    const sync = createFailingArea(runtimeApi, failures);
    const runtime = createProviderStorageRuntime({ runtime: runtimeApi, storage: { sync, local: createFailingArea(runtimeApi, []) } }, { retryDelayMs: 0 });
    await runtime.ready;

    failures.push(RATE_LIMITED);
    let seen: Error | undefined | 'pending' = 'pending';
    await runtime.area.set({ b: 1 }, (_result, error) => { seen = error; });
    expect(seen).toBeUndefined();
    expect(sync.values.b).toBe(1);

    const callsBefore = sync.calls;
    failures.push(RATE_LIMITED);
    await Promise.all([runtime.area.set({ c: 'old' }), runtime.area.set({ c: 'new' })]);
    expect(sync.values.c).toBe('new');
    expect(sync.calls - callsBefore).toBe(2);

    failures.push(RATE_LIMITED, RATE_LIMITED);
    await expect(runtime.area.set({ d: 1 })).rejects.toThrow(/MAX_WRITE_OPERATIONS_PER_MINUTE/);

    failures.push(RATE_LIMITED, RATE_LIMITED);
    const providerCalls = sync.calls;
    await expect(writeStorageValues(runtime.area, { runtime: runtimeApi }, { f: 1 }, { retryDelayMs: 0 })).rejects.toThrow(/MAX_WRITE/);
    expect(sync.calls - providerCalls).toBe(2);
  });

  it('retries a failed storage mode read instead of falling back to browser sync', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const recovered = createProviderStorageRuntime(createModeApi(2).chromeApi, { modeRetryDelaysMs: [0, 0, 0] });
    await recovered.ready;
    expect([recovered.getActiveAreaName(), recovered.isModeKnown()]).toEqual(['local', true]);

    const unknown = createProviderStorageRuntime(createModeApi(10).chromeApi, { modeRetryDelaysMs: [0, 0] });
    await unknown.ready;
    expect([unknown.getActiveAreaName(), unknown.isModeKnown()]).toEqual(['sync', false]);
  });

  it('does not retry a mode read the context is denied, so the overlay need not wait', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const denied = createModeApi(10, 'Access to storage is not allowed from this context.');
    const runtime = createProviderStorageRuntime(denied.chromeApi, { modeRetryDelaysMs: [60000] });
    await runtime.ready;
    expect([runtime.getActiveAreaName(), runtime.isModeKnown(), denied.local.reads]).toEqual(['sync', false, 1]);
  });

  it('adds a storage change listener only where there is an event and a listener', () => {
    const listener = () => {};
    const added: unknown[] = [];
    const onChanged = { addListener: (each: unknown) => { added.push(each); }, removeListener() {} };
    expect(addStorageChangeListener({ storage: { onChanged } }, listener)).toBe(true);
    expect(added).toEqual([listener]);
    expect(addStorageChangeListener(null, listener)).toBe(false);
    expect(addStorageChangeListener({ storage: {} }, listener)).toBe(false);
    expect(addStorageChangeListener({ storage: { onChanged } }, null)).toBe(false);
  });
});
