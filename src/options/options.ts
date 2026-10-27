import * as LumnoBlacklistUtils from '../domain/blacklist-utils';
import * as CUSTOM_QUOTES from '../domain/custom-quotes';
import * as COMMUNITY_LINKS from '../platform/community-links';
import * as NAVIGATION_DISPOSITION from '../domain/navigation-disposition';
import * as SETTINGS from '../domain/settings';
import { getContextSettingsStore, readStoredSetting } from '../platform/settings-store';
import * as LumnoShortcutDisplay from '../domain/shortcut-display';
import * as LumnoTooltip from '../shared/ui/tooltip';
import * as OPTIONS_ACCOUNT_SECTION from './options-account-section';
import * as OPTIONS_APPEARANCE_GLOBAL_SECTION from './options-appearance-global-section';
import * as OPTIONS_APPEARANCE_TAB from './options-appearance-tab';
import * as OPTIONS_DAILY_QUOTE_SECTION from './options-appearance-daily-quote-section';
import * as OPTIONS_APPEARANCE_NEWTAB_LAYOUT_SECTION from './options-appearance-newtab-layout-section';
import * as OPTIONS_APPEARANCE_NEWTAB_LOOK_SECTION from './options-appearance-newtab-look-section';
import * as OPTIONS_APPEARANCE_OVERLAY_SECTION from './options-appearance-overlay-section';
import { listInstalledFonts } from './options-installed-fonts';
import * as OPTIONS_AGGREGATE_SEARCH_ACTIONS from './options-aggregate-search-actions';
import * as OPTIONS_AGGREGATE_SEARCH_LIST from './options-aggregate-search-list';
import * as AGGREGATE_SEARCH from './options-aggregate-search';
import * as OPTIONS_BLACKLIST_SECTION from './options-blacklist-section';
import * as LumnoOptionsBlacklist from './options-blacklist';
import * as LumnoOptionsFeedbackSupportSection from './options-feedback-support';
import * as OPTIONS_FORMS from './options-forms';
import * as OPTIONS_GENERAL_FEATURES_SECTION from './options-general-features-section';
import * as OPTIONS_GENERAL_GLOBAL_SECTION from './options-general-global-section';
import * as OPTIONS_GENERAL_NEWTAB_SECTION from './options-general-newtab-section';
import * as OPTIONS_GENERAL_OVERLAY_SECTION from './options-general-overlay-section';
import * as OPTIONS_GENERAL_SEARCH_SECTION from './options-general-search-section';
import * as OPTIONS_GENERAL_SHORTCUTS_SECTION from './options-general-shortcuts-section';
import * as OPTIONS_GENERAL_TAB from './options-general-tab';
import * as OPTIONS_LABS_SECTION from './options-labs-section';
import * as OPTIONS_LANGUAGE from './options-language';
import * as OPTIONS_NAVIGATION from './options-navigation';
import * as PANEL_MOTION from './options-panel-motion';
import * as LumnoOptionsSearchSourceOrder from './options-search-source-order';
import * as SETTING_BINDINGS from './options-setting-bindings';
import * as OPTIONS_SHORTCUT_REFERENCE from './options-shortcut-reference';
import * as OPTIONS_SHORTCUTS_SECTION from './options-shortcuts-section';
import * as OPTIONS_SEARCH_SHORTCUT_STATUS from './options-search-shortcut-status';
import * as OPTIONS_SITE_SEARCH_ACTIONS from './options-site-search-actions';
import * as OPTIONS_SITE_SEARCH_LIST from './options-site-search-list';
import * as SITE_SEARCH from './options-site-search';
import * as LumnoOptionsSyncTransfer from './options-sync-transfer';
import * as THEME from './options-theme';
import * as OPTIONS_UNSUPPORTED_SETTINGS from './options-unsupported-settings';
import * as OPTIONS_TOOLTIPS from './options-tooltips';
import * as LumnoOptionsTranslationHelpSection from './options-translation-help';
import * as LumnoBrowserProfile from '../platform/browser-profile';
import * as LumnoMessaging from '../platform/messaging';
import { getHtmlElement, queryHtmlElement, queryHtmlElements } from '../shared/dom-lookup';
import type { LayoutMutation } from './options-panel-motion';
import * as OPTIONS_STATE from './options-state';
import { getBlacklistTabApi } from './react/blacklist-tab';
import { getAccountTabApi } from './react/account-tab';
import { getShortcutsTabApi } from './react/shortcuts-tab';
import { createToastController } from '../shared/react/toast';
import { getSettingsControlsApi } from './react/settings-controls';
import { getSettingsNavigationApi } from './react/settings-navigation';
import { newtabShortcutsLocalOverflow } from '../domain/settings/newtab-shortcuts';
import * as ProviderStorage from '../platform/provider-storage';
import { SiteSearchProviders, isHelpCenterSearchEnabled } from './features/site-search/providers';
import { AggregateSearches } from './features/aggregate-search/searches';

