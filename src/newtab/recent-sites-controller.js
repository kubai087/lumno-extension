(function(root) {
  // Pinned and hidden recent sites, and the recent-site context menu.
  function createRecentSitesController(deps) {
    const {
      NEWTAB_CONTEXT_MENU_OPEN_VALUE,
      t,
      showToast,
      openExternalNewTabUrl,
      hasShortcutForSite,
      addSiteToShortcuts,
      closeShortcutContextMenu,
      closeBookmarkContextMenu,
      canDismissRecentCard,
      hideCursorTooltip,
      hideTopActionTooltip,
      normalizeHost,
      getHostFromUrl,
      getCanonicalPageUrlForFavicon,
      sanitizeDisplayText,
      getSiteDisplayName,
      shouldExcludeFromRecentSites,
      isBrowserPageRecentUrl,
      MAX_PINNED_RECENT_SITES,
      NEWTAB_RECENT_STORE,
      recentSitesStorageArea,
      HIDDEN_RECENT_SITES_STORAGE_KEY,
      renderRecentSites,
      PINNED_RECENT_SITES_STORAGE_KEY,
      progressMatch,
      progressHistory,
      progressHistoryStorageArea,
      openProgressHistory
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    const MAX_HIDDEN_RECENT_SITES = 60;
    const RECENT_CONTEXT_MENU_ADD_SHORTCUT_VALUE = 'add-shortcut';
    const RECENT_CONTEXT_MENU_REMOVE_VALUE = 'remove';
    const RECENT_CONTEXT_MENU_TRACK_PROGRESS_VALUE = 'track-progress';
    const RECENT_CONTEXT_MENU_STOP_PROGRESS_VALUE = 'stop-progress';
    const RECENT_CONTEXT_MENU_PROGRESS_HISTORY_VALUE = 'progress-history';
    const RECENT_CONTEXT_MENU_MIN_WIDTH_PX = 124;
    const PIN_PROBE_TIMEOUT_MS = 900;
    const RECENT_CONTEXT_MENU_MAX_WIDTH_PX = 200;
    const RECENT_CONTEXT_MENU_PORTAL_Z_INDEX = 10050;
    const RECENT_CONTEXT_MENU_PORTAL_OFFSET_PX = -6;

    function getRecentShortcutSite(item) {
      const normalizedItem = normalizeRecentSiteRecord(item) || item;
      return {
        title: normalizedItem.siteName || normalizedItem.title || '',
        url: normalizedItem.url
      };
    }

    function getRecentContextMenuOptions(target) {
      const isShortcut = Boolean(target && target.item &&
        hasShortcutForSite(getRecentShortcutSite(target.item)));
      return [
        {
          action: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
          value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
          label: t('newtab_open_in_new_tab', 'Open in new tab')
        },
        {
          action: RECENT_CONTEXT_MENU_ADD_SHORTCUT_VALUE,
          value: RECENT_CONTEXT_MENU_ADD_SHORTCUT_VALUE,
          label: isShortcut
            ? t('newtab_shortcuts_already_added', 'Already in shortcuts')
            : t('recent_add_to_shortcuts', 'Add to shortcuts'),
          disabled: isShortcut
        },
        ...getProgressContextMenuOptions(target && target.item),
        {
          action: RECENT_CONTEXT_MENU_REMOVE_VALUE,
          value: RECENT_CONTEXT_MENU_REMOVE_VALUE,
          label: target && target.item
            ? getRecentDismissTooltip(target.item)
            : t('recent_dismiss_tooltip', 'Remove'),
          dividerBefore: true
        }
      ];
    }

    function isRecentContextMenuOpen() {
      return Boolean(
        pageState.recentContextMenu &&
        pageState.recentContextMenuSelectController &&
        pageState.recentContextMenuSelectController.isOpen(pageState.recentContextMenu.control)
      );
    }

    function isRecentContextMenuNode(node) {
      if (!node || !pageState.recentContextMenu) {
        return false;
      }
      const { control, menu } = pageState.recentContextMenu;
      return Boolean(
        (control && (node === control || (typeof control.contains === 'function' && control.contains(node)))) ||
        (menu && (node === menu || (typeof menu.contains === 'function' && menu.contains(node))))
      );
    }

    function clearRecentContextMenuTargetVisual() {
      const element = pageState.recentContextMenuTarget && pageState.recentContextMenuTarget.element;
      if (element && typeof element.removeAttribute === 'function') {
        element.removeAttribute('data-recent-context-menu-open');
      }
    }

    function closeRecentContextMenu() {
      clearRecentContextMenuTargetVisual();
      if (pageState.recentContextMenu && pageState.recentContextMenuSelectController) {
        pageState.recentContextMenuSelectController.setOpen(pageState.recentContextMenu.control, false);
      }
      pageState.recentContextMenuTarget = null;
    }

    function getRecentContextMenuPoint(target, event) {
      const clientX = Number(event && event.clientX);
      const clientY = Number(event && event.clientY);
      if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
        return { x: clientX, y: clientY };
      }
      const element = target && target.element;
      if (element && typeof element.getBoundingClientRect === 'function') {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left + (rect.width / 2),
          y: rect.bottom
        };
      }
      return { x: 0, y: 0 };
    }

    function setRecentContextMenuPosition(target, event) {
      if (!pageState.recentContextMenu || !pageState.recentContextMenu.control) {
        return;
      }
      const point = getRecentContextMenuPoint(target, event);
      pageState.recentContextMenu.control.style.left = `${Math.round(point.x)}px`;
      pageState.recentContextMenu.control.style.top = `${Math.round(point.y)}px`;
    }

    function removeRecentSiteFromContextMenu(item) {
      return Promise.resolve(hideRecentSiteTemporarily(item)).then((result) => {
        if (!result || !result.hidden) {
          return;
        }
        showToast(
          result.wasPinned
            ? t(
              'recent_dismiss_pinned_toast',
              '已取消置顶并从最近访问移除，再次访问后会重新出现'
            )
            : t(
              'recent_dismiss_toast',
              '已从最近访问移除，再次访问后会重新出现'
            ),
          false
        );
      }).catch(() => {
        showToast(t('toast_error', '操作失败，请重试。'), true);
      });
    }

    function handleRecentContextMenuAction(actionValue) {
      const action = String(actionValue || '');
      const target = pageState.recentContextMenuTarget;
      closeRecentContextMenu();
      if (!target || !target.item || !action) {
        return;
      }
      if (action === NEWTAB_CONTEXT_MENU_OPEN_VALUE) {
        openExternalNewTabUrl(target.item.url, 'newTab');
        return;
      }
      if (action === RECENT_CONTEXT_MENU_ADD_SHORTCUT_VALUE) {
        addSiteToShortcuts(getRecentShortcutSite(target.item));
        return;
      }
      if (action === RECENT_CONTEXT_MENU_TRACK_PROGRESS_VALUE ||
          action === RECENT_CONTEXT_MENU_STOP_PROGRESS_VALUE) {
        void setProgressTracking(target.item, action === RECENT_CONTEXT_MENU_TRACK_PROGRESS_VALUE);
        return;
      }
      if (action === RECENT_CONTEXT_MENU_PROGRESS_HISTORY_VALUE) {
        openProgressHistoryFor(target.item);
        return;
      }
      if (action !== RECENT_CONTEXT_MENU_REMOVE_VALUE) {
        return;
      }
      removeRecentSiteFromContextMenu(target.item);
    }

    function handleRecentContextMenuActionClick(event) {
      const target = event && event.target;
      const option = target && typeof target.closest === 'function'
        ? target.closest('._x_extension_select_option_2024_unique_')
        : null;
      if (!option || !pageState.recentContextMenu || !pageState.recentContextMenu.menu ||
          !pageState.recentContextMenu.menu.contains(option)) {
        return;
      }
      event.stopPropagation();
      if (option.getAttribute('aria-disabled') === 'true') {
        return;
      }
      handleRecentContextMenuAction(option.getAttribute('data-value'));
    }

    function handleRecentContextMenuDocumentPointerDown(event) {
      if (!pageState.recentContextMenuTarget || isRecentContextMenuNode(event.target)) {
        return;
      }
      closeRecentContextMenu();
    }

    function handleRecentContextMenuDocumentKeyDown(event) {
      if (event && event.key === 'Escape' &&
          (pageState.recentContextMenuTarget || isRecentContextMenuOpen())) {
        closeRecentContextMenu();
      }
    }

    function createRecentContextMenu() {
      if (!pageState.recentContextMenuSelectController ||
          typeof pageState.recentContextMenuSelectController.createSelect !== 'function') {
        return null;
      }
      const created = pageState.recentContextMenuSelectController.createSelect({
        id: '_x_extension_newtab_recent_context_menu_2026_unique_',
        selectId: '_x_extension_newtab_recent_context_menu_select_2026_unique_',
        className: 'x-nt-shortcut-context-menu x-nt-recent-context-menu',
        iconOnly: true,
        triggerIconClass: 'ri-more-line',
        menuClassName: 'x-nt-shortcut-context-menu-portal x-nt-recent-context-menu-portal',
        menuAlign: 'middle',
        menuWidth: 'content',
        menuMinWidth: RECENT_CONTEXT_MENU_MIN_WIDTH_PX,
        menuMaxWidth: RECENT_CONTEXT_MENU_MAX_WIDTH_PX,
        menuPortal: true,
        menuPortalZIndex: RECENT_CONTEXT_MENU_PORTAL_Z_INDEX,
        menuPortalOffset: RECENT_CONTEXT_MENU_PORTAL_OFFSET_PX,
        value: NEWTAB_CONTEXT_MENU_OPEN_VALUE,
        ariaLabel: t('recent_context_menu_label', 'Recent site actions'),
        options: getRecentContextMenuOptions(),
        onAction(payload) {
          handleRecentContextMenuAction(payload && payload.action);
        }
      });
      const control = created.wrapper;
      const select = created.select;
      const trigger = created.trigger;
      const menu = created.menu;
      if (!control || !select || !trigger || !menu) {
        return null;
      }
      trigger.tabIndex = -1;
      const stopContextMenuEvent = (event) => {
        event.stopPropagation();
      };
      [control, trigger, menu].forEach((element) => {
        element.addEventListener('pointerdown', stopContextMenuEvent);
        element.addEventListener('click', stopContextMenuEvent);
        element.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
      });
      menu.addEventListener('click', handleRecentContextMenuActionClick);
      document.addEventListener('pointerdown', handleRecentContextMenuDocumentPointerDown, true);
      document.addEventListener('keydown', handleRecentContextMenuDocumentKeyDown, true);
      (document.body || document.documentElement).appendChild(control);
      return { control, select, trigger, menu };
    }

    function openRecentContextMenu(target, event) {
      if (!target || !target.item || !target.element) {
        return;
      }
      if (!pageState.recentContextMenu) {
        pageState.recentContextMenu = createRecentContextMenu();
      }
      if (!pageState.recentContextMenu || !pageState.recentContextMenuSelectController) {
        return;
      }
      closeShortcutContextMenu();
      closeBookmarkContextMenu();
      closeRecentContextMenu();
      pageState.recentContextMenuTarget = target;
      target.element.setAttribute('data-recent-context-menu-open', 'true');
      setRecentContextMenuPosition(target, event);
      if (typeof pageState.recentContextMenuSelectController.setOptions === 'function') {
        pageState.recentContextMenuSelectController.setOptions(
          pageState.recentContextMenu.control,
          getRecentContextMenuOptions(target),
          NEWTAB_CONTEXT_MENU_OPEN_VALUE
        );
      }
      pageState.recentContextMenuSelectController.setOpen(pageState.recentContextMenu.control, true);
    }

    function handleRecentCardContextMenu(payload) {
      const event = payload && payload.event;
      const item = payload && payload.item;
      const element = payload && payload.element;
      if (!event || !item || !element || !canDismissRecentCard()) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      hideCursorTooltip();
      hideTopActionTooltip();
      if (item._xCustom && deps.onCustomSiteEdit) {
        deps.onCustomSiteEdit(item);
        return;
      }
      openRecentContextMenu({ item, element }, event);
    }

    function getRecentStoreOptions(extraOptions) {
      return {
        normalizeHost,
        getHostFromUrl,
        getCanonicalPageUrlForFavicon,
        sanitizeDisplayText,
        getSiteDisplayName,
        shouldExcludeUrl: shouldExcludeFromRecentSites,
        shouldPrioritizeTabUrl: isBrowserPageRecentUrl,
        maxPinned: MAX_PINNED_RECENT_SITES,
        maxHidden: MAX_HIDDEN_RECENT_SITES,
        belongsToTrackedWork,
        ...(extraOptions || {})
      };
    }

    function getRecentSiteUrlKey(item) {
      return NEWTAB_RECENT_STORE.getRecentSiteUrlKey(item);
    }

    function normalizeHiddenRecentSiteEntry(item) {
      return NEWTAB_RECENT_STORE.normalizeHiddenRecentSiteEntry(item);
    }

    function normalizeHiddenRecentSites(items) {
      return NEWTAB_RECENT_STORE.normalizeHiddenRecentSites(items, getRecentStoreOptions());
    }

    function readHiddenRecentSites() {
      return NEWTAB_RECENT_STORE.loadHiddenRecentSites(recentSitesStorageArea, getRecentStoreOptions({
        key: HIDDEN_RECENT_SITES_STORAGE_KEY
      }));
    }

    function writeHiddenRecentSites(items) {
      return NEWTAB_RECENT_STORE.saveHiddenRecentSites(recentSitesStorageArea, items, getRecentStoreOptions({
        key: HIDDEN_RECENT_SITES_STORAGE_KEY
      })).then((normalized) => {
        pageState.hiddenRecentSites = normalized;
        return normalized;
      });
    }

    function isRecentSiteHidden(item) {
      return NEWTAB_RECENT_STORE.isRecentSiteHidden(item, pageState.hiddenRecentSites);
    }

    function hideRecentSiteTemporarily(item) {
      const normalizedItem = normalizeRecentSiteRecord(item);
      const key = getRecentSiteUrlKey(normalizedItem);
      if (!normalizedItem || !key) {
        return Promise.resolve({ hidden: false, wasPinned: false });
      }
      const hiddenEntry = normalizeHiddenRecentSiteEntry({
        url: key,
        lastVisitTime: Number(normalizedItem.lastVisitTime) || 0,
        hiddenAt: Date.now()
      });
      const wasPinned = isRecentSitePinned(normalizedItem);
      const nextPinnedItems = wasPinned
        ? pageState.pinnedRecentSites.filter((pinnedItem) => !isSamePinnedSite(pinnedItem, normalizedItem))
        : pageState.pinnedRecentSites.slice();
      const nextHiddenItems = [hiddenEntry].concat(
        pageState.hiddenRecentSites.filter((entry) => entry && entry.url !== key)
      );
      const persistPinned = wasPinned
        ? writePinnedRecentSites(nextPinnedItems)
        : Promise.resolve(pageState.pinnedRecentSites.slice());
      return persistPinned.then(() => writeHiddenRecentSites(nextHiddenItems)).then(() => {
        pageState.recentRenderSignature = '';
        renderRecentSites(pageState.recentSourceItems);
        return { hidden: true, wasPinned };
      });
    }

    function getRecentDismissTooltip(item) {
      const normalizedItem = normalizeRecentSiteRecord(item);
      if (normalizedItem && isRecentSitePinned(normalizedItem)) {
        return t(
          'recent_dismiss_pinned_tooltip',
          '取消置顶并从最近访问移除，再次访问后会重新出现'
        );
      }
      return t(
        'recent_dismiss_tooltip',
        '从最近访问移除，再次访问后会重新出现'
      );
    }

    function getRecentSiteHostKey(item) {
      return NEWTAB_RECENT_STORE.getRecentSiteHostKey(item, getRecentStoreOptions());
    }

    function normalizeRecentSiteRecord(item, options) {
      return NEWTAB_RECENT_STORE.normalizeRecentSiteItem(item, getRecentStoreOptions(options));
    }

    // Pinned cards are one per site, tracked cards one per work.
    function isSamePinnedSite(a, b) {
      return NEWTAB_RECENT_STORE.isSamePinnedRecentSite(a, b, getRecentStoreOptions());
    }

    function normalizePinnedRecentSites(items) {
      return NEWTAB_RECENT_STORE.normalizePinnedRecentSites(items, getRecentStoreOptions());
    }

    function readPinnedRecentSites() {
      return NEWTAB_RECENT_STORE.loadPinnedRecentSites(recentSitesStorageArea, getRecentStoreOptions({
        key: PINNED_RECENT_SITES_STORAGE_KEY
      }));
    }

    function writePinnedRecentSites(items) {
      return NEWTAB_RECENT_STORE.savePinnedRecentSites(recentSitesStorageArea, items, getRecentStoreOptions({
        key: PINNED_RECENT_SITES_STORAGE_KEY
      })).then((normalized) => {
        pageState.pinnedRecentSites = normalized;
        return normalized;
      });
    }

    function isRecentSitePinned(item) {
      return pageState.pinnedRecentSites.some((pinnedItem) => isSamePinnedSite(pinnedItem, item));
    }

    function mergeRecentSitesWithPinned(items, limit) {
      return NEWTAB_RECENT_STORE.mergeRecentSitesWithPinned(
        items,
        pageState.pinnedRecentSites,
        pageState.hiddenRecentSites,
        limit,
        getRecentStoreOptions()
      );
    }

    function togglePinnedRecentSite(item) {
      const normalizedItem = normalizeRecentSiteRecord(item, { ignoreBlacklist: true });
      if (!normalizedItem) {
        return Promise.resolve({ pinned: false, limitReached: false });
      }
      // Unpinning the card itself needs no decision about tracking.
      const urlKey = getRecentSiteUrlKey(normalizedItem);
      const pinnedSelf = pageState.pinnedRecentSites.find((pinnedItem) =>
        getRecentSiteUrlKey(pinnedItem) === urlKey
      );
      if (pinnedSelf) {
        return pinOrUnpinRecentSite(normalizedItem, pinnedSelf.progressTracking === true);
      }
      return shouldAutoTrackOnPin(normalizedItem).then((autoTrack) =>
        pinOrUnpinRecentSite(normalizedItem, autoTrack)
      );
    }

    // Pinning an episode or chapter tracks it from the start (progress
    // tracking), which also makes it a card for the work, not the site. The
    // title and URL usually tell; otherwise an open tab with the page is read
    // for episode navigation or metadata, briefly.
    function shouldAutoTrackOnPin(item) {
      if (!pageState.progressTrackingEnabled) return Promise.resolve(false);
      if (progressMatch.looksLikeSeriesPage(item)) return Promise.resolve(true);
      if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        return Promise.resolve(false);
      }
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), PIN_PROBE_TIMEOUT_MS);
        try {
          chrome.runtime.sendMessage({ action: 'probeProgressSeries', url: item.url }, (response) => {
            clearTimeout(timer);
            resolve(!chrome.runtime.lastError && Boolean(response && response.series === true));
          });
        } catch (error) {
          clearTimeout(timer);
          resolve(false);
        }
      });
    }

    function pinOrUnpinRecentSite(normalizedItem, autoTrack) {
      const candidate = autoTrack ? { ...normalizedItem, progressTracking: true } : normalizedItem;
      const existingIndex = pageState.pinnedRecentSites.findIndex((pinnedItem) => isSamePinnedSite(pinnedItem, candidate));
      if (existingIndex >= 0) {
        const nextItems = pageState.pinnedRecentSites.filter((_, index) => index !== existingIndex);
        return writePinnedRecentSites(nextItems).then((savedItems) => {
          pageState.recentRenderSignature = '';
          renderRecentSites(pageState.recentSourceItems);
          return {
            pinned: false,
            limitReached: false,
            items: savedItems
          };
        });
      }
      if (pageState.pinnedRecentSites.length >= MAX_PINNED_RECENT_SITES) {
        return Promise.resolve({ pinned: false, limitReached: true, items: pageState.pinnedRecentSites.slice() });
      }
      const nextItems = [{
        ...normalizedItem,
        pinnedAt: Date.now(),
        ...(autoTrack ? {
          progressTracking: true,
          progressId: progressHistory.createProgressId(Date.now())
        } : {})
      }].concat(pageState.pinnedRecentSites);
      return writePinnedRecentSites(nextItems).then((savedItems) => {
        pageState.recentRenderSignature = '';
        renderRecentSites(pageState.recentSourceItems);
        if (autoTrack) {
          showToast(t('recent_progress_auto_toast', '已置顶，并开始跟踪进度。点击卡片上的雷达图标可停止。'), false);
        }
        return {
          pinned: true,
          limitReached: false,
          items: savedItems
        };
      });
    }

    // Progress tracking (Labs). A tracked pinned card follows the episode or
    // chapter the person is on; the background moves it (progress-tracker.js)
    // and keeps the versions it leaves in local storage.
    function findPinnedIndex(item) {
      return pageState.pinnedRecentSites.findIndex((pinnedItem) => isSamePinnedSite(pinnedItem, item));
    }

    function getTrackedPinnedItem(item) {
      if (!pageState.progressTrackingEnabled || !item) return null;
      const index = findPinnedIndex(item);
      const pinnedItem = index >= 0 ? pageState.pinnedRecentSites[index] : null;
      return pinnedItem && pinnedItem.progressTracking === true ? pinnedItem : null;
    }

    function getProgressHistoryId(item) {
      return progressHistory.getHistoryId(item, progressMatch);
    }

    function getProgressVersions(item) {
      const historyId = getProgressHistoryId(item);
      const map = pageState.progressHistoryMap || {};
      return historyId && Array.isArray(map[historyId]) ? map[historyId] : [];
    }

    // 'tracking' or 'available' for pinned cards, so the card can offer the
    // switch; '' where tracking does not apply.
    function getRecentProgressState(item) {
      if (!pageState.progressTrackingEnabled || !item) return '';
      const index = findPinnedIndex(item);
      if (index < 0) return '';
      return pageState.pinnedRecentSites[index].progressTracking === true ? 'tracking' : 'available';
    }

    function toggleRecentProgressTracking(item) {
      const state = getRecentProgressState(item);
      if (!state) return Promise.resolve(false);
      return setProgressTracking(item, state !== 'tracking');
    }

    // Recent pages of a tracked work fold into its card instead of filling
    // the list with earlier or later episodes.
    function belongsToTrackedWork(item) {
      if (!pageState.progressTrackingEnabled || !item) return false;
      return pageState.pinnedRecentSites.some((pinnedItem) => (
        pinnedItem && pinnedItem.progressTracking === true &&
        progressMatch.compareProgressPages(
          { url: pinnedItem.url, title: pinnedItem.title },
          { url: item.url, title: item.title }
        ).match
      ));
    }

    function getProgressContextMenuOptions(item) {
      if (!pageState.progressTrackingEnabled || !item) return [];
      const tracked = Boolean(getTrackedPinnedItem(item));
      const options = [{
        action: tracked ? RECENT_CONTEXT_MENU_STOP_PROGRESS_VALUE : RECENT_CONTEXT_MENU_TRACK_PROGRESS_VALUE,
        value: tracked ? RECENT_CONTEXT_MENU_STOP_PROGRESS_VALUE : RECENT_CONTEXT_MENU_TRACK_PROGRESS_VALUE,
        label: tracked
          ? t('recent_progress_stop', '停止跟踪进度')
          : t('recent_progress_track', '跟踪观看进度'),
        dividerBefore: true
      }];
      if (tracked && getProgressVersions(item).length) {
        options.push({
          action: RECENT_CONTEXT_MENU_PROGRESS_HISTORY_VALUE,
          value: RECENT_CONTEXT_MENU_PROGRESS_HISTORY_VALUE,
          label: t('recent_history_menu', '查看最近变更历史')
        });
      }
      return options;
    }

    // Turning tracking on for an unpinned card pins it, since only pinned
    // cards stay put long enough to follow a work.
    function setProgressTracking(item, enabled) {
      const normalizedItem = normalizeRecentSiteRecord(item, { ignoreBlacklist: true });
      if (!normalizedItem) return Promise.resolve(false);
      const index = findPinnedIndex(normalizedItem);
      let nextItems;
      if (index >= 0) {
        nextItems = pageState.pinnedRecentSites.map((pinnedItem, position) => {
          if (position !== index) return pinnedItem;
          if (!enabled) {
            const { progressTracking, progressId, ...rest } = pinnedItem;
            return rest;
          }
          return {
            ...pinnedItem,
            progressTracking: true,
            progressId: progressHistory.createProgressId(Date.now())
          };
        });
      } else if (!enabled) {
        return Promise.resolve(false);
      } else if (pageState.pinnedRecentSites.length >= MAX_PINNED_RECENT_SITES) {
        showToast(t('recent_pin_limit_toast', '最多只能置顶 3 个卡片。'), true);
        return Promise.resolve(false);
      } else {
        nextItems = [{
          ...normalizedItem,
          pinnedAt: Date.now(),
          progressTracking: true,
          progressId: progressHistory.createProgressId(Date.now())
        }].concat(pageState.pinnedRecentSites);
      }
      return writePinnedRecentSites(nextItems).then(() => {
        pageState.recentRenderSignature = '';
        renderRecentSites(pageState.recentSourceItems);
        showToast(enabled
          ? t('recent_progress_track_toast', '已开始跟踪，看下一集或下一章时卡片会自动更新')
          : t('recent_progress_stop_toast', '已停止跟踪进度'), false);
        return true;
      }).catch(() => {
        showToast(t('toast_error', '操作失败，请重试。'), true);
        return false;
      });
    }

    function openProgressHistoryFor(item) {
      const pinnedItem = getTrackedPinnedItem(item);
      const versions = pinnedItem ? getProgressVersions(pinnedItem) : [];
      if (!pinnedItem || !versions.length || typeof openProgressHistory !== 'function') return;
      openProgressHistory({
        cardId: getProgressHistoryId(pinnedItem),
        title: pinnedItem.title,
        url: pinnedItem.url,
        updateHistory: versions
      });
    }

    function writeProgressHistory(map) {
      return new Promise((resolve, reject) => {
        if (!progressHistoryStorageArea || typeof progressHistoryStorageArea.set !== 'function') {
          reject(new Error('storage-unavailable'));
          return;
        }
        progressHistoryStorageArea.set({ [progressHistory.STORAGE_KEY]: map }, () => {
          const error = typeof chrome !== 'undefined' && chrome.runtime ? chrome.runtime.lastError : null;
          if (error) reject(new Error(error.message || 'storage-error'));
          else resolve(map);
        });
      });
    }

    // Makes a retained version current; the version the card leaves takes its
    // place in the history, so a restore can itself be restored.
    function restoreProgressVersion(historyItem, _version, historyIndex) {
      const index = pageState.pinnedRecentSites.findIndex((pinnedItem) =>
        pinnedItem && pinnedItem.progressTracking === true &&
        getProgressHistoryId(pinnedItem) === historyItem.cardId
      );
      if (index < 0) return Promise.resolve(false);
      const current = pageState.pinnedRecentSites[index];
      const timestamp = Date.now();
      const restored = progressHistory.restoreVersion(
        pageState.progressHistoryMap,
        historyItem.cardId,
        historyIndex,
        { url: current.url, title: current.title, updatedAt: timestamp }
      );
      if (!restored.version) return Promise.resolve(false);
      const nextItems = pageState.pinnedRecentSites.map((entry, position) => {
        if (position !== index) return entry;
        // The site name can come from the old title, so it is derived again.
        const { siteName: _staleSiteName, ...card } = entry;
        return { ...card, url: restored.version.url, title: restored.version.title || entry.title };
      });
      return writeProgressHistory(restored.map).then(() => {
        pageState.progressHistoryMap = restored.map;
        return writePinnedRecentSites(nextItems);
      }).then(() => {
        pageState.recentRenderSignature = '';
        renderRecentSites(pageState.recentSourceItems);
        return true;
      }).catch(() => {
        showToast(t('recent_history_restore_failed', '无法恢复此版本'), true);
        return false;
      });
    }

    function updateRecentPinButton(button, isPinned, limitReached) {
      if (!button) {
        return;
      }
      button.classList.toggle('x-nt-recent-pin--active', Boolean(isPinned));
      button.disabled = false;
      button.classList.toggle('x-nt-recent-pin--limit', Boolean(!isPinned && limitReached));
      button.setAttribute('aria-pressed', isPinned ? 'true' : 'false');
      const label = isPinned
        ? t('recent_pin_remove', '取消置顶')
        : (limitReached
          ? t('recent_pin_limit', '最多置顶 3 个')
          : t('recent_pin_add', '置顶'));
      button.setAttribute('aria-label', label);
      button.setAttribute('data-tooltip', label);
      button.removeAttribute('title');
      const icon = button.querySelector('[data-recent-pin-icon]');
      if (icon) {
        icon.className = `ri-icon ri-size-16 ${
          isPinned ? 'ri-pushpin-fill' : 'ri-pushpin-line'
        }`;
      }
    }

    return {
      getRecentContextMenuOptions,
      closeRecentContextMenu,
      handleRecentCardContextMenu,
      getRecentStoreOptions,
      getRecentSiteUrlKey,
      normalizeHiddenRecentSites,
      readHiddenRecentSites,
      writeHiddenRecentSites,
      isRecentSiteHidden,
      normalizeRecentSiteRecord,
      normalizePinnedRecentSites,
      readPinnedRecentSites,
      isRecentSitePinned,
      mergeRecentSitesWithPinned,
      togglePinnedRecentSite,
      updateRecentPinButton,
      getRecentProgressState,
      toggleRecentProgressTracking,
      setProgressTracking,
      restoreProgressVersion
    };
  }

  root.LumnoNewtabRecentSitesController = { createRecentSitesController };
})(globalThis);
