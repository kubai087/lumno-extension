// The Options page's entry, an ES module that runs once the markup is
// parsed: it makes the page's owners, draws the one root over the static
// skeleton theme-preload.ts painted, then starts what follows storage and
// marks the page ready once its settings are read.
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as SETTINGS from '../../domain/settings';
import * as LumnoShortcutDisplay from '../../domain/shortcut-display';
import * as LumnoBrowserProfile from '../../platform/browser-profile';
import * as ProviderStorage from '../../platform/provider-storage';
import { getContextSettingsStore, readStoredSetting } from '../../platform/settings-store';
import type { SettingsStore } from '../../platform/settings-store';
import { createToastController } from '../../shared/react/toast';
import * as LumnoTooltip from '../../shared/ui/tooltip';
import { Account } from '../features/account/account';
import { AggregateSearches } from '../features/aggregate-search/searches';
import { APPEARANCE_TAB_SETTINGS } from '../features/appearance/appearance-tab';
import { PageTheme } from '../features/appearance/page-theme';
import { BLACKLIST_TAB_SETTINGS } from '../features/blacklist/blacklist-tab';
import { GENERAL_TAB_SETTINGS } from '../features/general/general-tab';
import { LABS_TAB_SETTINGS } from '../features/labs/labs-tab';
import { OptionsLocale } from '../features/language/locale';
import { OptionsNavigation } from '../features/navigation/navigation';
import { SEARCH_SOURCES_TAB_SETTINGS } from '../features/search-sources/search-sources-tab';
import { BrowserCommands } from '../features/shortcuts/browser-commands';
import { SiteSearchProviders } from '../features/site-search/providers';
import { formatTemplate } from '../format-template';
import { createAggregateSearchModel } from '../options-aggregate-search';
import { createSearchSourceOrderController } from '../options-search-source-order';
import { createSyncTransfer } from '../options-sync-transfer';
import type { OptionsPage } from './context';
import { createPageFeedback } from './feedback';
import { notifyNewtab } from './notify-newtab';
import { PanelMotion } from './panel-motion';
import { OptionsApp } from './root';
import { markReadyOnceRead, markRuntimeStart } from './startup';
import { getTabsRowInset } from '../dom/sticky-tabs';

type PageFeedback = ReturnType<typeof createPageFeedback>;

function createFeedback(): PageFeedback {
  const toastElement = document.getElementById('_x_extension_toast_2024_unique_');
  return createPageFeedback({
    doc: document,
    tooltip: LumnoTooltip.createController({
      documentObj: document,
      windowObj: window,
      id: '_x_extension_options_tooltip_2026_unique_',
      appendTo: document.body,
      maxWidth: 'min(360px, calc(100vw - 24px))'
    }),
    toast: createToastController(toastElement, { windowObj: window, duration: 2200 }),
    toastElement
  });
}

function createAccount(
  settingsStore: SettingsStore,
  locale: OptionsLocale,
  feedback: PageFeedback,
  providerStorage: ReturnType<typeof ProviderStorage.getProviderStorage>
): Account {
  return new Account({
    sync: {
      beginToast: feedback.beginToast,
      browserName: LumnoBrowserProfile.getBrowserInternalProfile(navigator).name || 'Chrome',
      chromeApi: chrome,
      documentObj: document,
      formatTemplate,
      getActivePrimaryAreaName: () => providerStorage.runtime.getActiveAreaName(),
      getMessage: locale.getMessage,
      localStorageArea: chrome.storage ? chrome.storage.local || null : null,
      settings: SETTINGS,
      showToast: feedback.showToast,
      storageArea: providerStorage.area,
      syncTransfer: createSyncTransfer({
        deriveLegacyAutoGroupEnabled: createAggregateSearchModel().deriveLegacyAutoGroupEnabled,
        settings: SETTINGS
      })
    },
    webdav: { chromeApi: chrome, getMessage: locale.getMessage },
    settingsStore,
    locale,
    showTooltipFor: feedback.showTooltipFor
  });
}

