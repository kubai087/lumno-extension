// Appearance panel motion: resizing the panel between tabs, switching
// source tabs and edit modes, opening and closing it, and the appearance
// scope change animation.
import type { Translate } from '../../newtab-types';
import type { ThemeScope, WallpaperSourceTab } from '../../react/wallpaper-panel/panel-model';
import type { DailyWallpapers } from './daily-wallpapers';
import type { PanelSettings } from './panel-settings';
import type { WallpaperSelection } from './wallpaper-selection';
import type { WallpaperSources } from './wallpaper-sources';
import type { WallpaperStorage } from './wallpaper-storage';
import * as REMOTE_CONTENT from '../../remote-content';
import { WALLPAPER_SOURCE_TABS } from '../wallpaper-options';
import type { WallpaperPanelUi } from './panel-ui';
import type { OnlineWallpapers } from './online-wallpapers';
import type { WallpaperChoice } from './wallpaper-choice';
import type { WallpaperPanelView } from './panel-view';
import { playEnterMotion, shouldReduceMotion } from './motion';
import { getAppearanceModeLabels } from './appearance-labels';

interface PanelMotionDeps extends
  Pick<WallpaperStorage, 'normalizeWallpaperSourceTab' | 'getWallpaperSelectionIdForUi' | 'getWallpaperSourceTabForId'>,
  Pick<WallpaperSelection, 'loadCustomWallpapers'>,
  Pick<DailyWallpapers, 'loadBingCatalog' | 'showCuratedPageOfSelection'>,
  Pick<WallpaperSources, 'getWallpaperById' | 'normalizeWallpaperMode'>,
  Pick<PanelSettings, 'getWallpaperAppearanceOptionButtons' | 'getWallpaperAppearanceOptionMotionElement'> {
  window: Window;
  document: Document;
  t: Translate;
  getThemeScope(): string;
  setThemeScope(scope: ThemeScope): void;
  panelUi: WallpaperPanelUi;
  online: OnlineWallpapers;
  choice: WallpaperChoice;
  panelView: WallpaperPanelView;
  selectionEvents: WallpaperSelection['events'];
}

