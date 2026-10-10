(function(root) {
  // Shortcut storage, favicons, loading, persistence, rendering and the add/edit
  // dialog.
  function createShortcutsController(deps) {
    const {
      shortcutFolderRuntime,
      bookmarksRuntime,
      isShortcutDragActive,
      NEWTAB_SHORTCUTS_STORAGE_KEY,
      MAX_NEWTAB_SHORTCUTS,
      normalizeHost,
      sanitizeDisplayText,
      providerStorageRuntime,
      storageAreaName,
      NEWTAB_SHORTCUTS_STORE,
      NEWTAB_SHORTCUTS_STORAGE_KEYS,
      NEWTAB_SHORTCUTS_CRITICAL_SYNC_RESERVE_BYTES,
      NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY,
      shortcutIconStore,
      folderItemIconStore,
      SHORTCUT_FAVICON,
      getPageFaviconUrlResolver,
      SEARCH_UTILS,
      getExtensionResourceUrl,
      sendRuntimeMessage,
      shortcutFaviconStore,
      faviconCacheRuntime,
      FAVICON_UTILS,
      getPersistedFaviconDataEntry,
      t,
      hideShortcutTooltip,
      closeShortcutContextMenu,
      syncOpenBookmarkCascadeAnchorVisual,
      applyNewtabShortcutsVisibility,
      updateShortcutLanguageStrings,
      updateBookmarkSectionPosition,
      storageArea,
      NEWTAB_SHORTCUT_ICON_STORE,
      NEWTAB_SHORTCUT_COLUMNS_DEFAULT,
      NEWTAB_SHORTCUT_SIZE_DEFAULT,
      NEWTAB_SHORTCUT_GAP_DEFAULT,
      applyNewtabShortcutLayoutPreferences,
      applyNewtabShortcutDockMagnification,
      updateNewtabShortcutPreferencesUi,
      NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
      NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
      NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
      NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY,
      NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
      NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
      NEWTAB_SHORTCUT_GAP_STORAGE_KEY,
      normalizeNewtabShortcutsVisible,
      normalizeNewtabShortcutAddVisible,
      normalizeNewtabShortcutDockMagnificationEnabled,
      inferNewtabShortcutColumnsFromWidth,
      normalizeNewtabShortcutColumns,
      normalizeNewtabShortcutSize,
      normalizeNewtabShortcutGap,
      loadFolderColors,
      showToast,
      formatMessage,
      getShortcutById,
      SHORTCUT_DIALOG_MODE_EDIT,
      SHORTCUT_DIALOG_ITEM_FOLDER,
      markBookmarkTreeDirty,
      loadBookmarks,
      refreshOpenBookmarkCascadeMenu,
      NEWTAB_BOOKMARK_MOVE_HISTORY,
      bookmarkMoveHistory,
      getBookmarkUndoShortcutLabel,
      resetShortcutDockHover,
      scheduleWallpaperAdaptiveToneUpdate,
      pageStructureRuntime,
      NEWTAB_SHORTCUTS_VIEW,
      shortcutTiles,
      getFigmaFolderSvg,
      initFolderPathMorph,
      playFolderPathMorph,
      getHostFromUrl,
      getImmediateThemeForSuggestion,
      applyShortcutTileTheme,
      queueThemeForTarget,
      attachFaviconWithFallbacks,
      bindShortcutTooltip,
      isMiddleClick,
      openShortcutUrl,
      handleShortcutContextMenu,
      handleShortcutNativeDragStart,
      getRiSvg,
      openShortcutDialog,
      openShortcutAddContextMenu,
      handleShortcutDragPointerDown,
      handleShortcutDockPointerOver,
      handleShortcutDockPointerMove,
      NEWTAB_SHORTCUT_DIALOG,
      bindShortcutDialogTooltip,
      hideShortcutDialogTooltip,
      SHORTCUT_DIALOG_ITEM_BOOKMARK
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    let shortcutsView = null;
    let shortcutStorageReloadTimer = null;
    const shortcutFaviconPending = new Map();
    const shortcutFaviconRequestQueue = [];
    const SHORTCUT_FAVICON_MAX_CONCURRENT_REQUESTS = 3;
    let shortcutFaviconActiveRequestCount = 0;
    let shortcutFaviconCacheWriteTimer = null;

    function getShortcutFolderId(shortcut) {
      if (!shortcut || shortcut.type !== 'folder') return '';
      if (!shortcut.folderRef) return String(shortcut.folderId || '');
      const node = shortcutFolderRuntime.getNode(shortcut, bookmarksRuntime.getNodeMap());
      return node ? String(node.id) : '';
    }

    function getVisibleShortcuts() {
      return shortcutFolderRuntime.visibleItems(pageState.newtabShortcuts, bookmarksRuntime.getNodeMap());
    }

    function refreshShortcutFolderReferences() {
      if (pageState.bookmarkMoveHistoryBusy) return Promise.resolve(false);
      const original = pageState.newtabShortcuts;
      return Promise.all([shortcutFolderRuntime.ready, bookmarksRuntime.ensureReady(false)]).then(([, ready]) => {
        if (!ready || pageState.bookmarkMoveHistoryBusy || isShortcutDragActive() || pageState.newtabShortcuts !== original) return false;
        const next = shortcutFolderRuntime.reconcile(original, bookmarksRuntime.getNodeMap());
        return shortcutFolderRuntime.flush().then(() => {
          if (pageState.newtabShortcuts !== original || pageState.bookmarkMoveHistoryBusy || isShortcutDragActive()) return false;
          if (JSON.stringify(next) !== JSON.stringify(original)) return persistShortcuts(next);
          renderShortcuts();
          return true;
        });
      }).catch((error) => {
        console.warn('[Lumno] Could not update shortcut folder references.', error);
        return false;
      });
    }

    function getShortcutStoreOptions(extraOptions) {
      return {
        key: NEWTAB_SHORTCUTS_STORAGE_KEY,
        maxShortcuts: MAX_NEWTAB_SHORTCUTS,
        normalizeHost,
        sanitizeDisplayText,
        ...(extraOptions || {})
      };
    }

    function isShortcutSyncStorageActive() {
      return Boolean(
        (providerStorageRuntime ? providerStorageRuntime.getActiveAreaName() : storageAreaName) === 'sync' &&
        chrome && chrome.storage && chrome.storage.sync
      );
    }

    function getShortcutOverflowStorageArea() {
      return isShortcutSyncStorageActive() && chrome.storage.local
        ? chrome.storage.local
        : null;
    }

    function getShortcutStorageLastError() {
      return chrome && chrome.runtime && chrome.runtime.lastError
        ? chrome.runtime.lastError
        : null;
    }

    function getStorageBytesInUse(area, keys) {
      return new Promise((resolve, reject) => {
        if (!area || typeof area.getBytesInUse !== 'function') {
          reject(new Error('Storage byte usage is unavailable'));
          return;
        }
        try {
          const maybePromise = area.getBytesInUse(keys, (bytesInUse) => {
            const runtimeError = getShortcutStorageLastError();
            if (runtimeError) {
              reject(new Error(runtimeError.message || 'Could not read sync byte usage'));
              return;
            }
            resolve(Math.max(0, Number(bytesInUse) || 0));
          });
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then((bytesInUse) => {
              resolve(Math.max(0, Number(bytesInUse) || 0));
            }).catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });
    }

    function getShortcutSyncByteBudget() {
      const defaultBudget = Number(
        NEWTAB_SHORTCUTS_STORE.DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES
      ) || (3 * 7680);
      if (!isShortcutSyncStorageActive()) {
        return Promise.resolve(Number.MAX_SAFE_INTEGER);
      }
      const syncArea = chrome.storage.sync;
      const totalQuotaBytes = Math.max(
        0,
        Number(syncArea.QUOTA_BYTES) || (100 * 1024)
      );
      return Promise.all([
        getStorageBytesInUse(syncArea, null),
        getStorageBytesInUse(syncArea, NEWTAB_SHORTCUTS_STORAGE_KEYS)
      ]).then(([totalBytes, shortcutBytes]) => {
        const nonShortcutBytes = Math.max(0, totalBytes - shortcutBytes);
        const protectedBudget = Math.max(
          0,
          totalQuotaBytes - NEWTAB_SHORTCUTS_CRITICAL_SYNC_RESERVE_BYTES - nonShortcutBytes
        );
        return Math.min(defaultBudget, protectedBudget);
      }).catch(() => 0);
    }

    function normalizeShortcutLocalState(value) {
      if (Array.isArray(value)) {
        return {
          authoritative: false,
          items: NEWTAB_SHORTCUTS_STORE.normalizeShortcuts(
            value,
            getShortcutStoreOptions()
          )
        };
      }
      const source = value && typeof value === 'object' ? value : {};
      return {
        authoritative: source.authoritative === true,
        items: NEWTAB_SHORTCUTS_STORE.normalizeShortcuts(
          source.items,
          getShortcutStoreOptions()
        )
      };
    }

    function readShortcutLocalState() {
      const overflowArea = getShortcutOverflowStorageArea();
      if (!overflowArea || typeof overflowArea.get !== 'function') {
        return Promise.resolve(normalizeShortcutLocalState(null));
      }
      return new Promise((resolve) => {
        try {
          overflowArea.get([NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY], (result) => {
            if (getShortcutStorageLastError()) {
              resolve(normalizeShortcutLocalState(null));
              return;
            }
            resolve(normalizeShortcutLocalState(
              result && result[NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY]
            ));
          });
        } catch (error) {
          resolve(normalizeShortcutLocalState(null));
        }
      });
    }

    function writeShortcutLocalState(items, authoritative) {
      const overflowArea = getShortcutOverflowStorageArea();
      if (!overflowArea || typeof overflowArea.set !== 'function') {
        return Promise.resolve();
      }
      const localState = {
        version: 1,
        authoritative: authoritative === true,
        items: NEWTAB_SHORTCUTS_STORE.normalizeShortcuts(
          items,
          getShortcutStoreOptions()
        ),
        updatedAt: Date.now()
      };
      return new Promise((resolve, reject) => {
        try {
          const maybePromise = overflowArea.set({
            [NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY]: localState
          }, () => {
            const runtimeError = getShortcutStorageLastError();
            if (runtimeError) {
              reject(new Error(runtimeError.message || 'Could not save local shortcuts'));
              return;
            }
            resolve();
          });
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(resolve).catch(reject);
          }
        } catch (error) {
          reject(error);
        }
      });
    }

    function scheduleShortcutStorageReload() {
      if (shortcutStorageReloadTimer !== null) {
        window.clearTimeout(shortcutStorageReloadTimer);
      }
      shortcutStorageReloadTimer = window.setTimeout(() => {
        shortcutStorageReloadTimer = null;
        loadShortcuts().then(() => {
          pruneShortcutFavicons(pageState.newtabShortcuts);
          const prunedIcons = getNextShortcutIconMap(pageState.newtabShortcuts);
          if (!areShortcutIconMapsEqual(pageState.newtabShortcutIcons, prunedIcons)) {
            pageState.newtabShortcutIcons = prunedIcons;
            shortcutIconStore.writeAll(prunedIcons).catch(() => {});
          }
          renderShortcuts();
        });
      }, 32);
    }

    function getShortcutIconDataUrl(shortcutId) {
      const id = String(shortcutId || '').trim();
      return id && pageState.newtabShortcutIcons[id] ? pageState.newtabShortcutIcons[id] : '';
    }

    // A built-in choice only holds while this extension still packages artwork
    // for the URL; otherwise the tile resolves its icon automatically.
    function getShortcutIconSource(shortcut) {
      const source = shortcut && shortcut.iconSource;
      return source === 'builtin' && !getShortcutDialogBuiltinIconUrl(shortcut.url) ? undefined : source;
    }

    function getShortcutFaviconDataUrl(pageUrl) {
      const normalizedPageUrl = SHORTCUT_FAVICON.normalizePageUrl(pageUrl);
      const shortcut = pageState.newtabShortcuts.find((item) => SHORTCUT_FAVICON.normalizePageUrl(item && item.url) === normalizedPageUrl);
      const source = getShortcutIconSource(shortcut);
      if (source === 'builtin') return '';
      const entry = normalizedPageUrl && pageState.newtabShortcutFavicons[normalizedPageUrl];
      if (entry && ['service', 'favicon-is', 'cache'].includes(source)) {
        const savedSource = SHORTCUT_FAVICON.getCachedIconSource(entry);
        if (source !== savedSource) return '';
      }
      return SHORTCUT_FAVICON.getCachedIconDataUrl(pageState.newtabShortcutFavicons, pageUrl);
    }

    function getShortcutFaviconCandidateUrl(pageUrl) {
      // A saved snapshot, including an explicit refresh, takes precedence over bundled defaults.
      if (getShortcutFaviconDataUrl(pageUrl)) {
        return '';
      }
      const normalizedPageUrl = SHORTCUT_FAVICON.normalizePageUrl(pageUrl);
      const shortcut = pageState.newtabShortcuts.find((item) => SHORTCUT_FAVICON.normalizePageUrl(item && item.url) === normalizedPageUrl);
      if (normalizedPageUrl && getShortcutIconSource(shortcut) !== 'builtin') return '';
      const resolver = getPageFaviconUrlResolver();
      return resolver ? resolver.getShortcutFaviconCandidateUrl(
        pageUrl, getShortcutDialogBuiltinIconUrl(pageUrl)
      ) : '';
    }

    function saveShortcutFaviconSnapshot(pageUrl, dataUrl, sourceUrl, replaceExisting) {
      const normalizedDataUrl = SHORTCUT_FAVICON.normalizeDataUrl(dataUrl);
      if (!normalizedDataUrl || !pageState.newtabShortcuts.some((item) =>
          SHORTCUT_FAVICON.normalizePageUrl(item && item.url) === pageUrl)) {
        return '';
      }
      const savedDataUrl = getShortcutFaviconDataUrl(pageUrl);
      if (savedDataUrl && replaceExisting !== true) {
        return savedDataUrl;
      }
      pageState.newtabShortcutFavicons = SHORTCUT_FAVICON.setCachedIcon(
        pageState.newtabShortcutFavicons, pageUrl, normalizedDataUrl, sourceUrl
      );
      scheduleShortcutFaviconCacheWrite(pageUrl);
      return normalizedDataUrl;
    }

    function areShortcutFaviconEntriesEqual(left, right) {
      return Boolean(left && right &&
        left.dataUrl === right.dataUrl &&
        left.sourceUrl === right.sourceUrl &&
        left.updatedAt === right.updatedAt);
    }

    // Websites inside shortcut folders keep their own icon choice; '' means
    // the automatic favicon.
    function getFolderItemIconUrl(bookmarkId, url) {
      const entry = folderItemIconStore.get(bookmarkId);
      if (!entry) return '';
      return entry.iconSource === 'builtin' ? getShortcutDialogBuiltinIconUrl(url) : entry.dataUrl;
    }

    function getFolderItemIcon(bookmarkId) {
      return folderItemIconStore.get(bookmarkId);
    }

    // The icon a website shortcut keeps once stacked into a folder.
    function getFolderItemIconForShortcut(shortcut, iconDataUrl) {
      if (iconDataUrl) return { iconSource: 'custom', dataUrl: iconDataUrl };
      const source = getShortcutIconSource(shortcut);
      if (source === 'builtin') return { iconSource: 'builtin' };
      const dataUrl = shortcut && shortcut.url ? getShortcutFaviconDataUrl(shortcut.url) : '';
      return dataUrl ? { iconSource: source || 'cache', dataUrl } : null;
    }

    function updateFolderItemIcons(changes) {
      const snapshot = bookmarksRuntime.getSnapshot();
      return folderItemIconStore.update(changes, snapshot.ready ? (id) => snapshot.nodeMap.has(id) : undefined);
    }

    function getNextFolderItemIcon(bookmarkId, url, iconState) {
      const current = folderItemIconStore.get(bookmarkId);
      const source = iconState.source;
      if (source === 'custom') {
        return iconState.action === 'replace' && iconState.dataUrl
          ? { iconSource: 'custom', dataUrl: iconState.dataUrl }
          : current && current.iconSource === 'custom' ? current : null;
      }
      if (source === 'builtin') return { iconSource: 'builtin' };
      const toPageUrl = (value) => SHORTCUT_FAVICON.normalizePageUrl(NEWTAB_SHORTCUTS_STORE.normalizeShortcutUrl(value));
      const pageUrl = toPageUrl(url);
      const onlineIcon = iconState.onlineIcon;
      if (onlineIcon && onlineIcon.dataUrl && pageUrl && onlineIcon.pageUrl === pageUrl) {
        return { iconSource: source, dataUrl: onlineIcon.dataUrl };
      }
      // An unchanged choice keeps its image until the URL changes.
      const node = bookmarksRuntime.getNode(bookmarkId);
      return current && current.iconSource === source && node && toPageUrl(node.url) === pageUrl ? current : null;
    }

    function getShortcutDialogOnlineIconUrl(url) {
      const pageUrl = NEWTAB_SHORTCUTS_STORE.normalizeShortcutUrl(url);
      return pageUrl ? getShortcutFaviconDataUrl(pageUrl) || getShortcutFaviconCandidateUrl(pageUrl) : '';
    }

    function getShortcutDialogBuiltinIconUrl(url) {
      const pageUrl = NEWTAB_SHORTCUTS_STORE.normalizeShortcutUrl(url);
      const assetPath = SHORTCUT_FAVICON.getBundledShortcutIconAssetPath(
        pageUrl, SEARCH_UTILS.getDefaultSiteSearchProviders()
      );
      return assetPath ? getExtensionResourceUrl(assetPath) : '';
    }

    function getShortcutDialogOnlineIconSource(url) {
      const pageUrl = SHORTCUT_FAVICON.normalizePageUrl(
        NEWTAB_SHORTCUTS_STORE.normalizeShortcutUrl(url)
      );
      const shortcut = pageState.newtabShortcuts.find((item) => SHORTCUT_FAVICON.normalizePageUrl(item && item.url) === pageUrl);
      if (shortcut && ['service', 'favicon-is', 'cache', 'builtin'].includes(shortcut.iconSource)) {
        return shortcut.iconSource;
      }
      const entry = pageUrl && pageState.newtabShortcutFavicons[pageUrl];
      if (entry && SHORTCUT_FAVICON.isCachedIconForPage(entry, pageUrl)) {
        return SHORTCUT_FAVICON.getCachedIconSource(entry);
      }
      return 'cache';
    }

    function isShortcutDialogIconSourceAvailable(source, url) {
      const pageUrl = NEWTAB_SHORTCUTS_STORE.normalizeShortcutUrl(url);
      if (!pageUrl) return source === 'cache';
      const normalizedPageUrl = SHORTCUT_FAVICON.normalizePageUrl(pageUrl);
      const resolver = getPageFaviconUrlResolver();
      return normalizedPageUrl
        ? Boolean(resolver && resolver.getShortcutFaviconFetchCandidates(normalizedPageUrl, source).length)
        : source === 'cache';
    }

    function refreshShortcutDialogOnlineIcon(url, iconSource) {
      const pageUrl = NEWTAB_SHORTCUTS_STORE.normalizeShortcutUrl(url);
      const normalizedPageUrl = SHORTCUT_FAVICON.normalizePageUrl(pageUrl);
      if (!normalizedPageUrl) {
        if (iconSource === 'service' || iconSource === 'favicon-is') return Promise.resolve(null);
        // Internal browser pages can only use their browser-provided icon.
        const browserIcon = pageUrl ? getShortcutFaviconCandidateUrl(pageUrl) : '';
        return Promise.resolve(browserIcon ? { dataUrl: browserIcon, pageUrl } : null);
      }
      const resolver = getPageFaviconUrlResolver();
      if (!resolver || resolver.getShortcutFaviconFetchCandidates(normalizedPageUrl, iconSource).length === 0) {
        return Promise.resolve(null);
      }
      const policyRevision = pageState.shortcutFaviconPolicyRevision;
      return new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        const timeoutId = window.setTimeout(() => finish(null), 8000);
        const sent = sendRuntimeMessage({
          action: 'getShortcutFaviconData',
          pageUrl: normalizedPageUrl,
          refresh: true,
          ...(['service', 'favicon-is', 'cache'].includes(iconSource) ? { iconSource } : {})
        }, (response) => {
          window.clearTimeout(timeoutId);
          const dataUrl = SHORTCUT_FAVICON.normalizeDataUrl(response && response.data);
          finish(dataUrl && policyRevision === pageState.shortcutFaviconPolicyRevision
            ? { dataUrl, pageUrl: normalizedPageUrl, sourceUrl: String(response.sourceUrl || '') }
            : null);
        });
        if (!sent) {
          window.clearTimeout(timeoutId);
          finish(null);
        }
      });
    }

    function scheduleShortcutFaviconCacheWrite(pageUrl) {
      const cacheKey = SHORTCUT_FAVICON.normalizePageUrl(pageUrl);
      const cacheEntry = cacheKey ? pageState.newtabShortcutFavicons[cacheKey] : null;
      if (cacheKey && cacheEntry) {
        pageState.shortcutFaviconPendingCacheEntries[cacheKey] = cacheEntry;
      }
      if (shortcutFaviconCacheWriteTimer !== null) {
        window.clearTimeout(shortcutFaviconCacheWriteTimer);
      }
      shortcutFaviconCacheWriteTimer = window.setTimeout(() => {
        shortcutFaviconCacheWriteTimer = null;
        const pendingEntries = { ...pageState.shortcutFaviconPendingCacheEntries };
        if (Object.keys(pendingEntries).length === 0) {
          return;
        }
        shortcutFaviconStore.mergeAll(pendingEntries).then((savedEntries) => {
          Object.keys(pendingEntries).forEach((key) => {
            if (areShortcutFaviconEntriesEqual(pageState.shortcutFaviconPendingCacheEntries[key], pendingEntries[key])) {
              delete pageState.shortcutFaviconPendingCacheEntries[key];
            }
          });
          pageState.newtabShortcutFavicons = SHORTCUT_FAVICON.normalizeCacheMap({
            ...savedEntries,
            ...pageState.shortcutFaviconPendingCacheEntries
          });
        }).catch(() => {});
      }, 120);
    }

    function drainShortcutFaviconRequestQueue() {
      while (shortcutFaviconActiveRequestCount < SHORTCUT_FAVICON_MAX_CONCURRENT_REQUESTS &&
          shortcutFaviconRequestQueue.length > 0) {
        const task = shortcutFaviconRequestQueue.shift();
        shortcutFaviconActiveRequestCount += 1;
        Promise.resolve().then(task.run).then(task.resolve, () => task.resolve('')).finally(() => {
          shortcutFaviconActiveRequestCount = Math.max(0, shortcutFaviconActiveRequestCount - 1);
          drainShortcutFaviconRequestQueue();
        });
      }
    }

    function enqueueShortcutFaviconRequest(run) {
      return new Promise((resolve) => {
        shortcutFaviconRequestQueue.push({ run, resolve });
        drainShortcutFaviconRequestQueue();
      });
    }

    function resolveShortcutFaviconDataUrl(pageUrl) {
      const normalizedPageUrl = SHORTCUT_FAVICON.normalizePageUrl(pageUrl);
      if (!normalizedPageUrl) {
        return Promise.resolve('');
      }
      const shortcut = pageState.newtabShortcuts.find((item) => SHORTCUT_FAVICON.normalizePageUrl(item && item.url) === normalizedPageUrl);
      const iconSource = getShortcutIconSource(shortcut);
      if (iconSource === 'builtin') return Promise.resolve('');
      const cachedDataUrl = getShortcutFaviconDataUrl(normalizedPageUrl);
      if (cachedDataUrl) {
        return Promise.resolve(cachedDataUrl);
      }
      const policyRevision = pageState.shortcutFaviconPolicyRevision;
      const requestKey = `${normalizedPageUrl}::${policyRevision}::${iconSource || 'auto'}`;
      if (shortcutFaviconPending.has(requestKey)) {
        return shortcutFaviconPending.get(requestKey);
      }
      const promise = enqueueShortcutFaviconRequest(async () => {
        await faviconCacheRuntime.ensureCachesReady();
        const shortcutStillExists = pageState.newtabShortcuts.some((item) =>
          SHORTCUT_FAVICON.normalizePageUrl(item && item.url) === normalizedPageUrl);
        if (!shortcutStillExists || policyRevision !== pageState.shortcutFaviconPolicyRevision) {
          return '';
        }
        const savedDataUrl = getShortcutFaviconDataUrl(normalizedPageUrl);
        if (savedDataUrl) {
          return savedDataUrl;
        }
        const cacheKey = FAVICON_UTILS.getFaviconPersistCacheKey(normalizedPageUrl);
        const existingEntry = getPersistedFaviconDataEntry(cacheKey);
        if (!iconSource && SHORTCUT_FAVICON.isCachedIconForPage(existingEntry, normalizedPageUrl) &&
            SHORTCUT_FAVICON.normalizeDataUrl(existingEntry.dataUrl)) {
          return saveShortcutFaviconSnapshot(normalizedPageUrl, existingEntry.dataUrl, existingEntry.sourceUrl || '');
        }
        const resolver = getPageFaviconUrlResolver();
        if (!resolver || resolver.getShortcutFaviconFetchCandidates(normalizedPageUrl, iconSource).length === 0) {
          return '';
        }
        return new Promise((resolve) => {
          let settled = false;
          const finish = (dataUrl) => {
            if (settled) {
              return;
            }
            settled = true;
            resolve(dataUrl || '');
          };
          const timeoutId = window.setTimeout(() => finish(''), 8000);
          const sent = sendRuntimeMessage({
            action: 'getShortcutFaviconData',
            pageUrl: normalizedPageUrl,
            ...(['service', 'favicon-is', 'cache'].includes(iconSource) ? { iconSource } : {})
          }, (response) => {
            window.clearTimeout(timeoutId);
            if (settled) {
              return;
            }
            const currentShortcut = pageState.newtabShortcuts.find((item) =>
              SHORTCUT_FAVICON.normalizePageUrl(item && item.url) === normalizedPageUrl);
            if (!currentShortcut || getShortcutIconSource(currentShortcut) !== iconSource ||
                policyRevision !== pageState.shortcutFaviconPolicyRevision) {
              finish('');
              return;
            }
            finish(saveShortcutFaviconSnapshot(normalizedPageUrl,
              response && response.data, response && response.sourceUrl));
          });
          if (!sent) {
            window.clearTimeout(timeoutId);
            finish('');
          }
        });
      }).finally(() => {
        shortcutFaviconPending.delete(requestKey);
      });
      shortcutFaviconPending.set(requestKey, promise);
      return promise;
    }

    function getShortcutTitle(shortcut) {
      if (shortcut && shortcut.type === 'folder') {
        const node = bookmarksRuntime.getNode(getShortcutFolderId(shortcut));
        return sanitizeDisplayText((node && node.title) || shortcut.title || '') ||
          t('newtab_shortcuts_open_folder', 'Open folder');
      }
      return sanitizeDisplayText(shortcut && shortcut.title ? shortcut.title : '') ||
        sanitizeDisplayText(shortcut && shortcut.host ? shortcut.host : '') ||
        sanitizeDisplayText(shortcut && shortcut.url ? shortcut.url : '') ||
        t('newtab_shortcuts_add', 'Add shortcut');
    }

    function setShortcutError(message) {
      if (pageState.shortcutDialogController) {
        pageState.shortcutDialogController.setError(message);
      }
    }

    function setShortcutIconError(message) {
      if (pageState.shortcutDialogController && typeof pageState.shortcutDialogController.setIconError === 'function') {
        pageState.shortcutDialogController.setIconError(message);
      }
    }

    function renderShortcuts() {
      if (!pageState.shortcutGrid || !shortcutsView) {
        return;
      }
      hideShortcutTooltip();
      closeShortcutContextMenu();
      pageState.newtabShortcuts = NEWTAB_SHORTCUTS_STORE.normalizeShortcuts(pageState.newtabShortcuts, getShortcutStoreOptions());
      const items = getVisibleShortcuts();
      shortcutsView.render(items);
      shortcutFolderRuntime.flush().catch(() => {});
      syncOpenBookmarkCascadeAnchorVisual();
      pageState.addShortcutButton = shortcutsView.getAddButton();
      if (pageState.shortcutSection) {
        pageState.shortcutSection.setAttribute('data-count', String(items.length));
      }
      applyNewtabShortcutsVisibility();
      updateShortcutLanguageStrings();
      updateBookmarkSectionPosition({
        preserveSearchEntryLayout: Boolean(
          document.body && document.body.getAttribute('data-nt-ready') === '1'
        )
      });
    }

    function loadShortcuts() {
      if (!storageArea) {
        pageState.newtabShortcuts = NEWTAB_SHORTCUTS_STORE.getDefaultShortcuts(getShortcutStoreOptions());
        return Promise.resolve(pageState.newtabShortcuts);
      }
      return Promise.all([
        NEWTAB_SHORTCUTS_STORE.loadShortcuts(storageArea, getShortcutStoreOptions()),
        readShortcutLocalState()
      ]).then(([syncedItems, localState]) => {
        if (localState && localState.authoritative === true) {
          pageState.newtabShortcuts = localState.items;
        } else {
          pageState.newtabShortcuts = NEWTAB_SHORTCUTS_STORE.mergeShortcutLists(
            syncedItems,
            localState && localState.items,
            getShortcutStoreOptions()
          );
        }
        if (pageState.newtabShortcuts.some((shortcut) => shortcut.type === 'folder')) {
          return refreshShortcutFolderReferences().then(() => pageState.newtabShortcuts);
        }
        return pageState.newtabShortcuts;
      });
    }

    function loadShortcutIcons() {
      return shortcutIconStore.readAll()
        .then((icons) => {
          pageState.newtabShortcutIcons = NEWTAB_SHORTCUT_ICON_STORE.normalizeIconMap(icons);
          return pageState.newtabShortcutIcons;
        })
        .catch(() => {
          pageState.newtabShortcutIcons = {};
          return pageState.newtabShortcutIcons;
        });
    }

    function loadShortcutFavicons() {
      return shortcutFaviconStore.readAll()
        .then((cacheMap) => {
          pageState.newtabShortcutFavicons = SHORTCUT_FAVICON.normalizeCacheMap(cacheMap);
          return pageState.newtabShortcutFavicons;
        })
        .catch(() => {
          pageState.newtabShortcutFavicons = {};
          return pageState.newtabShortcutFavicons;
        });
    }

    function pruneShortcutFavicons(shortcuts, persist) {
      const shortcutUrls = (Array.isArray(shortcuts) ? shortcuts : []).map((item) => item && item.url);
      const nextFavicons = SHORTCUT_FAVICON.retainCachedIcons(
        pageState.newtabShortcutFavicons,
        shortcutUrls
      );
      const changed = JSON.stringify(pageState.newtabShortcutFavicons) !== JSON.stringify(nextFavicons);
      pageState.newtabShortcutFavicons = nextFavicons;
      pageState.shortcutFaviconPendingCacheEntries = SHORTCUT_FAVICON.retainCachedIcons(
        pageState.shortcutFaviconPendingCacheEntries,
        shortcutUrls
      );
      if (changed && persist !== false) {
        shortcutFaviconStore.retainAll(shortcutUrls).catch(() => {});
      }
      return changed;
    }

    function loadNewtabShortcutPreferences() {
      if (!storageArea) {
        pageState.newtabShortcutsVisible = true;
        pageState.newtabShortcutAddVisible = true;
        pageState.newtabShortcutDockMagnificationEnabled = true;
        pageState.newtabShortcutColumns = NEWTAB_SHORTCUT_COLUMNS_DEFAULT;
        pageState.newtabShortcutSize = NEWTAB_SHORTCUT_SIZE_DEFAULT;
        pageState.newtabShortcutGap = NEWTAB_SHORTCUT_GAP_DEFAULT;
        applyNewtabShortcutLayoutPreferences();
        applyNewtabShortcutsVisibility();
        applyNewtabShortcutDockMagnification();
        updateNewtabShortcutPreferencesUi();
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        storageArea.get([
          NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
          NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
          NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
          NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY,
          NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
          NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
          NEWTAB_SHORTCUT_GAP_STORAGE_KEY
        ], (result) => {
          const stored = result || {};
          const rawVisible = stored[NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY];
          const rawAddVisible = stored[NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY];
          const rawMagnification =
            stored[NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY];
          const rawWidth = stored[NEWTAB_SHORTCUT_WIDTH_STORAGE_KEY];
          const rawColumns = stored[NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY];
          const rawSize = stored[NEWTAB_SHORTCUT_SIZE_STORAGE_KEY];
          const rawGap = stored[NEWTAB_SHORTCUT_GAP_STORAGE_KEY];
          pageState.newtabShortcutsVisible = normalizeNewtabShortcutsVisible(rawVisible);
          pageState.newtabShortcutAddVisible = normalizeNewtabShortcutAddVisible(rawAddVisible);
          pageState.newtabShortcutDockMagnificationEnabled =
            normalizeNewtabShortcutDockMagnificationEnabled(rawMagnification);
          pageState.newtabShortcutColumns = rawColumns === undefined
            ? inferNewtabShortcutColumnsFromWidth(rawWidth)
            : normalizeNewtabShortcutColumns(rawColumns);
          pageState.newtabShortcutSize = normalizeNewtabShortcutSize(rawSize);
          pageState.newtabShortcutGap = normalizeNewtabShortcutGap(rawGap);
          const repairs = {};
          if (rawVisible !== pageState.newtabShortcutsVisible) {
            repairs[NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY] = pageState.newtabShortcutsVisible;
          }
          if (rawAddVisible !== pageState.newtabShortcutAddVisible) {
            repairs[NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY] = pageState.newtabShortcutAddVisible;
          }
          if (rawMagnification !== pageState.newtabShortcutDockMagnificationEnabled) {
            repairs[NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY] =
              pageState.newtabShortcutDockMagnificationEnabled;
          }
          if (rawColumns !== pageState.newtabShortcutColumns) {
            repairs[NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY] = pageState.newtabShortcutColumns;
          }
          if (rawSize !== pageState.newtabShortcutSize) {
            repairs[NEWTAB_SHORTCUT_SIZE_STORAGE_KEY] = pageState.newtabShortcutSize;
          }
          if (rawGap !== pageState.newtabShortcutGap) {
            repairs[NEWTAB_SHORTCUT_GAP_STORAGE_KEY] = pageState.newtabShortcutGap;
          }
          if (Object.keys(repairs).length > 0) {
            storageArea.set(repairs);
          }
          applyNewtabShortcutLayoutPreferences();
          applyNewtabShortcutsVisibility();
          applyNewtabShortcutDockMagnification();
          updateNewtabShortcutPreferencesUi();
          resolve();
        });
      });
    }

    function loadVisibleShortcuts() {
      return Promise.all([loadShortcuts(), loadShortcutIcons(), loadShortcutFavicons(), loadFolderColors()]).then(() => {
        const prunedIcons = getNextShortcutIconMap(pageState.newtabShortcuts);
        const shouldPrune = !areShortcutIconMapsEqual(pageState.newtabShortcutIcons, prunedIcons);
        const shouldPruneFavicons = pruneShortcutFavicons(pageState.newtabShortcuts, false);
        pageState.newtabShortcutIcons = prunedIcons;
        renderShortcuts();
        if (shouldPrune) {
          shortcutIconStore.writeAll(prunedIcons).catch(() => {});
        }
        if (shouldPruneFavicons) {
          const shortcutUrls = pageState.newtabShortcuts.map((item) => item && item.url);
          shortcutFaviconStore.retainAll(shortcutUrls).catch(() => {});
        }
        return pageState.newtabShortcuts;
      });
    }

    function getNextShortcutIconMap(shortcuts, iconChange) {
      const validIds = new Set(
        (Array.isArray(shortcuts) ? shortcuts : [])
          .map((item) => String(item && item.id ? item.id : '').trim())
          .filter(Boolean)
      );
      const nextIcons = {};
      Object.keys(pageState.newtabShortcutIcons).forEach((shortcutId) => {
        if (validIds.has(shortcutId)) {
          nextIcons[shortcutId] = pageState.newtabShortcutIcons[shortcutId];
        }
      });
      (Array.isArray(iconChange) ? iconChange : [iconChange]).forEach((value) => {
        const change = value && typeof value === 'object' ? value : {};
        const shortcutId = String(change.shortcutId || '').trim();
        if (!shortcutId || !validIds.has(shortcutId)) {
          return;
        }
        if (change.action === 'remove') {
          delete nextIcons[shortcutId];
        } else if (change.action === 'replace') {
          const dataUrl = NEWTAB_SHORTCUT_ICON_STORE.normalizeIconDataUrl(change.dataUrl);
          if (dataUrl) {
            nextIcons[shortcutId] = dataUrl;
          }
        }
      });
      return NEWTAB_SHORTCUT_ICON_STORE.normalizeIconMap(nextIcons);
    }

    function areShortcutIconMapsEqual(leftValue, rightValue) {
      const left = NEWTAB_SHORTCUT_ICON_STORE.normalizeIconMap(leftValue);
      const right = NEWTAB_SHORTCUT_ICON_STORE.normalizeIconMap(rightValue);
      const leftKeys = Object.keys(left).sort();
      const rightKeys = Object.keys(right).sort();
      return leftKeys.length === rightKeys.length &&
        leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
    }

    function persistShortcuts(nextShortcuts, toastMessage, iconChange, persistOptions) {
      const options = getShortcutStoreOptions();
      const settings = persistOptions && typeof persistOptions === 'object'
        ? persistOptions
        : {};
      const normalized = NEWTAB_SHORTCUTS_STORE.normalizeShortcuts(nextShortcuts, options);
      const previousIcons = pageState.newtabShortcutIcons;
      const nextIcons = getNextShortcutIconMap(normalized, iconChange);
      const iconsChanged = !areShortcutIconMapsEqual(previousIcons, nextIcons);
      let didWriteIcons = false;
      let didStartItemPersistence = false;
      const syncBudgetReady = getShortcutSyncByteBudget();
      const iconsReady = iconsChanged
        ? shortcutIconStore.writeAll(nextIcons).then((savedIcons) => {
          didWriteIcons = true;
          return savedIcons;
        })
        : Promise.resolve(nextIcons);
      const persistItems = () => {
        didStartItemPersistence = true;
        pageState.shortcutPersistenceInFlightCount += 1;
        const finishTrackedPersistence = (operation) => Promise.resolve(operation).finally(() => {
          pageState.shortcutPersistenceInFlightCount = Math.max(0, pageState.shortcutPersistenceInFlightCount - 1);
        });
        if (!storageArea) {
          return finishTrackedPersistence(Promise.resolve({
            items: normalized,
            localOnlyIds: [],
            syncLimited: false
          }));
        }
        if (!isShortcutSyncStorageActive()) {
          return finishTrackedPersistence(NEWTAB_SHORTCUTS_STORE.saveShortcuts(storageArea, normalized, {
            ...options,
            maxItemBytes: Number.MAX_SAFE_INTEGER,
            maxTotalBytes: Number.MAX_SAFE_INTEGER
          }).then((items) => ({
            items,
            localOnlyIds: [],
            syncLimited: false
          })));
        }
        return finishTrackedPersistence(syncBudgetReady.then((maxTotalBytes) => {
          const plan = NEWTAB_SHORTCUTS_STORE.createShortcutStoragePlan(normalized, {
            ...options,
            maxTotalBytes
          });
          const overflowIds = plan.overflowItems.map((item) => String(item && item.id || ''));
          return writeShortcutLocalState(plan.overflowItems, false)
            .then(() => NEWTAB_SHORTCUTS_STORE.saveShortcutStoragePlan(
              storageArea,
              plan,
              {
                ...options,
                getLastError: getShortcutStorageLastError
              }
            ))
            .then(() => ({
              items: normalized,
              localOnlyIds: overflowIds,
              syncLimited: overflowIds.length > 0
            }))
            .catch((syncError) => {
              return writeShortcutLocalState(normalized, true).then(() => ({
                items: normalized,
                localOnlyIds: normalized.map((item) => String(item && item.id || '')),
                syncError,
                syncLimited: true
              }));
            });
        }));
      };
      return iconsReady
        .then((savedIcons) => {
          pageState.newtabShortcutIcons = savedIcons;
          return persistItems();
        })
        .then((result) => {
          const items = result && Array.isArray(result.items) ? result.items : normalized;
          pageState.newtabShortcuts = items;
          pruneShortcutFavicons(pageState.newtabShortcuts);
          if (settings.render !== false) {
            renderShortcuts();
          }
          const overflowShortcutId = String(settings.syncOverflowShortcutId || '');
          const shouldWarnAboutSyncLimit = Boolean(
            result && result.syncLimited === true && overflowShortcutId &&
            Array.isArray(result.localOnlyIds) &&
            result.localOnlyIds.includes(overflowShortcutId)
          );
          if (shouldWarnAboutSyncLimit) {
            showToast(t(
              'newtab_shortcuts_sync_limit_reached',
              'Shortcuts have reached the sync limit. New items will not sync.'
            ), false, { duration: 3600 });
          } else if (toastMessage) {
            showToast(toastMessage);
          }
          return true;
        })
        .catch(async (error) => {
          if (didWriteIcons) {
            try {
              await shortcutIconStore.writeAll(previousIcons);
            } catch (rollbackError) {
              console.warn('[Lumno] Failed to roll back shortcut icons', rollbackError);
            }
          }
          pageState.newtabShortcutIcons = previousIcons;
          renderShortcuts();
          if (didStartItemPersistence) {
            console.warn('[Lumno] Failed to save shortcuts', error);
            showToast(t('toast_error', 'Operation failed. Please try again.'), true);
          } else {
            setShortcutIconError(t(
              'newtab_shortcuts_icon_storage_error',
              'The local icon could not be saved. Try another image.'
            ));
          }
          return false;
        });
    }

    function saveNewShortcutFromDialog(title, url, iconState) {
      const options = getShortcutStoreOptions();
      const nextShortcut = NEWTAB_SHORTCUTS_STORE.createShortcutRecord({ title, url,
        iconSource: iconState && iconState.source }, options);
      if (!nextShortcut) {
        setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
        return Promise.resolve(false);
      }
      const withoutDuplicate = pageState.newtabShortcuts.filter((item) => item && item.url !== nextShortcut.url);
      if (withoutDuplicate.length >= MAX_NEWTAB_SHORTCUTS) {
        setShortcutError(formatMessage(
          'newtab_shortcuts_limit_reached',
          'You can add up to {count} shortcuts.',
          { count: MAX_NEWTAB_SHORTCUTS }
        ));
        return Promise.resolve(false);
      }
      const nextShortcuts = withoutDuplicate.concat(nextShortcut);
      return persistShortcuts(
        nextShortcuts,
        t('newtab_shortcuts_added', 'Shortcut added'),
        {
          shortcutId: nextShortcut.id,
          action: iconState && iconState.action,
          dataUrl: iconState && iconState.dataUrl
        },
        {
          syncOverflowShortcutId: nextShortcut.id
        }
      );
    }

    function getShortcutRecordForSite(site) {
      return NEWTAB_SHORTCUTS_STORE.createShortcutRecord({
        title: site && site.title,
        url: site && site.url
      }, getShortcutStoreOptions());
    }

    function hasShortcutForSite(site) {
      const record = getShortcutRecordForSite(site);
      return Boolean(record && pageState.newtabShortcuts.some((item) => item && item.url === record.url));
    }

    function addSiteToShortcuts(site) {
      const nextShortcut = getShortcutRecordForSite(site);
      if (!nextShortcut) {
        showToast(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'), true);
        return Promise.resolve(false);
      }
      if (pageState.newtabShortcuts.some((item) => item && item.url === nextShortcut.url)) {
        showToast(t('newtab_shortcuts_already_added', 'Already in shortcuts'));
        return Promise.resolve(false);
      }
      if (pageState.newtabShortcuts.length >= MAX_NEWTAB_SHORTCUTS) {
        showToast(formatMessage(
          'newtab_shortcuts_limit_reached',
          'You can add up to {count} shortcuts.',
          { count: MAX_NEWTAB_SHORTCUTS }
        ), true);
        return Promise.resolve(false);
      }
      return persistShortcuts(
        pageState.newtabShortcuts.concat(nextShortcut),
        t('newtab_shortcuts_added', 'Shortcut added'),
        undefined,
        { syncOverflowShortcutId: nextShortcut.id }
      );
    }

    function saveEditedShortcutFromDialog(title, url, shortcutId, iconState) {
      const currentShortcut = getShortcutById(shortcutId);
      if (!currentShortcut) {
        setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
        return Promise.resolve(false);
      }
      const options = getShortcutStoreOptions();
      const nextShortcut = NEWTAB_SHORTCUTS_STORE.createShortcutRecord({ title, url,
        iconSource: iconState && iconState.source || currentShortcut.iconSource }, options);
      if (!nextShortcut) {
        setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
        return Promise.resolve(false);
      }
      nextShortcut.id = currentShortcut.id;
      nextShortcut.createdAt = currentShortcut.createdAt;
      nextShortcut.updatedAt = Date.now();
      const nextShortcuts = [];
      pageState.newtabShortcuts.forEach((item) => {
        if (!item) {
          return;
        }
        if (item.id === currentShortcut.id) {
          nextShortcuts.push(nextShortcut);
          return;
        }
        if (item.url === nextShortcut.url) {
          return;
        }
        nextShortcuts.push(item);
      });
      return persistShortcuts(
        nextShortcuts,
        t('newtab_shortcuts_edited', 'Shortcut updated'),
        {
          shortcutId: nextShortcut.id,
          action: iconState && iconState.action,
          dataUrl: iconState && iconState.dataUrl
        }
      );
    }

    function saveShortcutFromDialog(title, url, dialogState) {
      const iconState = {
        action: dialogState && dialogState.iconAction,
        dataUrl: dialogState && dialogState.iconDataUrl,
        source: dialogState && dialogState.iconSource
      };
      if (dialogState && dialogState.mode === SHORTCUT_DIALOG_MODE_EDIT) {
        return saveEditedShortcutFromDialog(title, url, dialogState.shortcutId, iconState);
      }
      return saveNewShortcutFromDialog(title, url, iconState);
    }

    function saveBookmarkFromDialog(title, url, dialogState) {
      const itemId = String(
        (dialogState && (dialogState.itemId || dialogState.shortcutId)) || ''
      );
      const itemType = String((dialogState && dialogState.itemType) || '');
      const isFolder = itemType === SHORTCUT_DIALOG_ITEM_FOLDER;
      const nextUrl = String(url || '').trim();
      if (!itemId || (!isFolder && !nextUrl)) {
        setShortcutError(t('bookmarks_invalid_url', 'Enter a valid URL.'));
        return Promise.resolve(false);
      }
      const changes = {
        title: String(title || '').trim()
      };
      if (!isFolder) {
        changes.url = nextUrl;
      }
      const iconEntry = !isFolder && dialogState && dialogState.iconSource
        ? getNextFolderItemIcon(itemId, nextUrl, {
          source: dialogState.iconSource,
          action: dialogState.iconAction,
          dataUrl: dialogState.iconDataUrl,
          onlineIcon: dialogState.onlineIcon
        })
        : undefined;
      const keepCascadeOpen = Boolean(
        pageState.bookmarkCascadeRuntime &&
        typeof pageState.bookmarkCascadeRuntime.isOpen === 'function' &&
        pageState.bookmarkCascadeRuntime.isOpen()
      );
      return bookmarksRuntime.runControlledMutation(() => {
        return bookmarksRuntime.update(itemId, changes);
      }).then(() => {
        return iconEntry === undefined ? null : updateFolderItemIcons({ [itemId]: iconEntry });
      }).then(() => {
        markBookmarkTreeDirty({ preserveCascadeOpen: keepCascadeOpen });
        loadBookmarks({ force: true });
        if (keepCascadeOpen) {
          refreshOpenBookmarkCascadeMenu();
        }
        showToast(t(
          isFolder ? 'bookmarks_folder_updated' : 'bookmarks_updated',
          isFolder ? 'Folder updated' : 'Bookmark updated'
        ));
        return true;
      }).catch((error) => {
        console.warn('[Lumno] Failed to update bookmark', error);
        setShortcutError(t('bookmarks_update_failed', 'Could not update bookmark.'));
        return false;
      });
    }

    function removeShortcutById(shortcutId) {
      const id = String(shortcutId || '');
      if (!id || pageState.bookmarkMoveHistoryBusy) {
        return Promise.resolve(false);
      }
      const index = pageState.newtabShortcuts.findIndex((item) => item && item.id === id);
      if (index < 0) {
        return Promise.resolve(false);
      }
      const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createShortcutDeleteRecord({
        snapshot: pageState.newtabShortcuts[index], index,
        iconDataUrl: pageState.newtabShortcutIcons[id]
      });
      pageState.bookmarkMoveHistoryBusy = true;
      return persistShortcuts(pageState.newtabShortcuts.filter((item) => item && item.id !== id)).then((saved) => {
        if (saved) {
          bookmarkMoveHistory.push(record);
          showToast(formatMessage(
            'newtab_shortcuts_removed_undo',
            'Shortcut removed · {shortcut} to undo',
            { shortcut: getBookmarkUndoShortcutLabel() }
          ));
        }
        return saved;
      }).finally(() => { pageState.bookmarkMoveHistoryBusy = false; });
    }

    function hideShortcutAddFromContextMenu(sourceElement) {
      if (!pageState.newtabShortcutAddVisible) {
        return;
      }
      pageState.newtabShortcutAddVisible = false;
      const addButton = sourceElement || pageState.addShortcutButton;
      if (addButton) {
        addButton.hidden = true;
      }
      hideShortcutTooltip();
      resetShortcutDockHover();
      applyNewtabShortcutsVisibility();
      updateBookmarkSectionPosition({ preserveSearchEntryLayout: true });
      scheduleWallpaperAdaptiveToneUpdate();
      if (storageArea) {
        storageArea.set({ [NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY]: false });
      }
      showToast(t(
        'newtab_shortcuts_add_hidden',
        '“+” hidden. Re-enable it in Settings → Appearance → Shortcuts → Show “+”.'
      ));
    }

    function createShortcutsSection() {
      pageState.shortcutSection = pageStructureRuntime.shortcut.section;
      pageState.shortcutSection.setAttribute('aria-label', t('newtab_shortcuts_section_label', 'Shortcuts'));

      pageState.shortcutGrid = pageStructureRuntime.shortcut.grid;
      applyNewtabShortcutDockMagnification();

      shortcutsView = NEWTAB_SHORTCUTS_VIEW.createShortcutsView({
        grid: pageState.shortcutGrid,
        tiles: shortcutTiles,
        maxShortcuts: MAX_NEWTAB_SHORTCUTS,
        getFolderIconSvg: getFigmaFolderSvg,
        initFolderIcon: initFolderPathMorph,
        animateFolderIcon: playFolderPathMorph,
        getShortcutTitle,
        getHostFromUrl,
        getShortcutIconDataUrl,
        getShortcutFaviconDataUrl,
        resolveShortcutFaviconDataUrl,
        getShortcutFaviconPolicyRevision: () => pageState.shortcutFaviconPolicyRevision,
        getShortcutFaviconCandidateUrl,
        getImmediateThemeForSuggestion,
        applyShortcutTileTheme,
        queueThemeForTarget,
        attachFaviconWithFallbacks,
        bindTooltip: bindShortcutTooltip,
        hideTooltip: hideShortcutTooltip,
        formatOpenLabel: (title) => formatMessage('open_prefix', '打开 {title}', { title }),
        isMiddleClick,
        openShortcut: openShortcutUrl,
        onContextMenu: handleShortcutContextMenu,
        onNativeDragStart: handleShortcutNativeDragStart,
        getAddLabel: () => t('newtab_shortcuts_add', 'Add shortcut'),
        getAddIconSvg: () => getRiSvg('ri-add-line', 'ri-size-28'),
        getAddVisible: () => pageState.newtabShortcutAddVisible && pageState.newtabShortcuts.length < MAX_NEWTAB_SHORTCUTS,
        onAdd: (sourceElement) => {
          hideShortcutTooltip();
          openShortcutDialog({ sourceElement });
        },
        onAddContextMenu: openShortcutAddContextMenu
      });
      shortcutsView.render([]);
      pageState.addShortcutButton = shortcutsView.getAddButton();
      pageState.shortcutGrid.addEventListener('pointerdown', handleShortcutDragPointerDown);
      pageState.shortcutGrid.addEventListener('pointerover', handleShortcutDockPointerOver);
      pageState.shortcutGrid.addEventListener('pointermove', handleShortcutDockPointerMove);
      pageState.shortcutGrid.addEventListener('pointerleave', resetShortcutDockHover);
      updateShortcutLanguageStrings();
    }

    function createShortcutDialogComponent() {
      return NEWTAB_SHORTCUT_DIALOG.createShortcutDialog({
        documentObj: document,
        windowObj: window,
        t,
        getRiSvg,
        bindTooltip: bindShortcutDialogTooltip,
        hideTooltip: hideShortcutDialogTooltip,
        prepareIconFile: shortcutIconStore.prepareFile,
        getOnlineIconUrl: getShortcutDialogOnlineIconUrl,
        getOnlineIconSource: getShortcutDialogOnlineIconSource,
        getBuiltinIconUrl: getShortcutDialogBuiltinIconUrl,
        isIconSourceAvailable: isShortcutDialogIconSourceAvailable,
        refreshOnlineIcon: refreshShortcutDialogOnlineIcon,
        onSubmit(payload) {
          if (payload.itemType === SHORTCUT_DIALOG_ITEM_BOOKMARK ||
              payload.itemType === SHORTCUT_DIALOG_ITEM_FOLDER) {
            return saveBookmarkFromDialog(payload.title, payload.url, {
              itemType: payload.itemType,
              itemId: payload.itemId,
              shortcutId: payload.shortcutId,
              iconSource: payload.iconSource,
              iconAction: payload.iconAction,
              iconDataUrl: payload.iconDataUrl,
              onlineIcon: payload.onlineIcon
            });
          }
          return saveShortcutFromDialog(payload.title, payload.url, {
            mode: payload.mode,
            shortcutId: payload.shortcutId,
            iconAction: payload.iconAction,
            iconDataUrl: payload.iconDataUrl,
            iconSource: payload.iconSource
          }).then((saved) => {
            const onlineIcon = payload.onlineIcon;
            const pageUrl = SHORTCUT_FAVICON.normalizePageUrl(
              NEWTAB_SHORTCUTS_STORE.normalizeShortcutUrl(payload.url)
            );
            if (saved && onlineIcon && pageUrl && pageUrl === onlineIcon.pageUrl) {
              saveShortcutFaviconSnapshot(pageUrl, onlineIcon.dataUrl, onlineIcon.sourceUrl, true);
              renderShortcuts();
            }
            return saved;
          });
        }
      });
    }

    return {
      getShortcutFolderId,
      getFolderItemIconUrl,
      getFolderItemIcon,
      getFolderItemIconForShortcut,
      updateFolderItemIcons,
      getVisibleShortcuts,
      refreshShortcutFolderReferences,
      getShortcutStoreOptions,
      isShortcutSyncStorageActive,
      scheduleShortcutStorageReload,
      getShortcutIconDataUrl,
      getShortcutFaviconDataUrl,
      getShortcutFaviconCandidateUrl,
      getShortcutTitle,
      renderShortcuts,
      loadNewtabShortcutPreferences,
      loadVisibleShortcuts,
      persistShortcuts,
      removeShortcutById,
      hasShortcutForSite,
      addSiteToShortcuts,
      hideShortcutAddFromContextMenu,
      createShortcutsSection,
      createShortcutDialogComponent
    };
  }

  root.LumnoNewtabShortcutsController = { createShortcutsController };
})(globalThis);
