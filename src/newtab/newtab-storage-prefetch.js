(function() {
  // Starts the startup storage read with the keys the last New Tab asked for, while the rest of the
  // page is still loading; newtab.js's read batch takes the result.
  const settings = globalThis.LumnoSettings;
  const chromeApi = window.chrome || null;
  let keys = null;
  try {
    keys = JSON.parse(window.localStorage.getItem(settings.NEWTAB_STARTUP_STORAGE_KEYS_CACHE_KEY) || 'null');
  } catch (_error) {
    keys = null;
  }
  if (!Array.isArray(keys) || !keys.length || !keys.every((key) => typeof key === 'string')) {
    return;
  }
  const providerRuntime = settings.createProviderStorageRuntime(chromeApi);
  if (providerRuntime) {
    settings.prefetchStorageRead(providerRuntime.area, keys, chromeApi);
  }
})();
