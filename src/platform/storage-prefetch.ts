// A read a page's preload starts before its scripts load, and the page's
// settings store taking it instead of reading storage again.
import type { StorageAreaLike, StorageChangeListener, StorageItems } from '../domain/storage-port';
import { publishBootValue, readBootValue } from './boot-handoff';
import type { StorageAreaFacade, StorageChromeApi } from './settings-storage';
import { isStorageItems } from './settings-storage';

interface StorageReadPrefetch {
  keys: Set<string>;
  stale: boolean;
  result: Promise<StorageItems | null>;
  release: () => void;
}

// The storage reads a preload started, kept in the boot handoff so the page's
// own copy of this module finds them.
function getStorageReadPrefetches(create: boolean): WeakMap<object, StorageReadPrefetch> | null {
  const existing = readBootValue('storageReadPrefetches');
  if (existing || !create) {
    return existing || null;
  }
  const created = new WeakMap<object, StorageReadPrefetch>();
  publishBootValue('storageReadPrefetches', created);
  return created;
}

// Starts a read before the page's scripts have loaded. The page's store takes
// the result when it covers every key it reads and none of them changed since.
function prefetchStorageRead(
  area: StorageAreaLike | StorageAreaFacade | null | undefined,
  keys: unknown,
  chromeApi: StorageChromeApi | null | undefined
): boolean {
  const onChanged = chromeApi && chromeApi.storage && chromeApi.storage.onChanged;
  if (!area || typeof area.get !== 'function' || !Array.isArray(keys) || !keys.length ||
      !onChanged || typeof onChanged.addListener !== 'function') {
    return false;
  }
  const keySet = new Set(keys.map(String));
  const markStale: StorageChangeListener = (changes) => {
    if (Object.keys(changes || {}).some((key) => keySet.has(key))) prefetch.stale = true;
  };
  onChanged.addListener(markStale);
  const prefetch: StorageReadPrefetch = {
    keys: keySet,
    stale: false,
    release: () => {
      if (typeof onChanged.removeListener === 'function') onChanged.removeListener(markStale);
    },
    result: new Promise<StorageItems | null>((resolve) => {
      let settled = false;
      const finish = (value: unknown) => {
        if (settled) return;
        settled = true;
        resolve(isStorageItems(value) ? value : null);
      };
      try {
        const maybePromise = area.get(Array.from(keySet), finish);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(finish, () => finish(null));
        }
      } catch (_error) {
        finish(null);
      }
    })
  };
  const registry = getStorageReadPrefetches(true);
  if (registry) {
    registry.set(area, prefetch);
  }
  return true;
}

// The values a preload's read of `area` holds for `keys`: null when there was
// none, it did not cover every key, or one of them changed since. A prefetch
// serves one read; whatever it answers, it is gone afterwards.
function takePrefetchedRead(area: object, keys: readonly string[] | null): Promise<StorageItems | null> {
  const registry = getStorageReadPrefetches(false);
  const prefetch = registry ? registry.get(area) : undefined;
  if (!registry || !prefetch) {
    return Promise.resolve(null);
  }
  registry.delete(area);
  if (keys === null || !keys.every((key) => prefetch.keys.has(key))) {
    prefetch.release();
    return Promise.resolve(null);
  }
  return prefetch.result.then((value) => {
    prefetch.release();
    return value && !prefetch.stale ? value : null;
  });
}

export { prefetchStorageRead, takePrefetchedRead };
