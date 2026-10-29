// The content above the search box: the quote, and the wordmark or clock
// with its settings, its clock face and its entry animation.
import * as LumnoNewtabQuotes from '../../top-content/quotes';
import * as NEWTAB_TOP_CONTENT_RUNTIME from '../../top-content/top-content';
import { adaptiveToneEvents } from '../../wallpaper/tone-requests';
import type { PageContext } from '../../app/context';
import type { ServicesPart } from '../shell/services';
import type { NavigationPart } from '../shell/navigation';
import type { RecentCorePart } from '../sources/recent-core';
import type { LayoutPart } from './layout';

interface TopContentPartDeps {
  shell: ServicesPart;
  navigation: NavigationPart;
  recentCore: RecentCorePart;
  layout: LayoutPart;
}

function createTopContentPart(ctx: PageContext, deps: TopContentPartDeps) {
  const { localStorageArea, locale, preview, root, settings, t } = ctx;
  const shortcutSection = ctx.structure.shortcut.section;
  const topContentContainer = ctx.structure.topContent;
  const { appliedTheme, showToast, topActionTooltipController } = deps.shell;
  const { openExternalNewTabUrl } = deps.navigation;
  const { recentCards } = deps.recentCore;
  const {
    updateBookmarkSectionPosition,
    updateSearchEntryLayout,
    updateSuggestionsFloatingLayout
  } = deps.layout;

  const quoteRuntime = LumnoNewtabQuotes.createRuntime({
    documentObj: document, windowObj: window,
    settings, localStorageArea, t, showToast,
    locale,
    getSearchRoot: () => root,
    getShortcutSection: () => shortcutSection,
    getTooltipController: () => topActionTooltipController,
    onLayout: () => window.requestAnimationFrame(() => {
      updateBookmarkSectionPosition();
      adaptiveToneEvents.emit('stale', {});
    })
  });

  const {
    captureRecentCardLayout,
    cancelRecentResizeLayoutAnimations,
    shouldSkipNewtabEntryMotion,
    shouldAnimateNewtabLayoutShift,
    animateRecentResizeLayout,
    applyNewtabTopContentVisibility,
    finishWordmarkEntryAnimation,
    renderNewtabTopContent,
    followTopContentSettings
  } = NEWTAB_TOP_CONTENT_RUNTIME.createTopContentRuntime({
    appliedTheme,
    locale,
    topContentContainer,
    openExternalNewTabUrl,
    recentCards,
    updateSearchEntryLayout,
    updateSuggestionsFloatingLayout,
    settings,
    preview
  });
  // Settles once the stored clock face has loaded, so the first reveal never
  // draws the clock in a fallback face.
  const initialTimeFontReadyTask = followTopContentSettings();

  return {
    animateRecentResizeLayout,
    applyNewtabTopContentVisibility,
    cancelRecentResizeLayoutAnimations,
    captureRecentCardLayout,
    finishWordmarkEntryAnimation,
    initialTimeFontReadyTask,
    quoteRuntime,
    renderNewtabTopContent,
    shouldAnimateNewtabLayoutShift,
    shouldSkipNewtabEntryMotion
  };
}

type TopContentPart = ReturnType<typeof createTopContentPart>;

export { createTopContentPart };
export type { TopContentPart };
