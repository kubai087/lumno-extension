// A host-specific fix: on matching sites the panel waits for its styles.
interface SiteFix {
  id: string;
  hosts?: readonly string[];
  waitForStyleSheets?: boolean;
  styleIds: readonly string[];
  maxWaitMs: number;
}

// The window the gate reads its host and timers from.
interface SiteFixWindow {
  location?: { hostname?: string };
  setTimeout?: Window['setTimeout'];
  clearTimeout?: Window['clearTimeout'];
  requestAnimationFrame?: Window['requestAnimationFrame'];
  cancelAnimationFrame?: Window['cancelAnimationFrame'];
}

// What the gate needs of a <link rel="stylesheet">.
interface StylesheetLink {
  sheet?: unknown;
  dataset?: Record<string, string | undefined>;
  addEventListener(type: 'load' | 'error', listener: () => void, options?: AddEventListenerOptions): void;
  removeEventListener(type: 'load' | 'error', listener: () => void): void;
}

// Where the panel's style links live: its shadow root.
interface StyleRoot {
  getElementById?(id: string): unknown;
  querySelector?(selectors: string): unknown;
}

// What the gate needs of the panel.
interface RevealOverlay {
  style?: { setProperty?(name: string, value: string, priority?: string): void; removeProperty(name: string): unknown };
  setAttribute(name: string, value: string): void;
  removeAttribute?(name: string): void;
}

interface RevealResult {
  ok: boolean;
  reason: string;
}

interface RevealGateOptions {
  overlay?: RevealOverlay | null;
  styleRoot?: StyleRoot | null;
  styleIds?: string[];
  maxWaitMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isStyleRoot(value: unknown): value is StyleRoot {
  return isRecord(value) && (typeof value.getElementById === 'function' || typeof value.querySelector === 'function');
}

const OVERLAY_STYLE_IDS = Object.freeze({
  input: '_x_extension_input_component_style_2026_unique_',
  suggestions: '_x_extension_overlay_suggestions_style_2026_unique_'
});
const OVERLAY_STYLE_FALLBACK_ATTRIBUTE = 'data-lumno-site-fix-style-fallback';

const OVERLAY_STYLE_REVEAL_POLICY: Readonly<SiteFix> = Object.freeze({
  id: 'overlay-critical-style-reveal',
  waitForStyleSheets: true,
  styleIds: Object.freeze([
    OVERLAY_STYLE_IDS.input,
    OVERLAY_STYLE_IDS.suggestions
  ]),
  maxWaitMs: 80
});

const SITE_FIXES: readonly SiteFix[] = Object.freeze([]);

function normalizeHostname(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/\.$/, '')
    .toLowerCase();
}

function getWindowHostname(win?: SiteFixWindow | null): string {
  const targetWindow = win || (typeof window !== 'undefined' ? window : null);
  const locationLike = targetWindow && targetWindow.location ? targetWindow.location : null;
  return normalizeHostname(locationLike && locationLike.hostname ? locationLike.hostname : '');
}

function hostMatchesRule(hostname: string, rule: string): boolean {
  const host = normalizeHostname(hostname);
  const normalizedRule = normalizeHostname(rule);
  if (!host || !normalizedRule) {
    return false;
  }
  return host === normalizedRule || host.endsWith(`.${normalizedRule}`);
}

function getActiveFixes(win?: SiteFixWindow | null): SiteFix[] {
  const hostname = getWindowHostname(win);
  if (!hostname) {
    return [];
  }
  return SITE_FIXES.filter((fix) => {
    const hosts = Array.isArray(fix.hosts) ? fix.hosts : [];
    return hosts.some((host) => hostMatchesRule(hostname, host));
  });
}

