(function(root) {
  // Shortcut storage, favicons, loading, persistence, rendering and the add/edit
  // dialog.
  function createShortcutsController(deps) {
    const {
      shortcutFolderRuntime,
      bookmarksRuntime,
      isShortcutDragActive,
      MAX_NEWTAB_SHORTCUTS,
      normalizeHost,
      sanitizeDisplayText,
      providerStorageRuntime,
      storageAreaName,
      NEWTAB_SHORTCUTS_STORE,
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
      shortcutGroupHeaders,
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
      isCardActivationSuppressed,
      handleShortcutContextMenu,
      handleShortcutNativeDragStart,
      getRiSvg,
      openShortcutDialog,
      openShortcutAddContextMenu,
      handleShortcutDragPointerDown,
      handleShortcutDockPointerOver,
      handleShortcutDockPointerMove,
      syncShortcutDockFolderMenu,
      NEWTAB_SHORTCUT_DIALOG,
      bindShortcutDialogTooltip,
      hideShortcutDialogTooltip,
      SHORTCUT_DIALOG_ITEM_BOOKMARK,
      handleShortcutGroupMenu,
      WEBDAV_STATUS_STORAGE_KEY,
      animateShortcutLayoutChange
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    let shortcutsView = null;
    let shortcutStorageReloadTimer = null;
    // Groups and the migration time of the stored shortcut state; items live
    // in pageState.newtabShortcuts.
    let shortcutGroups = NEWTAB_SHORTCUTS_STORE.getDefaultShortcutState().groups;
    let shortcutMigratedAt = 0;
    let shortcutStateTorn = false;
    // The group a site added from the dialog joins, and the group the
    // dialog renames ('' while it creates one).
    let shortcutAddTargetGroupId = '';
    let shortcutGroupDialogTargetId = '';
    let shortcutTornReloadCount = 0;
    const SHORTCUT_TORN_RELOAD_LIMIT = 3;
    const SHORTCUT_TORN_RELOAD_DELAY_MS = 1500;
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

    // Sync bytes the next save may use, and whether the legacy flat list is
    // still in browser sync. Unknown usage leaves no sync budget, so the save
    // keeps everything in the local overflow record instead of risking the
    // space other settings need.
    function getShortcutSyncBudget() {
      if (!isShortcutSyncStorageActive()) {
        return Promise.resolve({ maxTotalBytes: Number.MAX_SAFE_INTEGER, legacyKeysPresent: false });
      }
      const syncArea = chrome.storage.sync;
      return Promise.all([
        getStorageBytesInUse(syncArea, null),
        getStorageBytesInUse(syncArea, NEWTAB_SHORTCUTS_STORE.SHORTCUTS_SYNC_KEYS),
        getStorageBytesInUse(syncArea, NEWTAB_SHORTCUTS_STORE.LEGACY_SHORTCUTS_CHUNK_KEYS)
      ]).then(([totalBytes, shortcutBytes, legacyBytes]) => ({
        maxTotalBytes: NEWTAB_SHORTCUTS_STORE.getShortcutSyncBudget({
          quotaBytes: Number(syncArea.QUOTA_BYTES) || (100 * 1024),
          reserveBytes: NEWTAB_SHORTCUTS_CRITICAL_SYNC_RESERVE_BYTES,
          totalBytes,
          shortcutBytes,
          legacyBytes
        }),
        legacyKeysPresent: legacyBytes > 0
      })).catch(() => ({ maxTotalBytes: 0, legacyKeysPresent: false }));
    }

    function readShortcutOverflowRecord() {
      const overflowArea = getShortcutOverflowStorageArea();
      if (!overflowArea || typeof overflowArea.get !== 'function') {
        return Promise.resolve(null);
      }
      return new Promise((resolve) => {
        try {
          overflowArea.get([NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY], (result) => {
            if (getShortcutStorageLastError()) {
              resolve(null);
              return;
            }
            resolve(result ? result[NEWTAB_SHORTCUTS_LOCAL_OVERFLOW_STORAGE_KEY] : null);
          });
        } catch (error) {
          resolve(null);
        }
      });
    }

    function readShortcutSyncValues() {
      return new Promise((resolve) => {
        try {
          const maybePromise = storageArea.get(NEWTAB_SHORTCUTS_STORE.SHORTCUT_STORAGE_KEYS.slice(), (result) => {
            resolve(result || {});
          });
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then((result) => resolve(result || {})).catch(() => resolve({}));
          }
        } catch (error) {
          resolve({});
        }
      });
    }

    function scheduleShortcutStorageReload(delayMs) {
      if (shortcutStorageReloadTimer !== null) {
        window.clearTimeout(shortcutStorageReloadTimer);
      }
      shortcutStorageReloadTimer = window.setTimeout(() => {
        shortcutStorageReloadTimer = null;
        loadShortcuts().then(() => {
          // A torn read can miss shortcuts, so their icons wait for a full one.
          if (shortcutStateTorn) {
            renderShortcuts();
            return;
          }
          pruneShortcutFavicons(pageState.newtabShortcuts);
          const prunedIcons = getNextShortcutIconMap(pageState.newtabShortcuts);
          if (!areShortcutIconMapsEqual(pageState.newtabShortcutIcons, prunedIcons)) {
            pageState.newtabShortcutIcons = prunedIcons;
            shortcutIconStore.writeAll(prunedIcons).catch(() => {});
          }
          renderShortcuts();
        });
      }, Number.isFinite(delayMs) ? delayMs : 32);
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
      deps.refreshBookmarkShortcutStates?.();
      const grouped = isShortcutGroupLayoutActive();
      shortcutsView.render(items, {
        grouped,
        groups: shortcutGroups
      });
      if (grouped) {
        scheduleWallpaperAdaptiveToneUpdate();
      }
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

    // A drag moves tiles between groups without rendering; the grid follows
    // its longest row as the tile joins or leaves one.
    function fitShortcutGroupColumns() {
      return Boolean(shortcutsView && isShortcutGroupLayoutActive() &&
        shortcutsView.fitGroupedColumns(getVisibleShortcuts(), shortcutGroups));
    }

    function applyShortcutState(state) {
      pageState.newtabShortcuts = state.items;
      shortcutGroups = state.groups;
      shortcutMigratedAt = Number(state.migratedAt) || 0;
    }

    function loadShortcuts() {
      if (!storageArea) {
        applyShortcutState(NEWTAB_SHORTCUTS_STORE.getDefaultShortcutState(getShortcutStoreOptions()));
        return Promise.resolve(pageState.newtabShortcuts);
      }
      return Promise.all([
        readShortcutSyncValues(),
        readShortcutOverflowRecord()
      ]).then(([values, overflowRecord]) => {
        const state = NEWTAB_SHORTCUTS_STORE.readShortcutState(values, overflowRecord, getShortcutStoreOptions());
        applyShortcutState(state);
        shortcutStateTorn = state.torn === true;
        // Part of another device's save has not arrived yet; read again
        // shortly instead of rewriting anything from a mixed copy.
        if (state.torn) {
          if (shortcutTornReloadCount < SHORTCUT_TORN_RELOAD_LIMIT) {
            shortcutTornReloadCount += 1;
            scheduleShortcutStorageReload(SHORTCUT_TORN_RELOAD_DELAY_MS);
          }
          return pageState.newtabShortcuts;
        }
        shortcutTornReloadCount = 0;
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
        if (shortcutStateTorn) {
          renderShortcuts();
          return pageState.newtabShortcuts;
        }
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
      const nextState = NEWTAB_SHORTCUTS_STORE.normalizeShortcutState({
        groups: settings.groups || shortcutGroups,
        items: nextShortcuts,
        migratedAt: shortcutMigratedAt
      }, options);
      const normalized = nextState.items;
      const previousIcons = pageState.newtabShortcutIcons;
      const nextIcons = getNextShortcutIconMap(normalized, iconChange);
      const iconsChanged = !areShortcutIconMapsEqual(previousIcons, nextIcons);
      let didWriteIcons = false;
      let didStartItemPersistence = false;
      const syncBudgetReady = getShortcutSyncBudget();
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
            state: nextState,
            localOnlyIds: [],
            syncLimited: false
          }));
        }
        return finishTrackedPersistence(syncBudgetReady.then((budget) => (
          NEWTAB_SHORTCUTS_STORE.persistShortcutState(storageArea, nextState, {
            ...options,
            overflowArea: getShortcutOverflowStorageArea(),
            maxTotalBytes: budget.maxTotalBytes,
            legacyKeysPresent: budget.legacyKeysPresent,
            getLastError: getShortcutStorageLastError
          })
        )));
      };
      return iconsReady
        .then((savedIcons) => {
          pageState.newtabShortcutIcons = savedIcons;
          return persistItems();
        })
        .then((result) => {
          // Group changes and added or removed sites can re-center the grid;
          // those renders slide the tiles over instead of jumping.
          const applySavedState = () => {
            applyShortcutState(result && result.state ? result.state : nextState);
            pruneShortcutFavicons(pageState.newtabShortcuts);
            if (settings.render !== false) {
              renderShortcuts();
            }
          };
          if (settings.animateLayout && settings.render !== false && typeof animateShortcutLayoutChange === 'function') {
            animateShortcutLayoutChange(applySavedState);
          } else {
            applySavedState();
          }
          const overflowShortcutId = String(settings.syncOverflowShortcutId || '');
          const shouldWarnAboutSyncLimit = Boolean(
            result && result.syncLimited === true && overflowShortcutId &&
            Array.isArray(result.localOnlyIds) &&
            result.localOnlyIds.includes(overflowShortcutId)
          );
          // With WebDAV on, a shortcut past the browser's sync space still
          // reaches other devices, so there is nothing to warn about.
          return (shouldWarnAboutSyncLimit ? isWebDavSyncEnabled() : Promise.resolve(true)).then((webdav) => {
            if (!webdav) {
              showToast(t(
                'newtab_shortcuts_sync_limit_reached',
                'Shortcuts exceed the browser’s sync space, so new ones stay on this device. Turn on WebDAV in Settings to sync them too.'
              ), false, { duration: 5200 });
            } else if (toastMessage) {
              showToast(toastMessage);
            }
            return true;
          });
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

    function isWebDavSyncEnabled() {
      const localArea = chrome && chrome.storage ? chrome.storage.local : null;
      if (!localArea || !WEBDAV_STATUS_STORAGE_KEY) {
        return Promise.resolve(false);
      }
      return new Promise((resolve) => {
        try {
          localArea.get([WEBDAV_STATUS_STORAGE_KEY], (result) => {
            const status = result && result[WEBDAV_STATUS_STORAGE_KEY];
            resolve(Boolean(!getShortcutStorageLastError() && status && status.enabled === true));
          });
        } catch (error) {
          resolve(false);
        }
      });
    }

    function getShortcutGroups() {
      return shortcutGroups;
    }

    // A single group is no grouping: it keeps the plain, centered shortcut
    // rows and shows no title, whatever it is named.
    function isShortcutGroupLayoutActive() {
      return shortcutGroups.length > 1;
    }

    function getLastShortcutGroupId() {
      return shortcutGroups.length ? shortcutGroups[shortcutGroups.length - 1].id : '';
    }

    function getShortcutGroupDisplayTitle(groupId) {
      const group = shortcutGroups.find((item) => item.id === groupId);
      return group && group.title
        ? group.title
        : t('newtab_shortcuts_group_untitled_name', 'Untitled group');
    }

    function openShortcutAddDialog(sourceElement, groupId) {
      hideShortcutTooltip();
      shortcutAddTargetGroupId = groupId || getLastShortcutGroupId();
      openShortcutDialog({ sourceElement });
    }

    // Groups are named in the shortcut dialog: an empty groupId creates one.
    function openShortcutGroupDialog(groupId, sourceElement) {
      const group = groupId ? shortcutGroups.find((item) => item.id === groupId) : null;
      if (groupId && !group) {
        return;
      }
      if (!group && shortcutGroups.length >= NEWTAB_SHORTCUTS_STORE.DEFAULT_MAX_SHORTCUT_GROUPS) {
        showGroupLimitToast();
        return;
      }
      hideShortcutTooltip();
      shortcutGroupDialogTargetId = group ? group.id : '';
      openShortcutDialog({
        sourceElement,
        itemType: 'group',
        mode: group ? SHORTCUT_DIALOG_MODE_EDIT : 'add',
        shortcut: group ? { id: group.id, title: group.title } : null
      });
    }

    function saveShortcutGroupFromDialog(title) {
      return shortcutGroupDialogTargetId
        ? renameShortcutGroup(shortcutGroupDialogTargetId, title)
        : createShortcutGroup(title);
    }

    function showGroupLimitToast() {
      showToast(formatMessage(
        'newtab_shortcuts_group_limit_reached',
        'You can create up to {count} groups.',
        { count: NEWTAB_SHORTCUTS_STORE.DEFAULT_MAX_SHORTCUT_GROUPS }
      ), true);
    }

    function createShortcutGroup(title) {
      if (pageState.bookmarkMoveHistoryBusy) {
        return Promise.resolve(false);
      }
      if (shortcutGroups.length >= NEWTAB_SHORTCUTS_STORE.DEFAULT_MAX_SHORTCUT_GROUPS) {
        showGroupLimitToast();
        return Promise.resolve(false);
      }
      const group = NEWTAB_SHORTCUTS_STORE.normalizeShortcutGroups([{
        id: NEWTAB_SHORTCUTS_STORE.createShortcutGroupId(),
        title: String(title || '')
      }])[0];
      // The first new group turns the existing row into a group of its own,
      // named "Shortcuts" unless it already has a name; it can be renamed or
      // cleared like any title.
      const groups = shortcutGroups.length === 1 && !shortcutGroups[0].title
        ? NEWTAB_SHORTCUTS_STORE.normalizeShortcutGroups([{
          id: shortcutGroups[0].id,
          title: t('newtab_shortcuts_group_default_title', 'Shortcuts')
        }])
        : shortcutGroups;
      return persistShortcuts(pageState.newtabShortcuts, '', undefined, {
        groups: groups.concat(group),
        animateLayout: true
      });
    }

    function renameShortcutGroup(groupId, title) {
      const nextTitle = NEWTAB_SHORTCUTS_STORE.normalizeShortcutGroups([{ id: groupId, title }])[0].title;
      const group = shortcutGroups.find((item) => item.id === groupId);
      if (!group || group.title === nextTitle) {
        return Promise.resolve(Boolean(group));
      }
      return persistShortcuts(pageState.newtabShortcuts, '', undefined, {
        groups: shortcutGroups.map((item) => (item.id === groupId ? { ...item, title: nextTitle } : item))
      });
    }

    function moveShortcutGroup(groupId, offset) {
      const index = shortcutGroups.findIndex((group) => group.id === groupId);
      return moveShortcutGroupToIndex(groupId, index + offset);
    }

    // `targetIndex` is the group's place among the other groups.
    function moveShortcutGroupToIndex(groupId, targetIndex) {
      const index = shortcutGroups.findIndex((group) => group.id === groupId);
      if (index < 0 || !Number.isInteger(targetIndex) || targetIndex < 0 ||
          targetIndex >= shortcutGroups.length || targetIndex === index) {
        return Promise.resolve(false);
      }
      const groups = shortcutGroups.slice();
      const [group] = groups.splice(index, 1);
      groups.splice(targetIndex, 0, group);
      return persistShortcuts(pageState.newtabShortcuts, '', undefined, { groups, animateLayout: true });
    }

    // The sites of a deleted group join the group above it, or the one below
    // when it was the first group.
    function planShortcutGroupDelete(groups, items, groupId, keepSites, preferredTargetId) {
      const index = groups.findIndex((group) => group.id === groupId);
      if (index < 0 || groups.length <= 1) {
        return null;
      }
      const remaining = groups.filter((group) => group.id !== groupId);
      const members = items.filter((item) => item.groupId === groupId);
      if (keepSites) {
        const target = remaining.find((group) => group.id === preferredTargetId) ||
          groups[index - 1] || groups[index + 1];
        return {
          index,
          groups: remaining,
          targetGroupId: target.id,
          members,
          items: items.map((item) => (item.groupId === groupId ? { ...item, groupId: target.id } : item))
        };
      }
      return {
        index,
        groups: remaining,
        targetGroupId: '',
        members,
        items: items.filter((item) => item.groupId !== groupId)
      };
    }

    function deleteShortcutGroup(groupId, keepSites) {
      if (pageState.bookmarkMoveHistoryBusy) {
        return Promise.resolve(false);
      }
      const items = pageState.newtabShortcuts;
      const plan = planShortcutGroupDelete(shortcutGroups, items, groupId, keepSites, '');
      if (!plan) {
        return Promise.resolve(false);
      }
      const group = shortcutGroups[plan.index];
      const record = NEWTAB_BOOKMARK_MOVE_HISTORY.createShortcutGroupDeleteRecord({
        group,
        groupIndex: plan.index,
        targetGroupId: plan.targetGroupId,
        movedIds: keepSites ? plan.members.map((item) => item.id) : [],
        removed: keepSites ? [] : plan.members.map((item) => ({
          snapshot: item,
          index: items.indexOf(item),
          iconDataUrl: pageState.newtabShortcutIcons[item.id]
        }))
      });
      pageState.bookmarkMoveHistoryBusy = true;
      return persistShortcuts(plan.items, '', undefined, { groups: plan.groups, animateLayout: true }).then((saved) => {
        if (saved && record) {
          bookmarkMoveHistory.push(record);
          showToast(formatMessage(
            'newtab_shortcuts_group_deleted_undo',
            'Group deleted · {shortcut} to undo',
            { shortcut: getBookmarkUndoShortcutLabel() }
          ));
        }
        return saved;
      }).finally(() => { pageState.bookmarkMoveHistoryBusy = false; });
    }

    // Deleting a group with its sites removes them all at once, so it asks
    // first; keeping the sites is a plain move and does not.
    function confirmDeleteShortcutGroupWithSites(groupId, sourceElement) {
      const count = pageState.newtabShortcuts.filter((item) => item.groupId === groupId).length;
      if (!count) {
        return deleteShortcutGroup(groupId, false);
      }
      openShortcutDialog({
        sourceElement,
        confirmationTitle: formatMessage(
          'newtab_shortcuts_group_delete_confirm_title',
          'Delete “{group}” and its sites?',
          { group: getShortcutGroupDisplayTitle(groupId) }
        ),
        confirmationDescription: formatMessage(
          'newtab_shortcuts_group_delete_confirm_description',
          'The group and its {count} sites will be deleted.',
          { count }
        ),
        confirmLabel: t('newtab_shortcuts_group_delete_confirm_button', 'Delete'),
        onConfirm() {
          return deleteShortcutGroup(groupId, false);
        }
      });
      return Promise.resolve(true);
    }

    // Undo puts the group back where it was, returns its moved sites to it
    // and restores the sites deleted with it; redo deletes it again.
    function applyShortcutGroupDeleteRecord(record, isUndo) {
      const items = pageState.newtabShortcuts;
      if (!isUndo) {
        const plan = planShortcutGroupDelete(shortcutGroups, items, record.group.id,
          !record.removed.length, record.targetGroupId);
        return plan
          ? persistShortcuts(plan.items, '', undefined, { groups: plan.groups, animateLayout: true })
          : Promise.resolve(false);
      }
      if (shortcutGroups.some((group) => group.id === record.group.id) ||
          shortcutGroups.length >= NEWTAB_SHORTCUTS_STORE.DEFAULT_MAX_SHORTCUT_GROUPS ||
          items.length + record.removed.length > MAX_NEWTAB_SHORTCUTS ||
          record.removed.some(({ snapshot }) => items.some((item) => item.id === snapshot.id ||
            (snapshot.url && item.url === snapshot.url)))) {
        return Promise.resolve(false);
      }
      const groups = shortcutGroups.slice();
      groups.splice(Math.min(record.groupIndex, groups.length), 0, record.group);
      const moved = new Set(record.movedIds);
      const next = items.map((item) => (moved.has(item.id) && item.groupId === record.targetGroupId
        ? { ...item, groupId: record.group.id } : item));
      record.removed.slice().sort((first, second) => first.index - second.index).forEach((entry) => {
        next.splice(Math.min(entry.index, next.length), 0, entry.snapshot);
      });
      const iconChange = record.removed.filter((entry) => entry.iconDataUrl).map((entry) => ({
        shortcutId: entry.snapshot.id, action: 'replace', dataUrl: entry.iconDataUrl
      }));
      return persistShortcuts(next, '', iconChange, { groups, animateLayout: true });
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
      // A site added from the dialog joins the group it was added from.
      const groupId = shortcutGroups.some((group) => group.id === shortcutAddTargetGroupId)
        ? shortcutAddTargetGroupId
        : getLastShortcutGroupId();
      shortcutAddTargetGroupId = '';
      const nextShortcuts = withoutDuplicate.concat(groupId ? { ...nextShortcut, groupId } : nextShortcut);
      return persistShortcuts(
        nextShortcuts,
        t('newtab_shortcuts_added', 'Shortcut added'),
        {
          shortcutId: nextShortcut.id,
          action: iconState && iconState.action,
          dataUrl: iconState && iconState.dataUrl
        },
        {
          syncOverflowShortcutId: nextShortcut.id,
          animateLayout: true
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
      const groupId = getLastShortcutGroupId();
      return persistShortcuts(
        pageState.newtabShortcuts.concat(groupId ? { ...nextShortcut, groupId } : nextShortcut),
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
      if (currentShortcut.groupId) {
        nextShortcut.groupId = currentShortcut.groupId;
      }
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
      return persistShortcuts(pageState.newtabShortcuts.filter((item) => item && item.id !== id), '', undefined,
        { animateLayout: true }).then((saved) => {
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
        onFolderMenuChange: syncShortcutDockFolderMenu,
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
        isActivationSuppressed: isCardActivationSuppressed,
        onContextMenu: handleShortcutContextMenu,
        onNativeDragStart: handleShortcutNativeDragStart,
        getAddLabel: () => t('newtab_shortcuts_add', 'Add shortcut'),
        getAddIconSvg: () => getRiSvg('ri-add-line', 'ri-size-28'),
        getAddVisible: () => pageState.newtabShortcutAddVisible && pageState.newtabShortcuts.length < MAX_NEWTAB_SHORTCUTS,
        // The add tile asks what to add, or offers to hide itself.
        onAdd: openShortcutAddContextMenu,
        onAddContextMenu: () => {},
        groupHeaders: shortcutGroupHeaders,
        getGroupPlaceholder: () => t('newtab_shortcuts_group_title_placeholder', 'Add a title'),
        getGroupActionsLabel: (title) => formatMessage('newtab_shortcuts_group_actions', '{group} actions', {
          group: title || t('newtab_shortcuts_group_untitled_name', 'Untitled group')
        }),
        getGroupMoreIconSvg: () => getRiSvg('ri-more-fill', 'ri-size-16'),
        onGroupMenu: handleShortcutGroupMenu,
        onGroupRename: openShortcutGroupDialog,
        getGroupEmptyLabel: () => t('newtab_shortcuts_group_add_site', 'Add site'),
        onGroupAdd: (groupId, sourceElement) => openShortcutAddDialog(sourceElement, groupId)
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
        async loadBookmarkChoices() {
          if (!await bookmarksRuntime.ensureReady(false)) throw new Error('Bookmarks unavailable');
          return globalThis.LumnoShortcutBookmarkChoices.collectChoices(
            bookmarksRuntime.getNodeMap(),
            NEWTAB_SHORTCUTS_STORE.normalizeShortcutUrl,
            pageState.newtabShortcuts
          );
        },
        onSubmit(payload) {
          if (payload.itemType === 'group') {
            return saveShortcutGroupFromDialog(payload.title);
          }
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
      createShortcutDialogComponent,
      getShortcutGroups,
      isShortcutGroupLayoutActive,
      fitShortcutGroupColumns,
      getShortcutGroupDisplayTitle,
      openShortcutAddDialog,
      openShortcutGroupDialog,
      createShortcutGroup,
      renameShortcutGroup,
      moveShortcutGroup,
      moveShortcutGroupToIndex,
      deleteShortcutGroup,
      confirmDeleteShortcutGroupWithSites,
      applyShortcutGroupDeleteRecord
    };
  }

  root.LumnoNewtabShortcutsController = { createShortcutsController };
})(globalThis);
