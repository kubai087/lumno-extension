// The panel's controls: the command actions, the keys, the input's events,
// the language, the theme the panel is drawn in, the font faces and the
// viewport size sync.
import * as PANEL_PANEL_KEYS from '../../panel/panel-keys';
import * as PANEL_PANEL_LANGUAGE from '../../panel/panel-language';
import * as PANEL_SEARCH_INPUT_EVENTS from '../../panel/search-input-events';
import * as PANEL_COMMAND_ACTIONS from '../../panel/command-actions';
import type { ThemeMode } from '../../../domain/settings/appearance';
import { getSystemLocale } from '../../../shared/i18n/surface-locale';
import { installOverlayFontFaces } from '../../dom/font-faces';
import type { OverlayContext } from '../../app/context';
import type { CoreFeature } from '../core';
import type { PanelFeature } from '../panel';
import type { SuggestionsFeature } from '../suggestions';

interface ControlsFeatureDeps {
  core: CoreFeature;
  panel: PanelFeature;
  suggestions: SuggestionsFeature;
}

function createControlsFeature(ctx: OverlayContext, deps: ControlsFeatureDeps) {
  const { elements, locale, settings, t } = ctx;
  const addOverlaySessionCleanup = ctx.overlaySessionCleanups.add;
  const {
    applyNoTranslate,
    defaultTheme,
    imeKeyGuard,
    notices,
    overlayMediaQuery,
    overlayNoticeLayer,
    overlayThemeChoice,
    overlayViewportSizeSync,
    shouldSwitchMatchedTabSuggestion,
    suggestionInputPreview
  } = deps.core;
  const {
    colorScheme,
    numberShortcutOptions,
    searchAutocomplete,
    searchMatching,
    searchMode,
    searchQuery,
    searchResults,
    siteSearchCatalog,
    suggestionItems,
    suggestionModifiers,
    suggestionSource
  } = deps.core;
  const {
    applyOverlayThemeVariables,
    closeOverlayWithMotion,
    faviconRuntime,
    finishOverlayResultActivation,
    getThemeForProvider,
    invalidatePageTheme,
    notifyOverlayLoadingSession,
    openSiteSearchProviderQuery,
    panelThemeEvents,
    preloadThemeFromFavicon,
    removeOverlay,
    resultActivation,
    syncOverlayPageThemeObservation
  } = deps.panel;
  const {
    activateOpenTabsSearchMode,
    clearOpenTabsSearchMode,
    clearSearchSuggestions,
    clearSiteSearchTabHint,
    getCommandMatch,
    getDirectUrlSuggestion,
    getNextThemeMode,
    getNextWebAppearanceMode,
    getWebAppearanceMode,
    isModeCommand,
    isSlashCommandInput,
    modeActions,
    modeMenu,
    quickNavigation,
    renderCachedTabsOrRequest,
    requestOverlaySearchSuggestions,
    requestTabsAndRender,
    scrollSelectedSuggestionIntoView,
    setSiteSearchTabHint,
    setWebAppearanceState,
    updateModeBadge,
    updatePendingSearchSuggestions,
    updateSearchSuggestions
  } = deps.suggestions;

  const {
    openOverlayCommunityQrDialog,
    openDocumentPipPickerFromOverlay,
    applyThemeModeChange,
    applyWebAppearanceMode,
    applyNextWebAppearanceMode
  } = PANEL_COMMAND_ACTIONS.createCommandActions({
    removeOverlay,
    t,
    isModeCommand,
    isSlashCommandInput,
    updateModeBadge,
    getWebAppearanceMode,
    setWebAppearanceState,
    getNextWebAppearanceMode,
    settings,
    overlayThemeChoice,
    updateSearchSuggestions,
    elements
  });

  const {
    isApplyingInputHistory,
    handleTabKey,
    handleSearchInputKeydown,
    getSuggestionNavigationKey,
    handleOverlayKeydown,
    handleOverlayKeyup,
    isSearchInputActive
  } = PANEL_PANEL_KEYS.createPanelKeys({
    shouldSwitchMatchedTabSuggestion,
    overlayThemeChoice,
    elements,
    suggestionInputPreview,
    settings,
    suggestionModifiers,
    modeActions,
    searchMatching,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    modeMenu,
    activateOpenTabsSearchMode,
    siteSearchCatalog,
    requestOverlaySearchSuggestions,
    clearSearchSuggestions,
    clearOpenTabsSearchMode,
    imeKeyGuard,
    suggestionItems,
    numberShortcutOptions,
    removeOverlay,
    closeOverlayWithMotion,
    scrollSelectedSuggestionIntoView,
    getCommandMatch,
    applyThemeModeChange,
    getNextThemeMode,
    applyWebAppearanceMode,
    applyNextWebAppearanceMode,
    openDocumentPipPickerFromOverlay,
    isModeCommand,
    openOverlayCommunityQrDialog,
    openSiteSearchProviderQuery,
    finishOverlayResultActivation,
    resultActivation,
    isSlashCommandInput,
    updateSearchSuggestions,
    quickNavigation
  });

  const {
    syncLiveSearchInputFromEvent,
    syncSearchTriggerHintFromInput,
    handleSearchInputCompositionStart,
    handleSearchInputCompositionEnd,
    handleSearchInputEvent
  } = PANEL_SEARCH_INPUT_EVENTS.createSearchInputEvents({
    isApplyingInputHistory,
    notices,
    elements,
    suggestionInputPreview,
    imeKeyGuard,
    searchMatching,
    locale,
    searchResults,
    searchMode,
    searchAutocomplete,
    searchQuery,
    siteSearchCatalog,
    applyNoTranslate,
    clearSiteSearchTabHint,
    isSlashCommandInput,
    setSiteSearchTabHint,
    suggestionSource,
    notifyOverlayLoadingSession,
    updateModeBadge,
    updateSearchSuggestions,
    renderCachedTabsOrRequest,
    getDirectUrlSuggestion,
    updatePendingSearchSuggestions,
    requestOverlaySearchSuggestions,
    clearSearchSuggestions
  });

  const {
    getDefaultPlaceholderText,
    applyOverlayCjkFontFace,
    applyLanguageStrings
  } = PANEL_PANEL_LANGUAGE.createPanelLanguage({
    notices,
    elements,
    defaultTheme,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    locale,
    updateModeBadge,
    getThemeForProvider,
    updateSearchSuggestions,
    requestTabsAndRender
  });


  // Follows the system's scheme while the theme follows the system.
  let overlayThemeMediaListener: (() => void) | null = null;

  function stopFollowingSystemTheme(): void {
    if (overlayThemeMediaListener) {
      overlayMediaQuery.removeEventListener('change', overlayThemeMediaListener);
      overlayThemeMediaListener = null;
    }
  }

  function applyOverlayTheme(mode: ThemeMode): void {
    applyOverlayThemeVariables(mode);
    overlayNoticeLayer.sync(elements.overlay);
    const resolvedTheme = elements.overlay ? elements.overlay.getAttribute('data-theme') : '';
    colorScheme.setState({ dark: resolvedTheme === 'dark' });
    updateModeBadge(elements.searchInput ? elements.searchInput.value : '');
    syncOverlayPageThemeObservation();
    if (mode === 'system') {
      if (!overlayThemeMediaListener) {
        const listener = () => {
          if (overlayThemeChoice.mode === 'system') {
            // Re-apply in full: updating only the panel's variables would leave
            // the rows on the previous scheme's colors.
            // A page that follows the system theme may have switched too.
            invalidatePageTheme();
            applyOverlayTheme('system');
          }
        };
        overlayThemeMediaListener = listener;
        overlayMediaQuery.addEventListener('change', listener);
      }
      return;
    }
    stopFollowingSystemTheme();
  }

  // A page that changed its own theme is followed at once.
  panelThemeEvents.on('pageThemeChanged', () => applyOverlayTheme(overlayThemeChoice.mode));

  // The panel draws the mode applied to it.
  overlayThemeChoice.events.on('applied', ({ mode }) => applyOverlayTheme(mode));

  addOverlaySessionCleanup(stopFollowingSystemTheme);

  faviconRuntime.onFaviconData(preloadThemeFromFavicon);

  // Adds the overlay's font faces to the page once.
  function ensureOverlayFontFaces() {
    if (!installOverlayFontFaces(document, window)) {
      return;
    }
    // Every face added to a page that has already laid out restyles and
    // relays out the whole page, so the CJK face joins in the same task,
    // guessed from the browser language. The language setting changes it
    // later only when it calls for another script.
    applyOverlayCjkFontFace(getSystemLocale());
  }

  function startOverlayViewportSizeSync(overlayElement: HTMLElement): void {
    overlayViewportSizeSync.start(overlayElement);
    overlayNoticeLayer.sync(overlayElement);
  }

  return {
    applyLanguageStrings,
    applyOverlayCjkFontFace,
    applyThemeModeChange,
    applyWebAppearanceMode,
    ensureOverlayFontFaces,
    getDefaultPlaceholderText,
    getSuggestionNavigationKey,
    handleOverlayKeydown,
    handleOverlayKeyup,
    handleSearchInputCompositionEnd,
    handleSearchInputCompositionStart,
    handleSearchInputEvent,
    handleSearchInputKeydown,
    handleTabKey,
    isSearchInputActive,
    openDocumentPipPickerFromOverlay,
    openOverlayCommunityQrDialog,
    startOverlayViewportSizeSync,
    syncLiveSearchInputFromEvent,
    syncSearchTriggerHintFromInput
  };
}

type ControlsFeature = ReturnType<typeof createControlsFeature>;

export { createControlsFeature };
export type { ControlsFeature };