// The page's owners and the context every view reads them from.
function createPage(host: HTMLElement) {
  const settingsStore = getContextSettingsStore(chrome, window);
  const locale = new OptionsLocale(settingsStore);
  const feedback = createFeedback();
  const showLoadError = (what: string) => (error: unknown) => {
    console.warn(`[Lumno] Could not load ${what}.`, error);
    feedback.showToast(locale.getMessage('toast_error', '操作失败，请重试。'), true);
  };
  // The provider area holds the synced settings; the settings transfer and
  // the aggregate searches' byte budget depend on which it is.
  const providerStorage = ProviderStorage.getProviderStorage(chrome);
  const siteSearchProviders = new SiteSearchProviders(settingsStore, showLoadError('site search providers'));
  const panelMotion = new PanelMotion();
  const navigation = new OptionsNavigation({
    win: window,
    doc: document,
    cancelPanelMotion: () => panelMotion.cancel(),
    onSearchSourcesOpened: () => void siteSearchProviders.refresh()
  });
  const page: OptionsPage = {
    settingsStore,
    locale,
    commands: new BrowserCommands(),
    siteSearchProviders,
    aggregateSearches: new AggregateSearches(settingsStore, providerStorage.runtime, showLoadError('aggregate searches')),
    sourceOrder: createSearchSourceOrderController({
      getMessage: locale.getMessage,
      showToast: feedback.showToast,
      read: () => readStoredSetting(settingsStore, SETTINGS.searchSourceOrder),
      write: (value) => settingsStore.set(SETTINGS.searchSourceOrder, SETTINGS.searchSourceOrder.parse(value))
    }),
    pageTheme: new PageTheme(settingsStore, { doc: document, win: window, animatePanel: (mutate) => panelMotion.animate(mutate) }),
    account: createAccount(settingsStore, locale, feedback, providerStorage),
    showToast: feedback.showToast,
    notifyNewtab,
    hideTooltip: feedback.hideTooltip,
    bindTooltips: feedback.bindTooltips,
    onSearchSourcesDrawn: () => navigation.scrollToPendingTarget(),
    getViewportTopInset: () => getTabsRowInset(host),
    isMacPlatform: LumnoShortcutDisplay.getNavigatorPlatform(navigator) === 'mac',
    browserFamily: document.documentElement.getAttribute('data-browser-family') || ''
  };
  return { page, navigation, panelMotion, providerStorage };
}

// Everything that follows storage, the browser or the address starts once
// the root is drawn.
function follow(page: OptionsPage, navigation: OptionsNavigation, providerStorage: ReturnType<typeof ProviderStorage.getProviderStorage>): void {
  const { settingsStore, sourceOrder, commands } = page;
  navigation.start();
  page.pageTheme.start();
  page.locale.follow();
  page.account.start(providerStorage.runtime);
  commands.follow(window, document);
  // The search shortcut falls back to another chord when the browser has none.
  settingsStore.subscribe(SETTINGS.fallbackShortcut, () => commands.load());
  settingsStore.subscribe(SETTINGS.searchSourceOrder, () => sourceOrder.accept(settingsStore.getStored(SETTINGS.searchSourceOrder)));
  void sourceOrder.load();
  page.aggregateSearches.followStorage();
  page.siteSearchProviders.followStorage();
  void page.siteSearchProviders.refresh();
  void page.aggregateSearches.refresh();
  page.bindTooltips();
}

function start(host: HTMLElement): void {
  const startedAt = markRuntimeStart(document);
  const { page, navigation, panelMotion, providerStorage } = createPage(host);
  const root = createRoot(host);
  flushSync(() => {
    root.render(createElement(OptionsApp, { page, navigation, panelMotion, host }));
  });
  follow(page, navigation, providerStorage);
  markReadyOnceRead(page.settingsStore.include([
    ...GENERAL_TAB_SETTINGS,
    ...APPEARANCE_TAB_SETTINGS,
    ...SEARCH_SOURCES_TAB_SETTINGS,
    ...BLACKLIST_TAB_SETTINGS,
    ...LABS_TAB_SETTINGS,
    SETTINGS.searchSourceOrder,
    SETTINGS.language,
    SETTINGS.themeMode
  ]), document, window, startedAt);
}

const host = document.getElementById('_x_extension_options_root_2024_unique_');
if (host && globalThis.chrome) {
  start(host);
}
