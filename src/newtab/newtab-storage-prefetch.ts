// Starts reading what the last New Tab's choices make known before the page's
// own scripts load: its locale messages and its startup storage keys.
import * as LumnoSettings from '../domain/settings';
import { publishBootValue } from '../platform/boot-handoff';
import * as ProviderStorage from '../platform/provider-storage';
import { prefetchStorageRead } from '../platform/storage-prefetch';

(function() {
  // Starts the startup work the last New Tab's choices make known while the rest of the page is still
  // loading; newtab.js takes the results.
  const settings = LumnoSettings;
  const chromeApi = window.chrome || null;

  function readCache(key: string): string | null {
    try {
      return window.localStorage ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  // The locale messages gate the page's first reveal; fetch them now instead of after storage answers.
  const cachedLocale = readCache(settings.newtabLocaleCache.key);
  if (cachedLocale && settings.normalizeLocale(cachedLocale) === cachedLocale &&
      chromeApi && chromeApi.runtime && typeof chromeApi.runtime.getURL === 'function') {
    const localePath = chromeApi.runtime.getURL(`_locales/${cachedLocale}/messages.json`);
    publishBootValue('localePrefetch', {
      locale: cachedLocale,
      messages: fetch(localePath, { cache: 'no-store' }).then((response): Promise<unknown> => response.json())
    });
  }

  let stored: unknown = null;
  try {
    stored = JSON.parse(readCache(settings.newtabStartupStorageKeys.key) || 'null');
  } catch {
    stored = null;
  }
  const list: unknown[] = Array.isArray(stored) ? stored : [];
  const keys = list.filter((key): key is string => typeof key === 'string');
  if (!keys.length || keys.length !== list.length) {
    return;
  }
  const providerRuntime = ProviderStorage.createProviderStorageRuntime(chromeApi);
  prefetchStorageRead(providerRuntime.area, keys, chromeApi);
})();
