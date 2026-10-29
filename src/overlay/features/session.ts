// The session's holders and guards: the notices, toast, last drawn query and
// theme mode, the size preset, the page guards against translation and input
// extensions, the notice layer and viewport sync, the IME guard, the default
// themes, the tab matching and the entry motion.
import { OverlayToast } from '../panel/overlay-toast';
import { createDefaultTheme, createUrlHighlightTheme } from '../../shared/favicon/favicon-theme';
import * as LumnoImeKeyGuard from '../../domain/search/ime-key-guard';
import * as SUGGESTION_INPUT_PREVIEW from '../../domain/search/suggestion-input-preview';
import * as SETTINGS from '../../domain/settings';
import * as LumnoOverlayLifecycle from '../lifecycle';
import * as OVERLAY_NOTICES from '../notices';
import * as PANEL_ENTRY_MOTION from '../panel/entry-motion';
import * as PANEL_PAGE_GUARDS from '../panel/page-guards';
import { OverlayNotices } from '../panel/overlay-notices';
import { LastRender } from '../panel/last-render';
import { OverlayThemeMode } from '../panel/overlay-theme-mode';
import * as PANEL_TAB_MATCHING from '../panel/tab-matching';
import * as OVERLAY_CONTEXT from '../overlay-context';
import type { OverlaySizePreset } from '../lifecycle';
import { overlaySizeMode, overlayWidth } from '../../domain/settings/overlay-panel';
import type { OverlayContext } from '../app/context';

function createSessionFeature(ctx: OverlayContext) {
  const { openOptions, overlayTabs, settings } = ctx;

  const shouldIgnoreTabZoomCompensation = OVERLAY_CONTEXT.isLocalFileLikeUrl(openOptions.currentTabUrl);
  // The session's parts that hold what it shows and lists.
  const notices = new OverlayNotices();
  // The toast, drawn once the panel mounts its element.
  const overlayToast = new OverlayToast();
  const lastRender = new LastRender();
  const overlayThemeChoice = new OverlayThemeMode();
  // A custom width replaces the size's own; the size keeps its height cap
  // and content scale.
  function getOverlaySizePreset(mode: unknown): OverlaySizePreset {
    const preset = SETTINGS.getOverlaySizePreset(mode);
    const customWidth = SETTINGS.overlayWidth.parse(settings.get(overlayWidth));
    return customWidth ? { ...preset, width: customWidth } : preset;
  }

  const {
    applyOverlayInputExtensionIsolation,
    applyNoTranslate,
    applyNoTranslateDeep,
    stopOverlayAntiTranslateObserver,
    pauseOverlayAntiTranslateObserverForScroll,
    pauseOverlayAntiTranslateObserverForMutationBurst,
    startOverlayAntiTranslateObserver
  } = PANEL_PAGE_GUARDS.createPageGuards({
    window
  });

  const overlayNoticeLayer = OVERLAY_NOTICES.createNoticeLayer(window, {
    getUpdateNotice: () => notices.update,
    getGraphicsNotice: () => notices.graphics,
    getEngagementNotice: () => notices.engagement,
    getSizePreset: () => getOverlaySizePreset(settings.get(overlaySizeMode)),
    decorate: applyNoTranslateDeep
  });
  const overlayViewportSizeSync = LumnoOverlayLifecycle.createViewportSizeSync(window, {
    getSizePreset: () => getOverlaySizePreset(settings.get(overlaySizeMode)),
    getRequestedTabZoomFactor: () => openOptions.tabZoomFactor,
    shouldIgnoreTabZoomCompensation: () => shouldIgnoreTabZoomCompensation
  });
  const imeKeyGuard = LumnoImeKeyGuard.createImeKeyGuard();
  const suggestionInputPreview = SUGGESTION_INPUT_PREVIEW.createSuggestionInputPreview();
  const overlayMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const defaultTheme = createDefaultTheme();
  const urlHighlightTheme = createUrlHighlightTheme();
  const {
    shouldSwitchMatchedTabSuggestion,
    getUrlDisplay,
    filterTabsForOverlay,
    getMatchedOpenTabIdForSuggestion,
    isCurrentOverlayTabUrl
  } = PANEL_TAB_MATCHING.createTabMatching({
    settings,
    overlayTabs,
    initialContextTabUrl: openOptions.currentTabUrl,
    prioritizeCurrentPageMatch: openOptions.prioritizeCurrentPageMatch
  });

  const overlayFrameTracker = LumnoOverlayLifecycle.createFrameTracker(window);

  const {
    shouldSkipOverlayEntryMotion,
    shouldSkipOverlayEntryMotionForSlowStartup,
    getOverlayEnterAnimationRevealTransform,
    clearOverlayPanelEnterCleanup,
    finishOverlayPanelEnterAnimation,
    applyOverlayEnterAnimationInitialState,
    playOverlayPanelEnterAnimation,
    clearOverlayEnterAnimationFrames
  } = PANEL_ENTRY_MOTION.createEntryMotion({
    settings,
    initialOverlayOpenStartedAt: openOptions.openedAt,
    overlayFrameTracker
  });

  return {
    applyNoTranslate,
    applyNoTranslateDeep,
    applyOverlayEnterAnimationInitialState,
    applyOverlayInputExtensionIsolation,
    clearOverlayEnterAnimationFrames,
    clearOverlayPanelEnterCleanup,
    defaultTheme,
    filterTabsForOverlay,
    finishOverlayPanelEnterAnimation,
    getMatchedOpenTabIdForSuggestion,
    getOverlayEnterAnimationRevealTransform,
    getOverlaySizePreset,
    getUrlDisplay,
    imeKeyGuard,
    isCurrentOverlayTabUrl,
    lastRender,
    notices,
    overlayFrameTracker,
    overlayMediaQuery,
    overlayNoticeLayer,
    overlayThemeChoice,
    overlayToast,
    overlayViewportSizeSync,
    pauseOverlayAntiTranslateObserverForMutationBurst,
    pauseOverlayAntiTranslateObserverForScroll,
    playOverlayPanelEnterAnimation,
    shouldSkipOverlayEntryMotion,
    shouldSkipOverlayEntryMotionForSlowStartup,
    shouldSwitchMatchedTabSuggestion,
    startOverlayAntiTranslateObserver,
    stopOverlayAntiTranslateObserver,
    suggestionInputPreview,
    urlHighlightTheme
  };
}

type SessionFeature = ReturnType<typeof createSessionFeature>;

export { createSessionFeature };
export type { SessionFeature };
