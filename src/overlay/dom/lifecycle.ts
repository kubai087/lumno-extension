// A chrome.* event such as chrome.storage.onChanged.
interface ChromeEventLike<L> {
  addListener(listener: L): void;
  removeListener(listener: L): void;
}

// A window with its own constructors and timers.
type HostWindow = Window & typeof globalThis;

interface OverlaySizePreset {
  width: number;
  maxHeightVh: number;
  uiScale: number;
}

interface ViewportSizeSyncConfig {
  getSizePreset?(): Partial<OverlaySizePreset> | null;
  // The page's zoom when the overlay opened, which the panel undoes.
  getRequestedTabZoomFactor?(): unknown;
  shouldIgnoreTabZoomCompensation?(): unknown;
}

interface MountConnectionGuardConfig {
  getMountParent?(doc: Document): Element | null;
  // Runs after the host was put back into the page.
  onRestore?(host: HTMLElement, parent: Element): void;
}

// The page guards' hooks the anti-translate guard calls.
interface AntiTranslateGuardHelpers {
  applyNoTranslateDeep?(node: Element): unknown;
  restoreProtectedNode?(node: Element): boolean;
  restoreProtectedAncestors?(node: Node, root: Element): boolean;
}

interface AntiTranslateGuardState {
  root: Element;
  flushTimer: number | null;
  pendingProtectedNodes: Set<Element>;
  pendingNoTranslateRoots: Set<Element>;
  guardWindowStartedAt: number;
  mutationCountInWindow: number;
  callbackCountInWindow: number;
  paused: boolean;
  // 'transient' for a scroll or a burst of changes, 'backoff' when the
  // page changed too much.
  pauseReason: '' | 'transient' | 'backoff';
  resumeTimer: number | null;
}

interface SessionDestroyOptions {
  preserveLoadingIntent: boolean;
  animateExit: boolean;
}

// Read through a call, so a check made before the host moved is not reused.
function isInDocument(element: Element): boolean {
  return element.isConnected === true;
}

// Every listener added through it, removed together by clear().
function createChromeEventListenerRegistry<L extends (...args: never[]) => unknown>(eventTarget: ChromeEventLike<L> | null) {
  const listeners = new Set<L>();

  function add(listener: L): L | null {
    if (!eventTarget || typeof eventTarget.addListener !== 'function' ||
        typeof listener !== 'function') {
      return null;
    }
    if (listeners.has(listener)) {
      return listener;
    }
    eventTarget.addListener(listener);
    listeners.add(listener);
    return listener;
  }

  function remove(listener: L): boolean {
    if (!listeners.has(listener)) {
      return false;
    }
    listeners.delete(listener);
    if (eventTarget && typeof eventTarget.removeListener === 'function') {
      eventTarget.removeListener(listener);
    }
    return true;
  }

  function clear(): void {
    Array.from(listeners).forEach(remove);
  }

  return Object.freeze({
    add,
    remove,
    clear,
    get size() { return listeners.size; }
  });
}

function createFrameTracker(win?: Window | null) {
  const targetWindow = win || window;
  let enterRafA: number | null = null;
  let enterRafB: number | null = null;

  function clear(): void {
    if (enterRafA !== null) {
      targetWindow.cancelAnimationFrame(enterRafA);
      enterRafA = null;
    }
    if (enterRafB !== null) {
      targetWindow.cancelAnimationFrame(enterRafB);
      enterRafB = null;
    }
  }

  // Runs applyVisibleState two frames later, once the start state painted.
  function runEnterAnimation(element: Element | null, applyVisibleState: () => void): void {
    clear();
    if (!element || typeof applyVisibleState !== 'function') {
      return;
    }
    enterRafA = targetWindow.requestAnimationFrame(() => {
      enterRafA = null;
      enterRafB = targetWindow.requestAnimationFrame(() => {
        enterRafB = null;
        if (!element.isConnected) {
          return;
        }
        applyVisibleState();
      });
    });
  }

  return Object.freeze({
    clear,
    runEnterAnimation
  });
}

