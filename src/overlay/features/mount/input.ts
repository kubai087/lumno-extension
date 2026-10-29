// The panel's input and what draws around it: the search input with its
// clear and close-other-tabs buttons, the notices and row actions, the
// tooltips, the results container, the button labels, the settings follows,
// the input mode controller, the site search loads, the input's listeners
// and the key router.
import { defaultAccentColor } from '../../../shared/favicon/favicon-theme';
import { parseCssColor, rgbToCss } from '../../../domain/color';
import * as AGGREGATE_SEARCH_STORE from '../../../domain/search/aggregate-search-store';
import * as SEARCH_INPUT_HISTORY from '../../../domain/search/search-input-history';
import * as SEARCH_INPUT_MODE from '../../../shared/search/search-input-mode';
import * as SUGGESTION_NAVIGATION from '../../../shared/search/suggestion-navigation';
import * as LumnoCursorTooltip from '../../../shared/ui/cursor-tooltip';
import * as LumnoTooltip from '../../../shared/ui/tooltip';
import * as OVERLAY_KEYBOARD from '../../keyboard';
import * as PANEL_PANEL_NOTICES from '../../panel/panel-notices';
import * as PANEL_SETTINGS_SYNC from '../../panel/settings-sync';
import * as PANEL_ROW_ACTIONS from '../../panel/row-actions';
import { getTabSwitcherHost } from '../../../shared/tab-switcher/host';
import * as LumnoMessaging from '../../../platform/messaging';
import { createSearchInput } from '../../../shared/react/search-input';
import {
  searchInputHistory,
  searchSourceOrder,
  siteSearchIconCache as siteSearchIconCacheSetting
} from '../../../domain/settings/search';
import { createSettingPort } from '../../../platform/settings-store';
import * as BundledIcons from '../../../domain/favicon/shortcut-favicon/bundled-icons';
import { isAggregateSearchProvider } from '../../../domain/search/aggregate-search-store';
import { getSiteSearchDisplayName, getSiteSearchPrefixText } from '../../../shared/search-panel/labels';
import type { OverlayContext } from '../../app/context';
import type { CoreFeature } from '../core';
import type { PanelFeature } from '../panel';
import type { SuggestionsFeature } from '../suggestions';
import type { ControlsFeature } from '../controls';
import type { PanelMountPart } from './panel-mount';

interface InputPartDeps {
  core: CoreFeature;
  panel: PanelFeature;
  suggestions: SuggestionsFeature;
  controls: ControlsFeature;
  mount: PanelMountPart;
}

