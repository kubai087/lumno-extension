// Reading and writing settings in the extension's storage: one-shot reads
// and writes with the sync quota's retry, copying local settings into sync,
// writing back repaired values, and the copies pages keep in localStorage
// for their next load.
import { motionEffectsEnabled } from '../domain/settings/appearance';
import { normalizeLocale } from '../domain/settings/locale';
import { newtabInputAutoFocusEnabled } from '../domain/settings/newtab-page';
import { NEWTAB_SHORTCUTS_GROUP_KEYS } from '../domain/settings/newtab-shortcuts';
import { newtabInputAutoFocusCache, newtabLocaleCache } from '../domain/settings/page-cache';
import type { StorageAreaLike, StorageChangeEventLike, StorageItems, StorageKeys } from '../domain/storage-port';


// The parts of the extension API these helpers use.
interface StorageChromeApi {
  runtime?: { lastError?: { message?: string } | null };
  storage?: {
    local?: StorageAreaLike;
    sync?: StorageAreaLike;
    onChanged?: StorageChangeEventLike;
  };
}

type AreaName = 'sync' | 'local' | '';

type StorageMethod = 'get' | 'set' | 'remove' | 'clear';

// Called with the operation's result, and with its error when it failed
// (Chrome also leaves the error in runtime.lastError meanwhile). A failed
// read has no result.
type FacadeCallback<R> = (result: R | undefined, error?: Error) => void;

// An area that answers like chrome.storage: with a callback, or a promise
// when there is none. With a callback the promise still settles, with no
// result when the operation failed.
interface StorageAreaFacade {
  get(keys?: StorageKeys | FacadeCallback<StorageItems>, callback?: FacadeCallback<StorageItems>): Promise<StorageItems | undefined>;
  set(items: StorageItems, callback?: FacadeCallback<void>): Promise<void>;
  remove(keys: string | string[], callback?: FacadeCallback<void>): Promise<void>;
  clear(callback?: FacadeCallback<void>): Promise<void>;
}

// The area provider-scoped settings live in, and which one that is.
interface ProviderStorageRuntime {
  area: StorageAreaFacade;
  readonly name: AreaName;
  ready: Promise<AreaName>;
  getActiveAreaName(): AreaName;
  isActiveAreaName(areaName: unknown): boolean;
  isModeKnown(): boolean;
}

interface RetryOptions {
  retryDelayMs?: number;
}

interface ProviderStorageOptions extends RetryOptions {
  modeRetryDelaysMs?: number[];
}





// What window.matchMedia answers for the reduced-motion query.
interface MotionWindow {
  matchMedia?: (query: string) => { matches: boolean };
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message || error);
  }
  return String(error || '');
}

// A storage answer: an object of values by key.
function isStorageItems(value: unknown): value is StorageItems {
  return Boolean(value) && typeof value === 'object';
}

function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(errorMessage(error) || fallbackMessage);
}

// Copies settings this device saved locally into sync where sync has none.
// Sync is read again just before writing so a value another device synced
// meanwhile is never overwritten. The grouped shortcut keys move as one
// save keyed off their head: all of them while sync lacks a head (replacing
// any stray chunk there), none once it has one. Nothing is ever removed.
function migrateLocalSettingsToSync(localArea: StorageAreaLike, syncArea: StorageAreaLike, keys: string[]): void {
  const [groupHeadKey] = NEWTAB_SHORTCUTS_GROUP_KEYS;
  const isGroupKey = (key: string) => NEWTAB_SHORTCUTS_GROUP_KEYS.includes(key);
  localArea.get(keys, (localItems) => {
    // A failed read has no items: nothing to copy then.
    const localResult = localItems || {};
    const hasLocal = keys.some((key) => typeof localResult[key] !== 'undefined');
    if (!hasLocal) {
      return;
    }
    syncArea.get(keys, (syncItems) => {
      if (!syncItems) {
        return;
      }
      const syncResult = syncItems;
      const groupMissing = typeof localResult[groupHeadKey] !== 'undefined'
        && typeof syncResult[groupHeadKey] === 'undefined';
      const missingSyncValues: StorageItems = {};
      keys.forEach((key) => {
        if (typeof localResult[key] === 'undefined') {
          return;
        }
        const missing = isGroupKey(key) ? groupMissing : typeof syncResult[key] === 'undefined';
        if (missing) {
          missingSyncValues[key] = localResult[key];
        }
      });
      const missingKeys = Object.keys(missingSyncValues);
      if (missingKeys.length === 0) {
        return;
      }
      syncArea.get(missingKeys, (latestSyncItems) => {
        if (!latestSyncItems) {
          return;
        }
        const latestSyncResult = latestSyncItems;
        const groupStillMissing = typeof latestSyncResult[groupHeadKey] === 'undefined';
        const stillMissingSyncValues: StorageItems = {};
        missingKeys.forEach((key) => {
          const missing = isGroupKey(key)
            ? groupStillMissing
            : typeof latestSyncResult[key] === 'undefined';
          if (missing) {
            stillMissingSyncValues[key] = missingSyncValues[key];
          }
        });
        if (Object.keys(stillMissingSyncValues).length > 0) {
          syncArea.set(stillMissingSyncValues);
        }
      });
    });
  });
}