function createViewportSizeSync(win?: Window | null, config?: ViewportSizeSyncConfig | null) {
  const targetWindow = win || window;
  const settings: ViewportSizeSyncConfig = config && typeof config === 'object' ? config : {};
  let resizeHandler: (() => void) | null = null;
  let visualViewportTarget: VisualViewport | null = null;
  let baseDevicePixelRatio: number | null = null;
  let baseTopPx: number | null = null;
  let initialTabZoomFactor = 1;

  function getSizePreset(): Partial<OverlaySizePreset> {
    if (typeof settings.getSizePreset === 'function') {
      return settings.getSizePreset() || {};
    }
    return { width: 760, maxHeightVh: 75, uiScale: 1 };
  }

  function getRequestedTabZoomFactor(): number {
    const raw = typeof settings.getRequestedTabZoomFactor === 'function'
      ? settings.getRequestedTabZoomFactor()
      : 1;
    return Number.isFinite(Number(raw)) && Number(raw) > 0 ? Number(raw) : 1;
  }

  function getVisualViewportScale(visualViewport: VisualViewport | null): number {
    const raw = visualViewport && Number.isFinite(Number(visualViewport.scale))
      ? Number(visualViewport.scale)
      : 1;
    return raw > 0 ? raw : 1;
  }

  function getVisualViewportOffset(visualViewport: VisualViewport | null, key: 'offsetLeft' | 'offsetTop'): number {
    const raw = visualViewport && Number.isFinite(Number(visualViewport[key]))
      ? Number(visualViewport[key])
      : 0;
    return raw > 0 ? raw : 0;
  }

  function shouldIgnoreTabZoomCompensation(): boolean {
    return typeof settings.shouldIgnoreTabZoomCompensation === 'function'
      ? Boolean(settings.shouldIgnoreTabZoomCompensation())
      : false;
  }

  function getViewportSize(): {
    viewportWidth: number;
    viewportHeight: number;
    visualViewportScale: number;
    visualViewportOffsetLeft: number;
    visualViewportOffsetTop: number;
  } {
    const doc = targetWindow.document;
    const visualViewport = targetWindow.visualViewport;
    const viewportWidth = visualViewport && Number.isFinite(visualViewport.width) && visualViewport.width > 0
      ? visualViewport.width
      : (targetWindow.innerWidth || doc.documentElement.clientWidth || 0);
    const viewportHeight = visualViewport && Number.isFinite(visualViewport.height) && visualViewport.height > 0
      ? visualViewport.height
      : (targetWindow.innerHeight || doc.documentElement.clientHeight || 0);
    const visualViewportScale = getVisualViewportScale(visualViewport);
    return {
      viewportWidth: viewportWidth * visualViewportScale,
      viewportHeight: viewportHeight * visualViewportScale,
      visualViewportScale,
      visualViewportOffsetLeft: getVisualViewportOffset(visualViewport, 'offsetLeft'),
      visualViewportOffsetTop: getVisualViewportOffset(visualViewport, 'offsetTop')
    };
  }

  // Sizes and places the panel so it looks the same at any page zoom.
  function apply(overlayElement: HTMLElement | null): void {
    if (!overlayElement || !overlayElement.isConnected) {
      return;
    }
    const sizePreset = getSizePreset();
    const viewport = getViewportSize();
    const currentDpr = Number.isFinite(targetWindow.devicePixelRatio) && targetWindow.devicePixelRatio > 0
      ? targetWindow.devicePixelRatio
      : 1;
    const baseDpr = baseDevicePixelRatio !== null && Number.isFinite(baseDevicePixelRatio) && baseDevicePixelRatio > 0
      ? baseDevicePixelRatio
      : currentDpr;
    const dprScaleDelta = currentDpr / baseDpr;
    const tabZoomFactor = Number.isFinite(initialTabZoomFactor) && initialTabZoomFactor > 0
      ? initialTabZoomFactor
      : 1;
    const visualViewportScale = Number.isFinite(viewport.visualViewportScale) && viewport.visualViewportScale > 0
      ? viewport.visualViewportScale
      : 1;
    const layoutZoomScale = tabZoomFactor * dprScaleDelta;
    const zoomScale = layoutZoomScale * visualViewportScale;
    const safeZoomScale = Math.max(0.5, Math.min(3, zoomScale));
    const safeVisualViewportScale = Math.max(0.5, Math.min(3, visualViewportScale));
    const presetUiScale = sizePreset.uiScale !== undefined && Number.isFinite(sizePreset.uiScale) && sizePreset.uiScale > 0
      ? sizePreset.uiScale
      : 1;
    const finalOverlayZoom = (1 / safeZoomScale) * presetUiScale;
    const safeFinalOverlayZoom = Math.max(0.35, Math.min(4, finalOverlayZoom));
    const maxWidth = Math.max(280, viewport.viewportWidth - 24);
    // Fixed-position anchors already use zoom-adjusted CSS viewport coordinates.
    // Tab zoom only belongs in the visual scale compensation above.
    const baseLeft = viewport.viewportWidth * 0.5;
    const compensatedLeft = viewport.visualViewportOffsetLeft +
      (baseLeft / safeVisualViewportScale);
    const baseTop = baseTopPx !== null && Number.isFinite(baseTopPx) && baseTopPx > 0
      ? baseTopPx
      : (viewport.viewportHeight * 0.2);
    const compensatedTop = viewport.visualViewportOffsetTop +
      (baseTop / safeVisualViewportScale);
    const topPx = Math.max(16, Math.min(compensatedTop, Math.max(16, viewport.viewportHeight - 120)));
    const leftPx = Math.max(16, Math.min(compensatedLeft, Math.max(16, viewport.viewportWidth - 16)));
    overlayElement.style.setProperty('width', `${sizePreset.width}px`, 'important');
    overlayElement.style.setProperty('max-width', `${maxWidth}px`, 'important');
    overlayElement.style.setProperty('max-height', `${sizePreset.maxHeightVh}vh`, 'important');
    overlayElement.style.setProperty('top', `${topPx}px`, 'important');
    overlayElement.style.setProperty('left', `${leftPx}px`, 'important');
    overlayElement.style.setProperty('--x-ov-visible-scale', `${safeFinalOverlayZoom}`, 'important');
    if (typeof overlayElement.style.removeProperty === 'function') {
      overlayElement.style.removeProperty('zoom');
    }
  }

  function stop(): void {
    if (!resizeHandler) {
      baseDevicePixelRatio = null;
      baseTopPx = null;
      initialTabZoomFactor = 1;
      return;
    }
    targetWindow.removeEventListener('resize', resizeHandler);
    if (visualViewportTarget && typeof visualViewportTarget.removeEventListener === 'function') {
      visualViewportTarget.removeEventListener('resize', resizeHandler);
      visualViewportTarget.removeEventListener('scroll', resizeHandler);
    }
    resizeHandler = null;
    visualViewportTarget = null;
    baseDevicePixelRatio = null;
    baseTopPx = null;
    initialTabZoomFactor = 1;
  }

  function start(overlayElement: HTMLElement | null): void {
    stop();
    if (!overlayElement) {
      return;
    }
    baseDevicePixelRatio = Number.isFinite(targetWindow.devicePixelRatio) && targetWindow.devicePixelRatio > 0
      ? targetWindow.devicePixelRatio
      : 1;
    initialTabZoomFactor = shouldIgnoreTabZoomCompensation() ? 1 : getRequestedTabZoomFactor();
    const viewport = getViewportSize();
    const visualViewport = targetWindow.visualViewport;
    baseTopPx = viewport.viewportHeight * 0.2;
    const handler = (): void => {
      apply(overlayElement);
    };
    resizeHandler = handler;
    targetWindow.addEventListener('resize', handler);
    if (visualViewport && typeof visualViewport.addEventListener === 'function') {
      visualViewport.addEventListener('resize', handler);
      visualViewport.addEventListener('scroll', handler);
      visualViewportTarget = visualViewport;
    }
    apply(overlayElement);
  }

  return Object.freeze({
    apply,
    start,
    stop
  });
}

