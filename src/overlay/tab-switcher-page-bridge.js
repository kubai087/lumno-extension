(function() {
  if (window._x_extension_tab_switcher_page_bridge_2026_unique_) {
    return;
  }
  window._x_extension_tab_switcher_page_bridge_2026_unique_ = true;

  const TAB_SWITCHER_HOST_ID = '_x_extension_tab_switcher_host_2026_unique_';
  const TAB_SWITCHER_ADVANCE_EVENT = '_x_extension_tab_switcher_advance_command_2026_unique_';
  const TAB_SWITCHER_EXTENSION_PAGE_PORT_NAME = 'lumno-tab-switcher-extension-page';
  const TAB_SWITCHER_RELEASE_REPLAY_WINDOW_MS = 5000;
  const chromeApi = typeof chrome !== 'undefined' ? chrome : null;
  let extensionPagePort = null;
  let extensionPagePortReconnectTimer = null;
  let extensionPagePortClosed = false;
  let extensionPageTabId = null;
  let armedReleaseKeys = [];
  const recentTrustedKeydownAtByKey = new Map();
  const recentTrustedReleaseAtByKey = new Map();

  function normalizeTabSwitcherReleaseKey(value) {
    const key = String(value || '');
    return key.length === 1 ? key.toLowerCase() : key;
  }

  function normalizeTabSwitcherReleaseCode(value) {
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

  function getTabSwitcherShortcutReleaseCandidates(event) {
    return Array.from(new Set([
      normalizeTabSwitcherReleaseKey(event && event.key),
      normalizeTabSwitcherReleaseCode(event && event.code)
    ].filter(Boolean)));
  }

  function getTabSwitcherShortcutKeydownCandidates(event) {
    const candidates = getTabSwitcherShortcutReleaseCandidates(event);
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

  function pruneTrustedTabSwitcherShortcutEvents(now) {
    [recentTrustedKeydownAtByKey, recentTrustedReleaseAtByKey].forEach((eventsByKey) => {
      eventsByKey.forEach((observedAt, key) => {
        if ((now - observedAt) > TAB_SWITCHER_RELEASE_REPLAY_WINDOW_MS) {
          eventsByKey.delete(key);
        }
      });
    });
  }

  function rememberTrustedTabSwitcherShortcutKeydown(event) {
    if (!event || event.isTrusted !== true || event.isComposing || event.repeat) {
      return;
    }
    const pressedAt = Date.now();
    pruneTrustedTabSwitcherShortcutEvents(pressedAt);
    getTabSwitcherShortcutKeydownCandidates(event).forEach((key) => {
      recentTrustedKeydownAtByKey.set(key, pressedAt);
    });
  }

  function getReleasedTabSwitcherShortcutKey(event) {
    return getTabSwitcherShortcutReleaseCandidates(event)
      .find((key) => armedReleaseKeys.includes(key)) || '';
  }

  function rememberTrustedTabSwitcherShortcutRelease(event) {
    const releasedAt = Date.now();
    pruneTrustedTabSwitcherShortcutEvents(releasedAt);
    getTabSwitcherShortcutReleaseCandidates(event).forEach((key) => {
      recentTrustedReleaseAtByKey.set(key, releasedAt);
    });
  }

  function getBufferedTabSwitcherShortcutReleaseKey(keys, commandStartedAt) {
    const startedAt = Number(commandStartedAt);
    if (!Number.isFinite(startedAt) || startedAt <= 0) {
      return '';
    }
    const now = Date.now();
    return keys.find((key) => {
      const observedAt = recentTrustedReleaseAtByKey.get(key);
      if (!Number.isFinite(observedAt) ||
          (now - observedAt) > TAB_SWITCHER_RELEASE_REPLAY_WINDOW_MS) {
        return false;
      }
      if (observedAt >= startedAt) {
        return true;
      }
      const keydownAt = recentTrustedKeydownAtByKey.get(key);
      return Number.isFinite(keydownAt) &&
        keydownAt <= observedAt &&
        (observedAt - keydownAt) <= TAB_SWITCHER_RELEASE_REPLAY_WINDOW_MS &&
        (startedAt - observedAt) <= TAB_SWITCHER_RELEASE_REPLAY_WINDOW_MS;
    }) || '';
  }

  function relayTabSwitcherShortcutRelease(key) {
    if (!key || !chromeApi || !chromeApi.runtime ||
        typeof chromeApi.runtime.sendMessage !== 'function') {
      return;
    }
    armedReleaseKeys = [];
    recentTrustedKeydownAtByKey.delete(key);
    recentTrustedReleaseAtByKey.delete(key);
    try {
      chromeApi.runtime.sendMessage({
        action: 'notifyTabSwitcherShortcutModifierReleased',
        key
      }, () => {
        void (chromeApi.runtime && chromeApi.runtime.lastError);
      });
    } catch (error) {
      // Ignore stale extension page contexts during reload.
    }
  }

  function normalizeTabSwitcherAdvanceOffset(value) {
    const offset = Math.trunc(Number(value));
    return Number.isFinite(offset) && offset !== 0 ? offset : 1;
  }

  function createTabSwitcherAdvanceEvent(offset) {
    const detail = { offset: normalizeTabSwitcherAdvanceOffset(offset) };
    if (typeof CustomEvent === 'function') {
      return new CustomEvent(TAB_SWITCHER_ADVANCE_EVENT, { detail });
    }
    const event = document.createEvent('CustomEvent');
    event.initCustomEvent(TAB_SWITCHER_ADVANCE_EVENT, false, false, detail);
    return event;
  }

  function advanceOpenTabSwitcherFromCommand(request) {
    const host = document.getElementById(TAB_SWITCHER_HOST_ID);
    if (!host) {
      return { ok: false };
    }
    if (typeof host._lumnoTabSwitcherAdvance === 'function') {
      const didAdvance = host._lumnoTabSwitcherAdvance(request && request.offset);
      return {
        ok: true,
        advanced: didAdvance === true,
        suppressed: didAdvance === false
      };
    }
    document.dispatchEvent(createTabSwitcherAdvanceEvent(request && request.offset));
    return { ok: true, advanced: true };
  }

  function commitOpenTabSwitcherFromShortcutRelease() {
    const host = document.getElementById(TAB_SWITCHER_HOST_ID);
    if (!host || typeof host._lumnoTabSwitcherCommitFromShortcutRelease !== 'function') {
      return { ok: false, committed: false };
    }
    return {
      ok: true,
      committed: host._lumnoTabSwitcherCommitFromShortcutRelease() === true
    };
  }

  function openTabSwitcherFromCommand(request) {
    const toggle = window._x_extension_toggleTabSwitcher_2026_unique_;
    if (typeof toggle !== 'function') {
      return { ok: false, reason: 'tab_switcher_missing' };
    }
    const context = request && request.context && typeof request.context === 'object'
      ? request.context
      : {};
    const result = toggle(context);
    return result && typeof result === 'object'
      ? result
      : { ok: true };
  }

  function setTabSwitcherCaptureVisibility(hidden) {
    const host = document.getElementById(TAB_SWITCHER_HOST_ID);
    if (!host) {
      return { ok: true, reason: 'tab_switcher_host_missing' };
    }
    const markerKey = 'lumnoCaptureVisibilityHidden';
    const valueKey = 'lumnoCapturePreviousVisibility';
    const priorityKey = 'lumnoCapturePreviousVisibilityPriority';
    const hadValueKey = 'lumnoCaptureHadVisibility';
    if (hidden) {
      if (host.dataset[markerKey] !== 'true') {
        const previousValue = host.style.getPropertyValue('visibility');
        host.dataset[markerKey] = 'true';
        host.dataset[valueKey] = previousValue || '';
        host.dataset[priorityKey] = host.style.getPropertyPriority('visibility') || '';
        host.dataset[hadValueKey] = previousValue ? 'true' : 'false';
      }
      host.style.setProperty('visibility', 'hidden', 'important');
      return { ok: true };
    }
    if (host.dataset[markerKey] === 'true') {
      if (host.dataset[hadValueKey] === 'true') {
        host.style.setProperty(
          'visibility',
          host.dataset[valueKey] || '',
          host.dataset[priorityKey] || ''
        );
      } else {
        host.style.removeProperty('visibility');
      }
      delete host.dataset[markerKey];
      delete host.dataset[valueKey];
      delete host.dataset[priorityKey];
      delete host.dataset[hadValueKey];
    }
    return { ok: true };
  }

  function getOpenTabSwitcherState() {
    const host = document.getElementById(TAB_SWITCHER_HOST_ID);
    return {
      ok: true,
      open: Boolean(host)
    };
  }

  function updateOpenTabSwitcherThumbnail(request) {
    const host = document.getElementById(TAB_SWITCHER_HOST_ID);
    if (!host || typeof host._lumnoTabSwitcherUpdateThumbnail !== 'function') {
      return { ok: false, reason: 'tab_switcher_host_missing' };
    }
    return host._lumnoTabSwitcherUpdateThumbnail(request) || { ok: true };
  }

  function handleTabSwitcherCommandMessage(request) {
    if (!request || typeof request !== 'object') {
      return null;
    }
    if (request.action === 'advanceOpenTabSwitcherFromCommand') {
      return advanceOpenTabSwitcherFromCommand(request);
    }
    if (request.action === 'armTabSwitcherShortcutRelease') {
      armedReleaseKeys = (Array.isArray(request.keys) ? request.keys : [request.key])
        .map(normalizeTabSwitcherReleaseKey)
        .filter(Boolean);
      const bufferedKey = getBufferedTabSwitcherShortcutReleaseKey(
        armedReleaseKeys,
        request.commandStartedAt
      );
      if (bufferedKey) {
        relayTabSwitcherShortcutRelease(bufferedKey);
      }
      return { ok: armedReleaseKeys.length > 0 || Boolean(bufferedKey) };
    }
    if (request.action === 'commitOpenTabSwitcherFromShortcutRelease') {
      return commitOpenTabSwitcherFromShortcutRelease();
    }
    if (request.action === 'openTabSwitcherFromCommand') {
      return openTabSwitcherFromCommand(request);
    }
    if (request.action === 'setTabSwitcherCaptureVisibility') {
      return setTabSwitcherCaptureVisibility(request.hidden);
    }
    if (request.action === 'getOpenTabSwitcherState') {
      return getOpenTabSwitcherState();
    }
    if (request.action === 'updateTabSwitcherThumbnail') {
      return updateOpenTabSwitcherThumbnail(request);
    }
    return null;
  }

  function isOwnExtensionPage() {
    if (!chromeApi || !chromeApi.runtime || !chromeApi.runtime.id) {
      return false;
    }
    try {
      // Firefox hosts extension pages on a per-install UUID, not runtime.id.
      const own = new URL(chromeApi.runtime.getURL(''));
      return window.location.protocol === own.protocol && window.location.hostname === own.hostname;
    } catch (error) {
      return false;
    }
  }

  function postExtensionPagePortMessage(message) {
    if (!extensionPagePort || !message) {
      return;
    }
    try {
      extensionPagePort.postMessage(message);
    } catch (error) {
      // The disconnect listener will reconnect if the page is still alive.
    }
  }

  function registerTabSwitcherExtensionPage(tab) {
    const tabId = tab && typeof tab.id === 'number' ? tab.id : null;
    extensionPageTabId = tabId;
    postExtensionPagePortMessage({
      action: 'registerTabSwitcherExtensionPage',
      tabId,
      url: window.location && window.location.href ? window.location.href : '',
      title: document && document.title ? document.title : ''
    });
  }

  function respondToExtensionPageRequest(request, response) {
    if (!request || typeof request.requestId !== 'number') {
      return;
    }
    postExtensionPagePortMessage({
      action: 'tabSwitcherExtensionPageResponse',
      requestId: request.requestId,
      tabId: extensionPageTabId,
      ok: Boolean(response && response.ok),
      reason: response && response.reason ? String(response.reason) : '',
      advanced: response && typeof response.advanced === 'boolean' ? response.advanced : null,
      committed: response && typeof response.committed === 'boolean' ? response.committed : null,
      open: response && typeof response.open === 'boolean' ? response.open : null,
      suppressed: Boolean(response && response.suppressed)
    });
  }

  function scheduleExtensionPagePortReconnect() {
    if (extensionPagePortClosed || extensionPagePortReconnectTimer) {
      return;
    }
    extensionPagePortReconnectTimer = window.setTimeout(() => {
      extensionPagePortReconnectTimer = null;
      connectExtensionPagePort();
    }, 1000);
  }

  function connectExtensionPagePort() {
    if (!isOwnExtensionPage() ||
        !chromeApi.runtime ||
        typeof chromeApi.runtime.connect !== 'function') {
      return;
    }
    if (extensionPagePort) {
      return;
    }
    try {
      extensionPagePort = chromeApi.runtime.connect({ name: TAB_SWITCHER_EXTENSION_PAGE_PORT_NAME });
    } catch (error) {
      return;
    }
    extensionPagePort.onMessage.addListener((request) => {
      const response = handleTabSwitcherCommandMessage(request);
      if (response) {
        respondToExtensionPageRequest(request, response);
      }
    });
    extensionPagePort.onDisconnect.addListener(() => {
      extensionPagePort = null;
      scheduleExtensionPagePortReconnect();
    });
    if (chromeApi.tabs && typeof chromeApi.tabs.getCurrent === 'function') {
      chromeApi.tabs.getCurrent((tab) => {
        registerTabSwitcherExtensionPage(tab);
      });
    } else {
      registerTabSwitcherExtensionPage(null);
    }
  }

  if (chromeApi && chromeApi.runtime && chromeApi.runtime.onMessage) {
    chromeApi.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      const response = handleTabSwitcherCommandMessage(request);
      if (!response) {
        return;
      }
      sendResponse(response);
    });
  }

  function notifyTabSwitcherShortcutModifierReleased(event) {
    if (!event || event.isTrusted !== true || !chromeApi || !chromeApi.runtime ||
        typeof chromeApi.runtime.sendMessage !== 'function') {
      return;
    }
    rememberTrustedTabSwitcherShortcutRelease(event);
    const key = getReleasedTabSwitcherShortcutKey(event);
    if (!key) {
      return;
    }
    relayTabSwitcherShortcutRelease(key);
  }

  window.addEventListener('keydown', rememberTrustedTabSwitcherShortcutKeydown, true);
  window.addEventListener('keyup', notifyTabSwitcherShortcutModifierReleased, true);

  window.addEventListener('pagehide', () => {
    extensionPagePortClosed = true;
    if (extensionPagePortReconnectTimer) {
      window.clearTimeout(extensionPagePortReconnectTimer);
      extensionPagePortReconnectTimer = null;
    }
  }, true);

  connectExtensionPagePort();
})();
