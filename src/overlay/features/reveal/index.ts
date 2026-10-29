// The panel shown: the host put into the page and kept there, the
// fullscreen Escape lock, the size, notice and translation syncs, the first
// input or open tabs, the entry motion and the page's scroll pauses.
import { createFullscreenEscapeLock } from '../../../shared/ui/fullscreen-escape-lock';
import * as LumnoOverlayLifecycle from '../../lifecycle';
import { isOverlayOpenState, setOverlayOpenState } from '../../../platform/content-registry';
import type { OverlayContext } from '../../app/context';
import type { CoreFeature } from '../core';
import type { PanelFeature } from '../panel';
import type { SuggestionsFeature } from '../suggestions';
import type { ControlsFeature } from '../controls';
import type { MountFeature } from '../mount';

interface RevealFeatureDeps {
  core: CoreFeature;
  panel: PanelFeature;
  suggestions: SuggestionsFeature;
  controls: ControlsFeature;
  mount: MountFeature;
}

function createRevealFeature(ctx: OverlayContext, deps: RevealFeatureDeps) {
  const { elements, openOptions, settings } = ctx;
  const addOverlaySessionCleanup = ctx.overlaySessionCleanups.add;
  const {
    applyNoTranslateDeep,
    applyOverlayEnterAnimationInitialState,
    clearOverlayEnterAnimationFrames,
    finishOverlayPanelEnterAnimation,
    getOverlayEnterAnimationRevealTransform,
    overlayFrameTracker,
    overlayNoticeLayer,
    overlayThemeChoice,
    overlayViewportSizeSync,
    pauseOverlayAntiTranslateObserverForScroll,
    playOverlayPanelEnterAnimation,
    shouldSkipOverlayEntryMotion,
    shouldSkipOverlayEntryMotionForSlowStartup,
    startOverlayAntiTranslateObserver
  } = deps.core;
  const { searchQuery } = deps.core;
  const {
    applyOverlayThemeVariables,
    replayWithoutLoadingNotification,
    setOverlayMountVisibility
  } = deps.panel;
  const {
    clearDefaultOpenTabsSuggestions,
    requestTabsAndRender,
    shouldShowOpenTabsForEmptyQuery,
    syncOpenTabsScrollbarGutter,
    updateModeBadge
  } = deps.suggestions;
  const { startOverlayViewportSizeSync } = deps.controls;
  const { overlayHost, overlayMount, overlayRevealGate } = deps.mount;
  const { initialLanguageReady, settingsApplied } = deps.mount;

  if (!shouldShowOpenTabsForEmptyQuery()) {
    clearDefaultOpenTabsSuggestions();
  }
  applyNoTranslateDeep(elements.overlay);
  applyOverlayThemeVariables(overlayThemeChoice.mode);
  // Reader extensions such as SimpRead can hide the original body and mount
  // their reading surface directly under <html>. Keep the overlay out of a
  // potentially hidden body while preserving fullscreen containment.
  const overlayMountParent = document.fullscreenElement ||
    document.documentElement ||
    document.body;
  overlayMountParent.appendChild(overlayHost);
  setOverlayOpenState(true);
  if (typeof overlayHost.showPopover === 'function') {
    try {
      overlayHost.showPopover();
    } catch (e) {
      // Keep the fixed-position fallback visible if top-layer promotion fails.
      overlayHost.removeAttribute('popover');
    }
  }
  function focusOverlayInputForReveal() {
    if (!elements.searchInput || !elements.searchInput.isConnected) {
      return;
    }
    if (openOptions.loadingSession && openOptions.loadingSession.focused === false) {
      return;
    }
    elements.searchInput.focus({ preventScroll: true });
  }

  const mountConnectionGuard = LumnoOverlayLifecycle.createMountConnectionGuard(window, {
    getMountParent(doc) {
      return doc.fullscreenElement || doc.documentElement || doc.body;
    },
    onRestore(restoredHost) {
      setOverlayOpenState(true);
      if (typeof restoredHost.showPopover === 'function') {
        try {
          restoredHost.showPopover();
        } catch (error) {
          restoredHost.removeAttribute('popover');
        }
      }
      overlayViewportSizeSync.apply(elements.overlay);
      const restoreFocus = () => {
        if (restoredHost.isConnected &&
            isOverlayOpenState()) {
          focusOverlayInputForReveal();
        }
      };
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(restoreFocus);
      } else {
        window.setTimeout(restoreFocus, 0);
      }
    }
  });
  addOverlaySessionCleanup(() => {
    mountConnectionGuard.stop();
  });
  mountConnectionGuard.start(overlayHost);
  // Over a fullscreen video, the first Escape closes the overlay.
  const fullscreenEscapeLock = createFullscreenEscapeLock(window);
  addOverlaySessionCleanup(() => {
    fullscreenEscapeLock.stop();
  });
  fullscreenEscapeLock.start();
  startOverlayViewportSizeSync(overlayMount.panel);
  overlayNoticeLayer.startFrameSync(elements.overlay);
  startOverlayAntiTranslateObserver(overlayMount.panel);

  settings.loaded.then(() => {
    const searchInput = elements.searchInput;
    if (!elements.overlay || !elements.overlay.isConnected || !searchInput) {
      return false;
    }
    if (openOptions.loadingSession || openOptions.prefillQuery) {
      const initialInputValue = openOptions.loadingSession
        ? openOptions.loadingSession.inputValue
        : openOptions.prefillQuery;
      searchInput.value = initialInputValue;
      const selectionStart = openOptions.loadingSession
        ? openOptions.loadingSession.selectionStart
        : initialInputValue.length;
      const selectionEnd = openOptions.loadingSession
        ? openOptions.loadingSession.selectionEnd
        : initialInputValue.length;
      const selectionDirection = openOptions.loadingSession
        ? openOptions.loadingSession.selectionDirection
        : 'none';
      searchInput.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
      searchQuery.set(initialInputValue);
      updateModeBadge(initialInputValue);
      replayWithoutLoadingNotification(() => {
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return true;
    }
    return initialLanguageReady.catch(() => {}).then(() => {
      requestTabsAndRender();
      return true;
    });
  }).catch(() => false);

  const revealOverlay = (options: { forceInstant: boolean }): void => {
    if (!elements.overlay || !elements.overlay.isConnected) {
      return;
    }
    setOverlayMountVisibility(overlayHost, false);
    overlayRevealGate.release();
    // The style gate has just released the result surface, so take one last
    // measurement before it can become visible on a slow stylesheet load.
    syncOpenTabsScrollbarGutter();
    // Focusing before the two animation frames lets typing begin as soon as
    // the command bar is visually released, instead of after the entry
    // motion has already started.
    focusOverlayInputForReveal();
    const reduceMotion = options.forceInstant ||
      shouldSkipOverlayEntryMotion();
    const revealTransform = getOverlayEnterAnimationRevealTransform();
    if (reduceMotion) {
      elements.overlay.style.setProperty('transition', 'none', 'important');
      elements.overlay.style.setProperty('opacity', '1', 'important');
      elements.overlay.style.setProperty('transform', revealTransform, 'important');
      finishOverlayPanelEnterAnimation(elements.overlay);
      overlayNoticeLayer.scheduleMount(elements.overlay, elements.overlayStyleRoot, 0);
    } else {
      clearOverlayEnterAnimationFrames();
      overlayFrameTracker.runEnterAnimation(elements.overlay, () => {
        playOverlayPanelEnterAnimation(elements.overlay, revealTransform);
        overlayNoticeLayer.scheduleMount(elements.overlay, elements.overlayStyleRoot, 360);
      });
    }
  };
  const revealReady = overlayRevealGate.waitUntilReady();
  Promise.all([
    Promise.resolve(revealReady).catch(() => null),
    settingsApplied.catch(() => {})
  ]).then((readyStates) => {
    if (!elements.overlay || !elements.overlay.isConnected) {
      return;
    }
    applyOverlayEnterAnimationInitialState(elements.overlay);
    const styleGateResult = readyStates[0];
    const revealGate = overlayRevealGate;
    // The gate gives up on its first-frame budget while the settings above
    // are still loading, so the stylesheets have often arrived by now.
    const stylesReady = Boolean(styleGateResult && styleGateResult.ok === true) ||
      Boolean(revealGate && revealGate.isReady());
    revealOverlay({
      // A late stylesheet uses the shell's stable fallback. Starting a
      // spring while that fallback is about to upgrade only makes slow
      // devices look more broken, so reveal its final state instead.
      forceInstant: !stylesReady || shouldSkipOverlayEntryMotionForSlowStartup()
    });
  });
  const scrollPauseHandler = () => {
    pauseOverlayAntiTranslateObserverForScroll();
  };
  window.addEventListener('scroll', scrollPauseHandler, true);
  window.addEventListener('wheel', scrollPauseHandler, { passive: true, capture: true });
  window.addEventListener('touchmove', scrollPauseHandler, { passive: true, capture: true });
  addOverlaySessionCleanup(() => {
    window.removeEventListener('scroll', scrollPauseHandler, true);
    window.removeEventListener('wheel', scrollPauseHandler, true);
    window.removeEventListener('touchmove', scrollPauseHandler, true);
  });

}

type RevealFeature = ReturnType<typeof createRevealFeature>;

export { createRevealFeature };
export type { RevealFeature };