// Puts the overlay's host back when the page removes it (a framework
// re-rendering <html>, or entering fullscreen elsewhere).
function createMountConnectionGuard(win?: HostWindow | null, config?: MountConnectionGuardConfig | null) {
  const targetWindow = win || window;
  const settings: MountConnectionGuardConfig = config && typeof config === 'object' ? config : {};
  const doc = targetWindow.document;
  const MutationObserverCtor = targetWindow.MutationObserver;
  const MAX_RESTORE_ATTEMPTS = 4;
  const RESTORE_RETRY_MS = 16;

  let active = false;
  let mountHost: HTMLElement | null = null;
  let documentObserver: MutationObserver | null = null;
  let parentObserver: MutationObserver | null = null;
  let observedParent: Node | null = null;
  let restoreTimer: number | null = null;
  let restoreAttempts = 0;

  function clearRestoreTimer(): void {
    if (restoreTimer === null) {
      return;
    }
    targetWindow.clearTimeout(restoreTimer);
    restoreTimer = null;
  }

  function resolveMountParent(): Element | null {
    let candidate: Element | null = null;
    if (typeof settings.getMountParent === 'function') {
      try {
        candidate = settings.getMountParent(doc);
      } catch (_error) {
        candidate = null;
      }
    }
    if (!candidate && doc) {
      candidate = doc.fullscreenElement || doc.documentElement || doc.body;
    }
    if (!candidate || candidate.isConnected === false ||
        typeof candidate.appendChild !== 'function') {
      return null;
    }
    return candidate;
  }

  function observeParent(parent: Node | null): void {
    if (!active || !parent || typeof MutationObserverCtor !== 'function') {
      return;
    }
    const observer = parentObserver || new MutationObserverCtor(() => {
      if (active && mountHost && mountHost.isConnected !== true) {
        scheduleRestore();
      }
    });
    parentObserver = observer;
    if (observedParent === parent) {
      return;
    }
    observer.disconnect();
    observedParent = parent;
    observer.observe(parent, { childList: true });
  }

  // Puts the host back if it left the page; true when it is in the page.
  function ensureConnected(): boolean {
    if (!active || !mountHost) {
      return false;
    }
    if (mountHost.isConnected === true) {
      observeParent(mountHost.parentNode || resolveMountParent());
      restoreAttempts = 0;
      return true;
    }
    const parent = resolveMountParent();
    if (!parent) {
      return false;
    }
    observeParent(parent);
    try {
      parent.appendChild(mountHost);
    } catch (_error) {
      return false;
    }
    if (!isInDocument(mountHost)) {
      return false;
    }
    restoreAttempts = 0;
    if (typeof settings.onRestore === 'function') {
      try {
        settings.onRestore(mountHost, parent);
      } catch (_error) {
        // Reconnection itself succeeded; optional UI restoration is best effort.
      }
    }
    return true;
  }

  function scheduleRestore(): void {
    if (!active || !mountHost || mountHost.isConnected === true || restoreTimer !== null) {
      return;
    }
    const delay = restoreAttempts > 0 ? RESTORE_RETRY_MS : 0;
    restoreTimer = targetWindow.setTimeout(() => {
      restoreTimer = null;
      if (ensureConnected()) {
        return;
      }
      restoreAttempts += 1;
      if (restoreAttempts < MAX_RESTORE_ATTEMPTS) {
        scheduleRestore();
      }
    }, delay);
  }

  function handleDocumentMutation(): void {
    if (!active || !mountHost) {
      return;
    }
    observeParent(mountHost.isConnected === true
      ? mountHost.parentNode
      : resolveMountParent());
    if (mountHost.isConnected !== true) {
      scheduleRestore();
    }
  }

  function start(host: HTMLElement | null): void {
    stop();
    if (!host) {
      return;
    }
    active = true;
    mountHost = host;
    if (doc && typeof MutationObserverCtor === 'function') {
      const observer = new MutationObserverCtor(handleDocumentMutation);
      documentObserver = observer;
      observer.observe(doc, { childList: true });
    }
    observeParent(host.parentNode || resolveMountParent());
    if (typeof targetWindow.addEventListener === 'function') {
      targetWindow.addEventListener('fullscreenchange', handleDocumentMutation);
    }
    if (host.isConnected !== true) {
      scheduleRestore();
    }
  }

  function stop(): void {
    active = false;
    clearRestoreTimer();
    restoreAttempts = 0;
    if (documentObserver) {
      documentObserver.disconnect();
      documentObserver = null;
    }
    if (parentObserver) {
      parentObserver.disconnect();
      parentObserver = null;
    }
    if (typeof targetWindow.removeEventListener === 'function') {
      targetWindow.removeEventListener('fullscreenchange', handleDocumentMutation);
    }
    observedParent = null;
    mountHost = null;
  }

  return Object.freeze({
    ensureConnected,
    start,
    stop
  });
}

