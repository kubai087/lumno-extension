// The storage area the page's settings live in, the startup read the next
// New Tab prefetches, and moving preferences an older version kept locally.
import { newtabStartupStorageKeys } from '../domain/settings/page-cache';
import * as ProviderStorage from '../platform/provider-storage';
import * as SettingsStorage from '../platform/settings-storage';
import { takePrefetchedRead } from '../platform/storage-prefetch';

function createStartupStorage() {
  const providerStorageRuntime = ProviderStorage.createProviderStorageRuntime(chrome);
  const storageArea = providerStorageRuntime.area;
  // The next New Tab prefetches these keys before its scripts load (newtab-storage-prefetch.ts).
  function rememberStartupStorageKeys(keys: readonly string[] | null | undefined): void {
    if (!keys || !keys.length) {
      return;
    }
    try {
      const value = JSON.stringify(keys.slice().sort());
      const cacheKey = newtabStartupStorageKeys.key;
      if (window.localStorage.getItem(cacheKey) !== value) {
        window.localStorage.setItem(cacheKey, value);
      }
    } catch {
      // localStorage is only a fast path; the next load reads storage as before.
    }
  }
  // The settings store's first read of the settings area is the page's
  // startup read: it takes the prefetch, and its keys are what the next
  // New Tab prefetches.
  let startupReadTaken = false;
  function takeStartupRead(area: object, keys: readonly string[]): ReturnType<typeof takePrefetchedRead> {
    if (!startupReadTaken && area === storageArea) {
      startupReadTaken = true;
      rememberStartupStorageKeys(keys);
    }
    return takePrefetchedRead(area, keys);
  }

  // Whether a storage change came from the area settings live in.
  function isPrimaryStorageAreaName(areaName: string): boolean {
    return providerStorageRuntime.isActiveAreaName(areaName);
  }

  // Copies preferences an older version kept in local storage into browser
  // sync, once the settings area is known and turns out to be sync.
  function migrateLocalSettingsIfNeeded(keys: string[]): void {
    void providerStorageRuntime.ready.then(() => {
      if (!chrome.storage || !chrome.storage.local || isPrimaryStorageAreaName('local')) {
        return;
      }
      SettingsStorage.migrateLocalSettingsToSync(chrome.storage.local, storageArea, keys);
    });
  }

  return {
    providerStorageRuntime,
    storageArea,
    takeStartupRead,
    isPrimaryStorageAreaName,
    migrateLocalSettingsIfNeeded
  };
}

type StartupStorage = ReturnType<typeof createStartupStorage>;

export { createStartupStorage };
export type { StartupStorage };
