(function() {
  const root = document.documentElement;
  const body = document.body;
  const preloadState = globalThis.LumnoNewtabWallpaperPreload;
  const effects = globalThis.LumnoNewtabWallpaperEffects;
  if (!root ||
      !body ||
      !preloadState ||
      !preloadState.wallpaper ||
      !(preloadState.imageUrl || preloadState.imageReady) ||
      !preloadState.effectPrefsReady) {
    return;
  }

  const liveState = {
    onRender() {},
    shouldAnimateTransition: () => false
  };
  const preloadRuntime = {
    claimed: false,
    controller: null,
    attach(options) {
      const config = options || {};
      if (typeof config.onRender === 'function') {
        liveState.onRender = config.onRender;
      }
      if (typeof config.shouldAnimateTransition === 'function') {
        liveState.shouldAnimateTransition = config.shouldAnimateTransition;
      }
    },
    updateSource(wallpaper, imageUrl) {
      preloadState.wallpaper = wallpaper || null;
      preloadState.imageUrl = String(imageUrl || '');
    }
  };
  globalThis.LumnoNewtabWallpaperEffectPreload = preloadRuntime;

  // Created up front so wallpaper.js always adopts this controller instead of starting its own, slower
  // render; it renders nothing until the preferences and the image are known.
  const controller = effects.createWallpaperEffects({
    documentObj: document,
    windowObj: window,
    getCurrentWallpaper: () => preloadState.wallpaper,
    getWallpaperImageUrl: () => preloadState.imageUrl,
    shouldAnimateTransition: () => liveState.shouldAnimateTransition(),
    onRender: () => liveState.onRender()
  });
  let runtimeAppliedPrefs = false;
  preloadRuntime.controller = Object.assign({}, controller, {
    apply(prefs) {
      runtimeAppliedPrefs = true;
      return controller.apply(prefs);
    }
  });

  // The page stays unpainted until this resolves, so the wallpaper and its effect appear together.
  function startEffects(prefs, imageUrl) {
    // Once wallpaper.js applies its own preferences it also decides when the wallpaper is ready.
    if (preloadRuntime.claimed || runtimeAppliedPrefs || !imageUrl) {
      return;
    }
    const normalized = effects.resolvePrefsForMode(prefs, preloadState.mode);
    if (normalized.type === 'none') {
      body.setAttribute('data-wallpaper-effect', 'none');
      body.setAttribute('data-nt-wallpaper-ready', '1');
      return;
    }

    body.setAttribute('data-wallpaper-active', 'true');
    body.setAttribute('data-wallpaper-effect', normalized.type);
    controller.apply(normalized);
    controller.refresh({ immediate: true }).then(() => {
      if (document.body) {
        document.body.setAttribute('data-nt-wallpaper-ready', '1');
      }
    });
  }

  // An online photo's IndexedDB copy may still be loading; without one, wallpaper.js takes over.
  const imageReady = preloadState.imageUrl ? null : preloadState.imageReady;
  preloadState.effectPrefsReady.then((prefs) => {
    if (!imageReady) {
      return startEffects(prefs, preloadState.imageUrl);
    }
    return imageReady.then((imageUrl) => startEffects(prefs, imageUrl));
  }).catch(() => {
    if (document.body) {
      document.body.setAttribute('data-nt-wallpaper-ready', '1');
    }
  });
})();