function createInputPart(ctx: OverlayContext, deps: InputPartDeps) {
  const { elements, formatMessage, locale, overlayTabs, settings, t } = ctx;
  const addOverlaySessionCleanup = ctx.overlaySessionCleanups.add;
  const {
    applyNoTranslate,
    applyOverlayInputExtensionIsolation,
    defaultTheme,
    filterTabsForOverlay,
    imeKeyGuard,
    notices,
    overlayNoticeLayer,
    overlayThemeChoice,
    overlayToast,
    overlayViewportSizeSync,
    shouldSwitchMatchedTabSuggestion,
    suggestionInputPreview
  } = deps.core;
  const {
    menuOrder,
    numberShortcutOptions,
    searchEngine,
    searchMode,
    searchQuery,
    searchResults,
    siteSearchCatalog,
    siteSearchIconCache,
    suggestionItems,
    suggestionModifiers
  } = deps.core;
  const {
    applyOverlayFontFamily,
    attachKeyRouter,
    closeOverlayWithMotion,
    createOverlayWheelIsolationHandler,
    faviconRuntime,
    finishOverlayResultActivation,
    getImmediateThemeForSuggestion,
    getOpenDisposition,
    getOverlayFaviconUrlResolver,
    getOverlayMountHost,
    getPageRenderableProviderIcon,
    getProviderThemeHost,
    getThemeForMode,
    getThemeForProvider,
    isOverlayDarkMode,
    notifyOverlayLoadingSession,
    openSiteSearchProviderQuery,
    removeOverlay,
    resultActivation,
    toPageRenderableIconUrl
  } = deps.panel;
  const {
    activateOpenTabsSearchMode,
    clearDefaultOpenTabsSuggestions,
    documentPipSupported,
    modeActions,
    modeMenu,
    renderTabSuggestions,
    requestOverlaySearchSuggestions,
    requestTabsAndRender,
    rowEvents,
    setDocumentPipEnabled,
    setInputScopedStyle,
    shouldShowOpenTabsForEmptyQuery,
    syncSearchModeMenuResultOffset,
    updateSearchSuggestions
  } = deps.suggestions;
  const {
    applyLanguageStrings,
    applyOverlayCjkFontFace,
    applyThemeModeChange,
    applyWebAppearanceMode,
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
    syncLiveSearchInputFromEvent,
    syncSearchTriggerHintFromInput
  } = deps.controls;
  const { copySearchResultUrl, overlayHost, overlayMount, overlayStyleRoot } = deps.mount;

  // The search icon opens the scope panel, except while a scope is set.
  let searchScopeIconEnabled = true;

  // The first messages are in before the panel's copy is drawn; later
  // changes redraw it.
  const initialLanguageReady = locale.ready.then(() => {
    applyOverlayCjkFontFace(locale.store.getSnapshot().locale);
  }).catch(() => {});

  function getCloseOtherTabsConfirmCopy() {
    return {
      message: t('overlay_close_other_tabs_confirm', '关闭此窗口中的其他标签页？置顶和分组内的标签页会保留。'),
      messageKey: 'overlay_close_other_tabs_confirm',
      confirmLabel: t('overlay_close_other_tabs_confirm_button', '关闭'),
      confirmLabelKey: 'overlay_close_other_tabs_confirm_button'
    };
  }

  function confirmCloseOtherTabs(event: MouseEvent): void {
    if (event.isTrusted !== true) {
      return;
    }
    // The confirm button is going away with its bubble; keep typing in the field.
    if (elements.searchInput) {
      elements.searchInput.focus({ preventScroll: true });
    }
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'closeOtherTabsForOverlay' }, (response) => {
      if (!response || response.ok !== true) {
        return;
      }
      if (searchQuery.text) {
        requestOverlaySearchSuggestions(searchQuery.text);
        return;
      }
      requestTabsAndRender();
    });
  }

  const inputParts = createSearchInput({
    portals: overlayMount.portals,
    container: overlayMount.inputContainer,
    styleRoot: overlayStyleRoot,
    placeholder: t('overlay_search_placeholder', t('search_placeholder', getDefaultPlaceholderText())),
    inputId: '_x_extension_search_input_2024_unique_',
    iconId: '_x_extension_search_icon_2024_unique_',
    containerId: '_x_extension_input_container_2024_unique_',
    containerStyleOverrides: {
      height: '56px',
      'min-height': '56px',
      'max-height': '56px',
      'border-radius': 'var(--x-ov-panel-radius, 26px) var(--x-ov-panel-radius, 26px) 0 0',
      'corner-shape': 'superellipse(1.25)',
      overflow: 'visible'
    },
    inputStyleOverrides: {
      height: '56px',
      'min-height': '56px',
      'max-height': '56px',
      'line-height': '1.3',
      'padding-top': '0',
      'padding-bottom': '0',
      'padding-left': '50px',
      'padding-right': '92px'
    },
    iconStyleOverrides: {
      left: '13px'
    },
    rightIconStyleOverrides: {
      '--x-ext-input-right-icon-inset': '13px',
      cursor: 'pointer'
    },
    clearAction: {
      id: '_x_extension_search_clear_2026_unique_',
      ariaLabel: t('search_input_clear', '清空'),
      icon: { name: 'ri-close-line', size: 16 },
      styleOverrides: {
        '--x-ext-input-clear-right': '85px',
        '--x-ext-input-clear-top': '13px'
      }
    },
    secondaryAction: {
      id: '_x_extension_search_close_other_tabs_2026_unique_',
      className: 'x-ov-close-other-tabs',
      ariaLabel: t('overlay_close_other_tabs_tooltip', '关闭其他标签页'),
      icon: { name: 'ri-brush-2-line', size: 16 },
      confirm: {
        getCopy: getCloseOtherTabsConfirmCopy,
        onConfirm: confirmCloseOtherTabs
      }
    },
    modeBadge: {
      id: '_x_extension_mode_badge_2024_unique_',
      className: 'x-lumno-search-input-mode__badge',
      surface: 'overlay',
      visible: false
    },
    showUnderlineWhenEmpty: true
  });
  elements.mountInput(inputParts, SEARCH_INPUT_HISTORY.createSearchInputHistoryController({
    storage: createSettingPort(settings.store, searchInputHistory)
  }));
  applyOverlayInputExtensionIsolation(inputParts.input);
  const rightIcon = inputParts.rightIcon;

  PANEL_PANEL_NOTICES.createPanelNotices({
    openOverlayCommunityQrDialog,
    notices,
    elements,
    portals: overlayMount.portals,
    removeOverlay,
    t,
    getOpenDisposition,
    locale
  });

  PANEL_ROW_ACTIONS.createRowActions({
    rowEvents,
    elements,
    searchQuery,
    modeActions,
    resultActivation,
    finishOverlayResultActivation,
    shouldSwitchMatchedTabSuggestion,
    removeOverlay,
    activateOpenTabsSearchMode,
    openDocumentPipPickerFromOverlay,
    openOverlayCommunityQrDialog,
    applyThemeModeChange,
    applyWebAppearanceMode,
    openSiteSearchProviderQuery,
    copySearchResultUrl,
    updateSearchSuggestions,
    requestOverlaySearchSuggestions
  });

  applyNoTranslate(elements.searchInput);
  applyNoTranslate(elements.inputContainer);
  applyNoTranslate(rightIcon);
  const topActionTooltipController = LumnoTooltip.createController({
    portals: overlayMount.portals,
    documentObj: document,
    windowObj: window,
    id: '_x_extension_top_action_tooltip_2026_unique_',
    appendTo: elements.overlay,
    boundaryElement: elements.overlay,
    positionMode: 'absolute',
    maxWidth: 420,
    decorateElement: applyNoTranslate
  });
  const overlayCursorTooltipController = LumnoCursorTooltip.createController({
    portals: overlayMount.portals,
    documentObj: document,
    windowObj: window,
    id: '_x_extension_overlay_cursor_tooltip_2026_unique_',
    appendTo: elements.overlay,
    boundaryElement: elements.overlay,
    positionMode: 'absolute',
    maxWidth: 520,
    offsetX: 14,
    offsetY: 16,
    decorateElement: applyNoTranslate
  });
  elements.mountTooltips(topActionTooltipController, overlayCursorTooltipController);
  const overlayModeMenuCursorTooltipController = LumnoCursorTooltip.createController({
    portals: overlayMount.portals,
    documentObj: document,
    windowObj: window,
    id: '_x_extension_overlay_mode_menu_cursor_tooltip_2026_unique_',
    appendTo: overlayStyleRoot,
    positionMode: 'fixed',
    maxWidth: 320,
    offsetX: 14,
    offsetY: 16,
    decorateElement: (element) => {
      applyNoTranslate(element);
      element.style.setProperty('--x-extension-tooltip-z-index', '2147483647');
    }
  });
  addOverlaySessionCleanup(() => {
    topActionTooltipController.destroy();
    overlayCursorTooltipController.destroy();
    overlayModeMenuCursorTooltipController.destroy();
  });
  const bindInputActionCursorTooltip = (button: HTMLElement | null, getText: () => string): void => {
    if (!button) {
      return;
    }
    overlayCursorTooltipController.bind(button, getText, {
      boundaryElement: elements.overlay,
      positionMode: 'absolute',
      maxWidth: 420,
      deferHideVisibility: true,
      preserveVisibleOnTargetSwitch: true,
      handoffRoot: elements.inputContainer
    });
  };
  const hideInputActionCursorTooltip = () => {
    overlayCursorTooltipController.hide();
  };
  const searchClearButton = inputParts.clearAction;
  inputParts.setChrome({
    tooltip: { bind: bindInputActionCursorTooltip, hide: hideInputActionCursorTooltip }
  });

  const suggestionsContainer = overlayMount.suggestionsContainer;
  elements.mountResults(suggestionsContainer);
  applyNoTranslate(suggestionsContainer);
  suggestionsContainer.addEventListener('wheel', function(event) {
    SUGGESTION_NAVIGATION.preventNumberShortcutWheel(event, suggestionsContainer);
  }, { passive: false });
  overlayMount.panel.addEventListener('pointerdown', function() {
    SUGGESTION_NAVIGATION.cancelNumberShortcuts(suggestionsContainer);
  }, true);
  suggestionsContainer.addEventListener('animationend', (event) => {
    if (event.animationName !== '_x_ov_scope_result_enter_2026_unique_') {
      return;
    }
    suggestionsContainer.setAttribute('data-scope-result-enter', 'done');
  });
  const wheelIsolationHandler = createOverlayWheelIsolationHandler(overlayMount.panel);
  overlayMount.panel.addEventListener('wheel', wheelIsolationHandler, { passive: false, capture: true });
  addOverlaySessionCleanup(() => overlayMount.panel.removeEventListener('wheel', wheelIsolationHandler, true));

  initialLanguageReady.then(() => {
    if (elements.overlay && elements.overlay.isConnected) {
      applyLanguageStrings({ refreshResults: false });
    }
    let shownMessages = locale.store.getSnapshot().messages;
    locale.store.subscribe(() => {
      const { messages, locale: shownLocale } = locale.store.getSnapshot();
      if (messages !== shownMessages) {
        shownMessages = messages;
        applyOverlayCjkFontFace(shownLocale);
        applyLanguageStrings();
      }
    });
  });

  function activateSearchScopeIcon(): void {
    if (elements.inputModeController) {
      elements.inputModeController.resetModeMenuDoubleTab();
    }
    void modeMenu.openFromDoubleTab();
  }
  // The input's buttons' names and tooltips in the current language.
  function applyInputActionLabels(): void {
    if (!elements.inputParts) {
      return;
    }
    elements.inputParts.setChrome({
      rightIconLabel: formatMessage('command_settings', '打开设置', { name: 'Lumno' }),
      secondaryLabel: t('overlay_close_other_tabs_tooltip', '关闭其他标签页'),
      clearLabel: t('search_input_clear', '清空'),
      scopeAction: {
        enabled: searchScopeIconEnabled,
        label: t('shortcut_reference_search_open_scope_menu_title', '打开搜索范围面板'),
        onActivate: activateSearchScopeIcon
      }
    });
  }
  applyInputActionLabels();
  addOverlaySessionCleanup(locale.store.subscribe(applyInputActionLabels));

  function setSearchScopeIconEnabled(enabled: boolean): void {
    searchScopeIconEnabled = enabled;
    if (!enabled) {
      hideInputActionCursorTooltip();
    }
    applyInputActionLabels();
  }

  if (rightIcon) {
    rightIcon.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'openOptionsPage' });
      removeOverlay(elements.overlay);
    });
  }
  if (searchClearButton) {
    inputParts.input.addEventListener('input', () => {
      if (elements.inputModeController) {
        elements.inputModeController.updateLayout();
      }
    });
  }

  // Focusing the input hands the selection back to it.
  inputParts.input.addEventListener('focus', function() {
    searchResults.select(-1);
    suggestionInputPreview.restore(elements.searchInput, searchQuery.raw);
  });

  const defaultPlaceholder = inputParts.input.placeholder;
  const attachFaviconData = faviconRuntime.attachFaviconData;
  const attachInputModeFaviconData =
    BundledIcons.createSiteSearchProviderIconHydrator(attachFaviconData);
  const refreshOverlayFaviconsForPolicyChange = faviconRuntime.refreshOverlayFaviconsForPolicyChange;
  const defaultCaretColor = inputParts.input.style.caretColor || 'var(--x-ext-input-caret, #7DB7FF)';
  const inputModePrefixTransition = 'opacity 140ms cubic-bezier(0.22, 1, 0.36, 1), transform 160ms cubic-bezier(0.22, 1, 0.36, 1), background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, color 140ms ease';

  const settingsApplied = PANEL_SETTINGS_SYNC.createSettingsSync({
    setDocumentPipEnabled,
    overlayTabs,
    elements,
    overlayViewportSizeSync,
    overlayNoticeLayer,
    settings,
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    updateSearchSuggestions,
    overlayThemeChoice,
    searchEngine,
    requestOverlaySearchSuggestions,
    shouldShowOpenTabsForEmptyQuery,
    renderTabSuggestions,
    filterTabsForOverlay,
    refreshOverlayFaviconsForPolicyChange,
    getImmediateThemeForSuggestion,
    requestTabsAndRender,
    clearDefaultOpenTabsSuggestions,
    documentPipSupported,
    applyOverlayFontFamily
  });

  elements.mountModeController(SEARCH_INPUT_MODE.createInputModeController(inputParts, {
    surface: 'overlay',
    prefixTransition: inputModePrefixTransition,
    defaultPlaceholder: getDefaultPlaceholderText() || defaultPlaceholder,
    getDefaultPlaceholder: () => getDefaultPlaceholderText() || defaultPlaceholder,
    defaultCaretColor,
    modeBadgeElement: elements.modeBadge,
    rightReserveBase: 92,
    rightAnchorOffset: 86,
    // The clear button adds a 30px slot plus a 6px gap left of the close-other-tabs button.
    getExtraRightInset: () => (inputParts.syncClearAction() ? 36 : 0),
    baseInputPaddingLeft: 50,
    setInputStyle: setInputScopedStyle,
    getThemeForMode,
    defaultTheme: defaultTheme,
    defaultAccentColor,
    parseCssColor,
    rgbToCss,
    isDarkMode: isOverlayDarkMode,
    getProviderIcon: getPageRenderableProviderIcon,
    resolveProviderIconUrl: (provider, iconUrl) => {
      const pageUrl = BundledIcons.getSiteSearchProviderPageUrl(provider);
      return toPageRenderableIconUrl(getOverlayFaviconUrlResolver().getProviderFaviconUrl(pageUrl, iconUrl), pageUrl);
    },
    getProviderThemeHost,
    getThemeForProvider,
    getSiteSearchPrefixText: (provider) => getSiteSearchPrefixText(locale, provider),
    getSiteSearchDisplayName: (provider) => getSiteSearchDisplayName(locale, provider),
    attachFaviconData: attachInputModeFaviconData,
    formatMessage,
    modeMenuCursorTooltipController: overlayModeMenuCursorTooltipController,
    getModeMenuItems: modeMenu.getItems,
    onModeMenuSelect: modeMenu.select,
    onModeMenuReorder: menuOrder.reorder,
    onModeMenuGroupMove: menuOrder.moveGroup,
    onModeMenuHistory: menuOrder.step,
    onModeTagRemovalConfirmation: () => {
      overlayToast.show(t(
        'search_scope_remove_confirmation',
        'Press Backspace again to remove the scope.'
      ));
    },
    onModeTagRemovalConfirmationReset: overlayToast.hide,
    onModeTagActiveChange: (active) => {
      setSearchScopeIconEnabled(!active);
    },
    onModeMenuLayoutChange: syncSearchModeMenuResultOffset,
    isTabHintSuppressed: () => Boolean(
      searchMode.site ||
      searchMode.local ||
      searchMode.openTabs
    )
  }));
  syncSearchModeMenuResultOffset();
  if (typeof window.ResizeObserver === 'function') {
    const modeMenuResultResizeObserver = new window.ResizeObserver(
      syncSearchModeMenuResultOffset
    );
    modeMenuResultResizeObserver.observe(suggestionsContainer);
    addOverlaySessionCleanup(() => {
      modeMenuResultResizeObserver.disconnect();
    });
  }
  siteSearchIconCache.load().then(() => {
    if (!searchMode.site || !elements.inputModeController) {
      return;
    }
    const activeProvider = searchMode.site;
    modeActions.setSiteSearchPrefix(activeProvider, defaultTheme);
    getThemeForProvider(activeProvider).then((theme) => {
      if (searchMode.site === activeProvider) {
        modeActions.setSiteSearchPrefix(activeProvider, theme);
      }
    }).catch(() => {});
  });

  void siteSearchCatalog.loadProviders();
  siteSearchCatalog.loadAggregates().then(() => {
    if (elements.inputModeController) {
      elements.inputModeController.refreshModeMenu();
    }
    if (elements.searchInput && elements.searchInput.value) {
      syncSearchTriggerHintFromInput(elements.searchInput.value);
    }
    if (searchQuery.text) {
      requestOverlaySearchSuggestions(searchQuery.text);
    }
  });

  // A new order from Settings or another surface reaches an open scope
  // panel now; a closed one reads it when it opens.
  settings.follow(searchSourceOrder, () => {
    if (elements.inputModeController) {
      elements.inputModeController.refreshModeMenu();
    }
  });
  // A changed list may drop the aggregate search the input is in, or
  // change its sources.
  siteSearchCatalog.store.subscribe(() => {
    const activeProvider = searchMode.site;
    if (activeProvider && isAggregateSearchProvider(activeProvider)) {
      const activeId = String(activeProvider.aggregateId || '');
      const definition = siteSearchCatalog.aggregates.find((item) => String(item && item.id ? item.id : '') === activeId);
      const updatedProvider = definition && siteSearchCatalog.isAggregateAvailable(definition)
        ? AGGREGATE_SEARCH_STORE.createScopeProvider(definition)
        : null;
      if (updatedProvider) {
        searchMode.replaceSite(updatedProvider);
        modeActions.setSiteSearchPrefix(updatedProvider, defaultTheme, { animate: false });
      } else {
        modeActions.clearSiteSearch();
      }
    }
    if (elements.inputModeController) {
      elements.inputModeController.refreshModeMenu();
    }
    if (searchQuery.text) {
      requestOverlaySearchSuggestions(searchQuery.text);
    }
  });

  settings.follow(siteSearchIconCacheSetting, () => {
    siteSearchIconCache.applyStored(settings.store.getStored(siteSearchIconCacheSetting));
    if (searchMode.site && elements.inputModeController) {
      const activeProvider = searchMode.site;
      modeActions.setSiteSearchPrefix(activeProvider, defaultTheme);
      getThemeForProvider(activeProvider).then((theme) => {
        if (searchMode.site === activeProvider) {
          modeActions.setSiteSearchPrefix(activeProvider, theme);
        }
      }).catch(() => {});
    }
    if (elements.inputModeController) {
      elements.inputModeController.refreshModeMenu();
    }
    if (searchQuery.text) {
      requestOverlaySearchSuggestions(searchQuery.text);
    }
  });

  inputParts.input.addEventListener('compositionstart', handleSearchInputCompositionStart);
  inputParts.input.addEventListener('compositionend', handleSearchInputCompositionEnd);
  inputParts.input.addEventListener('input', handleSearchInputEvent);
  inputParts.container.addEventListener('compositionstart', handleSearchInputCompositionStart, true);
  inputParts.container.addEventListener('compositionend', handleSearchInputCompositionEnd, true);
  inputParts.container.addEventListener('input', handleSearchInputEvent, true);
  const handleOverlayLoadingSessionSelection = (event: Event): void => {
    notifyOverlayLoadingSession(syncLiveSearchInputFromEvent(event));
  };
  inputParts.container.addEventListener('select', handleOverlayLoadingSessionSelection, true);
  inputParts.container.addEventListener('focusin', handleOverlayLoadingSessionSelection, true);
  inputParts.container.addEventListener('pointerup', handleOverlayLoadingSessionSelection, true);

  // Add click outside to close functionality
  const clickOutsideHandler = function(event: MouseEvent): void {
    const overlay = elements.overlay;
    if (!overlay) {
      return;
    }
    const eventPath = event.composedPath();
    const clickedInsideOverlay = eventPath.includes(overlay) || eventPath.includes(overlayHost);
    if (!clickedInsideOverlay) {
      closeOverlayWithMotion(overlay);
    }
  };
  document.addEventListener('click', clickOutsideHandler);
  addOverlaySessionCleanup(() => document.removeEventListener('click', clickOutsideHandler));
  inputParts.input.addEventListener('keydown', handleSearchInputKeydown);
  inputParts.input.addEventListener('keypress', function(e) {
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      e.stopPropagation();
    }
  });
  inputParts.input.addEventListener('keyup', function(e) {
    suggestionModifiers.syncFromEvent(e);
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      e.stopPropagation();
    }
  });

  function closeOverlayOnEscape(): void {
    if (elements.overlay) {
      closeOverlayWithMotion(elements.overlay);
    }
  }
  const overlayKeyRouter = new OVERLAY_KEYBOARD.OverlayKeyRouter(window, {
    getMount: () => ({
      document,
      host: getOverlayMountHost(elements.overlay),
      panel: elements.overlay
    }),
    isOverlayConnected: () => Boolean(elements.overlay && elements.overlay.isConnected),
    isKeyboardYielded: () => Boolean(getTabSwitcherHost(document)),
    isSearchInputActive,
    shouldHandleModeMenuKey: (e) => Boolean(
      elements.inputModeController &&
      typeof elements.inputModeController.shouldHandleModeMenuKeyEvent === 'function' &&
      elements.inputModeController.shouldHandleModeMenuKeyEvent(e)
    ),
    handleModeMenuKey(e) {
      if (!elements.inputModeController ||
          typeof elements.inputModeController.handleModeMenuKeyEvent !== 'function') {
        return false;
      }
      elements.inputModeController.handleModeMenuKeyEvent(e);
      return true;
    },
    isImeComposition: imeKeyGuard.shouldIgnoreKeydown,
    onKeyUp: imeKeyGuard.markKeyUp,
    syncModifiers: suggestionModifiers.syncFromEvent,
    handleNumberShortcut: (e) => SUGGESTION_NAVIGATION.handleNumberShortcutKeyEvent(
      e,
      suggestionItems,
      elements.suggestionsContainer,
      numberShortcutOptions
    ),
    getSuggestionNavigationKey,
    handleInputKeydown: handleSearchInputKeydown,
    handleTab: handleTabKey,
    handleOverlayKeydown,
    handleOverlayKeyup,
    onEscapeOutside: closeOverlayOnEscape,
    onEscapeTaken: closeOverlayOnEscape,
    onBlur: () => {
      suggestionModifiers.set(false, false, false);
      SUGGESTION_NAVIGATION.cancelNumberShortcuts(elements.suggestionsContainer);
    }
  });
  overlayKeyRouter.start();
  attachKeyRouter(overlayKeyRouter);
  addOverlaySessionCleanup(() => overlayKeyRouter.stop());

  return {
    initialLanguageReady,
    settingsApplied
  };
}

type InputPart = ReturnType<typeof createInputPart>;

export { createInputPart };
export type { InputPart };
