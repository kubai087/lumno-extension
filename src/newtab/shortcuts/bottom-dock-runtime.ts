// Creates the bottom shortcut dock and the layout motion that moves the
// page's blocks when the dock, sections or search entry change size.
import * as LumnoNewtabLayoutMotion from '../layout-motion';
import type { LayoutController } from '../layout';
import type { LayoutMotion } from '../layout-motion';
import { createDock } from '../react/dock';
import { NEWTAB_MOBILE_FLOW_BREAKPOINT_PX } from '../newtab-config';
import type { ViewportActivity } from '../viewport-activity';
import type { SearchBoxParts } from '../search/search-box-parts';
import type { PageNoticeControllers } from '../notice-controllers';

// A part of the page that may show an element of its own.

interface BottomDockRuntimeState {
  topContentContainer: HTMLElement | null;
  shortcutSection: HTMLElement | null;
  recentSection: HTMLElement | null;
  bottomDockScroller: HTMLElement | null;
  layoutController: LayoutController | null;
  layoutMotion: LayoutMotion | null;
  // While the window is resized the layout does not animate.
}

interface BottomDockRuntimeDeps {
  root: HTMLElement;
  bookmarkSection: HTMLElement | null;
  suggestionsSurface: HTMLElement | null;
  suggestionsOutline: HTMLElement | null;
  getNewtabTopOccupiedInsetPx(): number;
  shouldAnimateNewtabLayoutShift(): boolean;
  applyNewtabWidthMode(): void;
  viewport: Pick<ViewportActivity, 'locked'>;
  searchBox: Pick<SearchBoxParts, 'inputParts'>;
  suggestionsContainer: HTMLElement;
  searchLayer: HTMLElement;
  notices: Pick<PageNoticeControllers, 'engagement' | 'update'>;
  quoteRuntime: { element: HTMLElement | null };
  pageState: BottomDockRuntimeState;
}

function createBottomDockRuntime(deps: BottomDockRuntimeDeps) {
  const {
    quoteRuntime,
    searchLayer,
    suggestionsContainer,
    searchBox,
    root,
    bookmarkSection,
    suggestionsSurface,
    suggestionsOutline,
    getNewtabTopOccupiedInsetPx,
    shouldAnimateNewtabLayoutShift,
    applyNewtabWidthMode,
    viewport,
    notices
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  const recentSection = pageState.recentSection;
  if (!bookmarkSection || !recentSection) {
    throw new Error('The New Tab dock, bookmark or recent section is unavailable.');
  }
  const SEARCH_LAYOUT_MIN_TOP_PX = 28;
  const SEARCH_LAYOUT_MIN_BOTTOM_PX = 20;
  const SEARCH_LAYOUT_UPSHIFT_RATIO = 0.06;
  const SEARCH_LAYOUT_UPSHIFT_MIN_PX = 24;
  const SEARCH_LAYOUT_UPSHIFT_MAX_PX = 80;
  const SEARCH_LAYOUT_CONTENT_SECTIONS_EXTRA_UPSHIFT_PX = 20;
  const SEARCH_LAYOUT_EMPTY_SECTIONS_EXTRA_UPSHIFT_PX = 96;
  const SEARCH_LAYOUT_NARROW_VIEWPORT_MIN_WIDTH_PX = 520;
  const SEARCH_LAYOUT_NARROW_VIEWPORT_MAX_WIDTH_PX = 1440;
  const SEARCH_LAYOUT_NARROW_TOP_INSET_PX = 16;
  const SEARCH_LAYOUT_NARROW_TOP_INSET_TRANSITION_PX = 64;
  const SEARCH_LAYOUT_SHORT_VIEWPORT_MAX_HEIGHT_PX = 680;
  const SEARCH_LAYOUT_SHORT_MIN_TOP_PX = 44;

  const bottomDockRuntime = createDock({
    documentObj: document,
    windowObj: window,
    root,
    searchLayer: () => searchLayer,
    inputParts: () => searchBox.inputParts,
    topContentContainer: () => pageState.topContentContainer,
    shortcutSection: () => pageState.shortcutSection,
    quoteSection: () => quoteRuntime.element,
    bookmarkSection,
    recentSection,
    suggestionsContainer: suggestionsContainer,
    suggestionsSurface,
    suggestionsOutline,
    getTopInsetPx: getNewtabTopOccupiedInsetPx,
    constants: {
      minTopPx: SEARCH_LAYOUT_MIN_TOP_PX,
      minBottomPx: SEARCH_LAYOUT_MIN_BOTTOM_PX,
      upshiftRatio: SEARCH_LAYOUT_UPSHIFT_RATIO,
      upshiftMinPx: SEARCH_LAYOUT_UPSHIFT_MIN_PX,
      upshiftMaxPx: SEARCH_LAYOUT_UPSHIFT_MAX_PX,
      contentSectionsExtraUpshiftPx: SEARCH_LAYOUT_CONTENT_SECTIONS_EXTRA_UPSHIFT_PX,
      emptySectionsExtraUpshiftPx: SEARCH_LAYOUT_EMPTY_SECTIONS_EXTRA_UPSHIFT_PX,
      narrowViewportMinWidthPx: SEARCH_LAYOUT_NARROW_VIEWPORT_MIN_WIDTH_PX,
      narrowViewportMaxWidthPx: SEARCH_LAYOUT_NARROW_VIEWPORT_MAX_WIDTH_PX,
      narrowTopInsetPx: SEARCH_LAYOUT_NARROW_TOP_INSET_PX,
      narrowTopInsetTransitionPx: SEARCH_LAYOUT_NARROW_TOP_INSET_TRANSITION_PX,
      shortViewportMaxHeightPx: SEARCH_LAYOUT_SHORT_VIEWPORT_MAX_HEIGHT_PX,
      shortMinTopPx: SEARCH_LAYOUT_SHORT_MIN_TOP_PX,
      mobileFlowBreakpointPx: NEWTAB_MOBILE_FLOW_BREAKPOINT_PX
    }
  });
  const bottomDock = bottomDockRuntime.element;
  pageState.bottomDockScroller = bottomDockRuntime.scroller;
  pageState.layoutController = bottomDockRuntime.layoutController;
  // The dock moves as a whole when its sections slide together.
  pageState.layoutMotion = LumnoNewtabLayoutMotion.createLayoutMotion({
    documentObj: document,
    windowObj: window,
    getTargets: () => [
      { key: 'topContent', element: pageState.topContentContainer },
      { key: 'search', element: root },
      { key: 'shortcuts', element: pageState.shortcutSection },
      { key: 'quote', element: quoteRuntime.element },
      { key: 'updateNotice', element: notices.update && notices.update.element },
      {
        key: 'engagementNotice',
        element: notices.engagement && notices.engagement.element
      },
      { key: 'bookmarks', element: bookmarkSection, mover: bottomDock },
      { key: 'recent', element: recentSection, mover: bottomDock }
    ],
    canAnimate: () => shouldAnimateNewtabLayoutShift() &&
      !viewport.locked &&
      document.visibilityState === 'visible' &&
      document.documentElement.getAttribute('data-lumno-motion-effects') !== 'off'
  });
  applyNewtabWidthMode();

  return {
    bottomDockRuntime,
    bottomDock
  };
}

export { createBottomDockRuntime };
export type { BottomDockRuntimeDeps, BottomDockRuntimeState };
