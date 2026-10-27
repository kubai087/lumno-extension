// The one state object options.ts shares with the modules split out of it:
// each module declares the slice it reads and writes, and this type is all
// of them together.
import type { SettingsStore } from '../platform/settings-store';
import type { ToastController } from '../shared/ui/toast-screen';
import type { TooltipController } from '../shared/ui/tooltip';
import type { AggregateSearchListState } from './options-aggregate-search-list';
import type { FormsState } from './options-forms';
import type { NavigationState } from './options-navigation';
import type { createPanelHeightAnimator } from './options-panel-motion';
import type { createSearchSourceOrderController } from './options-search-source-order';
import type { SiteSearchListState } from './options-site-search-list';
import type { TooltipsState } from './options-tooltips';
import type { ProviderStorageRuntime } from '../platform/settings-storage';

// What options.ts itself keeps beyond the modules' slices, and the full
// types of what the slices see only part of.
interface OptionsPageState {
  providerStorageRuntime: ProviderStorageRuntime;
  // The page's settings, read and followed through one store.
  settingsStore: SettingsStore;
  searchSourceOrderController: ReturnType<typeof createSearchSourceOrderController>;
  panelHeightAnimator: ReturnType<typeof createPanelHeightAnimator>;
  tooltipController: TooltipController;
}

type OptionsState =
  AggregateSearchListState &
  FormsState &
  NavigationState &
  SiteSearchListState &
  TooltipsState &
  OptionsPageState;

// What the state starts from: what the page made before it. Everything else
// starts empty or at its default.
interface OptionsStateParts {
  providerStorageRuntime: ProviderStorageRuntime;
  settingsStore: SettingsStore;
  panelHeightAnimator: ReturnType<typeof createPanelHeightAnimator>;
  searchSourceOrderController: ReturnType<typeof createSearchSourceOrderController>;
  tooltipController: TooltipController;
  toastController: ToastController | null;
}

function createOptionsState(parts: OptionsStateParts): OptionsState {
  return {
    // What the page made before the state.
    providerStorageRuntime: parts.providerStorageRuntime,
    settingsStore: parts.settingsStore,
    panelHeightAnimator: parts.panelHeightAnimator,
    searchSourceOrderController: parts.searchSourceOrderController,
    tooltipController: parts.tooltipController,
    toastController: parts.toastController,

    // Startup: select refreshes wait for the settings to be read.
    optionsStartupReadPending: true,
    optionsStartupRefreshCoalescing: true,
    optionsStartupRefreshDeferred: false,

    // Views made as the page mounts them.
    settingsNavigationController: null,
    siteSearchEngineBuiltinListController: null,
    siteSearchCustomListController: null,
    siteSearchBuiltinListController: null,
    siteSearchAiBuiltinListController: null,
    siteSearchFormController: null,

    // The page.
    currentActiveSettingsTab: 'general',
    // A linked setting to scroll to once the lists have rendered.
    pendingOptionsScrollTarget: ''
  };
}

export { createOptionsState };
export type { OptionsPageState, OptionsState, OptionsStateParts };
