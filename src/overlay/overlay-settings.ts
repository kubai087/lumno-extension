// The settings an overlay session reads, through the settings store this
// content script world shares. What the session follows is released when it
// closes, so a closed overlay leaves no storage listener behind.
import type { Setting } from '../domain/settings/define';
import { motionEffectsEnabled, simpleModeEnabled, themeMode } from '../domain/settings/appearance';
import { documentPipEnabled } from '../domain/settings/features';
import { language } from '../domain/settings/locale';
import {
  overlayEnterAnimation,
  overlayFontFallback,
  overlayFontFamily,
  overlayOpenInCurrentTab,
  overlayOpenTabsDefaultVisible,
  overlayPageThemeAdaptationEnabled,
  overlaySizeMode,
  overlayTabPriority,
  overlayWidth
} from '../domain/settings/overlay-panel';
import {
  aggregateSearches,
  defaultSearchEngine,
  faviconEnhancedFetchEnabled,
  faviconRequestBlacklist,
  macosCtrlSuggestionNavigationEnabled,
  numberShortcutInstantEnabled,
  searchBlacklist,
  searchResultDisplayLimit,
  searchResultPriority,
  searchResultSourceTypes,
  searchSourceOrder,
  siteSearchCustom,
  siteSearchDisabled,
  tabRankScoreDebug
} from '../domain/settings/search';
import { createSettingsStore, getContextSettingsStore } from '../platform/settings-store';
import type { SettingsStore } from '../platform/settings-store';
import type { SettingsStoreChromeApi } from '../platform/settings-areas';
import type { SettingsListener } from '../platform/setting-values';

const OVERLAY_SETTINGS: readonly Setting<unknown>[] = Object.freeze([
  themeMode,
  language,
  motionEffectsEnabled,
  simpleModeEnabled,
  documentPipEnabled,
  overlayEnterAnimation,
  overlayFontFamily,
  overlayFontFallback,
  overlayOpenInCurrentTab,
  overlayOpenTabsDefaultVisible,
  overlayPageThemeAdaptationEnabled,
  overlaySizeMode,
  overlayTabPriority,
  overlayWidth,
  aggregateSearches,
  defaultSearchEngine,
  faviconEnhancedFetchEnabled,
  faviconRequestBlacklist,
  macosCtrlSuggestionNavigationEnabled,
  numberShortcutInstantEnabled,
  searchBlacklist,
  searchResultDisplayLimit,
  searchResultPriority,
  searchResultSourceTypes,
  searchSourceOrder,
  siteSearchCustom,
  siteSearchDisabled,
  tabRankScoreDebug
]);

interface OverlaySettings {
  readonly store: SettingsStore;
  // Settles once every overlay setting has been read.
  readonly loaded: Promise<void>;
  // Whether `loaded` has settled; until then get() answers the defaults.
  isLoaded(): boolean;
  get<T>(setting: Setting<T>): T;
  set<T>(setting: Setting<T>, value: T): Promise<void>;
  // Calls `listener` on changes until the session closes.
  follow(settings: Setting<unknown> | readonly Setting<unknown>[], listener: SettingsListener): void;
  // Stops everything follow() started.
  release(): void;
}

function createOverlaySettings(chromeApi: SettingsStoreChromeApi | null | undefined): OverlaySettings {
  const store = chromeApi
    ? getContextSettingsStore(chromeApi)
    : createSettingsStore({ chromeApi: null, settings: [] });
  let settled = false;
  const loaded = store.include(OVERLAY_SETTINGS).finally(() => {
    settled = true;
  });
  const unsubscribes: Array<() => void> = [];
  return Object.freeze({
    store,
    loaded,
    isLoaded: () => settled,
    get: <T>(setting: Setting<T>) => store.get(setting),
    set: <T>(setting: Setting<T>, value: T) => store.set(setting, value),
    follow(settings: Setting<unknown> | readonly Setting<unknown>[], listener: SettingsListener) {
      // Once the session follows anything, it follows every overlay setting,
      // so what the store holds stays current until it closes.
      if (!unsubscribes.length) unsubscribes.push(store.subscribe(OVERLAY_SETTINGS, () => {}));
      unsubscribes.push(store.subscribe(settings, listener));
    },
    release() {
      unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
    }
  });
}

export { OVERLAY_SETTINGS, createOverlaySettings };
export type { OverlaySettings };
