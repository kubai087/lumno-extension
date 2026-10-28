// The one state object search-panel.ts shares with the panel's modules in
// overlay/panel/: each module declares the slice it reads and writes, and
// this type is all of them together.
import type { OverlayTab } from '../domain/messages';
import type { createImeKeyGuard } from '../domain/search/ime-key-guard';
import type { createSearchInputHistoryController } from '../domain/search/search-input-history';
import type { SuggestionInputPreview } from '../domain/search/suggestion-input-preview';
import type { ThemeVariant } from '../shared/favicon/favicon-theme';
import type { SearchInputParts } from '../shared/react/search-input';
import type { InputModeController } from '../shared/search/search-input-mode';
import type { CursorTooltipController } from '../shared/ui/cursor-tooltip-model';
import type { TooltipController } from '../shared/ui/tooltip';
import type { OverlayKeyRouter } from './keyboard';
import type { createSessionCleanupRegistry, createViewportSizeSync } from './lifecycle';
import type { createNoticeLayer } from './notices';
import type { EntryMotionState } from './panel/entry-motion';
import type { FaviconPolicyState } from './panel/favicon-policy';
import type { PanelKeysState } from './panel/panel-keys';
import type { PanelLanguageState } from './panel/panel-language';
import type { PanelNoticesState } from './panel/panel-notices';
import type { PanelSessionState } from './panel/panel-session';
import type { PanelThemeState } from './panel/panel-theme';
import type { RemoteSuggestionsState } from './panel/remote-suggestions';
import type { ResultActivationState } from './panel/result-activation';
import type { ResultsLayoutState } from './panel/results-layout';
import type { SearchInputEventsState } from './panel/search-input-events';
import type { SearchModeMenuState } from './panel/search-mode-menu';
import type { SearchModesState } from './panel/search-modes';
import type { SettingsSyncState } from './panel/settings-sync';
import type { SlashCommandsState } from './panel/slash-commands';
import type { SuggestionSourcesState } from './panel/suggestion-sources';
import type { SuggestionThemesState } from './panel/suggestion-themes';
import type { SuggestionsRenderState } from './panel/suggestions-render';
import type { TabMatchingState } from './panel/tab-matching';
import type { OverlaySettings } from './overlay-settings';
import type { RevealGate } from './site-fixes';

// What search-panel.ts itself keeps beyond the modules' slices, in full.
interface SearchPanelState {
  inputParts: SearchInputParts | null;
  inputModeController: InputModeController | null;
  inputHistoryController: ReturnType<typeof createSearchInputHistoryController> | null;
  imeKeyGuard: ReturnType<typeof createImeKeyGuard>;
  suggestionInputPreview: SuggestionInputPreview;
  overlayNoticeLayer: ReturnType<typeof createNoticeLayer>;
  overlayViewportSizeSync: ReturnType<typeof createViewportSizeSync>;
  overlaySessionCleanups: ReturnType<typeof createSessionCleanupRegistry>;
  // The session's settings, and what it follows of them until it closes.
  settings: OverlaySettings;
  overlayKeyRouter: OverlayKeyRouter | null;
  overlayRevealGate: RevealGate | null;
  topActionTooltipController: TooltipController | null;
  overlayCursorTooltipController: CursorTooltipController | null;
}

type OverlayState =
  EntryMotionState &
  FaviconPolicyState &
  PanelKeysState &
  PanelLanguageState<ThemeVariant> &
  PanelNoticesState &
  PanelSessionState &
  PanelThemeState &
  RemoteSuggestionsState &
  ResultActivationState &
  ResultsLayoutState &
  SearchInputEventsState &
  SearchModeMenuState &
  SearchModesState &
  SettingsSyncState &
  SlashCommandsState &
  SuggestionSourcesState &
  SuggestionThemesState &
  SuggestionsRenderState &
  TabMatchingState &
  SearchPanelState;

// What the state starts from: what the panel made before it, and what the
// open context said. Everything else starts empty or at its default.
interface OverlayStateParts {
  settings: SearchPanelState['settings'];
  overlaySessionCleanups: SearchPanelState['overlaySessionCleanups'];
  overlayNoticeLayer: SearchPanelState['overlayNoticeLayer'];
  overlayViewportSizeSync: SearchPanelState['overlayViewportSizeSync'];
  imeKeyGuard: SearchPanelState['imeKeyGuard'];
  suggestionInputPreview: SearchPanelState['suggestionInputPreview'];
  overlayMediaQuery: MediaQueryList;
  defaultTheme: ThemeVariant;
  urlHighlightTheme: ThemeVariant;
  // From the open context.
  prioritizeCurrentPageMatch: boolean;
  currentTabPinned: boolean;
  initialContextTabUrl: string;
  loadingSessionTrackingActive: boolean;
  documentPipEnabled: boolean;
  tabs: OverlayTab[];
  currentOverlayTabId: number | null;
}

function createOverlayState(parts: OverlayStateParts): OverlayState {
  return {
    // What the panel made before the state.
    settings: parts.settings,
    overlaySessionCleanups: parts.overlaySessionCleanups,
    overlayNoticeLayer: parts.overlayNoticeLayer,
    overlayViewportSizeSync: parts.overlayViewportSizeSync,
    imeKeyGuard: parts.imeKeyGuard,
    suggestionInputPreview: parts.suggestionInputPreview,
    overlayMediaQuery: parts.overlayMediaQuery,
    defaultTheme: parts.defaultTheme,
    urlHighlightTheme: parts.urlHighlightTheme,

    // From the open context.
    prioritizeCurrentPageMatch: parts.prioritizeCurrentPageMatch,
    currentTabPinned: parts.currentTabPinned,
    initialContextTabUrl: parts.initialContextTabUrl,
    loadingSessionTrackingActive: parts.loadingSessionTrackingActive,
    documentPipEnabled: parts.documentPipEnabled,
    tabs: parts.tabs,
    currentOverlayTabId: parts.currentOverlayTabId,
    overlayTabsCacheReady: parts.tabs.length > 0,

    // The panel's elements, made when it mounts.
    overlay: null,
    overlayPanelView: null,
    overlayStyleRoot: null,
    inputParts: null,
    searchInput: null,
    inputContainer: null,
    modeBadge: null,
    suggestionsContainer: null,

    // Controllers made later in the session.
    overlayContextToken: '',
    inputModeController: null,
    inputHistoryController: null,
    isApplyingSearchInputHistory: false,
    overlaySuggestionsView: null,
    overlayKeyRouter: null,
    overlayRevealGate: null,
    overlayUpdateNoticeController: null,
    overlayGraphicsNoticeController: null,
    overlayEngagementNoticeController: null,
    topActionTooltipController: null,
    overlayCursorTooltipController: null,
    overlayPageThemeObserver: null,
    overlayThemeMediaListener: null,
    clickOutsideHandler: null,
    overlayScrollPauseHandler: null,
    overlayWheelIsolationHandler: null,
    suppressOverlayLoadingSessionNotification: false,

    // Settings, at their defaults until storage answers.
    overlayThemeMode: 'system',
    defaultPlaceholderText: 'Search or enter URL…',

    lastRenderedQuery: '',
    lastRenderedActionContextKey: '',
    overlayRemoteSuggestionDebounceTimer: null,
    overlayFirstResultRevealTimer: null
  };
}

export { createOverlayState };
export type { OverlayState, OverlayStateParts };
