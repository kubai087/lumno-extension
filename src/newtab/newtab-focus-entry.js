(function() {
  const locationUrl = new URL(window.location.href);
  // Firefox marks its swapped-in tab with #focus (see swapNewtabForFocus).
  if (locationUrl.searchParams.get('focus') === '1' || locationUrl.hash === '#focus') {
    const documentElement = document.documentElement;
    if (documentElement) {
      documentElement.setAttribute('data-nt-focus-route', 'true');
    }
    return;
  }

  const documentElement = document.documentElement;
  if (documentElement) {
    documentElement.setAttribute('data-nt-focus-route-pending', 'true');
  }

  const settings = globalThis.LumnoSettings;
  const storageKey = settings.NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY ||
    '_x_extension_newtab_input_auto_focus_enabled_2026_unique_';
  const normalizeEnabled = settings.normalizeNewtabInputAutoFocusEnabled;
  const chromeApi = window.chrome || (typeof chrome !== 'undefined' ? chrome : null);

  function revealPage() {
    if (documentElement) {
      documentElement.removeAttribute('data-nt-focus-route-pending');
    }
  }

  // Firefox keeps URL-bar focus through same-tab navigation on the New Tab
  // page, so the background swaps in a fresh #focus tab instead. Wait until
  // shown: Firefox preloads this page hidden before it becomes a tab.
  function swapTabWhenVisible() {
    const requestSwap = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      document.removeEventListener('visibilitychange', requestSwap);
      try {
        chromeApi.runtime.sendMessage({ action: 'swapNewtabForFocus' }, (response) => {
          if (chromeApi.runtime.lastError || !response || !response.ok || !response.removed) {
            revealPage();
          }
        });
      } catch (_error) {
        revealPage();
      }
    };
    document.addEventListener('visibilitychange', requestSwap);
    requestSwap();
  }

  function redirectToFocusRoute() {
    if (locationUrl.protocol === 'moz-extension:') {
      swapTabWhenVisible();
      return;
    }
    locationUrl.searchParams.set('focus', '1');
    window.location.replace(locationUrl.href);
  }

  function settle(enabled) {
    if (typeof settings.cacheNewtabInputAutoFocusEnabled === 'function') {
      settings.cacheNewtabInputAutoFocusEnabled(enabled);
    }
    if (!normalizeEnabled(enabled)) {
      revealPage();
      return;
    }
    redirectToFocusRoute();
  }

  // The choice the last New Tab saw routes this one at once, before the page loads any further. The
  // focused page reads storage and corrects the copy if the setting changed on another device.
  let cachedEnabled = null;
  try {
    cachedEnabled = window.localStorage
      ? window.localStorage.getItem(settings.NEWTAB_INPUT_AUTO_FOCUS_CACHE_KEY)
      : null;
  } catch (_error) {
    cachedEnabled = null;
  }
  if (cachedEnabled === 'true') {
    redirectToFocusRoute();
    return;
  }

  const providerRuntime = settings.createProviderStorageRuntime(chromeApi);
  const storage = providerRuntime ? providerRuntime.area : chromeApi && chromeApi.storage
    ? (chromeApi.storage.sync || chromeApi.storage.local)
    : null;
  if (!storage || typeof storage.get !== 'function') {
    settle(false);
    return;
  }

  try {
    storage.get([storageKey], (result) => {
      settle(result && result[storageKey]);
    });
  } catch (_error) {
    settle(false);
  }
})();