function escapeAttributeValue(value: string): string {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function findById(rootNode: StyleRoot | null, id: string): unknown {
  if (!rootNode || !id) {
    return null;
  }
  if (typeof rootNode.getElementById === 'function') {
    return rootNode.getElementById(id);
  }
  if (typeof rootNode.querySelector === 'function') {
    return rootNode.querySelector(`[id="${escapeAttributeValue(id)}"]`);
  }
  return null;
}

function isStylesheetLink(node: unknown): node is StylesheetLink {
  if (!isRecord(node) || typeof node.getAttribute !== 'function' ||
      typeof node.addEventListener !== 'function' || typeof node.removeEventListener !== 'function') {
    return false;
  }
  const relAttribute: unknown = Reflect.apply(node.getAttribute, node, ['rel']);
  const rel = String(relAttribute || node.rel || '').toLowerCase();
  return rel.split(/\s+/).includes('stylesheet');
}

function isStylesheetLoaded(link: StylesheetLink | null): boolean {
  if (!link) {
    return true;
  }
  if (link.dataset && link.dataset.lumnoStylesheetReady === 'true') {
    return true;
  }
  try {
    if (link.sheet) {
      return true;
    }
  } catch (_error) {
    return false;
  }
  return false;
}

function markStylesheetReady(link: StylesheetLink): void {
  if (link && link.dataset) {
    link.dataset.lumnoStylesheetReady = 'true';
  }
}

function collectStyleLinks(rootNode: StyleRoot, styleIds: readonly string[]): StylesheetLink[] {
  const ids = Array.isArray(styleIds) ? styleIds : [];
  const links: StylesheetLink[] = [];
  ids.forEach((id) => {
    const link = findById(rootNode, id);
    if (isStylesheetLink(link) && !links.includes(link)) {
      links.push(link);
    }
  });
  return links;
}

function getTimerWindow(win?: SiteFixWindow | null): SiteFixWindow | null {
  return win || (typeof window !== 'undefined' ? window : null);
}

// Resolves once every link loaded, or with ok false on an error or when
// maxWaitMs ran out; onAllLoaded still runs if they load later.
function waitForStyleLinks(
  win: SiteFixWindow | null | undefined,
  links: StylesheetLink[],
  maxWaitMs: number,
  onAllLoaded?: () => void
): Promise<RevealResult> {
  const targetWindow = getTimerWindow(win);
  const pendingLinks = (Array.isArray(links) ? links : []).filter((link) => !isStylesheetLoaded(link));
  if (pendingLinks.length === 0) {
    (Array.isArray(links) ? links : []).forEach(markStylesheetReady);
    if (typeof onAllLoaded === 'function') {
      onAllLoaded();
    }
    return Promise.resolve({ ok: true, reason: 'already-loaded' });
  }
  const setTimer = targetWindow ? targetWindow.setTimeout : undefined;
  if (!targetWindow || typeof setTimer !== 'function') {
    return Promise.resolve({ ok: false, reason: 'timer-unavailable' });
  }

  return new Promise((resolve) => {
    let initialResultSettled = false;
    let remaining = pendingLinks.length;
    let timer: number | null = null;
    let raf: number | null = null;
    const cleanups: Array<() => void> = [];
    const readyLinks = new Set<StylesheetLink>();

    const settleInitialResult = (ok: boolean, reason: string): void => {
      if (initialResultSettled) {
        return;
      }
      initialResultSettled = true;
      if (timer !== null && typeof targetWindow.clearTimeout === 'function') {
        targetWindow.clearTimeout(timer);
        timer = null;
      }
      if (raf !== null && typeof targetWindow.cancelAnimationFrame === 'function') {
        targetWindow.cancelAnimationFrame(raf);
        raf = null;
      }
      resolve({ ok: Boolean(ok), reason: reason || (ok ? 'loaded' : 'unknown') });
    };

    const handleReady = (link: StylesheetLink, reason: string): void => {
      if (readyLinks.has(link)) {
        return;
      }
      readyLinks.add(link);
      markStylesheetReady(link);
      remaining -= 1;
      if (remaining <= 0) {
        cleanups.forEach((cleanup) => cleanup());
        if (typeof onAllLoaded === 'function') {
          onAllLoaded();
        }
        settleInitialResult(true, reason || 'loaded');
      }
    };

    pendingLinks.forEach((link) => {
      if (!link || typeof link.addEventListener !== 'function') {
        handleReady(link, 'listener-unavailable');
        return;
      }
      const onLoad = () => handleReady(link, 'loaded');
      // A failed local stylesheet must keep the inline fallback active rather
      // than treating the error as if the component CSS had applied.
      const onError = () => settleInitialResult(false, 'error');
      link.addEventListener('load', onLoad, { once: true });
      link.addEventListener('error', onError, { once: true });
      cleanups.push(() => {
        link.removeEventListener('load', onLoad);
        link.removeEventListener('error', onError);
      });
    });

    if (typeof targetWindow.requestAnimationFrame === 'function') {
      raf = targetWindow.requestAnimationFrame(() => {
        raf = null;
        const stillPending = pendingLinks.filter((link) => !isStylesheetLoaded(link));
        if (stillPending.length === 0) {
          pendingLinks.forEach((link) => handleReady(link, 'loaded-after-frame'));
        }
      });
    }

    const waitMs = Math.max(0, Number(maxWaitMs) || 0);
    if (waitMs > 0) {
      timer = setTimer.call(targetWindow, () => {
        // Keep load listeners alive after the first-frame budget expires:
        // the panel can reveal with its safe fallback now and upgrade as soon
        // as the real stylesheets finish loading.
        settleInitialResult(false, 'timeout');
      }, waitMs);
    }
  });
}

function setOverlayDeferredVisibility(overlay: RevealOverlay, enabled: boolean, fixId: string): void {
  const style = overlay ? overlay.style : undefined;
  if (!style || typeof style.setProperty !== 'function') {
    return;
  }
  if (enabled) {
    overlay.setAttribute('data-lumno-site-fix-reveal', fixId || 'waiting');
    style.setProperty('visibility', 'hidden', 'important');
    return;
  }
  if (typeof overlay.removeAttribute === 'function') {
    overlay.removeAttribute('data-lumno-site-fix-reveal');
  }
  style.removeProperty('visibility');
}

function setOverlayStyleFallback(overlay: RevealOverlay, enabled: boolean, fixId: string): void {
  if (!overlay || typeof overlay.setAttribute !== 'function') {
    return;
  }
  if (enabled) {
    overlay.setAttribute(OVERLAY_STYLE_FALLBACK_ATTRIBUTE, fixId || 'waiting');
    return;
  }
  if (typeof overlay.removeAttribute === 'function') {
    overlay.removeAttribute(OVERLAY_STYLE_FALLBACK_ATTRIBUTE);
  }
}

function createNoopRevealGate(): RevealGate {
  return Object.freeze({
    active: false,
    fixId: '',
    waitUntilReady: () => Promise.resolve({ ok: true, reason: 'not-needed' }),
    isReady: () => true,
    release: () => {},
    cancel: () => {}
  });
}

// Keeps the panel hidden until its stylesheets load, for at most the
// fix's wait; past that it shows with the inline fallback styles.
function createOverlayRevealGate(win?: SiteFixWindow | null, options?: RevealGateOptions | null): RevealGate {
  const settings: RevealGateOptions = options && typeof options === 'object' ? options : {};
  const activeFix = getActiveFixes(win).find((fix) => fix && fix.waitForStyleSheets) ||
    OVERLAY_STYLE_REVEAL_POLICY;

  const overlay = settings.overlay || null;
  const shadowRoot: unknown = overlay ? Reflect.get(overlay, '_lumnoOverlayRoot') : null;
  const styleRoot = settings.styleRoot || (isStyleRoot(shadowRoot) ? shadowRoot : null);
  if (!overlay || !styleRoot) {
    return createNoopRevealGate();
  }
  // Narrowed here, for the functions below.
  const panel: RevealOverlay = overlay;
  const root: StyleRoot = styleRoot;

  const styleIds = Array.isArray(settings.styleIds) && settings.styleIds.length > 0
    ? settings.styleIds
    : activeFix.styleIds;
  const maxWaitMs = Number.isFinite(Number(settings.maxWaitMs))
    ? Number(settings.maxWaitMs)
    : activeFix.maxWaitMs;
  let released = false;
  let stylesReady = false;
  let waitPromise: Promise<RevealResult & { fixId: string }> | null = null;

  setOverlayDeferredVisibility(panel, true, activeFix.id);

  function release(): void {
    if (released) {
      return;
    }
    released = true;
    setOverlayStyleFallback(panel, !stylesReady, activeFix.id);
    setOverlayDeferredVisibility(panel, false, activeFix.id);
  }

  function cancel(): void {
    released = true;
    setOverlayDeferredVisibility(panel, false, activeFix.id);
    setOverlayStyleFallback(panel, false, activeFix.id);
  }

  function waitUntilReady(): Promise<RevealResult & { fixId: string }> {
    if (!waitPromise) {
      const links = collectStyleLinks(root, styleIds);
      if (links.length === 0) {
        waitPromise = Promise.resolve({
          ok: false,
          reason: 'stylesheets-not-found',
          fixId: activeFix.id
        });
      } else {
        // The entry animation already commits its hidden initial state across two frames.
        // Adding paint frames here would delay every overlay reveal without extra protection.
        waitPromise = waitForStyleLinks(win, links, maxWaitMs, () => {
          stylesReady = true;
          setOverlayStyleFallback(panel, false, activeFix.id);
        }).then((result) => ({
          ok: Boolean(result && result.ok),
          reason: result && result.reason ? result.reason : 'unknown',
          fixId: activeFix.id
        }));
      }
    }
    return waitPromise;
  }

  // Whether the styles have loaded by now. waitUntilReady settles once the
  // first-frame budget expires, while the stylesheets may still finish loading
  // before the panel is actually revealed.
  function isReady(): boolean {
    return stylesReady;
  }

  return Object.freeze({
    active: true,
    fixId: activeFix.id,
    waitUntilReady,
    isReady,
    release,
    cancel
  });
}

// The panel's reveal gate; inactive where nothing needs to wait.
interface RevealGate {
  readonly active: boolean;
  readonly fixId: string;
  waitUntilReady(): Promise<RevealResult & { fixId?: string }>;
  // Whether the styles have loaded by now, even after waitUntilReady gave up.
  isReady(): boolean;
  release(): void;
  cancel(): void;
}

export {
  OVERLAY_STYLE_IDS,
  OVERLAY_STYLE_REVEAL_POLICY,
  SITE_FIXES,
  createOverlayRevealGate,
  getActiveFixes,
  hostMatchesRule
};
export type { RevealGate, RevealGateOptions, RevealOverlay, SiteFix, StyleRoot, StylesheetLink };
