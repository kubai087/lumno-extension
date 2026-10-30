import { describe, expect, it } from 'vitest';
import type { StorageChangeListener, StorageItems, StorageKeys } from '../domain/storage-port';
import { prefetchStorageRead, takePrefetchedRead } from './storage-prefetch';

// A sync area that answers after the current task and records its reads,
// with the change events a preload watches.
function createArea(values: StorageItems) {
  const reads: StorageKeys[] = [];
  const listeners = new Set<StorageChangeListener>();
  const area = {
    get(keys: StorageKeys, callback?: (items: StorageItems | undefined) => void) {
      reads.push(keys);
      const list = Array.isArray(keys) ? keys : [];
      const selected = Object.fromEntries(list.filter((key) => key in values).map((key) => [key, values[key]]));
      void Promise.resolve().then(() => callback?.(selected));
    },
    set() {}
  };
  const chromeApi = {
    storage: {
      onChanged: {
        addListener: (listener: StorageChangeListener) => { listeners.add(listener); },
        removeListener: (listener: StorageChangeListener) => { listeners.delete(listener); }
      }
    }
  };
  // Another page stores a value.
  const change = (key: string, newValue: unknown) => {
    values[key] = newValue;
    listeners.forEach((listener) => listener({ [key]: { newValue } }, 'sync'));
  };
  return { area, chromeApi, reads, listeners, change };
}

describe('Storage read prefetch', () => {
  it('serves a read it covers from the one read it started, then stops watching', async () => {
    const { area, chromeApi, reads, listeners } = createArea({ alpha: 1, beta: 2 });
    expect(prefetchStorageRead(area, ['alpha', 'beta'], chromeApi)).toBe(true);
    await expect(takePrefetchedRead(area, ['alpha'])).resolves.toEqual({ alpha: 1, beta: 2 });
    expect(reads).toEqual([['alpha', 'beta']]);
    expect(listeners.size).toBe(0);
  });

  it('serves nothing once a key it read changed', async () => {
    const { area, chromeApi, change } = createArea({ alpha: 1 });
    prefetchStorageRead(area, ['alpha'], chromeApi);
    change('alpha', 5);
    await expect(takePrefetchedRead(area, ['alpha'])).resolves.toBeNull();
  });

  it('leaves a read asking for keys it lacks to read them all itself', async () => {
    const { area, chromeApi, listeners } = createArea({ alpha: 1, gamma: 3 });
    prefetchStorageRead(area, ['alpha'], chromeApi);
    await expect(takePrefetchedRead(area, ['alpha', 'gamma'])).resolves.toBeNull();
    expect(listeners.size).toBe(0);
  });

  it('does not start without change events, which would let it serve stale values', () => {
    const { area } = createArea({ alpha: 1 });
    expect(prefetchStorageRead(area, ['alpha'], {})).toBe(false);
  });
});
