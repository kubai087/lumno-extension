(function(root) {
  // Applying the UI language and the light/dark theme to the New Tab, and
  // following the system theme.
  function createAppearanceModes(deps) {
    const {
      t,
      renderNewtabTopContent,
      updateRecentHeading,
      updateBookmarkHeading,
      updateBookmarkPagerLabels,
      updateBookmarkBreadcrumb,
      updateRecentModeMenu,
      updateBookmarkModeMenu,
      updateWallpaperLanguageStrings,
      updateWallpaperAppearanceSelectionUi,
      updateFeedbackLanguageStrings,
      updateShortcutLanguageStrings,
      notifyLanguageChange,
      setLocalSearchScopePrefix,
      updateModeBadge,
      recentCards,
      formatMessage,
      bookmarkCards,
      renderSuggestions,
      getSystemLocale,
      normalizeLocale,
      applyDocumentLanguage,
      forceReloadRecentSitesForI18n,
      loadLocaleMessages,
      shortcutTiles,
      applyShortcutTileTheme,
      resolveTheme,
      syncBookmarkTopbarSurfaceColorForTheme,
      applyWordmarkThemeAppearance,
      suggestionItems,
      applyThemeVariables,
      applyRecentCardTheme,
      applyBookmarkCardTheme,
      updateSelection,
      addMediaQueryChangeListener,
      mediaQuery,
      removeMediaQueryChangeListener,
      scheduleWallpaperAdaptiveToneUpdate,
      initialThemeReadyPromise,
      storageArea,
      THEME_STORAGE_KEY,
      NEWTAB_THEME_MODE_STORAGE_KEY,
      NEWTAB_THEME_SCOPE_STORAGE_KEY,
      initialLanguageReadyPromise,
      LANGUAGE_STORAGE_KEY
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    let mediaListenerAttached = false;
    let hasThemeBootstrapStarted = false;
    let initialLanguageApplied = false;
    let hasLanguageBootstrapStarted = false;
    let languageApplyRequestId = 0;

    function applyLanguageStrings() {
      document.title = t('newtab_page_title', 'New Tab');
      if (pageState.topContentController && pageState.newtabTopContentMode === 'time') {
        renderNewtabTopContent(false);
      }
      updateRecentHeading();
      updateBookmarkHeading();
      updateBookmarkPagerLabels();
      if (pageState.bookmarkTopbarRuntime) {
        pageState.bookmarkTopbarRuntime.updateLanguage(t('bookmark_view_mode_top', 'Top bookmarks bar'));
      }
      updateBookmarkBreadcrumb();
      updateRecentModeMenu();
      updateBookmarkModeMenu();
      updateWallpaperLanguageStrings();
      if (pageState.quoteRuntime) pageState.quoteRuntime.updateLanguage();
      updateWallpaperAppearanceSelectionUi();
      updateFeedbackLanguageStrings();
      updateShortcutLanguageStrings();
      if (pageState.inputModeController &&
          typeof pageState.inputModeController.refreshModeMenuLanguage === 'function') {
        pageState.inputModeController.refreshModeMenuLanguage();
      }
      if (pageState.updateNoticeController &&
          typeof pageState.updateNoticeController.updateLanguage === 'function') {
        pageState.updateNoticeController.updateLanguage();
      }
      if (pageState.engagementNoticeController &&
          typeof pageState.engagementNoticeController.updateLanguage === 'function') {
        pageState.engagementNoticeController.updateLanguage();
      }
      if (pageState.webdavFeatureHintController &&
          typeof pageState.webdavFeatureHintController.updateLanguage === 'function') {
        pageState.webdavFeatureHintController.updateLanguage();
      }
      if (pageState.inputParts && pageState.inputParts.input) {
        pageState.defaultPlaceholderText = t('search_placeholder', pageState.defaultPlaceholderText);
        if (!pageState.siteSearchState && !pageState.localSearchScopeState) {
          pageState.inputParts.input.placeholder = pageState.defaultPlaceholderText;
        }
        if (pageState.localSearchScopeState) {
          setLocalSearchScopePrefix(pageState.localSearchScopeState);
        }
      }
      updateModeBadge(pageState.inputParts && pageState.inputParts.input ? pageState.inputParts.input.value : '');
      recentCards.forEach((card) => {
        if (!card || !card._xActionText || !card._xTitleText) {
          return;
        }
        card._xActionText.textContent = t('action_go_current_tab', '前往');
        card.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', {
          title: card._xTitleText
        }));
      });
      bookmarkCards.forEach((card) => {
        if (!card || !card._xTitleText) {
          return;
        }
        card.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', {
          title: card._xTitleText
        }));
      });
      if (pageState.latestQuery && pageState.latestQuery.trim()) {
        renderSuggestions(pageState.lastSuggestionResponse, pageState.latestQuery);
      }
      notifyLanguageChange();
    }

    function applyLanguageMode(mode) {
      const requestId = ++languageApplyRequestId;
      pageState.currentLanguageMode = mode || 'system';
      const targetLocale = pageState.currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(pageState.currentLanguageMode);
      pageState.currentResolvedLocale = targetLocale;
      applyDocumentLanguage(targetLocale);
      const finalizeLanguageInit = () => {
        if (initialLanguageApplied) {
          return;
        }
        initialLanguageApplied = true;
        if (typeof pageState.resolveInitialLanguageReady === 'function') {
          pageState.resolveInitialLanguageReady();
        }
      };
      const applyResolvedMessages = (messages) => {
        if (requestId !== languageApplyRequestId) {
          return;
        }
        pageState.currentMessages = messages || {};
        applyLanguageStrings();
        forceReloadRecentSitesForI18n();
        finalizeLanguageInit();
      };
      loadLocaleMessages(targetLocale).then(applyResolvedMessages);
    }

    function refreshShortcutTileThemes() {
      shortcutTiles.forEach((tile) => {
        if (!tile) {
          return;
        }
        applyShortcutTileTheme(tile, tile._xTheme, tile._xHost || '');
      });
    }

    function refreshFallbackIcons() {
      if (pageState.faviconViewRuntime && typeof pageState.faviconViewRuntime.refreshFallbackIcons === 'function') {
        pageState.faviconViewRuntime.refreshFallbackIcons();
      }
    }

    function refreshThemeAwareFavicons() {
      if (pageState.faviconViewRuntime && typeof pageState.faviconViewRuntime.refreshThemeAwareFavicons === 'function') {
        pageState.faviconViewRuntime.refreshThemeAwareFavicons();
      }
    }

    function scheduleThemeAwareFaviconRescue() {
      if (pageState.faviconViewRuntime && typeof pageState.faviconViewRuntime.scheduleThemeAwareFaviconRescue === 'function') {
        pageState.faviconViewRuntime.scheduleThemeAwareFaviconRescue();
      }
    }

    function applyThemeMode(mode, options) {
      const previousThemeMode = pageState.currentThemeMode;
      pageState.currentThemeMode = normalizeThemeMode(mode);
      const mediaMatchesOverride = options && typeof options.mediaMatches === 'boolean'
        ? options.mediaMatches
        : null;
      const previousResolved = document.body ? document.body.getAttribute('data-theme') : '';
      const resolved = resolveTheme(mode, mediaMatchesOverride);
      document.body.setAttribute('data-theme', resolved);
      syncBookmarkTopbarSurfaceColorForTheme(resolved);
      if (document.documentElement) {
        document.documentElement.removeAttribute('data-wallpaper-preload-theme');
        document.documentElement.style.colorScheme = resolved;
      }
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', resolved === 'dark' ? '#111111' : '#ffffff');
      }
      applyWordmarkThemeAppearance(resolved);
      const didResolvedThemeChange = previousResolved !== resolved;
      suggestionItems.forEach((item) => {
        if (item && item._xTheme) {
          applyThemeVariables(item, item._xTheme);
        }
      });
      recentCards.forEach((card) => {
        if (!card) {
          return;
        }
        applyRecentCardTheme(card, card._xTheme, card._xHost || '');
      });
      bookmarkCards.forEach((card) => {
        if (!card) {
          return;
        }
        // 文件夹卡片通常没有 host/theme，也需要在主题切换时重算阴影与变量。
        applyBookmarkCardTheme(card, card._xTheme, card._xHost || '');
      });
      refreshShortcutTileThemes();
      applyLanguageStrings();
      updateSelection();
      updateModeBadge(pageState.inputParts && pageState.inputParts.input ? pageState.inputParts.input.value : '');
      refreshFallbackIcons();
      if (didResolvedThemeChange) {
        refreshThemeAwareFavicons();
        scheduleThemeAwareFaviconRescue();
      }
      if ((didResolvedThemeChange || previousThemeMode !== pageState.currentThemeMode) &&
          pageState.wallpaperRuntime && typeof pageState.wallpaperRuntime.handleThemeModeChange === 'function') {
        pageState.wallpaperRuntime.handleThemeModeChange();
      }
      if (!pageState.initialThemeApplied) {
        pageState.initialThemeApplied = true;
        if (typeof pageState.resolveInitialThemeReady === 'function') {
          pageState.resolveInitialThemeReady();
        }
      }
      if (mode === 'system' && !mediaListenerAttached) {
        mediaListenerAttached = addMediaQueryChangeListener(mediaQuery, handleMediaChange);
      }
      if (mode !== 'system' && mediaListenerAttached) {
        removeMediaQueryChangeListener(mediaQuery, handleMediaChange);
        mediaListenerAttached = false;
      }
      scheduleWallpaperAdaptiveToneUpdate();
    }

    function normalizeThemeMode(value) {
      if (value === 'light' || value === 'dark') {
        return value;
      }
      return 'system';
    }

    function normalizeNewtabThemeMode(value) {
      if (value === 'light' || value === 'dark') {
        return value;
      }
      return 'global';
    }

    function normalizeNewtabThemeScope(value) {
      return value === 'home' ? 'home' : 'global';
    }

    function isNewtabThemeFollowingGlobal() {
      return pageState.newtabThemeMode === 'global';
    }

    function getScopedThemeMode() {
      return isNewtabThemeFollowingGlobal() ? pageState.globalThemeMode : pageState.newtabThemeMode;
    }

    function getSelectedThemeMode() {
      if (pageState.newtabThemeScope !== 'home') {
        return pageState.globalThemeMode;
      }
      return isNewtabThemeFollowingGlobal() ? 'system' : pageState.newtabThemeMode;
    }

    function applyScopedThemeMode(options) {
      applyThemeMode(getScopedThemeMode(), options);
    }

    function bootstrapInitialThemeMode() {
      if (hasThemeBootstrapStarted) {
        return initialThemeReadyPromise;
      }
      hasThemeBootstrapStarted = true;
      if (!storageArea) {
        pageState.globalThemeMode = 'system';
        pageState.newtabThemeMode = 'global';
        pageState.newtabThemeScope = 'global';
        applyScopedThemeMode();
        return initialThemeReadyPromise;
      }
      storageArea.get([
        THEME_STORAGE_KEY,
        NEWTAB_THEME_MODE_STORAGE_KEY,
        NEWTAB_THEME_SCOPE_STORAGE_KEY
      ], (result) => {
        pageState.globalThemeMode = normalizeThemeMode(result ? result[THEME_STORAGE_KEY] : 'system');
        pageState.newtabThemeMode = normalizeNewtabThemeMode(result ? result[NEWTAB_THEME_MODE_STORAGE_KEY] : 'global');
        pageState.newtabThemeScope = normalizeNewtabThemeScope(result ? result[NEWTAB_THEME_SCOPE_STORAGE_KEY] : 'global');
        applyScopedThemeMode();
      });
      return initialThemeReadyPromise;
    }

    function bootstrapInitialLanguageMode() {
      if (hasLanguageBootstrapStarted) {
        return initialLanguageReadyPromise;
      }
      hasLanguageBootstrapStarted = true;
      if (!storageArea) {
        applyLanguageMode('system');
        return initialLanguageReadyPromise;
      }
      storageArea.get([LANGUAGE_STORAGE_KEY], (result) => {
        applyLanguageMode(result[LANGUAGE_STORAGE_KEY] || 'system');
      });
      return initialLanguageReadyPromise;
    }

    function handleMediaChange(event) {
      if (pageState.currentThemeMode !== 'system') {
        return;
      }
      // 仅更新 data-theme 会遗漏依赖 JS 混色的卡片；系统主题切换时需完整重算。
      const mediaMatches = event && typeof event.matches === 'boolean'
        ? event.matches
        : mediaQuery.matches;
      applyThemeMode('system', { mediaMatches });
    }

    function syncSystemThemeMode() {
      if (pageState.currentThemeMode !== 'system') {
        return;
      }
      const resolved = resolveTheme('system');
      if (!document.body || document.body.getAttribute('data-theme') === resolved) {
        return;
      }
      applyThemeMode('system', { mediaMatches: mediaQuery.matches });
    }

    return {
      applyLanguageMode,
      refreshThemeAwareFavicons,
      scheduleThemeAwareFaviconRescue,
      applyThemeMode,
      normalizeThemeMode,
      normalizeNewtabThemeMode,
      normalizeNewtabThemeScope,
      isNewtabThemeFollowingGlobal,
      getScopedThemeMode,
      getSelectedThemeMode,
      applyScopedThemeMode,
      bootstrapInitialThemeMode,
      bootstrapInitialLanguageMode,
      syncSystemThemeMode
    };
  }

  root.LumnoNewtabAppearanceModes = { createAppearanceModes };
})(globalThis);
