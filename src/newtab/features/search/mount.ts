// Puts the page together once its parts exist: the top content, the search
// layer, the shortcuts, the notices and results in the document, the
// wallpaper and feedback controls with their outside presses, the bookmark
// bar and the dock, and the window events the parts follow from then on.
import { isNode } from '../../../shared/dom-guards';
import { adaptiveToneEvents } from '../../wallpaper/tone-requests';
import type { PageContext } from '../../app/context';
import type { ServicesPart } from '../shell/services';
import type { BookmarkStorePart } from '../stores/bookmark-store';
import type { NavigationPart } from '../shell/navigation';
import type { BookmarkMenusPart } from '../menus/bookmark-menus';
import type { ThemePart } from '../appearance/theme';
import type { TopContentPart } from '../appearance/top-content';
import type { WallpaperPart } from '../appearance/wallpaper';
import type { DragsPart } from '../sections/drags';
import type { SectionViewsPart } from '../sections/section-views';
import type { SearchUiPart } from './search-ui';

interface MountPartDeps {
  shell: ServicesPart;
  bookmarkStore: BookmarkStorePart;
  navigation: NavigationPart;
  bookmarkMenus: BookmarkMenusPart;
  theme: ThemePart;
  topContent: TopContentPart;
  wallpaper: WallpaperPart;
  drags: DragsPart;
  sectionViews: SectionViewsPart;
  searchUi: SearchUiPart;
}

function createMountPart(ctx: PageContext, deps: MountPartDeps) {
  const { locale, root } = ctx;
  const searchLayer = ctx.structure.searchLayer;
  const shortcutSection = ctx.structure.shortcut.section;
  const suggestionsContainer = ctx.structure.suggestions.container;
  const suggestionsOutline = ctx.structure.suggestions.outline;
  const suggestionsSurface = ctx.structure.suggestions.surface;
  const topContentContainer = ctx.structure.topContent;
  const { dismissStack } = deps.shell;
  const { bookmarkParts } = deps.bookmarkStore;
  const { closeFeedbackPopover, createFeedbackControls, isFeedbackPopoverOpen } = deps.navigation;
  const { positionBookmarkCascadeLevels } = deps.bookmarkMenus;
  const { notices } = deps.theme;
  const {
    applyNewtabTopContentVisibility,
    quoteRuntime,
    renderNewtabTopContent,
    shouldSkipNewtabEntryMotion
  } = deps.topContent;
  const { wallpaperRuntime } = deps.wallpaper;
  const { finishBookmarkDrag, finishShortcutDrag } = deps.drags;
  const { bottomDockRuntime, handleRecentVisibilityChange } = deps.sectionViews;
  const {
    createNewtabEngagementNoticeController,
    createNewtabGraphicsNoticeController,
    inputParts
  } = deps.searchUi;

  renderNewtabTopContent(!shouldSkipNewtabEntryMotion());
  applyNewtabTopContentVisibility();

  wallpaperRuntime.createControls();
  const feedbackControl = createFeedbackControls();
  document.addEventListener('pointerdown', function(event) {
    if (!isFeedbackPopoverOpen()) {
      return;
    }
    const target = isNode(event.target) ? event.target : null;
    if (target === feedbackControl || feedbackControl.contains(target)) {
      return;
    }
    closeFeedbackPopover();
  }, true);
  document.addEventListener('pointerdown', function(event) {
    if (!wallpaperRuntime.isPanelOpen()) {
      return;
    }
    const target = isNode(event.target) ? event.target : null;
    if (wallpaperRuntime.containsTarget(target)) {
      return;
    }
    wallpaperRuntime.closePanel();
  }, true);
  dismissStack.register('wallpaper-panel', {
    isOpen: wallpaperRuntime.isPanelOpen,
    close: () => {
      // Escape dismisses an open filter menu before it closes the whole panel.
      if (wallpaperRuntime.closeOpenMenu()) {
        return;
      }
      wallpaperRuntime.closePanel({ restoreFocus: true });
    }
  });

  document.body.insertBefore(topContentContainer, root);
  searchLayer.appendChild(inputParts.container);
  root.appendChild(searchLayer);
  const newtabUpdateNoticeAnchor = root.nextSibling;
  document.body.insertBefore(shortcutSection, newtabUpdateNoticeAnchor);
  const updateNotice = notices.update;
  if (updateNotice && updateNotice.element) {
    document.body.insertBefore(updateNotice.element, newtabUpdateNoticeAnchor);
    if (typeof updateNotice.recordExposure === 'function') {
      updateNotice.recordExposure();
    }
  }
  document.body.insertBefore(suggestionsSurface, newtabUpdateNoticeAnchor);
  document.body.insertBefore(suggestionsOutline, newtabUpdateNoticeAnchor);
  document.body.insertBefore(suggestionsContainer, newtabUpdateNoticeAnchor);
  // 等首轮语言解析完成后再创建，避免默认文案在新标签页首帧短暂闪现。
  Promise.all([
    locale.ready,
    updateNotice && updateNotice.ready ? updateNotice.ready : Promise.resolve(false)
  ]).then(() => {
    if (notices.engagement) {
      return;
    }
    const noticeAnchor = suggestionsSurface.parentNode === document.body
      ? suggestionsSurface
      : newtabUpdateNoticeAnchor;
    const graphicsNotice = createNewtabGraphicsNoticeController();
    notices.mountGraphics(graphicsNotice);
    if (graphicsNotice && graphicsNotice.element) {
      document.body.insertBefore(graphicsNotice.element, noticeAnchor);
    }
    const engagementNotice = createNewtabEngagementNoticeController();
    notices.mountEngagement(engagementNotice);
    if (!engagementNotice || !engagementNotice.element) {
      return;
    }
    document.body.insertBefore(engagementNotice.element, noticeAnchor);
    if (String(inputParts.input.value || '').trim() &&
        typeof engagementNotice.recordMeaningfulUse === 'function') {
      engagementNotice.recordMeaningfulUse();
    }
  });
  if (bookmarkParts.topbar) {
    bookmarkParts.topbar.mount(document.body);
  }
  bottomDockRuntime.mount(document.body);
  const initialQuoteReadyTask = quoteRuntime.mount().catch(() => true);
  const wallpaperControl = wallpaperRuntime.getControlElement();
  if (wallpaperControl) {
    document.body.appendChild(wallpaperControl);
  }
  document.body.appendChild(feedbackControl);

  window.addEventListener('blur', () => {
    finishShortcutDrag(null, { cancel: true });
    finishBookmarkDrag(null, { canceled: true });
  });
  window.addEventListener('visibilitychange', handleRecentVisibilityChange);
  window.addEventListener('resize', () => adaptiveToneEvents.emit('stale', {}), { passive: true });
  // An open folder menu follows its anchor once per frame while the page
  // scrolls; scroll events run before that frame's animation callbacks, so
  // the menu never trails the page.
  let bookmarkCascadeScrollFrame = 0;
  window.addEventListener('scroll', () => {
    adaptiveToneEvents.emit('stale', {});
    if (bookmarkCascadeScrollFrame || !bookmarkParts.cascade || !bookmarkParts.cascade.isOpen()) {
      return;
    }
    bookmarkCascadeScrollFrame = window.requestAnimationFrame(() => {
      bookmarkCascadeScrollFrame = 0;
      positionBookmarkCascadeLevels();
    });
  }, { passive: true });
  bottomDockRuntime.onScroll(() => adaptiveToneEvents.emit('stale', {}), { passive: true });

  return {
    initialQuoteReadyTask
  };
}

type MountPart = ReturnType<typeof createMountPart>;

export { createMountPart };
export type { MountPart };
