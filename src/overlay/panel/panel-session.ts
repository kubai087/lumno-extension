// The overlay's place on the page: the context token that tells this
// session's panel from a stale one, the mount host and its visibility, wheel
// isolation, telling the background about loading and closing, and removing
// the panel.
import * as LumnoMessaging from '../../platform/messaging';
import type { SearchInputParts } from '../../shared/react/search-input';
import type { EngagementNoticeController } from '../../shared/engagement-notice';
import type { GraphicsNoticeController } from '../../shared/graphics-acceleration-notice';
import type { SuggestionsViewController } from '../../shared/react/search/suggestion-list/types';
import type { InputModeController } from '../../shared/search/search-input-mode';
import type { UpdateNoticeController } from '../../shared/update-notice';
import type * as OverlayLifecycle from '../lifecycle';
import type { createNoticeLayer } from '../notices';
import { setOverlayOpenState } from '../../platform/content-registry';
import { destroySearchInput } from '../../shared/react/search-input';
import * as SettingsStorage from '../../platform/settings-storage';
import { motionEffectsEnabled } from '../../domain/settings/appearance';
import type { OverlaySettings } from '../overlay-settings';

interface PanelSessionState {
  overlayContextToken: string;
  overlayViewportSizeSync: Pick<ReturnType<typeof OverlayLifecycle.createViewportSizeSync>, 'stop'>;
  overlayNoticeLayer: Pick<ReturnType<typeof createNoticeLayer>, 'stop'>;
  overlaySessionCleanups: Pick<ReturnType<typeof OverlayLifecycle.createSessionCleanupRegistry>, 'run'>;
  settings: Pick<OverlaySettings, 'get' | 'release'>;
  overlayKeyRouter: { stop(): void } | null;
  // Holds the panel back until its styles load; cancelled when it closes.
  overlayRevealGate: { cancel?(): void } | null;
  overlayWheelIsolationHandler: ((event: WheelEvent) => void) | null;
  overlaySuggestionsView: Pick<SuggestionsViewController, 'destroy'> | null;
  inputParts: SearchInputParts | null;
  clickOutsideHandler: ((event: MouseEvent) => void) | null;
  overlayMediaQuery: MediaQueryList;
  overlayThemeMediaListener: ((event: MediaQueryListEvent) => void) | null;
  overlayScrollPauseHandler: ((event: Event) => void) | null;
  inputModeController: Pick<InputModeController, 'destroy'> | null;
  inputHistoryController: { destroy?(): void } | null;
  overlayUpdateNoticeController: UpdateNoticeController | null;
  overlayGraphicsNoticeController: GraphicsNoticeController | null;
  overlayEngagementNoticeController: EngagementNoticeController | null;
  // The page under the overlay is loading and the worker keeps its input.
  loadingSessionTrackingActive: boolean;
  suppressOverlayLoadingSessionNotification: boolean;
}

interface PanelSessionDeps {
  pauseOverlayAntiTranslateObserverForScroll(): void;
  clearOverlayEnterAnimationFrames(): void;
  clearOverlayPanelEnterCleanup(): void;
  cancelPendingOverlaySuggestionRequests(): void;
  stopOverlayAntiTranslateObserver(): void;
  overlayShell: { destroyOverlayMount(host: HTMLElement | null): void };
  stopOverlayPageThemeObserver(): void;
  overlayLifecycle: Pick<typeof OverlayLifecycle, 'requestSessionDestroy'>;
  overlayState: PanelSessionState;
}

interface RemoveOverlayOptions {
  // The page under the overlay is loading; the worker keeps the input.
  preserveLoadingIntent?: boolean;
  animateExit?: boolean;
}

function isElementTarget(target: EventTarget | null): target is Element {
  return target !== null && 'nodeType' in target && target.nodeType === 1;
}

function isNodeTarget(target: EventTarget | null): target is Node {
  return target !== null && 'nodeType' in target;
}

function hasInlineStyle(element: Element): element is Element & ElementCSSInlineStyle {
  return 'style' in element && Boolean(element.style);
}

// HTML and SVG elements can be blurred; other elements cannot.
function isBlurrable(element: Element): element is Element & HTMLOrSVGElement {
  return 'blur' in element && typeof element.blur === 'function';
}