function createPanelMotion(deps: PanelMotionDeps) {
  const {
    selectionEvents,
    panelView,
    choice,
    online,
    panelUi,
    window,
    normalizeWallpaperSourceTab,
    loadCustomWallpapers,
    loadBingCatalog,
    getWallpaperSelectionIdForUi,
    getWallpaperById,
    showCuratedPageOfSelection,
    getWallpaperSourceTabForId,
    normalizeWallpaperMode,
    document,
    t,
    getThemeScope,
    getWallpaperAppearanceOptionButtons,
    getWallpaperAppearanceOptionMotionElement,
    setThemeScope
  } = deps;


  const WALLPAPER_PANEL_RESIZE_DURATION_MS = 260;
  const WALLPAPER_PANEL_RESIZE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  let wallpaperPanelResizing = false;
  let wallpaperPanelResizeTimer: number | null = null;
  let wallpaperPanelResizeCleanup: (() => void) | null = null;
  let wallpaperAppearanceAnimationTimers: number[] = [];
  let lastSyncedWallpaperSourceId: string | null = null;

  function cleanupWallpaperPanelResize(): void {
    if (wallpaperPanelResizeTimer !== null) {
      window.clearTimeout(wallpaperPanelResizeTimer);
      wallpaperPanelResizeTimer = null;
    }
    if (typeof wallpaperPanelResizeCleanup === 'function') {
      wallpaperPanelResizeCleanup();
      wallpaperPanelResizeCleanup = null;
    }
  }

  function measureWallpaperPanelOpenHeight(): number {
    const panel = panelView.panel;
    if (!panel) {
      return 0;
    }
    const previousHeight = panel.style.height;
    const previousTransition = panel.style.transition;
    panel.style.transition = 'none';
    panel.style.height = 'auto';
    const height = panel.getBoundingClientRect().height;
    panel.style.height = previousHeight;
    panel.style.transition = previousTransition;
    return height;
  }

  function animateWallpaperPanelResize(mutate: () => void): void {
    if (typeof mutate !== 'function') {
      return;
    }
    // A resize already in progress measures its own end height after this change.
    if (wallpaperPanelResizing) {
      mutate();
      return;
    }
    const resizingPanel = panelView.panel;
    const canAnimate = resizingPanel &&
      isWallpaperPanelOpen() &&
      !shouldReduceMotion(window);
    if (!resizingPanel || !canAnimate) {
      mutate();
      return;
    }
    // Narrowed here, for the handlers below.
    const panel = resizingPanel;

    cleanupWallpaperPanelResize();
    const startHeight = panel.getBoundingClientRect().height;
    const previousHeight = panel.style.height;
    const previousOverflow = panel.style.overflow;
    const previousTransition = panel.style.transition;
    const previousWillChange = panel.style.willChange;

    panel.style.height = `${startHeight}px`;
    panel.style.overflow = 'hidden';
    panel.style.willChange = 'height, transform, opacity, filter';
    wallpaperPanelResizing = true;
    try {
      mutate();
    } finally {
      wallpaperPanelResizing = false;
    }
    const endHeight = measureWallpaperPanelOpenHeight();

    const restorePanel = () => {
      panel.style.height = previousHeight;
      panel.style.overflow = previousOverflow;
      panel.style.transition = previousTransition;
      panel.style.willChange = previousWillChange;
      panel.removeEventListener('transitionend', handleTransitionEnd);
      if (wallpaperPanelResizeTimer !== null) {
        window.clearTimeout(wallpaperPanelResizeTimer);
        wallpaperPanelResizeTimer = null;
      }
      wallpaperPanelResizeCleanup = null;
    };
    function handleTransitionEnd(event: TransitionEvent): void {
      if (event && event.target === panel && event.propertyName === 'height') {
        restorePanel();
      }
    }

    if (Math.abs(endHeight - startHeight) < 1) {
      restorePanel();
      return;
    }

    wallpaperPanelResizeCleanup = restorePanel;
    panel.style.height = `${startHeight}px`;
    panel.style.transition = `height ${WALLPAPER_PANEL_RESIZE_DURATION_MS}ms ${WALLPAPER_PANEL_RESIZE_EASING}`;
    void panel.offsetHeight;
    panel.addEventListener('transitionend', handleTransitionEnd);
    requestAnimationFrame(() => {
      if (!wallpaperPanelResizeCleanup) {
        return;
      }
      panel.style.height = `${endHeight}px`;
    });
    wallpaperPanelResizeTimer = window.setTimeout(restorePanel, WALLPAPER_PANEL_RESIZE_DURATION_MS + 80);
  }

  function setWallpaperActiveTab(tab: unknown): void {
    const nextTab = normalizeWallpaperSourceTab(tab);
    const previousTab = panelUi.state.tab;
    if (previousTab !== nextTab) {
      panelUi.setTab(nextTab);
      if (nextTab === 'curated') showCuratedCategoryOfSelection();
      playEnterMotion(window, 
        getWallpaperGridForTab(nextTab),
        WALLPAPER_SOURCE_TABS.indexOf(nextTab) < WALLPAPER_SOURCE_TABS.indexOf(previousTab) ? 'enter-prev' : 'enter-next'
      );
    }
    if (nextTab === 'local' && isWallpaperPanelOpen()) {
      void loadCustomWallpapers();
    }
    if (nextTab === 'bing' && previousTab !== nextTab && isWallpaperPanelOpen()) void loadBingCatalog();
  }
  function showCuratedCategoryOfSelection(): void {
    const selectedId = getWallpaperSelectionIdForUi();
    const selected = getWallpaperById(selectedId);
    const slot = REMOTE_CONTENT.isDailyWallpaperId(selectedId) ? REMOTE_CONTENT.wallpaperFromId(selectedId) : null;
    // A daily choice keeps its own category, which may be the random mix.
    const category = selected && selected.provider === 'curated'
      ? (slot ? slot.category : selected.category)
      : '';
    if (!category) {
      return;
    }
    online.setCuratedCategory(category);
    showCuratedPageOfSelection();
  }
  // Follow the selection only when it moves, so storage reloads (deleting a
  // local wallpaper, syncs, theme changes) keep the tab the user is browsing.
  function syncWallpaperSourceTabToEditMode(options?: { force?: boolean } | null): void {
    const selectedId = getWallpaperSelectionIdForUi();
    const force = Boolean(options && options.force);
    if (!force && selectedId === lastSyncedWallpaperSourceId) {
      return;
    }
    lastSyncedWallpaperSourceId = selectedId;
    if (selectedId) {
      setWallpaperActiveTab(getWallpaperSourceTabForId(selectedId));
    }
  }

  function setWallpaperActiveMode(mode: unknown): void {
    online.dropSelections();
    const nextMode = normalizeWallpaperMode(mode);
    if (choice.state.editMode === nextMode) {
      return;
    }
    choice.setEditMode(nextMode);
    syncWallpaperSourceTabToEditMode({ force: true });
    playEnterMotion(window, getWallpaperGridForTab(panelUi.state.tab), 'enter');
  }

  function isWallpaperPanelOpen(): boolean {
    return panelUi.state.open;
  }
  function setWallpaperPanelOpenState(open: boolean): void {
    if (!document.body) {
      return;
    }
    if (open) {
      document.body.setAttribute('data-wallpaper-panel-open', 'true');
      return;
    }
    document.body.removeAttribute('data-wallpaper-panel-open');
  }

  function clearWallpaperAppearanceScopeAnimation(): void {
    wallpaperAppearanceAnimationTimers.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    wallpaperAppearanceAnimationTimers = [];
    panelUi.releaseModeLabels();
    getWallpaperAppearanceOptionButtons().forEach((button) => {
      const motionElement = getWallpaperAppearanceOptionMotionElement(button);
      if (!motionElement) {
        return;
      }
      motionElement.style.removeProperty('transition');
      motionElement.style.removeProperty('transform');
      motionElement.style.removeProperty('opacity');
      motionElement.style.removeProperty('will-change');
    });
    const options = panelView.getRefs().appearanceOptions;
    if (options) {
      options.removeAttribute('data-scope-animating');
    }
  }
  function getWallpaperGridForTab(tab: WallpaperSourceTab): HTMLElement | undefined {
    const refs = panelView.getRefs();
    if (tab === 'bing') return refs.bingPanel;
    if (tab === 'curated') return refs.curatedPanel;
    return tab === 'local' ? refs.localGrid : refs.builtInGrid;
  }
  function getAppearanceScopeDirection(scope: ThemeScope): number {
    return scope === 'home' ? 1 : -1;
  }

  function getAppearanceOptionDelay(index: number, count: number, direction: number): number {
    const visualIndex = direction > 0 ? (count - 1 - index) : index;
    return Math.max(0, visualIndex * 20);
  }

  function animateWallpaperAppearanceScopeChange(previousScope: unknown, nextScope: unknown): void {
    const targetScope: ThemeScope = nextScope === 'home' ? 'home' : 'global';
    const sourceScope: ThemeScope = previousScope === 'home' ? 'home' : 'global';
    const buttons = getWallpaperAppearanceOptionButtons();
    clearWallpaperAppearanceScopeAnimation();
    if (!buttons.length || sourceScope === targetScope || shouldReduceMotion(window)) {
      setThemeScope(targetScope);
      return;
    }
    const direction = getAppearanceScopeDirection(targetScope);
    const offsetPx = 24;
    const durationMs = 220;
    const fadeDurationMs = 140;
    const handoffOverlapMs = 70;
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const options = panelView.getRefs().appearanceOptions;
    // The tabs move to the new scope at once; the options keep their labels until they swap.
    panelUi.holdModeLabels(getAppearanceModeLabels(t, getThemeScope()), targetScope);
    if (options) {
      options.setAttribute('data-scope-animating', 'true');
    }

    let maxOutDelay = 0;
    buttons.forEach((button, index) => {
      const motionElement = getWallpaperAppearanceOptionMotionElement(button);
      if (!motionElement) {
        return;
      }
      const delay = getAppearanceOptionDelay(index, buttons.length, direction);
      maxOutDelay = Math.max(maxOutDelay, delay);
      motionElement.style.setProperty('will-change', 'transform, opacity');
      motionElement.style.setProperty(
        'transition',
        `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeDurationMs}ms ${easing} ${delay}ms`
      );
      motionElement.style.setProperty('opacity', '0');
      motionElement.style.setProperty('transform', `translate3d(${direction * -offsetPx}px, 0, 0)`);
    });

    const handoffDelayMs = Math.max(0, durationMs + maxOutDelay - handoffOverlapMs);
    const handoffTimer = window.setTimeout(() => {
      wallpaperAppearanceAnimationTimers = wallpaperAppearanceAnimationTimers.filter((timerId) => timerId !== handoffTimer);
      setThemeScope(targetScope);
      panelUi.releaseModeLabels();
      buttons.forEach((button) => {
        const motionElement = getWallpaperAppearanceOptionMotionElement(button);
        if (!motionElement) {
          return;
        }
        motionElement.style.setProperty('transition', 'none');
        motionElement.style.setProperty('opacity', '0');
        motionElement.style.setProperty('transform', `translate3d(${direction * offsetPx}px, 0, 0)`);
      });
      if (options) {
        void options.offsetHeight;
      }
      let maxInDelay = 0;
      buttons.forEach((button, index) => {
        const motionElement = getWallpaperAppearanceOptionMotionElement(button);
        if (!motionElement) {
          return;
        }
        const delay = getAppearanceOptionDelay(index, buttons.length, direction);
        maxInDelay = Math.max(maxInDelay, delay);
        motionElement.style.setProperty(
          'transition',
          `transform ${durationMs}ms ${easing} ${delay}ms, opacity ${fadeDurationMs}ms ${easing} ${delay}ms`
        );
        motionElement.style.setProperty('opacity', '1');
        motionElement.style.setProperty('transform', 'translate3d(0, 0, 0)');
      });
      const cleanupTimer = window.setTimeout(() => {
        wallpaperAppearanceAnimationTimers = wallpaperAppearanceAnimationTimers.filter((timerId) => timerId !== cleanupTimer);
        clearWallpaperAppearanceScopeAnimation();
      }, durationMs + maxInDelay + 24);
      wallpaperAppearanceAnimationTimers.push(cleanupTimer);
    }, handoffDelayMs);
    wallpaperAppearanceAnimationTimers.push(handoffTimer);
  }

  selectionEvents.on('chosen', () => syncWallpaperSourceTabToEditMode());

  return {
    animateWallpaperPanelResize,
    setWallpaperActiveTab,
    syncWallpaperSourceTabToEditMode,
    setWallpaperActiveMode,
    isWallpaperPanelOpen,
    setWallpaperPanelOpenState,
    animateWallpaperAppearanceScopeChange
  };
}

type PanelMotion = ReturnType<typeof createPanelMotion>;

export { createPanelMotion };
export type { PanelMotion, PanelMotionDeps };
