(function(root) {
  // New Tab display preferences: normalizing, loading and applying the shortcut,
  // auto-focus, simple mode and search result settings.
  function createPagePreferences(deps) {
    const {
      SETTINGS,
      NEWTAB_SEARCH_WIDTH_CONFIG,
      NEWTAB_SHORTCUT_COLUMNS_MIN,
      NEWTAB_SHORTCUT_COLUMNS_MAX,
      NEWTAB_SHORTCUT_COLUMNS_DEFAULT,
      NEWTAB_SHORTCUT_SIZE_MIN,
      NEWTAB_SHORTCUT_SIZE_MAX,
      NEWTAB_SHORTCUT_SIZE_DEFAULT,
      NEWTAB_SHORTCUT_GAP_MIN,
      NEWTAB_SHORTCUT_GAP_MAX,
      NEWTAB_SHORTCUT_GAP_DEFAULT,
      NEWTAB_SHORTCUT_WIDTH_MIN,
      NEWTAB_SHORTCUT_WIDTH_MAX,
      storageArea,
      NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY,
      applyNewtabShortcutsVisibility,
      updateBookmarkSectionPosition,
      NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY,
      renderShortcuts,
      NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY,
      applyNewtabShortcutDockMagnification,
      scheduleWallpaperAdaptiveToneUpdate,
      NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY,
      applyNewtabShortcutColumns,
      NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY,
      applyNewtabShortcutLayoutPreferences,
      NEWTAB_SHORTCUT_SIZE_STORAGE_KEY,
      NEWTAB_SHORTCUT_GAP_STORAGE_KEY,
      NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY,
      SIMPLE_MODE_ENABLED_STORAGE_KEY,
      MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY,
      getBookmarkGridColumnCount
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    function normalizeNewtabWidthMode(value) {
      return SETTINGS.normalizeNewtabWidthMode(value);
    }

    function normalizeNewtabSearchWidth(value, options) {
      return SETTINGS.normalizeNewtabSearchWidth(value, Object.assign({}, NEWTAB_SEARCH_WIDTH_CONFIG, options || {}));
    }

    function normalizeNewtabTopContentMode(value) {
      return SETTINGS.normalizeNewtabTopContentMode(value);
    }

    function normalizeNewtabTimeSecondsVisible(value) {
      return SETTINGS.normalizeNewtabTimeSecondsVisible(value);
    }

    function normalizeNewtabTimeFontWeight(value) {
      return SETTINGS.normalizeNewtabTimeFontWeight(value);
    }

    function normalizeNewtabShortcutsVisible(value) {
      return SETTINGS.normalizeNewtabShortcutsVisible(value);
    }

    function normalizeNewtabShortcutAddVisible(value) {
      return SETTINGS.normalizeNewtabShortcutAddVisible(value);
    }

    function normalizeNewtabShortcutDockMagnificationEnabled(value) {
      return SETTINGS.normalizeNewtabShortcutDockMagnificationEnabled(value);
    }

    function normalizeNewtabShortcutColumns(value) {
      return SETTINGS.normalizeNewtabShortcutColumns(value, {
        min: NEWTAB_SHORTCUT_COLUMNS_MIN,
        max: NEWTAB_SHORTCUT_COLUMNS_MAX,
        fallback: NEWTAB_SHORTCUT_COLUMNS_DEFAULT
      });
    }

    function normalizeNewtabShortcutSize(value) {
      return SETTINGS.normalizeNewtabShortcutSize(value, {
        min: NEWTAB_SHORTCUT_SIZE_MIN,
        max: NEWTAB_SHORTCUT_SIZE_MAX,
        fallback: NEWTAB_SHORTCUT_SIZE_DEFAULT
      });
    }

    function normalizeNewtabShortcutGap(value) {
      return SETTINGS.normalizeNewtabShortcutGap(value, {
        min: NEWTAB_SHORTCUT_GAP_MIN,
        max: NEWTAB_SHORTCUT_GAP_MAX,
        fallback: NEWTAB_SHORTCUT_GAP_DEFAULT
      });
    }

    function inferNewtabShortcutColumnsFromWidth(value) {
      return SETTINGS.inferNewtabShortcutColumnsFromWidth(value, {
        widthMin: NEWTAB_SHORTCUT_WIDTH_MIN,
        widthMax: NEWTAB_SHORTCUT_WIDTH_MAX,
        columnsMin: NEWTAB_SHORTCUT_COLUMNS_MIN,
        columnsMax: NEWTAB_SHORTCUT_COLUMNS_MAX
      });
    }

    function normalizeNewtabInputAutoFocusEnabled(value) {
      return SETTINGS.normalizeNewtabInputAutoFocusEnabled(value);
    }

    function cacheNewtabInputAutoFocusEnabled(value) {
      if (typeof SETTINGS.cacheNewtabInputAutoFocusEnabled === 'function') {
        SETTINGS.cacheNewtabInputAutoFocusEnabled(value);
      }
    }

    function normalizeNewtabFeedbackButtonVisible(value) {
      return SETTINGS.normalizeNewtabFeedbackButtonVisible(value);
    }

    function normalizeNewtabAppearanceButtonVisible(value) {
      return SETTINGS.normalizeNewtabAppearanceButtonVisible(value);
    }

    function updateNewtabInputAutoFocusUi() {
      if (pageState.wallpaperRuntime && typeof pageState.wallpaperRuntime.updateInputAutoFocusUi === 'function') {
        pageState.wallpaperRuntime.updateInputAutoFocusUi();
      }
    }

    function setNewtabInputAutoFocusEnabled(enabled) {
      const nextValue = normalizeNewtabInputAutoFocusEnabled(enabled);
      pageState.newtabInputAutoFocusEnabled = nextValue;
      cacheNewtabInputAutoFocusEnabled(nextValue);
      updateNewtabInputAutoFocusUi();
      if (storageArea) {
        storageArea.set({ [NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY]: nextValue });
      }
      return nextValue;
    }

    function updateNewtabShortcutPreferencesUi() {
      if (pageState.wallpaperRuntime && typeof pageState.wallpaperRuntime.updateShortcutsUi === 'function') {
        pageState.wallpaperRuntime.updateShortcutsUi();
      }
    }

    function setNewtabShortcutsVisible(enabled, options) {
      const config = options || {};
      const nextValue = normalizeNewtabShortcutsVisible(enabled);
      pageState.newtabShortcutsVisible = nextValue;
      applyNewtabShortcutsVisibility();
      updateNewtabShortcutPreferencesUi();
      updateBookmarkSectionPosition({ preserveSearchEntryLayout: true });
      if (config.persist && storageArea) {
        storageArea.set({ [NEWTAB_SHORTCUTS_VISIBLE_STORAGE_KEY]: nextValue });
      }
      return nextValue;
    }

    function setNewtabShortcutAddVisible(enabled, options) {
      const config = options || {};
      const nextValue = normalizeNewtabShortcutAddVisible(enabled);
      pageState.newtabShortcutAddVisible = nextValue;
      renderShortcuts();
      updateNewtabShortcutPreferencesUi();
      if (config.persist && storageArea) {
        storageArea.set({ [NEWTAB_SHORTCUT_ADD_VISIBLE_STORAGE_KEY]: nextValue });
      }
      return nextValue;
    }

    function setNewtabShortcutDockMagnificationEnabled(enabled, options) {
      const config = options || {};
      const nextValue = normalizeNewtabShortcutDockMagnificationEnabled(enabled);
      pageState.newtabShortcutDockMagnificationEnabled = nextValue;
      applyNewtabShortcutDockMagnification();
      updateNewtabShortcutPreferencesUi();
      scheduleWallpaperAdaptiveToneUpdate();
      if (config.persist && storageArea) {
        storageArea.set({ [NEWTAB_SHORTCUT_DOCK_MAGNIFICATION_ENABLED_STORAGE_KEY]: nextValue });
      }
      return nextValue;
    }

    function setNewtabShortcutColumns(value, options) {
      const config = options || {};
      const nextValue = normalizeNewtabShortcutColumns(value);
      pageState.newtabShortcutColumns = nextValue;
      applyNewtabShortcutColumns();
      updateNewtabShortcutPreferencesUi();
      updateBookmarkSectionPosition({
        preserveSearchEntryLayout: true,
        stabilizeDockDensity: true
      });
      if (config.persist && storageArea) {
        storageArea.set({ [NEWTAB_SHORTCUT_COLUMNS_STORAGE_KEY]: nextValue });
      }
      return nextValue;
    }

    function setNewtabShortcutSize(value, options) {
      const config = options || {};
      const nextValue = normalizeNewtabShortcutSize(value);
      pageState.newtabShortcutSize = nextValue;
      applyNewtabShortcutLayoutPreferences();
      updateNewtabShortcutPreferencesUi();
      updateBookmarkSectionPosition({
        preserveSearchEntryLayout: true,
        stabilizeDockDensity: true
      });
      if (config.persist && storageArea) {
        storageArea.set({ [NEWTAB_SHORTCUT_SIZE_STORAGE_KEY]: nextValue });
      }
      return nextValue;
    }

    function setNewtabShortcutGap(value, options) {
      const config = options || {};
      const nextValue = normalizeNewtabShortcutGap(value);
      pageState.newtabShortcutGap = nextValue;
      applyNewtabShortcutLayoutPreferences();
      updateNewtabShortcutPreferencesUi();
      updateBookmarkSectionPosition({
        preserveSearchEntryLayout: true,
        stabilizeDockDensity: true
      });
      if (config.persist && storageArea) {
        storageArea.set({ [NEWTAB_SHORTCUT_GAP_STORAGE_KEY]: nextValue });
      }
      return nextValue;
    }

    function loadNewtabInputAutoFocusEnabled() {
      if (!storageArea) {
        pageState.newtabInputAutoFocusEnabled = false;
        return Promise.resolve(pageState.newtabInputAutoFocusEnabled);
      }
      return new Promise((resolve) => {
        storageArea.get([NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY], (result) => {
          const rawValue = result && result[NEWTAB_INPUT_AUTO_FOCUS_ENABLED_STORAGE_KEY];
          pageState.newtabInputAutoFocusEnabled = normalizeNewtabInputAutoFocusEnabled(rawValue);
          cacheNewtabInputAutoFocusEnabled(pageState.newtabInputAutoFocusEnabled);
          updateNewtabInputAutoFocusUi();
          resolve(pageState.newtabInputAutoFocusEnabled);
        });
      });
    }

    const initialNewtabInputAutoFocusReadyTask = loadNewtabInputAutoFocusEnabled();

    function loadNumberShortcutInstantEnabled() {
      if (!storageArea) {
        pageState.numberShortcutInstantEnabled = false;
        return Promise.resolve(pageState.numberShortcutInstantEnabled);
      }
      return new Promise((resolve) => {
        storageArea.get([NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY], (result) => {
          const rawValue = result && result[NUMBER_SHORTCUT_INSTANT_ENABLED_STORAGE_KEY];
          pageState.numberShortcutInstantEnabled = normalizeNumberShortcutInstantEnabled(rawValue);
          resolve(pageState.numberShortcutInstantEnabled);
        });
      });
    }

    const initialNumberShortcutInstantReadyTask = loadNumberShortcutInstantEnabled();

    function normalizeSimpleModeEnabled(value) {
      return SETTINGS.normalizeSimpleModeEnabled(value);
    }

    function loadSimpleModeEnabled() {
      if (!storageArea) {
        pageState.simpleModeEnabled = false;
        return Promise.resolve(pageState.simpleModeEnabled);
      }
      return new Promise((resolve) => {
        storageArea.get([SIMPLE_MODE_ENABLED_STORAGE_KEY], (result) => {
          const rawValue = result && result[SIMPLE_MODE_ENABLED_STORAGE_KEY];
          pageState.simpleModeEnabled = normalizeSimpleModeEnabled(rawValue);
          resolve(pageState.simpleModeEnabled);
        });
      });
    }

    loadSimpleModeEnabled();

    function normalizeMacosCtrlSuggestionNavigationEnabled(value) {
      return SETTINGS.normalizeMacosCtrlSuggestionNavigationEnabled(value);
    }

    function loadMacosCtrlSuggestionNavigationEnabled() {
      if (!storageArea) {
        pageState.macosCtrlSuggestionNavigationEnabled = false;
        return Promise.resolve(pageState.macosCtrlSuggestionNavigationEnabled);
      }
      return new Promise((resolve) => {
        storageArea.get([MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY], (result) => {
          const rawValue = result && result[MACOS_CTRL_SUGGESTION_NAVIGATION_ENABLED_STORAGE_KEY];
          pageState.macosCtrlSuggestionNavigationEnabled =
            normalizeMacosCtrlSuggestionNavigationEnabled(rawValue);
          resolve(pageState.macosCtrlSuggestionNavigationEnabled);
        });
      });
    }

    loadMacosCtrlSuggestionNavigationEnabled();

    function normalizeNumberShortcutInstantEnabled(value) {
      return SETTINGS.normalizeNumberShortcutInstantEnabled(value);
    }

    function normalizeBookmarkFolderIconsVisible(value) {
      return SETTINGS.normalizeBookmarkFolderIconsVisible(value);
    }

    function normalizeZenModeEnabled(value) {
      return value === true;
    }

    function normalizeSearchResultPriority(value) {
      return SETTINGS.normalizeSearchResultPriority(value);
    }

    function normalizeOverlayTabPriorityMode(value) {
      return SETTINGS.normalizeOverlayTabPriorityMode(value);
    }

    function normalizeBookmarkCount(value) {
      return SETTINGS.normalizeBookmarkCount(value);
    }

    function getBookmarkLimit() {
      const normalized = normalizeBookmarkCount(pageState.currentBookmarkCount);
      if (normalized <= 0) {
        return 8;
      }
      const rows = Math.max(1, Math.round(normalized / 4));
      // Use the actual rendered column count so "show N rows" remains accurate on responsive layouts.
      const columns = Math.max(1, getBookmarkGridColumnCount());
      return rows * columns;
    }

    function normalizeBookmarkColumns(value) {
      return SETTINGS.normalizeBookmarkColumns(value);
    }

    function normalizeTabRankScoreDebugMode(value) {
      return SETTINGS.normalizeTabRankScoreDebugMode(value);
    }

    function normalizeBookmarkCascadeDebugMode(value) {
      return value === true;
    }

    return {
      normalizeNewtabWidthMode,
      normalizeNewtabSearchWidth,
      normalizeNewtabTopContentMode,
      normalizeNewtabTimeSecondsVisible,
      normalizeNewtabTimeFontWeight,
      normalizeNewtabShortcutsVisible,
      normalizeNewtabShortcutAddVisible,
      normalizeNewtabShortcutDockMagnificationEnabled,
      normalizeNewtabShortcutColumns,
      normalizeNewtabShortcutSize,
      normalizeNewtabShortcutGap,
      inferNewtabShortcutColumnsFromWidth,
      normalizeNewtabInputAutoFocusEnabled,
      normalizeNewtabFeedbackButtonVisible,
      normalizeNewtabAppearanceButtonVisible,
      updateNewtabInputAutoFocusUi,
      setNewtabInputAutoFocusEnabled,
      updateNewtabShortcutPreferencesUi,
      setNewtabShortcutsVisible,
      setNewtabShortcutAddVisible,
      setNewtabShortcutDockMagnificationEnabled,
      setNewtabShortcutColumns,
      setNewtabShortcutSize,
      setNewtabShortcutGap,
      initialNewtabInputAutoFocusReadyTask,
      normalizeSimpleModeEnabled,
      normalizeMacosCtrlSuggestionNavigationEnabled,
      normalizeNumberShortcutInstantEnabled,
      normalizeBookmarkFolderIconsVisible,
      normalizeZenModeEnabled,
      normalizeSearchResultPriority,
      normalizeOverlayTabPriorityMode,
      normalizeBookmarkCount,
      getBookmarkLimit,
      normalizeBookmarkColumns,
      normalizeTabRankScoreDebugMode,
      normalizeBookmarkCascadeDebugMode
    };
  }

  root.LumnoNewtabPagePreferences = { createPagePreferences };
})(globalThis);
