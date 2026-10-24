import * as SHORTCUT_KEY_MATCHER from '../shared/shortcut-key-matcher.js';

(function() {
  const RUNTIME_KEY = '_x_extension_shortcut_key_observer_2026_unique_';
  const previousRuntime = window[RUNTIME_KEY];
  // The background injects this script again into frames that may already run
  // it: on every tab switcher command and after an extension reload or update.
  // The replacement takes over the running observer's state, so a modifier
  // release buffered moments before still commits the switcher, and it asks
  // the worker nothing the previous observer already knew.
  let inheritedState = null;
  if (previousRuntime) {
    try {
      inheritedState = typeof previousRuntime.exportState === 'function'
        ? previousRuntime.exportState()
        : null;
    } catch (error) {
      inheritedState = null;
    }
    if (typeof previousRuntime.cleanup === 'function') {
      try {
        previousRuntime.cleanup();
      } catch (error) {
        // A listener from the previous extension context may already be invalid.
      }
    }
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
  let showSearchShortcutSpec = null;
  let showSearchShortcutRefreshedAt = 0;
  // Whether the background has answered; until then a replacement asks again
  // instead of inheriting a request whose answer reaches the old observer.
  let showSearchShortcutResolved = false;
  let tabSwitcherShiftTabEnabled = false;
  let armedPageShortcut = '';
  let armedReleaseKeys = [];
  const recentTrustedKeydownAtByKey = new Map();
  const recentTrustedReleaseAtByKey = new Map();

  function notifyTopFrameDocumentStarted() {
    if (window.top !== window) {
      return;
    }
    try {
      chrome.runtime.sendMessage({
        action: 'notifyTopFrameDocumentStarted',
        documentUrl: location && location.href ? location.href : '',
        documentReadyState: document.readyState,
        observedAt: Date.now()
      }, () => {
        void (chrome.runtime && chrome.runtime.lastError);
      });
    } catch (error) {
      // Ignore an extension context invalidated while this Document commits.
    }
  }

  function adoptInheritedState(state) {
    if (!state || typeof state !== 'object') {
      return;
    }
    if (state.showSearchShortcutResolved === true && typeof state.showSearchShortcut === 'string') {
      applyShowSearchShortcut(state.showSearchShortcut);
      if (Number.isFinite(state.showSearchShortcutRefreshedAt)) {
        showSearchShortcutRefreshedAt = state.showSearchShortcutRefreshedAt;
      }
    }
    if (Array.isArray(state.armedReleaseKeys)) {
      armedReleaseKeys = state.armedReleaseKeys.map(normalizeReleaseKey).filter(Boolean);
    }
    tabSwitcherShiftTabEnabled = state.tabSwitcherShiftTabEnabled === true;
    armedPageShortcut = ['Ctrl+Tab', 'Ctrl+Shift+Tab'].includes(state.armedPageShortcut) ? state.armedPageShortcut : '';
    [
      [state.trustedKeydowns, recentTrustedKeydownAtByKey],
      [state.trustedReleases, recentTrustedReleaseAtByKey]
    ].forEach(([entries, eventsByKey]) => {
      (Array.isArray(entries) ? entries : []).forEach((entry) => {
        if (Array.isArray(entry) && typeof entry[0] === 'string' && Number.isFinite(entry[1])) {
          eventsByKey.set(entry[0], entry[1]);
        }
      });
    });
  }

  function exportState() {
    return {
      showSearchShortcut: showSearchShortcutRaw,
      showSearchShortcutRefreshedAt,
      showSearchShortcutResolved,
      tabSwitcherShiftTabEnabled,
      armedPageShortcut,
      armedReleaseKeys: armedReleaseKeys.slice(),
      trustedKeydowns: Array.from(recentTrustedKeydownAtByKey.entries()),
      trustedReleases: Array.from(recentTrustedReleaseAtByKey.entries())
    };
  }

  function applyShowSearchShortcut(shortcut) {
    const nextShortcut = String(shortcut || '').trim();
    showSearchShortcutRaw = nextShortcut;
    showSearchShortcutResolved = true;
    showSearchShortcutSpec = SHORTCUT_KEY_MATCHER.parseShortcut(nextShortcut);
  }

  function refreshShowSearchShortcut() {
    const now = Date.now();
    if ((now - showSearchShortcutRefreshedAt) < SHOW_SEARCH_SHORTCUT_REFRESH_MIN_INTERVAL_MS) {
      return;
    }
    showSearchShortcutRefreshedAt = now;
    try {
      chrome.runtime.sendMessage({ action: 'getShowSearchShortcut' }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          return;
        }
        tabSwitcherShiftTabEnabled = Boolean(response && response.tabSwitcherShiftTabEnabled === true);
        const nextShortcut = response && typeof response.shortcut === 'string'
          ? response.shortcut
          : '';
        if (nextShortcut === showSearchShortcutRaw) {
          showSearchShortcutResolved = true;
          return;
        }
        applyShowSearchShortcut(nextShortcut);
      });
    } catch (error) {
      // Ignore an extension context invalidated during reload or navigation.
    }
  }

  function relayUnresolvedShowSearchShortcut(event, descriptor) {
    if (!SHORTCUT_KEY_MATCHER.canBeChromeCommandShortcut(descriptor)) {
      return;
    }
    try {
      chrome.runtime.sendMessage({
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
    } catch (error) {
      // Ignore an extension context invalidated during reload or navigation.
    }
  }

  function relayShowSearchShortcut(event) {
    if (!event || event.isTrusted !== true || event.isComposing || event.repeat) {
      return;
    }
    rememberTrustedShortcutKeydown(event);
    if (tabSwitcherShiftTabEnabled && SHORTCUT_KEY_MATCHER.isTabSwitcherCtrlTabEvent(event) &&
        !document.getElementById('_x_extension_tab_switcher_host_2026_unique_')) {
      event.preventDefault();
      event.stopPropagation();
      try {
        chrome.runtime.sendMessage({
          action: 'triggerTabSwitcherFromCtrlTab',
          reverse: event.shiftKey === true,
          observedAt: Date.now()
        }, () => { void (chrome.runtime && chrome.runtime.lastError); });
      } catch (error) {
        // A reload may invalidate this content script before the page reloads.
      }
      return;
    }
    const descriptor = SHORTCUT_KEY_MATCHER.describeKeyboardEvent(event);
    if (!showSearchShortcutSpec) {
      relayUnresolvedShowSearchShortcut(event, descriptor);
      return;
    }
    if (!SHORTCUT_KEY_MATCHER.descriptorMatchesShortcut(descriptor, showSearchShortcutSpec)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    try {
      chrome.runtime.sendMessage({
        action: 'triggerShowSearchFromPageHotkey',
        documentUrl: location && location.href ? location.href : '',
        documentIsTop: window.top === window,
        observedAt: Date.now(),
        trustedShortcutFallback: true
      }, () => {
        void (chrome.runtime && chrome.runtime.lastError);
      });
    } catch (error) {
      // Ignore an extension context invalidated during reload or navigation.
    }
  }

  function normalizeReleaseKey(value) {
    const key = String(value || '');
    return key.length === 1 ? key.toLowerCase() : key;
  }

  function normalizeReleaseCode(value) {
    const code = String(value || '');
    if (/^Key[A-Z]$/.test(code)) {
      return code.slice(3).toLowerCase();
    }
    if (/^Digit\d$/.test(code)) {
      return code.slice(5);
    }
    const aliases = {
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
    return aliases[code] || '';
  }

  function getShortcutReleaseCandidates(event) {
    return Array.from(new Set([
      normalizeReleaseKey(event && event.key),
      normalizeReleaseCode(event && event.code)
    ].filter(Boolean)));
  }

  function getShortcutKeydownCandidates(event) {
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

  function pruneTrustedShortcutEvents(now) {
    [recentTrustedKeydownAtByKey, recentTrustedReleaseAtByKey].forEach((eventsByKey) => {
      eventsByKey.forEach((observedAt, key) => {
        if ((now - observedAt) > RELEASE_REPLAY_WINDOW_MS) {
          eventsByKey.delete(key);
        }
      });
    });
  }

  function rememberTrustedShortcutKeydown(event) {
    const pressedAt = Date.now();
    pruneTrustedShortcutEvents(pressedAt);
    getShortcutKeydownCandidates(event).forEach((key) => {
      recentTrustedKeydownAtByKey.set(key, pressedAt);
    });
  }

  function getReleasedShortcutKey(event) {
    return getShortcutReleaseCandidates(event)
      .find((key) => armedReleaseKeys.includes(key)) || '';
  }

  function rememberTrustedShortcutRelease(event) {
    const releasedAt = Date.now();
    pruneTrustedShortcutEvents(releasedAt);
    getShortcutReleaseCandidates(event).forEach((key) => {
      recentTrustedReleaseAtByKey.set(key, releasedAt);
    });
  }

  function getBufferedReleasedShortcutKey(keys, commandStartedAt) {
    const startedAt = Number(commandStartedAt);
    if (!Number.isFinite(startedAt) || startedAt <= 0) {
      return '';
    }
    const now = Date.now();
    return keys.find((key) => {
      const observedAt = recentTrustedReleaseAtByKey.get(key);
      if (!Number.isFinite(observedAt) ||
          (now - observedAt) > RELEASE_REPLAY_WINDOW_MS) {
        return false;
      }
      if (observedAt >= startedAt) {
        return true;
      }
      const keydownAt = recentTrustedKeydownAtByKey.get(key);
      return Number.isFinite(keydownAt) &&
        keydownAt <= observedAt &&
        (observedAt - keydownAt) <= RELEASE_REPLAY_WINDOW_MS &&
        (startedAt - observedAt) <= RELEASE_REPLAY_WINDOW_MS;
    }) || '';
  }

  function relayTabSwitcherShortcutRelease(key) {
    if (!key) {
      return;
    }
    armedReleaseKeys = [];
    recentTrustedKeydownAtByKey.delete(key);
    recentTrustedReleaseAtByKey.delete(key);
    try {
      chrome.runtime.sendMessage({
        action: 'notifyTabSwitcherShortcutModifierReleased',
        key,
        ...(armedPageShortcut ? { shortcut: armedPageShortcut } : {})
      }, () => {
        void (chrome.runtime && chrome.runtime.lastError);
      });
    } catch (error) {
      // Ignore stale extension contexts while a tab or the extension reloads.
    }
  }

  const runtimeMessageListener = (request, _sender, sendResponse) => {
      if (!request || request.action !== 'armTabSwitcherShortcutRelease') {
        return;
      }
      armedReleaseKeys = (Array.isArray(request.keys) ? request.keys : [request.key])
        .map(normalizeReleaseKey)
        .filter(Boolean);
      armedPageShortcut = ['Ctrl+Tab', 'Ctrl+Shift+Tab'].includes(request.shortcut) ? request.shortcut : '';
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

  function notifyTabSwitcherShortcutModifierReleased(event) {
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
  const refreshShowSearchShortcutOnFocus = (event) => {
    if (event && event.target !== window) {
      return;
    }
    refreshShowSearchShortcut();
  };
  // Every frame of a tab becomes visible together; the top frame speaks for
  // the tab and a subframe refreshes when its own window takes focus.
  const refreshShowSearchShortcutOnVisibility = () => {
    if (window.top === window && document.visibilityState === 'visible') {
      refreshShowSearchShortcut();
    }
  };
  // A page restored from the back/forward cache keeps this script's state
  // from before it was cached, without running the startup request again.
  const refreshShowSearchShortcutOnPageShow = (event) => {
    if (event && event.persisted === true) {
      refreshShowSearchShortcut();
    }
  };

  const refreshTabSwitcherShiftTabSetting = (changes) => {
    if (changes && (changes._x_extension_tab_switcher_enabled_2026_unique_ ||
        changes._x_extension_tab_switcher_shift_tab_enabled_2026_unique_)) {
      showSearchShortcutRefreshedAt = 0;
      refreshShowSearchShortcut();
    }
  };
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(refreshTabSwitcherShiftTabSetting);
  }

  adoptInheritedState(inheritedState);
  // Only the observer a Document starts with reports that start; a
  // replacement, or a sweep of tabs open before an install, runs in a page
  // that is already showing.
  if (!previousRuntime && document.readyState === 'loading') {
    notifyTopFrameDocumentStarted();
  }
  // A subframe cannot receive keys before its window takes focus, which
  // refreshes the shortcut, so only the top frame asks at startup. Asking from
  // every frame messaged the worker once per iframe on each page load, ads and
  // about:blank frames included.
  if (!showSearchShortcutResolved && window.top === window) {
    refreshShowSearchShortcut();
  }
  window.addEventListener('keydown', relayShowSearchShortcut, true);
  window.addEventListener('keyup', notifyTabSwitcherShortcutModifierReleased, true);
  window.addEventListener('focus', refreshShowSearchShortcutOnFocus);
  window.addEventListener('pageshow', refreshShowSearchShortcutOnPageShow);
  document.addEventListener('visibilitychange', refreshShowSearchShortcutOnVisibility, true);
  window[RUNTIME_KEY] = Object.freeze({
    exportState,
    cleanup() {
      window.removeEventListener('keydown', relayShowSearchShortcut, true);
      window.removeEventListener('keyup', notifyTabSwitcherShortcutModifierReleased, true);
      window.removeEventListener('focus', refreshShowSearchShortcutOnFocus);
      window.removeEventListener('pageshow', refreshShowSearchShortcutOnPageShow);
      document.removeEventListener('visibilitychange', refreshShowSearchShortcutOnVisibility, true);
      if (chrome.storage && chrome.storage.onChanged && typeof chrome.storage.onChanged.removeListener === 'function') {
        chrome.storage.onChanged.removeListener(refreshTabSwitcherShiftTabSetting);
      }
      if (chrome && chrome.runtime && chrome.runtime.onMessage &&
          typeof chrome.runtime.onMessage.removeListener === 'function') {
        try {
          chrome.runtime.onMessage.removeListener(runtimeMessageListener);
        } catch (error) {
          // Ignore a listener that belongs to an invalidated extension context.
        }
      }
    }
  });
})();