// Writes back the normalized values a page settled on after reading
// `stored` from `area`. An invalid value is replaced at once. A missing one
// is only filled with its default when this device has no local copy: that
// copy is on its way in through migrateLocalSettingsToSync, and a default
// written first would make the migration keep the default instead.
function writeSettingRepairs(
  chromeApi: StorageChromeApi | null | undefined,
  area: StorageAreaLike | null | undefined,
  repairs: StorageItems | null | undefined,
  stored: StorageItems | null | undefined
): void {
  if (!area || typeof area.set !== 'function') {
    return;
  }
  const values: StorageItems = repairs || {};
  const keys = Object.keys(values);
  const isMissing = (key: string) => !stored || typeof stored[key] === 'undefined';
  const write = (list: string[]) => {
    if (list.length > 0) {
      area.set(Object.fromEntries(list.map((key) => [key, values[key]])));
    }
  };
  write(keys.filter((key) => !isMissing(key)));
  const missing = keys.filter(isMissing);
  const localArea = chromeApi && chromeApi.storage ? chromeApi.storage.local : null;
  if (missing.length === 0) {
    return;
  }
  if (!localArea || localArea === area || typeof localArea.get !== 'function') {
    write(missing);
    return;
  }
  try {
    localArea.get(missing, (localResult) => {
      const failed = Boolean(chromeApi && chromeApi.runtime && chromeApi.runtime.lastError) || !localResult;
      write(missing.filter((key) => failed || typeof localResult[key] === 'undefined'));
    });
  } catch (error) {
    write(missing);
  }
}

// newtab-focus-entry.ts reads this copy to route a new tab before storage answers.
function cacheNewtabInputAutoFocusEnabled(value: unknown): void {
  try {
    const localStorageObj = globalThis.localStorage;
    const next = newtabInputAutoFocusEnabled.parse(value) ? 'true' : 'false';
    if (localStorageObj && localStorageObj.getItem(newtabInputAutoFocusCache.key) !== next) {
      localStorageObj.setItem(newtabInputAutoFocusCache.key, next);
    }
  } catch (_error) {
    // The copy is only a fast path; the focus entry falls back to reading storage.
  }
}

// newtab-storage-prefetch.ts fetches this locale's messages before newtab.js asks for them.
function cacheNewtabLocale(locale: unknown): void {
  try {
    const localStorageObj = globalThis.localStorage;
    const next = normalizeLocale(locale);
    if (localStorageObj && localStorageObj.getItem(newtabLocaleCache.key) !== next) {
      localStorageObj.setItem(newtabLocaleCache.key, next);
    }
  } catch (_error) {
    // The copy is only a fast path; newtab.js fetches the messages itself without it.
  }
}

function shouldSkipEntryMotion(windowRef: MotionWindow | null | undefined, motionEffectsValue: unknown): boolean {
  if (!motionEffectsEnabled.parse(motionEffectsValue)) {
    return true;
  }
  return Boolean(
    windowRef &&
    typeof windowRef.matchMedia === 'function' &&
    windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function readStorageValue(
  storageArea: StorageAreaLike | null | undefined,
  chromeApi: StorageChromeApi | null | undefined,
  key: string
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!storageArea || typeof storageArea.get !== 'function') {
      resolve(undefined);
      return;
    }
    let settled = false;
    const finish = (error: unknown, result?: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      if (!isStorageItems(result)) {
        reject(new Error('storage-read-failed'));
        return;
      }
      resolve(result[key]);
    };
    const callback = (result: StorageItems | undefined) => {
      const runtimeError = chromeApi && chromeApi.runtime
        ? chromeApi.runtime.lastError
        : null;
      finish(
        runtimeError
          ? new Error(String(runtimeError.message || 'storage-read-failed'))
          : null,
        result
      );
    };
    try {
      const maybePromise = storageArea.get([key], callback);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then((result) => finish(null, result)).catch((error: unknown) => finish(error));
      }
    } catch (error) {
      finish(error);
    }
  });
}