(function() {
  const optionsRuntimeStartedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
  let optionsReadyMarked = false;

  function markOptionsPerformance(name: string): void {
    try {
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        performance.mark(name);
      }
    } catch (e) {
      // Performance markers are diagnostics only.
    }
  }

  markOptionsPerformance('lumno-options-runtime-start');
  if (document.documentElement) {
    document.documentElement.setAttribute('data-lumno-options-runtime-started', 'true');
  }

  const panel = getHtmlElement(document, '_x_extension_settings_panel_2024_unique_');
  const optionsRoot = getHtmlElement(document, '_x_extension_options_root_2024_unique_');
  const tabsRow = queryHtmlElement(document, '._x_extension_settings_tabs_row_2024_unique_');
  const tabButtons = queryHtmlElements(document, '._x_extension_settings_tab_button_2024_unique_');
  const tabContents = queryHtmlElements(document, '._x_extension_settings_content_2024_unique_');
  const tabsContainer = getHtmlElement(document, '_x_extension_settings_tabs_2024_unique_');
  const settingsVersion = getHtmlElement(document, '_x_extension_settings_version_2024_unique_');
  const toastElement = getHtmlElement(document, '_x_extension_toast_2024_unique_');
  if (!panel || !optionsRoot || tabButtons.length === 0) {
    return;
  }
  // The React views, set by the options islands bundle that loads first.
  const optionsBlacklistTabApi = getBlacklistTabApi();
  const optionsAccountTabApi = getAccountTabApi();
  const optionsShortcutsTabApi = getShortcutsTabApi();
  const optionsSettingsControlsApi = getSettingsControlsApi();
  const optionsSettingsNavigationApi = getSettingsNavigationApi();
  if (!optionsAccountTabApi || !optionsBlacklistTabApi || !optionsShortcutsTabApi ||
      !optionsSettingsControlsApi || !optionsSettingsNavigationApi) {
    console.warn('Lumno: options views not available.');
    return;
  }



  // Device-only values (the language copy, the shortcut overflow, WebDAV
  // status) and the local-to-sync migration always use chrome.storage.local,
  // whichever area holds the synced settings.
  const localStorageArea = chrome && chrome.storage ? chrome.storage.local || null : null;

  // The provider area, for the settings transfer on the Account tab.
  const { runtime: providerStorageRuntime, area: providerStorageArea } = ProviderStorage.getProviderStorage(chrome);
  // Page state shared with the parts of this page split out into
  // src/options/: each receives this one object as `optionsState` and reads
  // and writes the same properties this file does.
  const optionsSettingsStore = getContextSettingsStore(chrome, window);
  const siteSearchProviders = new SiteSearchProviders(optionsSettingsStore, (error) => {
    console.warn('[Lumno] Could not load site search providers.', error);
    showToast(getMessage('toast_error', '操作失败，请重试。'), true);
  });
  const aggregateSearches = new AggregateSearches(optionsSettingsStore, providerStorageRuntime, (error) => {
    console.warn('[Lumno] Could not load aggregate searches.', error);
    showToast(getMessage('toast_error', '操作失败，请重试。'), true);
  });
  const optionsState = OPTIONS_STATE.createOptionsState({
    providerStorageRuntime,
    settingsStore: optionsSettingsStore,
    panelHeightAnimator: PANEL_MOTION.createPanelHeightAnimator({
      documentObj: document,
      panel,
      reserveHost: optionsRoot,
      windowObj: window
    }),
    searchSourceOrderController: LumnoOptionsSearchSourceOrder.createSearchSourceOrderController({
      getMessage: (key, fallback) => getMessage(key, fallback),
      showToast: (message, isError) => showToast(message, isError),
      read: () => readStoredSetting(optionsSettingsStore, SETTINGS.searchSourceOrder),
      write: (value) => optionsSettingsStore.set(SETTINGS.searchSourceOrder, SETTINGS.searchSourceOrder.parse(value)),
      onChange() {
        if (siteSearchProviders.store.getSnapshot().loaded) {
          renderSiteSearchList();
        }
        renderAggregateSearchList();
        generalSearchSection.render();
      }
    }),
    tooltipController: LumnoTooltip.createController({
      documentObj: document,
      windowObj: window,
      id: '_x_extension_options_tooltip_2026_unique_',
      appendTo: document.body,
      maxWidth: 'min(360px, calc(100vw - 24px))'
    }),
    toastController: createToastController(toastElement, {
      windowObj: window,
      duration: 2200
    }),
    isMacPlatform: LumnoShortcutDisplay.getNavigatorPlatform(navigator) === 'mac'
  });


  // The settings tabs stay pinned at the top; a menu that flips upward must clear them.
  function getMenuViewportTopInset(): number {
    const tabsRect = tabsRow ? tabsRow.getBoundingClientRect() : null;
    return tabsRect ? Math.max(0, tabsRect.bottom + 8) : 8;
  }

  const {
    showTooltipFor,
    initTooltips,
    refreshCustomSelects,
    showToast,
    beginToast
  } = OPTIONS_TOOLTIPS.createTooltips({
    renderSettingsForms: (...args) => renderSettingsForms(...args),
    toastElement,
    optionsState
  });



  const siteSearchModel = SITE_SEARCH.createSiteSearchModel();
  // The provider or aggregate search already using a trigger key, ignoring
  // the provider key or aggregate id being edited.
  function findSiteSearchKeyConflict(key: string, allowedKey?: string, allowedAggregateId?: string) {
    const { defaults, custom } = siteSearchProviders.store.getSnapshot();
    return siteSearchModel.findSiteSearchKeyConflict(key, allowedKey || '', allowedAggregateId || '', {
      aggregateSearches: aggregateSearches.store.getSnapshot().items,
      providers: defaults.concat(custom)
    });
  }
  // The keys each list shows right now, in order, for the move buttons.
  const renderedSearchSourceKeys: Record<string, string[]> = {};

  const {
    getLocalizedBuiltinProviderName,
    getSiteSearchItemIconUrl,
    getSearchSourceReorderCopy,
    locateBuiltinSiteSearchProvider,
    renderSiteSearchList
  } = OPTIONS_SITE_SEARCH_LIST.createSiteSearchList({
    providers: siteSearchProviders,
    getMessage: (key, fallback) => getMessage(key, fallback),
    renderedSearchSourceKeys,
    initTooltips,
    scrollToOptionsTarget: (targetKey, options) => scrollToOptionsTarget(targetKey, options),
    optionsState
  });

  const {
    renderSettingsNavigation,
    setActiveTab,
    handleSettingsTabSelection,
    updateTabsStickyVisualState,
    scheduleOptionsScrollRefresh,
    scheduleOptionsViewportLayoutRefresh,
    getOptionsRouteState,
    scrollToOptionsTarget
  } = OPTIONS_NAVIGATION.createNavigation({
    getMessage: (...args) => getMessage(...args),
    tabContents,
    siteSearchProviders,
    tabsRow,
    optionsState
  });

  const siteSearchActions = OPTIONS_SITE_SEARCH_ACTIONS.createSiteSearchActions({
    providers: siteSearchProviders,
    getMessage: (key, fallback) => getMessage(key, fallback),
    showToast,
    hasKeyConflict: (key, allowedKey) => Boolean(findSiteSearchKeyConflict(key, allowedKey))
  });
  const aggregateSearchActions = OPTIONS_AGGREGATE_SEARCH_ACTIONS.createAggregateSearchActions({
    aggregates: aggregateSearches,
    providers: siteSearchProviders,
    getMessage: (key, fallback) => getMessage(key, fallback),
    showToast,
    hasKeyConflict: (key, currentId) => Boolean(findSiteSearchKeyConflict(key, '', currentId))
  });
  const aggregateSearchModel = AGGREGATE_SEARCH.createAggregateSearchModel();

  const {
    getMessage,
    normalizeLocale,
    getSystemLocale,
    applyLanguageMode,
    loadLanguageSetting,
    loadLocaleMessages
  } = OPTIONS_LANGUAGE.createLanguage({
    formatTemplate: (...args) => formatTemplate(...args),
    formatShortcutForDisplay: (...args) => formatShortcutForDisplay(...args),
    SETTINGS,
    renderFeedbackSupport,
    renderTranslationHelp,
    refreshCustomSelects,
    refreshSyncStatus,
    renderShortcutReferenceList: (...args) => renderShortcutReferenceList(...args),
    renderSettingsNavigation,
    onLanguageApplied: (mode, locale) => generalGlobalSection.setLanguage(mode, locale),
    renderTabSections: () => {
      generalGlobalSection.render();
      generalFeaturesSection.render();
      generalSearchSection.render();
      generalOverlaySection.render();
      generalNewtabSection.render();
      generalShortcutsSection.render();
      appearanceGlobalSection.render();
      appearanceOverlaySection.render();
      appearanceNewtabLookSection.render();
      dailyQuoteSection.render();
      appearanceNewtabLayoutSection.render();
      labsSection.render();
      blacklistSection.render();
    },
    renderSiteSearchList,
    renderAggregateSearchList: (...args) => renderAggregateSearchList(...args),
    optionsState
  });

  const {
    formatTemplate,
    renderSettingsForms
  } = OPTIONS_FORMS.createForms({
    getMessage,
    optionsState
  });

  const shortcutDisplay = LumnoShortcutDisplay;
  const generalTab = OPTIONS_GENERAL_TAB.createGeneralTab(optionsSettingsControlsApi.createGeneralTabController(
    queryHtmlElement(document, '._x_extension_settings_content_2024_unique_[data-content="general"]')
  ));
  const generalGlobalSection = OPTIONS_GENERAL_GLOBAL_SECTION.createGeneralGlobalSection({
    view: generalTab.global,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    runtime: chrome.runtime,
    getMessage,
    showToast,
    applyLanguage: (mode) => applyLanguageMode(mode, { persist: true }),
    getViewportTopInset: getMenuViewportTopInset
  });
  const feedbackSupportSection = LumnoOptionsFeedbackSupportSection.createFeedbackSupportSection({
    communityLinks: COMMUNITY_LINKS,
    controller: generalGlobalSection.feedback,
    licensesLink: generalGlobalSection.licensesLink,
    getLocale: () => (optionsState.currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(optionsState.currentLanguageMode)),
    getMessage,
    helpIconUrl: chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function'
      ? chrome.runtime.getURL('assets/images/site-search/glyph-lm.png')
      : '../../assets/images/site-search/glyph-lm.png',
    isHelpCenterSearchEnabled: () => isHelpCenterSearchEnabled(siteSearchProviders.store.getSnapshot()) === true
  });
  const translationHelpSection = LumnoOptionsTranslationHelpSection.createTranslationHelpSection({
    controller: generalGlobalSection.translationHelp,
    documentObj: document,
    formatTemplate: (...args) => formatTemplate(...args),
    getIssueUrl: () => COMMUNITY_LINKS.getLinks().githubIssue,
    getLocale: () => (optionsState.currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(optionsState.currentLanguageMode)),
    getMessage,
    loadLocaleMessages,
    uiLocales: SETTINGS.UI_LOCALES,
    version: chrome?.runtime?.getManifest?.()?.version || ''
  });


  // Drawn before the switches below are set up, which mark the rows this
  // browser cannot honor.
  const generalFeaturesSection = OPTIONS_GENERAL_FEATURES_SECTION.createGeneralFeaturesSection({
    view: generalTab.features,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    getMessage,
    browserFamily: document.documentElement.getAttribute('data-browser-family') || '',
    getAssetUrl: (path) => chrome.runtime.getURL(path),
    getViewportTopInset: getMenuViewportTopInset,
    getTabSwitcherShortcut: () => LumnoShortcutDisplay.formatShortcutChord('Alt+Q', {
      platform: optionsState.isMacPlatform ? 'mac' : 'windows'
    }) || (optionsState.isMacPlatform ? '⌥Q' : 'Alt+Q')
  });
  const generalShortcutsSection = OPTIONS_GENERAL_SHORTCUTS_SECTION.createGeneralShortcutsSection({
    view: generalTab.shortcuts,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    runtime: chrome.runtime,
    getMessage,
    showToast
  });
  const generalNewtabSection = OPTIONS_GENERAL_NEWTAB_SECTION.createGeneralNewtabSection({
    view: generalTab.newtab,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    getMessage
  });
  const generalOverlaySection = OPTIONS_GENERAL_OVERLAY_SECTION.createGeneralOverlaySection({
    view: generalTab.overlay,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    getMessage
  });
  const generalSearchSection = OPTIONS_GENERAL_SEARCH_SECTION.createGeneralSearchSection({
    view: generalTab.search,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    orderController: optionsState.searchSourceOrderController,
    getMessage,
    getViewportTopInset: getMenuViewportTopInset,
    hideTooltip: () => optionsState.tooltipController.hide()
  });
  const appearanceTab = OPTIONS_APPEARANCE_TAB.createAppearanceTab(optionsSettingsControlsApi.createAppearanceTabController(
    queryHtmlElement(document, '._x_extension_settings_content_2024_unique_[data-content="appearance"]')
  ));
  const appearanceGlobalSection = OPTIONS_APPEARANCE_GLOBAL_SECTION.createAppearanceGlobalSection({
    view: appearanceTab.global,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    getMessage,
    onTheme(mode, button) {
      playThemeOptionClickEffect(button);
      setThemeMode(mode);
    }
  });
  const appearanceOverlaySection = OPTIONS_APPEARANCE_OVERLAY_SECTION.createAppearanceOverlaySection({
    view: appearanceTab.overlay,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    getMessage,
    formatTemplate: (text, params) => formatTemplate(text, params),
    browserFamily: document.documentElement.getAttribute('data-browser-family') || '',
    listInstalledFonts,
    getViewportTopInset: getMenuViewportTopInset
  });
  const appearanceNewtabLookSection = OPTIONS_APPEARANCE_NEWTAB_LOOK_SECTION.createAppearanceNewtabLookSection({
    view: appearanceTab.newtabLook,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    getMessage,
    notifyNewtabSectionsRefresh: (section) => notifyNewtabSectionsRefresh(section),
    getViewportTopInset: getMenuViewportTopInset
  });
  // The daily quote mirrors the quote section of New Tab's appearance panel.
  const dailyQuoteSection = OPTIONS_DAILY_QUOTE_SECTION.createDailyQuoteSection({
    view: appearanceTab.dailyQuote,
    settings: SETTINGS,
    customQuotes: CUSTOM_QUOTES,
    getMessage,
    showToast: (message, isError) => showToast(message, isError),
    settingsStore: optionsState.settingsStore,
    getViewportTopInset: getMenuViewportTopInset
  });
  const appearanceNewtabLayoutSection = OPTIONS_APPEARANCE_NEWTAB_LAYOUT_SECTION.createAppearanceNewtabLayoutSection({
    view: appearanceTab.newtabLayout,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    getMessage,
    notifyNewtabSectionsRefresh: (section) => notifyNewtabSectionsRefresh(section)
  });
  const labsSection = OPTIONS_LABS_SECTION.createLabsSection({
    host: queryHtmlElement(document, '._x_extension_settings_content_2024_unique_[data-content="labs"]'),
    optionsSettingsControlsApi,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    getMessage,
    browserFamily: document.documentElement.getAttribute('data-browser-family') || ''
  });
  const blacklistSection = OPTIONS_BLACKLIST_SECTION.createBlacklistSection({
    host: queryHtmlElement(document, '._x_extension_settings_content_2024_unique_[data-content="blacklist"]'),
    blacklistTabApi: optionsBlacklistTabApi,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    blacklistModel: LumnoOptionsBlacklist.createBlacklistModel({
      blacklistUtils: LumnoBlacklistUtils
    }),
    getMessage,
    showToast,
    notifyNewtabSectionsRefresh,
    initTooltips
  });

  OPTIONS_UNSUPPORTED_SETTINGS.markBrowserUnsupportedSettings(getMessage);

  optionsState.settingsNavigationController = optionsSettingsNavigationApi.createSettingsNavigationController(tabsContainer, {
      onSelect: handleSettingsTabSelection
    });
  // Each Search sources list orders on its own; the record keys them by list.
  // The search source order list each site search list sorts by.
  function getSiteSearchListOptions(listId: 'custom' | 'site' | 'ai' | 'engine') {
    return {
      onLocateDuplicate: locateBuiltinSiteSearchProvider,
      onMove: (fromIndex: number, toIndex: number) => optionsState.searchSourceOrderController.moveListItem(
        listId,
        renderedSearchSourceKeys[listId] || [],
        fromIndex,
        toIndex
      ),
      onRemove: siteSearchActions.removeProvider,
      onSave: siteSearchActions.saveProvider
    };
  }
  const shortcutsSection = OPTIONS_SHORTCUTS_SECTION.createShortcutsSection({
    host: queryHtmlElement(document, '._x_extension_settings_content_2024_unique_[data-content="shortcuts"]'),
    shortcutsTabApi: optionsShortcutsTabApi,
    getMessage,
    orderController: optionsState.searchSourceOrderController,
    settingsStore: optionsState.settingsStore,
    SETTINGS,
    deriveLegacyAutoGroupEnabled: aggregateSearchModel.deriveLegacyAutoGroupEnabled,
    refreshCustomSelects,
    initTooltips,
    handlers: {
      custom: getSiteSearchListOptions('custom'),
      sites: getSiteSearchListOptions('site'),
      ai: getSiteSearchListOptions('ai'),
      engines: getSiteSearchListOptions('engine'),
      aggregate: {
        onMove: (fromIndex, toIndex) => optionsState.searchSourceOrderController.moveListItem(
          'aggregate',
          renderedSearchSourceKeys.aggregate || [],
          fromIndex,
          toIndex
        ),
        onRemove: aggregateSearchActions.removeAggregateSearch,
        onSave: aggregateSearchActions.saveAggregateSearch
      },
      onAddSiteSearch: siteSearchActions.addProvider,
      onClearCustom: siteSearchActions.clearCustomProviders,
      onClearAggregates: aggregateSearchActions.clearAggregateSearches,
      onResetBuiltin: siteSearchActions.resetBuiltinProviders
    }
  });
  optionsState.siteSearchCustomListController = shortcutsSection.customList;
  optionsState.siteSearchEngineBuiltinListController = shortcutsSection.enginesList;
  optionsState.siteSearchBuiltinListController = shortcutsSection.sitesList;
  optionsState.siteSearchAiBuiltinListController = shortcutsSection.aiList;
  const aggregateSearchListController = shortcutsSection.aggregateList;
  optionsState.siteSearchFormController = shortcutsSection.form;

  const syncTransfer = LumnoOptionsSyncTransfer.createSyncTransfer({
    deriveLegacyAutoGroupEnabled: aggregateSearchModel.deriveLegacyAutoGroupEnabled,
    settings: SETTINGS
  });
  // Each section binds its settings next to the code that renders it; the
  // page's settings store follows storage for all of them.
  const settingBinder = SETTING_BINDINGS.createSettingBinder({
    store: optionsState.settingsStore,
    refreshCustomSelects
  });

  // Once the bound settings are read and shown.
  function finishOptionsStartupRead(): void {
    optionsState.optionsStartupReadPending = false;
    const root = document.documentElement;
    if (optionsState.optionsStartupRefreshDeferred) {
      optionsState.optionsStartupRefreshDeferred = false;
      refreshCustomSelects({ force: true });
    }
    const markOptionsReady = () => {
      if (optionsReadyMarked) {
        return;
      }
      optionsReadyMarked = true;
      optionsState.optionsStartupRefreshCoalescing = false;
      if (optionsState.optionsStartupRefreshDeferred) {
        optionsState.optionsStartupRefreshDeferred = false;
        refreshCustomSelects({ force: true });
      }
      const readyAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
      if (root) {
        root.setAttribute('data-lumno-options-ready', 'true');
        root.setAttribute(
          'data-lumno-options-ready-ms',
          Math.max(0, readyAt - optionsRuntimeStartedAt).toFixed(2)
        );
        root.setAttribute(
          'data-lumno-options-ready-navigation-ms',
          Math.max(0, readyAt).toFixed(2)
        );
      }
      markOptionsPerformance('lumno-options-ready');
      try {
        if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
          performance.measure(
            'lumno-options-startup',
            'lumno-options-runtime-start',
            'lumno-options-ready'
          );
        }
      } catch (e) {
        // Performance measures are diagnostics only.
      }
    };
    // Ready means the startup values have been painted, so changes from here
    // on may animate: wait for the frame that paints them. A hidden page gets
    // no frames until it is shown and has nothing on screen to animate, so it
    // is ready as soon as the values are in.
    if (document.visibilityState === 'hidden' || typeof requestAnimationFrame !== 'function') {
      markOptionsReady();
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(markOptionsReady);
    });
  }


  function getActivePrimaryAreaName() {
    return optionsState.providerStorageRuntime.getActiveAreaName();
  }

  function animateOptionsPanelHeight(mutateLayout: LayoutMutation): boolean {
    return optionsState.panelHeightAnimator.animate(mutateLayout);
  }
  settingBinder.onChange(SETTINGS.searchSourceOrder, () => {
    optionsState.searchSourceOrderController.accept(optionsState.settingsStore.getStored(SETTINGS.searchSourceOrder));
  });
  optionsState.searchSourceOrderController.load();


  const { renderAggregateSearchList } = OPTIONS_AGGREGATE_SEARCH_LIST.createAggregateSearchList({
    aggregates: aggregateSearches,
    providers: siteSearchProviders,
    getMessage,
    getSiteSearchItemIconUrl,
    getLocalizedBuiltinProviderName,
    formatTemplate,
    aggregateSearchListController,
    renderedSearchSourceKeys,
    getSearchSourceReorderCopy,
    optionsState
  });
  aggregateSearches.store.subscribe(renderAggregateSearchList);



  function renderFeedbackSupport() {
    feedbackSupportSection.render();
  }

  renderFeedbackSupport();
  // The lists follow the providers; the help links only when the Help
  // Center search turns on or off.
  let helpCenterSearchShown: boolean | null = null;
  siteSearchProviders.store.subscribe(() => {
    renderSiteSearchList();
    renderAggregateSearchList();
    const helpCenterSearch = isHelpCenterSearchEnabled(siteSearchProviders.store.getSnapshot());
    if (helpCenterSearch !== helpCenterSearchShown) {
      helpCenterSearchShown = helpCenterSearch;
      renderFeedbackSupport();
    }
  });
  feedbackSupportSection.loadLinks();

  function renderTranslationHelp() {
    translationHelpSection.render();
  }

  renderTranslationHelp();


  function notifyNewtabSectionsRefresh(section: string): void {
    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    try {
      LumnoMessaging.sendPageMessage(chrome.runtime, 
        { action: 'lumno:newtab-refresh-sections', section: section || 'all' },
        () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            return;
          }
        }
      );
    } catch (error) {
      // Ignore runtime messaging errors.
    }
  }

  const accountSection = OPTIONS_ACCOUNT_SECTION.createAccountSection({
    host: getHtmlElement(document, '_x_extension_account_settings_content_2026_unique_'),
    accountTabApi: optionsAccountTabApi,
    sync: {
      beginToast,
      browserName: LumnoBrowserProfile.getBrowserInternalProfile(navigator).name || 'Chrome',
      chromeApi: chrome,
      documentObj: document,
      formatTemplate,
      getActivePrimaryAreaName,
      getMessage,
      localStorageArea,
      settings: SETTINGS,
      showToast,
      storageArea: providerStorageArea,
      syncTransfer
    },
    webdav: { chromeApi: chrome, getMessage },
    showTooltipFor
  });
  const syncSection = accountSection.syncSection;
  optionsState.webDavSettingsController = accountSection.webDavController;
  function refreshSyncStatus() {
    syncSection.refreshSyncStatus();
  }
  settingBinder.onChange(SETTINGS.webdavStatus, refreshSyncStatus);
  settingBinder.onChange(newtabShortcutsLocalOverflow, () => syncSection.refreshShortcutSyncSummary());
  settingBinder.onChange([SETTINGS.syncMeta, ...SETTINGS.BROWSER_SYNC_SETTINGS], refreshSyncStatus);

  settingBinder.onChange(SETTINGS.language, () => {
    applyLanguageMode(optionsState.settingsStore.get(SETTINGS.language));
  });

  const {
    formatShortcutForDisplay,
    renderShortcutReferenceList
  } = OPTIONS_SHORTCUT_REFERENCE.createShortcutReference({
    shortcutDisplay,
    shortcutReferenceController: generalShortcutsSection.referenceList,
    getMessage,
    formatTemplate,
    getHelpUrl: (slug, anchor) => COMMUNITY_LINKS.getHelpUrl(
      optionsState.currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(optionsState.currentLanguageMode),
      slug,
      anchor
    ),
    onTabSwitcherCtrlTabLinkChange: (link) => generalFeaturesSection.setCtrlTabLink(link),
    optionsState
  });

  optionsState.searchShortcutStatus = OPTIONS_SEARCH_SHORTCUT_STATUS.createSearchShortcutStatus({
    chromeApi: chrome,
    isMacPlatform: optionsState.isMacPlatform,
    formatShortcutForDisplay,
    getMessage,
    onChange: (label) => generalShortcutsSection.setStatus(label)
  });
  function loadCurrentShortcut(): void {
    if (optionsState.searchShortcutStatus) {
      optionsState.searchShortcutStatus.load();
    }
  }
  settingBinder.onChange(SETTINGS.fallbackShortcut, () => loadCurrentShortcut());

  if (settingsVersion && chrome?.runtime?.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (manifest?.version) {
      settingsVersion.textContent = `v${manifest.version}`;
    }
    function openSettingsVersionRelease(event: MouseEvent): void {
      event.preventDefault();
      event.stopPropagation();
      if (!chrome?.runtime?.sendMessage) {
        return;
      }
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'openReleasePage',
        reason: 'options-version',
        disposition: NAVIGATION_DISPOSITION.getDisposition(event, 'newTab')
      }, () => {
        if (chrome.runtime && chrome.runtime.lastError) {
          return;
        }
      });
    }
    settingsVersion.addEventListener('click', openSettingsVersionRelease);
    settingsVersion.addEventListener('auxclick', (event) => {
      if (!event || Number(event.button) !== 1) {
        return;
      }
      openSettingsVersionRelease(event);
    });
  }

  function updateOverlayPageThemeAdaptationVisibility(mode: unknown): void {
    const nextMode = mode === 'dark' || mode === 'light' ? mode : 'system';
    animateOptionsPanelHeight(() => {
      document.documentElement.setAttribute('data-options-theme-mode', nextMode);
      return appearanceOverlaySection.showThemeMode(nextMode);
    });
  }

  function setThemeMode(mode: unknown): void {
    if (optionsState.themeSection) {
      optionsState.themeSection.setMode(mode);
    }
  }

  function playThemeOptionClickEffect(button: Element | null): void {
    THEME.playThemeOptionClickEffect(button, window);
  }

  optionsState.themeSection = THEME.createThemeSection({
    documentObj: document,
    getMessage,
    onModeShown: updateOverlayPageThemeAdaptationVisibility,
    panel,
    picker: appearanceGlobalSection.themePicker,
    settings: SETTINGS,
    settingsStore: optionsState.settingsStore,
    windowObj: window
  });
  optionsState.themeSection.init();
  settingBinder.onChange(SETTINGS.themeMode, () => {
    if (optionsState.themeSection) {
      optionsState.themeSection.applyStorageChange(optionsState.settingsStore.get(SETTINGS.themeMode));
    }
  });


  initTooltips();

  function getInitialTabKey() {
    const routeState = getOptionsRouteState();
    return OPTIONS_NAVIGATION.normalizeSettingsTabKey(routeState.tabKey);
  }

  function getInitialOptionsTargetKey() {
    const routeState = getOptionsRouteState();
    return routeState.targetKey || '';
  }

  tabButtons.forEach((button) => {
    button.addEventListener('click', function() {
      handleSettingsTabSelection(button.getAttribute('data-tab') || '');
    });
  });

  const initialTab = getInitialTabKey();
  const initialOptionsTargetKey = getInitialOptionsTargetKey();
  optionsState.pendingOptionsScrollTarget = initialTab === 'shortcuts' ? initialOptionsTargetKey : '';
  setActiveTab(initialTab);
  if (initialTab === 'labs') {
    scrollToOptionsTarget(initialOptionsTargetKey, { behavior: 'auto', block: 'center', flash: true });
  }
  if (initialTab === 'shortcuts') {
    void siteSearchProviders.refresh();
  }
  window.addEventListener('scroll', scheduleOptionsScrollRefresh, { passive: true });
  updateTabsStickyVisualState();
  window.addEventListener('resize', scheduleOptionsViewportLayoutRefresh, { passive: true });
  optionsState.providerStorageRuntime.ready.then(() => {
    syncSection.migrateStorageIfNeeded(SETTINGS.BROWSER_SYNC_KEYS.slice());
    refreshSyncStatus();
  });



  loadCurrentShortcut();
  renderShortcutReferenceList();
  window.addEventListener('focus', () => {
    loadCurrentShortcut();
    renderShortcutReferenceList();
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadCurrentShortcut();
      renderShortcutReferenceList();
    }
  }, true);

  generalGlobalSection.bindSettings(settingBinder);
  generalFeaturesSection.bindSettings(settingBinder);
  generalSearchSection.bindSettings(settingBinder);
  generalOverlaySection.bindSettings(settingBinder);
  generalNewtabSection.bindSettings(settingBinder);
  generalShortcutsSection.bindSettings(settingBinder);
  appearanceGlobalSection.bindSettings(settingBinder);
  appearanceOverlaySection.bindSettings(settingBinder);
  appearanceNewtabLookSection.bindSettings(settingBinder);
  dailyQuoteSection.bindSettings(settingBinder);
  appearanceNewtabLayoutSection.bindSettings(settingBinder);
  labsSection.bindSettings(settingBinder);
  blacklistSection.bindSettings(settingBinder);
  shortcutsSection.bindSettings(settingBinder);
  loadLanguageSetting();
  void settingBinder.whenBound().then(finishOptionsStartupRead);

  refreshCustomSelects();

  aggregateSearches.followStorage();
  siteSearchProviders.followStorage();
  void siteSearchProviders.refresh();
  void aggregateSearches.refresh();
})();
