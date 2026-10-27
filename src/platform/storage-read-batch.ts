// The batched startup read: every read a page makes in its first task goes
// to storage as one, served from a prefetch when one is ready.
import type { StorageAreaLike, StorageChangeListener, StorageItems, StorageKeys } from '../domain/storage-port';
import { publishBootValue, readBootValue } from './boot-handoff';
import type { ReadBatchMetrics, StorageAreaFacade, StorageChromeApi, StorageReadBatch, StorageReadPrefetch } from './settings-storage';
import { isStorageItems } from './settings-storage';


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

// Starts a read before the page's scripts have loaded. The batch created later for the same area
// takes the result when it covers every requested key and none of them changed in the meantime.
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

// A promise and the function that settles it.
function createDeferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: (value) => settle(value) };
}

interface ReadRequest {
  callback: ((items: StorageItems | undefined) => void) | null;
  keys: StorageKeys | undefined;
  resolve: ((items: StorageItems) => void) | null;
}

interface ReadBatchContext {
  readonly source: StorageAreaLike;
  acceptingReads: boolean;
  flushScheduled: boolean;
  includesAllKeys: boolean;
  requests: ReadRequest[];
  readonly requestedKeys: Set<string>;
  readonly ready: { promise: Promise<ReadBatchMetrics>; resolve(value: ReadBatchMetrics): void; };
}

function collectRequestKeys(ctx: ReadBatchContext, keys: StorageKeys | undefined) {
  if (keys === null || typeof keys === 'undefined') {
    ctx.includesAllKeys = true;
    return;
  }
  if (typeof keys === 'string') {
    ctx.requestedKeys.add(keys);
    return;
  }
  if (Array.isArray(keys)) {
    keys.forEach((key) => ctx.requestedKeys.add(String(key)));
    return;
  }
  if (typeof keys === 'object') {
    Object.keys(keys).forEach((key) => ctx.requestedKeys.add(key));
  }
}

function selectRequestResult(values: StorageItems, keys: StorageKeys | undefined): StorageItems {
  if (keys === null || typeof keys === 'undefined') {
    return values;
  }
  if (typeof keys === 'object' && !Array.isArray(keys)) {
    const result: StorageItems = { ...keys };
    Object.keys(keys).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        result[key] = values[key];
      }
    });
    return result;
  }
  const list = Array.isArray(keys) ? keys : [keys];
  const result: StorageItems = {};
  list.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      result[key] = values[key];
    }
  });
  return result;
}

function flush(ctx: ReadBatchContext) {
  if (!ctx.acceptingReads) {
    return;
  }
  ctx.acceptingReads = false;
  ctx.flushScheduled = false;
  const pending = ctx.requests;
  ctx.requests = [];
  const keys = ctx.includesAllKeys ? null : Array.from(ctx.requestedKeys);
  let settled = false;
  const finish = (rawResult: unknown) => {
    if (settled) {
      return;
    }
    settled = true;
    const result: StorageItems = isStorageItems(rawResult) ? rawResult : {};
    const callbackErrors: unknown[] = [];
    pending.forEach((request) => {
      const selected = selectRequestResult(result, request.keys);
      try {
        if (request.callback) {
          request.callback(selected);
        } else if (request.resolve) {
          request.resolve(selected);
        }
      } catch (error) {
        callbackErrors.push(error);
      }
    });
    ctx.ready.resolve(Object.freeze({
      keys: keys === null ? null : Object.freeze(keys.slice()),
      keyCount: keys === null ? null : keys.length,
      requestCount: pending.length,
      underlyingReadCount: 1
    }));
    callbackErrors.forEach((error) => {
      Promise.resolve().then(() => {
        throw error;
      });
    });
  };
  const readArea = () => {
    try {
      const maybePromise = ctx.source.get(keys, finish);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(finish).catch(() => finish({}));
      }
    } catch (error) {
      finish({});
    }
  };
  void takePrefetchedRead(ctx.source, keys).then((value) => {
    if (value) finish(value);
    else readArea();
  });
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

// Like chrome.storage get: (keys, callback), (callback), or (keys) for a promise.
function get(
  ctx: ReadBatchContext,
  keysOrCallback?: StorageKeys | ((items: StorageItems | undefined) => void),
  maybeCallback?: (items: StorageItems | undefined) => void
): Promise<StorageItems | undefined> | void {
  let keys: StorageKeys | undefined;
  let callback = maybeCallback;
  if (typeof keysOrCallback === 'function' && typeof callback === 'undefined') {
    callback = keysOrCallback;
    keys = null;
  } else if (typeof keysOrCallback !== 'function') {
    keys = keysOrCallback;
  }
  if (!ctx.acceptingReads) {
    return ctx.source.get(keys === undefined ? null : keys, callback);
  }
  let resolveRequest: ((items: StorageItems) => void) | null = null;
  const promise = typeof callback === 'function'
    ? undefined
    : new Promise<StorageItems>((resolve) => {
        resolveRequest = resolve;
      });
  ctx.requests.push({
    callback: typeof callback === 'function' ? callback : null,
    keys,
    resolve: resolveRequest
  });
  collectRequestKeys(ctx, keys);
  if (!ctx.flushScheduled) {
    ctx.flushScheduled = true;
    Promise.resolve().then((() => flush(ctx)));
  }
  return promise;
}

// Gathers the reads a page makes while it starts into one storage read.
function createStorageReadBatch(area: StorageAreaLike | null | undefined): StorageReadBatch | null {
  if (!area || typeof area.get !== 'function') {
    return null;
  }
  const source = area;
  const requestedKeys = new Set<string>();
  const ready = createDeferred<ReadBatchMetrics>();
  const ctx: ReadBatchContext = {
    source,
    acceptingReads: true,
    flushScheduled: false,
    includesAllKeys: false,
    requests: [],
    requestedKeys,
    ready
  };

  return Object.freeze({
    area: Object.freeze({
      clear(callback?: () => void) {
        return typeof ctx.source.clear === 'function' ? ctx.source.clear(callback) : undefined;
      },
      get: (keysOrCallback?: StorageKeys | ((items: StorageItems | undefined) => void), maybeCallback?: (items: StorageItems | undefined) => void) => get(ctx, keysOrCallback, maybeCallback),
      remove(keys: string | string[], callback?: () => void) {
        return typeof ctx.source.remove === 'function' ? ctx.source.remove(keys, callback) : undefined;
      },
      set(items: StorageItems, callback?: () => void) {
        return ctx.source.set(items, callback);
      }
    }),
    flush: () => flush(ctx),
    ready: ctx.ready.promise
  });
}

export {
  takePrefetchedRead,
  collectRequestKeys,
  createDeferred,
  createStorageReadBatch,
  flush,
  get,
  getStorageReadPrefetches,
  prefetchStorageRead,
  selectRequestResult
};
export type {
  ReadBatchContext,
  ReadRequest
};