// chrome.storage.sync refuses a burst of writes (dragging a slider, several
// pages saving at once) with an error naming the exhausted quota. Its
// buckets refill about one write every two seconds, so a single later
// attempt goes through unless the burst keeps going.
const STORAGE_RATE_LIMIT_RETRY_MS = 2500;
const STORAGE_RATE_LIMIT_PATTERN = /MAX_(?:SUSTAINED_)?WRITE_OPERATIONS_PER_(?:MINUTE|HOUR)/;
// Chrome's answer to a content script reading an area restricted to trusted
// contexts. It holds for the life of the context, so retrying cannot help.
const STORAGE_ACCESS_DENIED_PATTERN = /Access to storage is not allowed from this context/i;
function isStorageRateLimitError(error: unknown): boolean {
  return STORAGE_RATE_LIMIT_PATTERN.test(errorMessage(error));
}
function getStorageRetryDelay(options?: RetryOptions | null): number {
  const delay = options && Number(options.retryDelayMs);
  return typeof delay === 'number' && Number.isFinite(delay) && delay >= 0 ? delay : STORAGE_RATE_LIMIT_RETRY_MS;
}
// Provider areas retry refused bursts themselves; wrapping one must not
// retry the same write twice.
const rateLimitRetryingAreas = new WeakSet<object>();

function writeStorageValues(
  storageArea: StorageAreaLike | StorageAreaFacade | null | undefined,
  chromeApi: StorageChromeApi | null | undefined,
  values: unknown,
  options?: RetryOptions | null
): Promise<StorageItems> {
  const payload: StorageItems = isStorageItems(values) && !Array.isArray(values)
    ? { ...values }
    : {};
  const retryDelayMs = getStorageRetryDelay(options);
  return new Promise((resolve, reject) => {
    if (!storageArea || typeof storageArea.set !== 'function') {
      resolve(payload);
      return;
    }
    const area = storageArea;
    let retries = rateLimitRetryingAreas.has(area) ? 0 : 1;
    const attempt = () => {
      let settled = false;
      const finish = (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        if (error && retries > 0 && isStorageRateLimitError(error)) {
          retries -= 1;
          setTimeout(attempt, retryDelayMs);
          return;
        }
        if (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        resolve(payload);
      };
      const callback = () => {
        const runtimeError = chromeApi && chromeApi.runtime
          ? chromeApi.runtime.lastError
          : null;
        finish(runtimeError
          ? new Error(String(runtimeError.message || 'storage-write-failed'))
          : null);
      };
      try {
        const maybePromise = area.set(payload, callback);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(() => {
            Promise.resolve().then(() => finish(null));
          }).catch(finish);
        }
      } catch (error) {
        finish(error);
      }
    };
    attempt();
  });
}

function writeStorageValue<T>(
  storageArea: StorageAreaLike | StorageAreaFacade | null | undefined,
  chromeApi: StorageChromeApi | null | undefined,
  key: string,
  value: T
): Promise<T> {
  return writeStorageValues(storageArea, chromeApi, { [key]: value })
    .then(() => value);
}

export {
  STORAGE_ACCESS_DENIED_PATTERN,
  STORAGE_RATE_LIMIT_PATTERN,
  STORAGE_RATE_LIMIT_RETRY_MS,
  cacheNewtabInputAutoFocusEnabled,
  cacheNewtabLocale,
  errorMessage,
  getStorageRetryDelay,
  isStorageItems,
  isStorageRateLimitError,
  migrateLocalSettingsToSync,
  rateLimitRetryingAreas,
  readStorageValue,
  shouldSkipEntryMotion,
  toError,
  writeSettingRepairs,
  writeStorageValue,
  writeStorageValues
};
export type {
  AreaName,
  FacadeCallback,
  MotionWindow,
  ProviderStorageOptions,
  ProviderStorageRuntime,
  RetryOptions,
  StorageAreaFacade,
  StorageChromeApi,
  StorageMethod
};