// Keeps page translators out of the panel: marks what the panel adds as
// not to translate, and backs off when the page changes too much to watch.
function createAntiTranslateGuard(win?: HostWindow | null, deps?: AntiTranslateGuardHelpers | null) {
  const targetWindow = win || window;
  const helpers: AntiTranslateGuardHelpers = deps && typeof deps === 'object' ? deps : {};
  const applyNoTranslateDeep = typeof helpers.applyNoTranslateDeep === 'function'
    ? helpers.applyNoTranslateDeep
    : (node: Element) => node;
  const restoreProtectedNode = typeof helpers.restoreProtectedNode === 'function'
    ? helpers.restoreProtectedNode
    : () => false;
  const restoreProtectedAncestors = typeof helpers.restoreProtectedAncestors === 'function'
    ? helpers.restoreProtectedAncestors
    : () => false;
  const MutationObserverCtor = targetWindow.MutationObserver;
  const NodeCtor = targetWindow.Node;
  const GUARD_WINDOW_MS = 1500;
  const MAX_MUTATIONS_PER_WINDOW = 120;
  const MAX_CALLBACKS_PER_WINDOW = 12;
  const BACKOFF_MS = 900;
  const SCROLL_PAUSE_MS = 180;

  let observer: MutationObserver | null = null;
  let state: AntiTranslateGuardState | null = null;
  let scrollPauseResumeTimer: number | null = null;

  function isElementNode(node: Node): node is Element {
    return node.nodeType === NodeCtor.ELEMENT_NODE;
  }

  function observeRoot(root: Element): void {
    if (!observer || !root || !root.isConnected) {
      return;
    }
    observer.observe(root, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function restoreProtectedSubtree(root: Element): void {
    if (!root || !NodeCtor || root.nodeType !== NodeCtor.ELEMENT_NODE) {
      return;
    }
    const nodes: Element[] = [root];
    if (typeof root.querySelectorAll === 'function') {
      root.querySelectorAll('*').forEach((node) => {
        nodes.push(node);
      });
    }
    nodes.forEach((node) => {
      restoreProtectedNode(node);
    });
  }

  function stop(): void {
    if (scrollPauseResumeTimer !== null) {
      targetWindow.clearTimeout(scrollPauseResumeTimer);
      scrollPauseResumeTimer = null;
    }
    if (state && state.flushTimer) {
      targetWindow.clearTimeout(state.flushTimer);
    }
    if (state && state.resumeTimer) {
      targetWindow.clearTimeout(state.resumeTimer);
    }
    state = null;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function pauseForTransientMutations(): void {
    const activeState = state;
    if (!activeState || activeState.resumeTimer || activeState.pauseReason === 'backoff') {
      return;
    }
    if (!activeState.paused) {
      activeState.paused = true;
      activeState.pauseReason = 'transient';
      if (activeState.flushTimer) {
        targetWindow.clearTimeout(activeState.flushTimer);
        activeState.flushTimer = null;
      }
      if (observer) {
        observer.disconnect();
      }
    } else if (activeState.pauseReason !== 'transient') {
      return;
    }
    if (scrollPauseResumeTimer !== null) {
      targetWindow.clearTimeout(scrollPauseResumeTimer);
    }
    scrollPauseResumeTimer = targetWindow.setTimeout(() => {
      scrollPauseResumeTimer = null;
      const currentState = state;
      if (!currentState || currentState !== activeState || currentState.resumeTimer ||
          currentState.pauseReason !== 'transient') {
        return;
      }
      if (!activeState.root || !activeState.root.isConnected) {
        return;
      }
      activeState.guardWindowStartedAt = 0;
      activeState.mutationCountInWindow = 0;
      activeState.callbackCountInWindow = 0;
      activeState.pendingProtectedNodes.clear();
      activeState.pendingNoTranslateRoots.clear();
      activeState.paused = false;
      activeState.pauseReason = '';
      observeRoot(activeState.root);
    }, SCROLL_PAUSE_MS);
  }

  function backoff(reason: string, detail: Record<string, number> | null): void {
    const activeState = state;
    if (!activeState || activeState.paused) {
      return;
    }
    activeState.paused = true;
    activeState.pauseReason = 'backoff';
    if (activeState.flushTimer) {
      targetWindow.clearTimeout(activeState.flushTimer);
      activeState.flushTimer = null;
    }
    if (observer) {
      observer.disconnect();
    }
    activeState.pendingProtectedNodes.clear();
    activeState.pendingNoTranslateRoots.clear();
    if (activeState.resumeTimer) {
      targetWindow.clearTimeout(activeState.resumeTimer);
    }
    activeState.resumeTimer = targetWindow.setTimeout(() => {
      const currentState = state;
      if (!currentState || currentState !== activeState) {
        return;
      }
      activeState.resumeTimer = null;
      if (!activeState.root || !activeState.root.isConnected) {
        return;
      }
      applyNoTranslateDeep(activeState.root);
      restoreProtectedSubtree(activeState.root);
      activeState.guardWindowStartedAt = 0;
      activeState.mutationCountInWindow = 0;
      activeState.callbackCountInWindow = 0;
      activeState.paused = false;
      activeState.pauseReason = '';
      observeRoot(activeState.root);
    }, BACKOFF_MS);
    try {
      targetWindow.console.warn('[Lumno] Backing off overlay anti-translate observer to avoid DOM churn', {
        reason: reason || 'unknown',
        detail: detail || null
      });
    } catch (_error) {
      // Ignore console serialization failures.
    }
  }

  function start(root: Element | null): void {
    stop();
    if (!root || typeof MutationObserverCtor !== 'function') {
      return;
    }
    let isRestoring = false;
    state = {
      root,
      flushTimer: null,
      pendingProtectedNodes: new Set(),
      pendingNoTranslateRoots: new Set(),
      guardWindowStartedAt: 0,
      mutationCountInWindow: 0,
      callbackCountInWindow: 0,
      paused: false,
      pauseReason: '',
      resumeTimer: null
    };
    observer = new MutationObserverCtor((mutations: MutationRecord[]) => {
      const activeState = state;
      if (isRestoring || !activeState || activeState.paused) {
        return;
      }
      const now = Date.now();
      if (!activeState.guardWindowStartedAt || now - activeState.guardWindowStartedAt > GUARD_WINDOW_MS) {
        activeState.guardWindowStartedAt = now;
        activeState.mutationCountInWindow = 0;
        activeState.callbackCountInWindow = 0;
      }
      activeState.mutationCountInWindow += mutations.length;
      activeState.callbackCountInWindow += 1;
      if (activeState.mutationCountInWindow > MAX_MUTATIONS_PER_WINDOW ||
          activeState.callbackCountInWindow > MAX_CALLBACKS_PER_WINDOW) {
        backoff('mutation-budget-exceeded', {
          mutationCountInWindow: activeState.mutationCountInWindow,
          callbackCountInWindow: activeState.callbackCountInWindow
        });
        return;
      }
      mutations.forEach((mutation) => {
        const target = mutation.target;
        if (target) {
          const restored = restoreProtectedAncestors(target, root);
          if (!restored && isElementNode(target)) {
            activeState.pendingNoTranslateRoots.add(target);
          }
        }
        mutation.addedNodes.forEach((node) => {
          if (isElementNode(node)) {
            activeState.pendingNoTranslateRoots.add(node);
          }
          let current: Element | null = isElementNode(node) ? node : node.parentElement;
          while (current) {
            // An element that renders itself again after a translator.
            if ('_xProtectedRender' in current && typeof current._xProtectedRender === 'function') {
              activeState.pendingProtectedNodes.add(current);
              break;
            }
            if (current === root) {
              break;
            }
            current = current.parentElement;
          }
        });
      });
      if (activeState.pendingProtectedNodes.size <= 0 && activeState.pendingNoTranslateRoots.size <= 0) {
        return;
      }
      if (activeState.flushTimer) {
        return;
      }
      activeState.flushTimer = targetWindow.setTimeout(() => {
        const currentState = state;
        if (!currentState || currentState !== activeState || currentState.paused) {
          return;
        }
        activeState.flushTimer = null;
        const noTranslateRoots = Array.from(activeState.pendingNoTranslateRoots);
        const protectedNodes = Array.from(activeState.pendingProtectedNodes);
        activeState.pendingNoTranslateRoots.clear();
        activeState.pendingProtectedNodes.clear();
        isRestoring = true;
        if (observer) {
          observer.disconnect();
        }
        noTranslateRoots.forEach((node) => {
          applyNoTranslateDeep(node);
        });
        protectedNodes.forEach((node) => {
          restoreProtectedNode(node);
        });
        isRestoring = false;
        observeRoot(root);
      }, 0);
    });
    observeRoot(root);
  }

  return Object.freeze({
    pauseForMutationBurst: pauseForTransientMutations,
    pauseForScroll: pauseForTransientMutations,
    start,
    stop
  });
}

// Teardown steps owned by one overlay session, run newest first. A failing
// step never keeps the rest of the session alive.
function createSessionCleanupRegistry() {
  const cleanups: Array<() => void> = [];
  return Object.freeze({
    add(cleanup: () => void): () => void {
      if (typeof cleanup === 'function') {
        cleanups.push(cleanup);
      }
      return cleanup;
    },
    run(): void {
      while (cleanups.length > 0) {
        const cleanup = cleanups.pop();
        try {
          if (cleanup) {
            cleanup();
          }
        } catch (_error) {
          // Keep releasing the remaining steps.
        }
      }
    },
    get size() { return cleanups.length; }
  });
}

// Every invocation of the overlay helper runs in its own closure, so a later
// invocation (the next hotkey press, or a re-injected runtime) cannot reach
// the listeners an earlier one registered. Each session therefore listens on
// its mount host for this event and tears itself down when asked. DOM events
// cross isolated worlds, which also lets a fresh extension context retire an
// overlay left behind by a reloaded one; the detail stays a string for the
// same reason.
const SESSION_DESTROY_EVENT = '_x_extension_overlay_session_destroy_2026_unique_';
const SESSION_PRESERVE_LOADING_INTENT = 'preserve-loading-intent';
const SESSION_ANIMATE_EXIT = 'animate-exit';

function readEventDetail(event: Event): unknown {
  return 'detail' in event ? event.detail : undefined;
}

function onSessionDestroyRequest(host: EventTarget | null, destroy: (options: SessionDestroyOptions) => void): () => void {
  if (!host || typeof host.addEventListener !== 'function' || typeof destroy !== 'function') {
    return () => {};
  }
  const handleDestroyRequest = (event: Event): void => {
    const detail = readEventDetail(event);
    const animateExit = Boolean(event) && detail === SESSION_ANIMATE_EXIT;
    // An animated exit keeps listening, so a later request (a press that
    // reopens the overlay) can still finish the session at once.
    if (!animateExit) {
      host.removeEventListener(SESSION_DESTROY_EVENT, handleDestroyRequest);
    }
    destroy({
      preserveLoadingIntent: Boolean(event) &&
        detail === SESSION_PRESERVE_LOADING_INTENT,
      animateExit
    });
  };
  host.addEventListener(SESSION_DESTROY_EVENT, handleDestroyRequest);
  return () => {
    host.removeEventListener(SESSION_DESTROY_EVENT, handleDestroyRequest);
  };
}

// Asks the session mounted on `host` to tear itself down. Returns true when
// the host has left the document afterwards.
function requestSessionDestroy(
  host: Element | null,
  options?: { preserveLoadingIntent?: boolean; animateExit?: boolean } | null
): boolean {
  if (!host || typeof host.dispatchEvent !== 'function') {
    return false;
  }
  const doc = host.ownerDocument;
  const win = doc && doc.defaultView;
  const CustomEventCtor = (win && win.CustomEvent) ||
    (typeof CustomEvent === 'function' ? CustomEvent : null);
  if (CustomEventCtor) {
    host.dispatchEvent(new CustomEventCtor(SESSION_DESTROY_EVENT, {
      detail: options && options.preserveLoadingIntent === true
        ? SESSION_PRESERVE_LOADING_INTENT
        : (options && options.animateExit === true ? SESSION_ANIMATE_EXIT : '')
    }));
  }
  return host.isConnected !== true;
}

export {
  createAntiTranslateGuard,
  createChromeEventListenerRegistry,
  createFrameTracker,
  createMountConnectionGuard,
  createSessionCleanupRegistry,
  createViewportSizeSync,
  onSessionDestroyRequest,
  requestSessionDestroy
};
export type { AntiTranslateGuardHelpers, MountConnectionGuardConfig, OverlaySizePreset, SessionDestroyOptions, ViewportSizeSyncConfig };
