// Watches keys in every frame: the show-search shortcut as a fallback for
// pages the browser command does not reach, the release of the tab
// switcher's modifier, which commits the switch, and in the top frame the
// keys typed while the overlay opens (overlay-type-ahead.ts).
import * as SHORTCUT_KEY_MATCHER from '../domain/shortcut-key-matcher';
import * as OVERLAY_FONT_FACES from '../shared/overlay-font-faces';
import type { KeyDescriptor, ShortcutSpec } from '../domain/shortcut-key-matcher';
import type { PageReply } from '../domain/messages';
import * as LumnoMessaging from '../platform/messaging';
import { claimContentScript, isOverlayOpenState, setOverlayTypeAhead } from '../platform/content-registry';
import { OverlayTypeAhead } from './overlay-type-ahead';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

(function() {
  // The manifest runs this in every frame, and the worker injects it again
  // into frames that may already run it (on tab switcher commands, and into
  // tabs opened before an install); the first one keeps observing, with what
  // it already knows.
  if (!claimContentScript('shortcut-key-observer')) {
    return;
  }
  // The configured shortcut lives in chrome.commands, which a content script
  // cannot read or observe, so it is fetched from the background. Asking on
  // every keydown woke the service worker from every frame while the user
  // typed; instead the frame asks once at startup and again when its window
  // regains focus, its tab becomes visible or the page comes back from the
  // back/forward cache (the user may have edited the shortcut in
  // chrome://extensions/shortcuts meanwhile). The interval folds the focus and
  // visibilitychange that arrive together on a tab switch into one request.
  const SHOW_SEARCH_SHORTCUT_REFRESH_MIN_INTERVAL_MS = 2000;
  const RELEASE_REPLAY_WINDOW_MS = 5000;
  let showSearchShortcutRaw = '';
  let showSearchShortcutSpec: ShortcutSpec | null = null;
  let showSearchShortcutRefreshedAt = 0;
  // Whether the background has answered; until then a replacement asks again
  // instead of inheriting a request whose answer reaches the old observer.
  let showSearchShortcutResolved = false;
  let armedReleaseKeys: string[] = [];
  const recentTrustedKeydownAtByKey = new Map<string, number>();
  const recentTrustedReleaseAtByKey = new Map<string, number>();
  // The overlay opens in the top frame only, so only it holds typed keys.
  const overlayTypeAhead = window.top === window
    ? new OverlayTypeAhead(window, { isOverlayOpen: isOverlayOpenState })
    : null;
  if (overlayTypeAhead) {
    setOverlayTypeAhead(overlayTypeAhead);
  }

  function notifyTopFrameDocumentStarted(): void {
    if (window.top !== window) {
      return;
    }
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'notifyTopFrameDocumentStarted',
        documentUrl: location && location.href ? location.href : '',
        documentReadyState: document.readyState,
        observedAt: Date.now()
      }, () => {
        void (chrome.runtime && chrome.runtime.lastError);
      });
    } catch (_error) {
      // Ignore an extension context invalidated while this Document commits.
    }
  }

  // The search overlay opens in the top frame only, and its faces cost
  // nothing before the page first lays out (see overlay-font-faces.ts).
  function registerOverlayFontFaces(): void {
    if (window.top !== window) {
      return;
    }
    try {
      OVERLAY_FONT_FACES.registerEarlyOverlayFontFaces(window, {
        getUrl: (assetPath) => chrome.runtime.getURL(assetPath),
        lang: chrome.i18n && typeof chrome.i18n.getUILanguage === 'function'
          ? chrome.i18n.getUILanguage()
          : ''
      });
    } catch (_error) {
      // Ignore an extension context invalidated while this Document commits.
    }
  }

  function applyShowSearchShortcut(shortcut: unknown): void {
    const nextShortcut = String(shortcut || '').trim();
    showSearchShortcutRaw = nextShortcut;
    showSearchShortcutResolved = true;
    showSearchShortcutSpec = SHORTCUT_KEY_MATCHER.parseShortcut(nextShortcut);
  }

  function refreshShowSearchShortcut(): void {
    const now = Date.now();
    if ((now - showSearchShortcutRefreshedAt) < SHOW_SEARCH_SHORTCUT_REFRESH_MIN_INTERVAL_MS) {
      return;
    }
    showSearchShortcutRefreshedAt = now;
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'getShowSearchShortcut' }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          return;
        }
        const nextShortcut = response && typeof response.shortcut === 'string'
          ? response.shortcut
          : '';
        if (nextShortcut === showSearchShortcutRaw) {
          showSearchShortcutResolved = true;
          return;
        }
        applyShowSearchShortcut(nextShortcut);
      });
    } catch (_error) {
      // Ignore an extension context invalidated during reload or navigation.
    }
  }

  // Before the shortcut is known, the background checks the keys itself.
  function relayUnresolvedShowSearchShortcut(descriptor: KeyDescriptor | null): void {
    if (!descriptor) {
      return;
    }
    if (!SHORTCUT_KEY_MATCHER.canBeChromeCommandShortcut(descriptor)) {
      return;
    }
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'triggerShowSearchFromPageHotkey',
        documentUrl: location && location.href ? location.href : '',
        documentIsTop: window.top === window,
        observedAt: Date.now(),
        observedShortcut: descriptor,
        requiresShortcutVerification: true,
        trustedShortcutFallback: true
      }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          return;
        }
        if (response && typeof response.shortcut === 'string') {
          applyShowSearchShortcut(response.shortcut);
        }
      });
    } catch (_error) {
      // Ignore an extension context invalidated during reload or navigation.
    }
  }

  function relayShowSearchShortcut(event: KeyboardEvent): void {
    if (!event || event.isTrusted !== true || event.isComposing || event.repeat) {
      return;
    }
    rememberTrustedShortcutKeydown(event);
    const descriptor = SHORTCUT_KEY_MATCHER.describeKeyboardEvent(event);
    if (!showSearchShortcutSpec) {
      relayUnresolvedShowSearchShortcut(descriptor);
      return;
    }
    if (!SHORTCUT_KEY_MATCHER.descriptorMatchesShortcut(descriptor, showSearchShortcutSpec)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (overlayTypeAhead) {
      overlayTypeAhead.arm();
    }
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'triggerShowSearchFromPageHotkey',
        documentUrl: location && location.href ? location.href : '',
        documentIsTop: window.top === window,
        observedAt: Date.now(),
        trustedShortcutFallback: true
      }, () => {
        void (chrome.runtime && chrome.runtime.lastError);
      });
    } catch (_error) {
      // Ignore an extension context invalidated during reload or navigation.
    }
  }

  function normalizeReleaseKey(value: unknown): string {
    const key = String(value || '');
    return key.length === 1 ? key.toLowerCase() : key;
  }

  function normalizeReleaseCode(value: unknown): string {
    const code = String(value || '');
    if (/^Key[A-Z]$/.test(code)) {
      return code.slice(3).toLowerCase();
    }
    if (/^Digit\d$/.test(code)) {
      return code.slice(5);
    }
    const aliases: Readonly<Record<string, string>> = {
      Backquote: '`',
      Backslash: '\\',
      BracketLeft: '[',
      BracketRight: ']',
      Comma: ',',
      Equal: '=',
      Minus: '-',
      Period: '.',
      Quote: "'",
      Semicolon: ';',
      Slash: '/'
    };
    return Object.prototype.hasOwnProperty.call(aliases, code) ? aliases[code] : '';
  }

  function getShortcutReleaseCandidates(event: KeyboardEvent): string[] {
    return Array.from(new Set([
      normalizeReleaseKey(event && event.key),
      normalizeReleaseCode(event && event.code)
    ].filter(Boolean)));
  }

  function getShortcutKeydownCandidates(event: KeyboardEvent): string[] {
    const candidates = getShortcutReleaseCandidates(event);
    if (event && event.altKey) {
      candidates.push('Alt');
    }
    if (event && event.ctrlKey) {
      candidates.push('Control');
    }
    if (event && event.metaKey) {
      candidates.push('Meta');
    }
    if (event && event.shiftKey) {
      candidates.push('Shift');
    }
    return Array.from(new Set(candidates));
  }

  function pruneTrustedShortcutEvents(now: number): void {
    [recentTrustedKeydownAtByKey, recentTrustedReleaseAtByKey].forEach((eventsByKey) => {
      eventsByKey.forEach((observedAt, key) => {
        if ((now - observedAt) > RELEASE_REPLAY_WINDOW_MS) {
          eventsByKey.delete(key);
        }
      });
    });
  }

  function rememberTrustedShortcutKeydown(event: KeyboardEvent): void {
    const pressedAt = Date.now();
    pruneTrustedShortcutEvents(pressedAt);
    getShortcutKeydownCandidates(event).forEach((key) => {
      recentTrustedKeydownAtByKey.set(key, pressedAt);
    });
  }

  function getReleasedShortcutKey(event: KeyboardEvent): string {
    return getShortcutReleaseCandidates(event)
      .find((key) => armedReleaseKeys.includes(key)) || '';
  }

  function rememberTrustedShortcutRelease(event: KeyboardEvent): void {
    const releasedAt = Date.now();
    pruneTrustedShortcutEvents(releasedAt);
    getShortcutReleaseCandidates(event).forEach((key) => {
      recentTrustedReleaseAtByKey.set(key, releasedAt);
    });
  }

  // A modifier released just before the switcher command arrived: its
  // keyup came first, so the release is replayed from what was heard.
  function getBufferedReleasedShortcutKey(keys: string[], commandStartedAt: unknown): string {
    const startedAt = Number(commandStartedAt);
    if (!Number.isFinite(startedAt) || startedAt <= 0) {
      return '';
    }
    const now = Date.now();
    return keys.find((key) => {
      const observedAt = recentTrustedReleaseAtByKey.get(key);
      if (!isFiniteNumber(observedAt) ||
          (now - observedAt) > RELEASE_REPLAY_WINDOW_MS) {
        return false;
      }
      if (observedAt >= startedAt) {
        return true;
      }
      const keydownAt = recentTrustedKeydownAtByKey.get(key);
      return isFiniteNumber(keydownAt) &&
        keydownAt <= observedAt &&
        (observedAt - keydownAt) <= RELEASE_REPLAY_WINDOW_MS &&
        (startedAt - observedAt) <= RELEASE_REPLAY_WINDOW_MS;
    }) || '';
  }

  function forgetTrustedShortcutRelease(key: string, releasedAt: number | undefined): void {
    // A newer press and release of the same key belongs to a later command.
    if (recentTrustedReleaseAtByKey.get(key) !== releasedAt) {
      return;
    }
    recentTrustedKeydownAtByKey.delete(key);
    recentTrustedReleaseAtByKey.delete(key);
  }

  function relayTabSwitcherShortcutRelease(key: string): void {
    if (!key) {
      return;
    }
    armedReleaseKeys = [];
    // An earlier switcher arms every tab in its window, so a quick release
    // can be relayed live while the next switcher is still opening. Keep it
    // buffered until the background reports a commit, so the arm that
    // follows the open can replay it.
    const releasedAt = recentTrustedReleaseAtByKey.get(key);
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
        action: 'notifyTabSwitcherShortcutModifierReleased',
        key
      }, (response) => {
        void (chrome.runtime && chrome.runtime.lastError);
        if (response && response.committed === true) {
          forgetTrustedShortcutRelease(key, releasedAt);
        }
      });
    } catch (_error) {
      // Ignore stale extension contexts while a tab or the extension reloads.
    }
  }

  const runtimeMessageListener = (
    request: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (reply: PageReply<'armTabSwitcherShortcutRelease'>) => void
  ): void => {
      if (isRecord(request) && overlayTypeAhead &&
          (request.action === 'armOverlayTypeAhead' || request.action === 'cancelOverlayTypeAhead')) {
        if (request.action === 'armOverlayTypeAhead') {
          overlayTypeAhead.arm();
        } else {
          overlayTypeAhead.cancel();
        }
        sendResponse({ ok: true });
        return;
      }
      if (!isRecord(request) || request.action !== 'armTabSwitcherShortcutRelease') {
        return;
      }
      const keys: unknown[] = Array.isArray(request.keys) ? request.keys : [request.key];
      armedReleaseKeys = keys
        .map(normalizeReleaseKey)
        .filter(Boolean);
      const bufferedKey = getBufferedReleasedShortcutKey(
        armedReleaseKeys,
        request.commandStartedAt
      );
      if (bufferedKey) {
        relayTabSwitcherShortcutRelease(bufferedKey);
      }
      sendResponse({ ok: armedReleaseKeys.length > 0 || Boolean(bufferedKey) });
  };

  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(runtimeMessageListener);
  }

  function notifyTabSwitcherShortcutModifierReleased(event: KeyboardEvent): void {
    if (!event || event.isTrusted !== true) {
      return;
    }
    rememberTrustedShortcutRelease(event);
    const key = getReleasedShortcutKey(event);
    if (!key) {
      return;
    }
    relayTabSwitcherShortcutRelease(key);
  }

  // Element focus does not bubble, so a non-capturing listener on window hears
  // only the window itself gaining focus, the one focus that can follow a
  // shortcut edit.
  const refreshShowSearchShortcutOnFocus = (event: FocusEvent): void => {
    if (event && event.target !== window) {
      return;
    }
    refreshShowSearchShortcut();
  };
  // Every frame of a tab becomes visible together; the top frame speaks for
  // the tab and a subframe refreshes when its own window takes focus.
  const refreshShowSearchShortcutOnVisibility = (): void => {
    if (window.top === window && document.visibilityState === 'visible') {
      refreshShowSearchShortcut();
    }
  };
  // A page restored from the back/forward cache keeps this script's state
  // from before it was cached, without running the startup request again.
  const refreshShowSearchShortcutOnPageShow = (event: PageTransitionEvent): void => {
    if (event && event.persisted === true) {
      refreshShowSearchShortcut();
    }
  };

  // Only the observer a Document starts with reports that start and
  // registers the overlay's faces; a sweep of tabs open before an install
  // runs in a page that is already showing.
  if (document.readyState === 'loading') {
    notifyTopFrameDocumentStarted();
    registerOverlayFontFaces();
  }
  // A subframe cannot receive keys before its window takes focus, which
  // refreshes the shortcut, so only the top frame asks at startup. Asking from
  // every frame messaged the worker once per iframe on each page load, ads and
  // about:blank frames included.
  if (!showSearchShortcutResolved && window.top === window) {
    refreshShowSearchShortcut();
  }
  // Before the relay, so the shortcut's own keydown is never held.
  if (overlayTypeAhead) {
    overlayTypeAhead.start();
  }
  window.addEventListener('keydown', relayShowSearchShortcut, true);
  window.addEventListener('keyup', notifyTabSwitcherShortcutModifierReleased, true);
  window.addEventListener('focus', refreshShowSearchShortcutOnFocus);
  window.addEventListener('pageshow', refreshShowSearchShortcutOnPageShow);
  document.addEventListener('visibilitychange', refreshShowSearchShortcutOnVisibility, true);
})();