// Made once per loaded overlay module.
const OVERLAY_CONTEXT_TOKEN = `${Date.now()}:${Math.random().toString(36).slice(2)}`;

function createPanelSession(deps: PanelSessionDeps) {
  const {
    pauseOverlayAntiTranslateObserverForScroll,
    clearOverlayEnterAnimationFrames,
    clearOverlayPanelEnterCleanup,
    cancelPendingOverlaySuggestionRequests,
    stopOverlayAntiTranslateObserver,
    overlayShell,
    stopOverlayPageThemeObserver,
    overlayLifecycle
  } = deps;

  // The panel state object shared with search-panel.ts and the other modules.
  const overlayState = deps.overlayState;

  const OVERLAY_CONTEXT_TOKEN_ATTRIBUTE = 'data-lumno-overlay-context-token';

  function stopOverlayViewportSizeSync(): void {
    overlayState.overlayViewportSizeSync.stop();
  }

  // This overlay's token: one per loaded overlay module, so an overlay a
  // reloaded extension left in the page (from another isolated world) reads
  // as stale.
  function getOrCreateOverlayContextToken(): string {
    return OVERLAY_CONTEXT_TOKEN;
  }

  // The element the panel is mounted under: the shell's host, the shadow
  // root's host, or the panel itself.
  function getOverlayMountHost(overlayElement: HTMLElement | null): HTMLElement | null {
    if (!overlayElement) {
      return null;
    }
    const shellHost: unknown = Reflect.get(overlayElement, '_lumnoOverlayHost');
    if (shellHost instanceof HTMLElement) {
      return shellHost;
    }
    try {
      const root = overlayElement.getRootNode();
      if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
        return root.host;
      }
    } catch (_error) {
      // Fall back to removing the element itself.
    }
    return overlayElement;
  }

  function getOverlayElementContextToken(element: Element | null): string {
    if (!element) {
      return '';
    }
    return String(element.getAttribute(OVERLAY_CONTEXT_TOKEN_ATTRIBUTE) || '').trim();
  }

  function setOverlayStoredContextToken(overlayElement: HTMLElement | null): void {
    const mountHost = getOverlayMountHost(overlayElement);
    [overlayElement, mountHost].forEach((element) => {
      if (element) {
        element.setAttribute(OVERLAY_CONTEXT_TOKEN_ATTRIBUTE, overlayState.overlayContextToken);
      }
    });
  }

  function getOverlayStoredContextToken(overlayElement: HTMLElement | null): string {
    return getOverlayElementContextToken(overlayElement) ||
      getOverlayElementContextToken(getOverlayMountHost(overlayElement));
  }

  function setOverlayMountVisibility(mountHost: Element | null, hidden: boolean): void {
    if (!mountHost || !hasInlineStyle(mountHost) || typeof mountHost.style.setProperty !== 'function') {
      return;
    }
    if (hidden) {
      mountHost.setAttribute('data-lumno-overlay-mount-hidden', 'true');
      mountHost.style.setProperty('visibility', 'hidden', 'important');
      return;
    }
    mountHost.removeAttribute('data-lumno-overlay-mount-hidden');
    if (typeof mountHost.style.removeProperty === 'function') {
      mountHost.style.removeProperty('visibility');
    }
  }

  // A panel left by an earlier context of this extension (before a reload).
  function isStaleOverlay(overlayElement: HTMLElement | null): boolean {
    const storedToken = getOverlayStoredContextToken(overlayElement);
    return storedToken !== overlayState.overlayContextToken;
  }

  function isScrollableOverflowValue(value: string): boolean {
    return value === 'auto' || value === 'scroll' || value === 'overlay';
  }

  function canScrollByWheelDelta(scrollPosition: number, viewportSize: number, scrollSize: number, delta: number): boolean {
    if (!delta) {
      return false;
    }
    const maxScroll = Math.max(0, scrollSize - viewportSize);
    if (maxScroll <= 0) {
      return false;
    }
    if (delta < 0) {
      return scrollPosition > 0;
    }
    return scrollPosition < maxScroll - 1;
  }

  function canScrollElementWithWheel(element: EventTarget | null, event: WheelEvent): boolean {
    if (!isElementTarget(element) || !event) {
      return false;
    }
    const doc = element.ownerDocument || document;
    if (element === doc.body || element === doc.documentElement) {
      return false;
    }
    const win = doc.defaultView || window;
    const style = win && typeof win.getComputedStyle === 'function'
      ? win.getComputedStyle(element)
      : null;
    if (!style) {
      return false;
    }
    const deltaY = Number(event.deltaY) || 0;
    const deltaX = Number(event.deltaX) || 0;
    const scrollHeight = Number(element.scrollHeight) || 0;
    const clientHeight = Number(element.clientHeight) || 0;
    const scrollWidth = Number(element.scrollWidth) || 0;
    const clientWidth = Number(element.clientWidth) || 0;
    const canScrollY = isScrollableOverflowValue(style.overflowY) &&
      scrollHeight > clientHeight + 1 &&
      canScrollByWheelDelta(Number(element.scrollTop) || 0, clientHeight, scrollHeight, deltaY);
    const canScrollX = isScrollableOverflowValue(style.overflowX) &&
      scrollWidth > clientWidth + 1 &&
      canScrollByWheelDelta(Number(element.scrollLeft) || 0, clientWidth, scrollWidth, deltaX);
    return canScrollY || canScrollX;
  }

  // The element in the panel the wheel would scroll, if any.
  function findOverlayWheelScrollableElement(event: WheelEvent, overlayElement: Element): EventTarget | null {
    if (!event || !overlayElement) {
      return null;
    }
    const path = typeof event.composedPath === 'function'
      ? event.composedPath()
      : [];
    for (const node of path) {
      if (node === overlayElement) {
        break;
      }
      if (canScrollElementWithWheel(node, event)) {
        return node;
      }
    }
    const target = event.target;
    let current: Element | null = isElementTarget(target)
      ? target
      : (isNodeTarget(target) ? target.parentElement : null);
    while (current && current !== overlayElement) {
      if (canScrollElementWithWheel(current, event)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  // Keeps the page from scrolling under the panel, while what scrolls in
  // the panel still does.
  function createOverlayWheelIsolationHandler(overlayElement: HTMLElement): (event: WheelEvent) => void {
    return function(event: WheelEvent): void {
      if (!event || !overlayElement || !overlayElement.isConnected) {
        return;
      }
      const path = typeof event.composedPath === 'function'
        ? event.composedPath()
        : [];
      const target = event.target;
      const isInsideOverlay = (isNodeTarget(target) && overlayElement.contains(target)) || path.includes(overlayElement);
      if (!isInsideOverlay) {
        return;
      }
      event.stopPropagation();
      pauseOverlayAntiTranslateObserverForScroll();
      if (findOverlayWheelScrollableElement(event, overlayElement)) {
        return;
      }
      event.preventDefault();
    };
  }

  function notifyOverlayClosed(): void {
    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'notifyOverlayClosed' }, () => {
        void chrome.runtime.lastError;
      });
    } catch (_error) {
      // The document may already be unloading.
    }
  }

  function isOverlayInputFocused(input: HTMLInputElement | null): boolean {
    if (!input) {
      return false;
    }
    if (document.activeElement === input) {
      return true;
    }
    const root = input.getRootNode();
    return 'activeElement' in root && root.activeElement === input;
  }

  // Hands the worker the input's text and selection, to put back after
  // the page under the overlay loads.
  function notifyOverlayLoadingSession(input: HTMLInputElement | null): void {
    if (overlayState.suppressOverlayLoadingSessionNotification || !overlayState.loadingSessionTrackingActive || !input ||
        !chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    const inputValue = typeof input.value === 'string' ? input.value : '';
    const inputLength = inputValue.length;
    const rawSelectionStart = Number(input.selectionStart);
    const selectionStart = Number.isFinite(rawSelectionStart)
      ? Math.max(0, Math.min(inputLength, Math.trunc(rawSelectionStart)))
      : inputLength;
    const rawSelectionEnd = Number(input.selectionEnd);
    const selectionEnd = Number.isFinite(rawSelectionEnd)
      ? Math.max(selectionStart, Math.min(inputLength, Math.trunc(rawSelectionEnd)))
      : selectionStart;
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'updateOverlayLoadingSession',
        session: {
          inputValue,
          selectionStart,
          selectionEnd,
          selectionDirection: input.selectionDirection === 'backward' ||
            input.selectionDirection === 'forward'
            ? input.selectionDirection
            : 'none',
          focused: isOverlayInputFocused(input)
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          return;
        }
        if (response && response.tracked === false) {
          overlayState.loadingSessionTrackingActive = false;
        }
      });
    } catch (_error) {
      // The loading Document can be replaced between the input event and delivery.
    }
  }

  let overlayExitTimer: number | null = null;
  let closingOverlayElement: HTMLElement | null = null;

  // The exit follows the same switches as the entry: the Motion effects
  // setting and the system's reduced-motion preference.
  function closeOverlayWithMotion(overlayElement: HTMLElement | null): void {
    if (!overlayElement || !overlayElement.isConnected ||
        SettingsStorage.shouldSkipEntryMotion(window, overlayState.settings.get(motionEffectsEnabled)) ||
        overlayElement.getAttribute('data-lumno-overlay-entry') !== 'done') {
      removeOverlay(overlayElement);
      return;
    }
    if (closingOverlayElement === overlayElement) return;
    closingOverlayElement = overlayElement;
    // The overlay is closed as far as the worker and the user are concerned;
    // it only stays mounted to animate out. It stops taking keys, focus and
    // clicks, so Enter pressed during the exit cannot still run a search.
    setOverlayOpenState(false);
    if (overlayState.overlayKeyRouter) {
      overlayState.overlayKeyRouter.stop();
    }
    overlayElement.inert = true;
    const overlayRoot: unknown = Reflect.get(overlayElement, '_lumnoOverlayRoot');
    const focusedElement = overlayRoot instanceof ShadowRoot ? overlayRoot.activeElement : null;
    if (focusedElement && isBlurrable(focusedElement)) {
      focusedElement.blur();
    }
    overlayElement.setAttribute('data-lumno-overlay-exit', 'running');
    overlayElement.style.setProperty('pointer-events', 'none', 'important');
    overlayElement.style.setProperty('will-change', 'transform, opacity', 'important');
    overlayElement.style.setProperty(
      'transition',
      'transform 220ms cubic-bezier(0.4, 0, 1, 1), opacity 160ms ease-in',
      'important'
    );
    // Commit the visible state before changing the protected inline transform.
    void overlayElement.offsetWidth;
    overlayElement.style.setProperty(
      'transform',
      'translateX(-50%) translateY(8px) scale(var(--x-ov-visible-scale, 1)) scale(0.985)',
      'important'
    );
    overlayElement.style.setProperty('opacity', '0', 'important');
    overlayExitTimer = window.setTimeout(() => {
      overlayExitTimer = null;
      removeOverlay(overlayElement);
    }, 230);
  }

  // Tears down this invocation's overlay session: DOM, page listeners,
  // storage listeners and every controller registered for the session.
  function removeOverlay(overlayElement: HTMLElement | null, options?: RemoveOverlayOptions | null): void {
    const removalOptions: RemoveOverlayOptions = options && typeof options === 'object' ? options : {};
    if (overlayExitTimer !== null) {
      window.clearTimeout(overlayExitTimer);
      overlayExitTimer = null;
    }
    closingOverlayElement = null;
    setOverlayOpenState(false);
    if (removalOptions.preserveLoadingIntent !== true) {
      notifyOverlayClosed();
    }
    clearOverlayEnterAnimationFrames();
    clearOverlayPanelEnterCleanup();
    cancelPendingOverlaySuggestionRequests();
    if (overlayState.overlayRevealGate && typeof overlayState.overlayRevealGate.cancel === 'function') {
      overlayState.overlayRevealGate.cancel();
      overlayState.overlayRevealGate = null;
    }
    stopOverlayViewportSizeSync();
    overlayState.overlayNoticeLayer.stop();
    stopOverlayAntiTranslateObserver();
    // Session cleanups stop the mount connection guard, so they must run
    // before the host leaves the document or the guard would re-attach it.
    overlayState.overlaySessionCleanups.run();
    overlayState.overlayKeyRouter = null;
    if (overlayElement) {
      if (overlayState.overlayWheelIsolationHandler) {
        overlayElement.removeEventListener('wheel', overlayState.overlayWheelIsolationHandler, true);
      }
      if (overlayState.overlaySuggestionsView && typeof overlayState.overlaySuggestionsView.destroy === 'function') {
        overlayState.overlaySuggestionsView.destroy();
      }
      // The search input's own root, before the panel it sits in goes.
      if (overlayState.inputParts) {
        destroySearchInput(overlayState.inputParts);
      }
      const mountHost = getOverlayMountHost(overlayElement);
      overlayShell.destroyOverlayMount(mountHost);
      if (mountHost) {
        mountHost.remove();
      }
    }
    overlayState.overlayWheelIsolationHandler = null;
    overlayState.overlaySuggestionsView = null;
    // Also remove the scrollbar style
    const scrollbarStyle = document.getElementById('_x_extension_scrollbar_style_2024_unique_');
    if (scrollbarStyle) {
      scrollbarStyle.remove();
    }
    const overlayThemeStyle = document.getElementById('_x_extension_overlay_theme_style_2024_unique_');
    if (overlayThemeStyle) {
      overlayThemeStyle.remove();
    }
    if (overlayState.clickOutsideHandler) {
      document.removeEventListener('click', overlayState.clickOutsideHandler);
      overlayState.clickOutsideHandler = null;
    }
    overlayState.settings.release();
    if (overlayState.overlayThemeMediaListener) {
      overlayState.overlayMediaQuery.removeEventListener('change', overlayState.overlayThemeMediaListener);
      overlayState.overlayThemeMediaListener = null;
    }
    if (overlayState.overlayScrollPauseHandler) {
      window.removeEventListener('scroll', overlayState.overlayScrollPauseHandler, true);
      window.removeEventListener('wheel', overlayState.overlayScrollPauseHandler, true);
      window.removeEventListener('touchmove', overlayState.overlayScrollPauseHandler, true);
      overlayState.overlayScrollPauseHandler = null;
    }
    stopOverlayPageThemeObserver();
    if (overlayState.inputModeController) {
      overlayState.inputModeController.destroy();
      overlayState.inputModeController = null;
    }
    if (overlayState.inputHistoryController && typeof overlayState.inputHistoryController.destroy === 'function') {
      overlayState.inputHistoryController.destroy();
    }
    overlayState.inputHistoryController = null;
    [
      overlayState.overlayUpdateNoticeController,
      overlayState.overlayGraphicsNoticeController,
      overlayState.overlayEngagementNoticeController
    ].forEach((controller) => {
      if (!controller || typeof controller.destroy !== 'function') {
        return;
      }
      if (controller.element && controller.element.parentNode) {
        controller.element.parentNode.removeChild(controller.element);
      }
      controller.destroy();
    });
    overlayState.overlayUpdateNoticeController = null;
    overlayState.overlayGraphicsNoticeController = null;
    overlayState.overlayEngagementNoticeController = null;
  }

  // Asks the session that owns an existing panel to close; removes the
  // panel itself when no session answers.
  function destroyExistingOverlaySession(overlayElement: HTMLElement | null, options?: RemoveOverlayOptions | null): void {
    const mountHost = getOverlayMountHost(overlayElement);
    const destroyed = mountHost
      ? overlayLifecycle.requestSessionDestroy(mountHost, options)
      : !(overlayElement && overlayElement.isConnected);
    if (destroyed || (overlayElement &&
        overlayElement.getAttribute('data-lumno-overlay-exit') === 'running')) {
      setOverlayOpenState(false);
      return;
    }
    // An overlay from a runtime that predates session teardown: remove its
    // DOM at least, as before.
    removeOverlay(overlayElement, options);
  }

  return {
    getOrCreateOverlayContextToken,
    getOverlayMountHost,
    setOverlayStoredContextToken,
    setOverlayMountVisibility,
    isStaleOverlay,
    createOverlayWheelIsolationHandler,
    notifyOverlayLoadingSession,
    removeOverlay,
    closeOverlayWithMotion,
    destroyExistingOverlaySession
  };
}

export { createPanelSession };
export type { PanelSessionDeps, PanelSessionState, RemoveOverlayOptions };
