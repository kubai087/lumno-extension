(function() {
  if (window._x_extension_hotkey_listener_2024_unique_) {
    return;
  }
  window._x_extension_hotkey_listener_2024_unique_ = true;

  const REFRESH_SHORTCUT_MS = 15000;
  const TAB_VISIBLE_REPORT_MIN_INTERVAL_MS = 800;
  const PAGE_TOAST_STYLE_ID = '_x_extension_page_toast_style_2026_unique_';
  const PAGE_TOAST_ID = '_x_extension_page_toast_2026_unique_';
  const PAGE_TOAST_SHOW_DURATION_MS = 2000;
  const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
  const providerStorageRuntime = globalThis.LumnoSettings &&
    typeof globalThis.LumnoSettings.createProviderStorageRuntime === 'function'
    ? globalThis.LumnoSettings.createProviderStorageRuntime(chrome)
    : null;
  const storageArea = providerStorageRuntime
    ? providerStorageRuntime.area
    : ((chrome && chrome.storage && chrome.storage.sync)
        ? chrome.storage.sync
        : (chrome && chrome.storage ? chrome.storage.local : null));
  const storageAreaName = providerStorageRuntime ? providerStorageRuntime.name : (storageArea
    ? (storageArea === (chrome && chrome.storage ? chrome.storage.sync : null) ? 'sync' : 'local')
    : null);
  let shortcutRaw = '';
  let shortcutSpec = null;
  let lastRefreshAt = 0;
  let lastVisibleReportAt = 0;
  let pageToastTimer = null;
  let currentMessages = null;
  let currentLanguageMode = 'system';

  function applyNoTranslate(element) {
    if (!element || typeof element.setAttribute !== 'function') {
      return element;
    }
    element.setAttribute('translate', 'no');
    element.setAttribute('lang', 'zxx');
    element.setAttribute('notranslate', '');
    element.setAttribute('data-no-translate', 'true');
    if (element.classList) {
      element.classList.add('notranslate');
    }
    return element;
  }

  function getMessage(key, fallback) {
    if (currentMessages && currentMessages[key] && currentMessages[key].message) {
      return currentMessages[key].message;
    }
    try {
      if (chrome && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
        const value = chrome.i18n.getMessage(key);
        if (value) {
          return value;
        }
      }
    } catch (e) {
      // Ignore i18n failures in page context.
    }
    return fallback;
  }

  function hydrateLocaleMessages() {
    if (!storageArea || typeof storageArea.get !== 'function') {
      return;
    }
    storageArea.get([LANGUAGE_STORAGE_KEY], (result) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        return;
      }
      currentLanguageMode = result && result[LANGUAGE_STORAGE_KEY]
        ? String(result[LANGUAGE_STORAGE_KEY])
        : 'system';
      refreshLocaleMessages();
    });
  }

  function normalizeLocale(value) {
    const normalized = String(value || '').replace('-', '_').toLowerCase();
    if (normalized === 'zh' || normalized === 'zh_cn' || normalized.startsWith('zh_cn') || normalized.startsWith('zh_hans')) {
      return 'zh_CN';
    }
    if (normalized === 'zh_tw' || normalized.startsWith('zh_tw') || normalized.startsWith('zh_hant_tw')) {
      return 'zh_TW';
    }
    if (normalized === 'zh_hk' || normalized.startsWith('zh_hk') || normalized.startsWith('zh_hant_hk')) {
      return 'zh_TW';
    }
    if (normalized.startsWith('zh_hant')) {
      return 'zh_TW';
    }
    if (normalized === 'ja' || normalized.startsWith('ja_')) {
      return 'ja';
    }
    return 'en';
  }

  function getTargetLocale() {
    if (currentLanguageMode && currentLanguageMode !== 'system') {
      return normalizeLocale(currentLanguageMode);
    }
    try {
      if (chrome && chrome.i18n && typeof chrome.i18n.getUILanguage === 'function') {
        return normalizeLocale(chrome.i18n.getUILanguage());
      }
    } catch (e) {
      // Ignore i18n failures in page context.
    }
    return normalizeLocale(navigator.language || 'en');
  }

  function refreshLocaleMessages() {
    const targetLocale = getTargetLocale();
    if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    chrome.runtime.sendMessage({ action: 'getLocaleMessages', locale: targetLocale }, (response) => {
      if (chrome.runtime && chrome.runtime.lastError) {
        return;
      }
      if (response && response.messages) {
        currentMessages = response.messages;
      }
    });
  }

  const HOTKEY_LISTENER_DEBUG_ENABLED = false;

  function logHotkeyListenerDebug(stage, payload) {
    if (!HOTKEY_LISTENER_DEBUG_ENABLED) {
      return;
    }
    try {
      const detail = payload && typeof payload === 'object' ? payload : {};
      console.log(`[Lumno][hotkey-listener] ${stage}`, detail);
    } catch (e) {
      // Ignore logging errors.
    }
  }

  function triggerOverlay() {
    logHotkeyListenerDebug('trigger-overlay', {
      shortcut: shortcutRaw || '',
      href: location && location.href ? location.href : ''
    });
    try {
      chrome.runtime.sendMessage({ action: 'triggerShowSearchFromPageHotkey' });
    } catch (e) {
      // Ignore runtime bridge failures.
      logHotkeyListenerDebug('trigger-overlay-failed', {
        error: e && e.message ? e.message : String(e || '')
      });
    }
  }

  function ensureRemixIconStyles() {
    if (!chrome || !chrome.runtime || !chrome.runtime.getURL) {
      return;
    }
    if (document.getElementById('_x_extension_remixicon_css_2024_unique_')) {
      return;
    }
    const host = document.head || document.documentElement;
    if (!host) {
      return;
    }
    const link = document.createElement('link');
    link.id = '_x_extension_remixicon_css_2024_unique_';
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('assets/remixicon/fonts/remixicon.css');
    host.appendChild(link);
  }

  function ensurePageToast() {
    ensureRemixIconStyles();
    const root = document.documentElement || document.body;
    if (!root) {
      return null;
    }
    if (!document.getElementById(PAGE_TOAST_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = PAGE_TOAST_STYLE_ID;
      style.textContent = `
        #${PAGE_TOAST_ID} {
          position: fixed;
          top: max(24px, calc(env(safe-area-inset-top) + 12px));
          left: 50%;
          transform: translateX(-50%) translateY(-18px) scale(0.96);
          background: rgba(17, 24, 39, 0.92);
          color: #f9fafb;
          padding: 10px 14px;
          border-radius: 999px;
          font-size: 12px;
          line-height: 1.35;
          max-width: min(560px, calc(100vw - 32px));
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
          opacity: 0;
          filter: blur(8px);
          pointer-events: none;
          transition: opacity 180ms ease, filter 220ms ease, transform 220ms ease;
          z-index: 2147483647;
          display: inline-flex;
          isolation: isolate;
          justify-content: center;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        #${PAGE_TOAST_ID}::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          left: -40%;
          width: 40%;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0),
            rgba(255, 255, 255, 0.26),
            rgba(255, 255, 255, 0)
          );
          opacity: 0;
          transform: translateX(0);
          pointer-events: none;
        }
        #${PAGE_TOAST_ID}[data-show="true"] {
          opacity: 1;
          filter: blur(0);
          transform: translateX(-50%) translateY(0) scale(1);
        }
        #${PAGE_TOAST_ID}[data-show="true"]::after {
          animation: _x_extension_page_toast_sheen_2026_unique_ 900ms ease-out 120ms 1 both;
        }
        @keyframes _x_extension_page_toast_sheen_2026_unique_ {
          0% {
            opacity: 0;
            transform: translateX(0);
          }
          24% {
            opacity: 0.5;
          }
          100% {
            opacity: 0;
            transform: translateX(360%);
          }
        }
        #${PAGE_TOAST_ID} ._x_extension_page_toast_icon_2026_unique_ {
          flex: 0 0 auto;
          width: 16px;
          height: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0;
          font-size: 16px;
          line-height: 1;
          transform: translateX(0);
        }
        #${PAGE_TOAST_ID} ._x_extension_page_toast_text_2026_unique_ {
          display: inline-block;
          margin: 0;
          padding: 0;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transform: translateX(0);
        }
        #${PAGE_TOAST_ID}[data-show="true"] ._x_extension_page_toast_icon_2026_unique_ {
          animation: _x_extension_page_toast_icon_gather_2026_unique_ 320ms cubic-bezier(0.22, 1, 0.36, 1) 220ms 1 both;
        }
        #${PAGE_TOAST_ID}[data-show="true"] ._x_extension_page_toast_text_2026_unique_ {
          animation: _x_extension_page_toast_text_gather_2026_unique_ 320ms cubic-bezier(0.22, 1, 0.36, 1) 220ms 1 both;
        }
        @keyframes _x_extension_page_toast_icon_gather_2026_unique_ {
          0% {
            transform: translateX(-6px);
          }
          100% {
            transform: translateX(0);
          }
        }
        @keyframes _x_extension_page_toast_text_gather_2026_unique_ {
          0% {
            transform: translateX(6px);
          }
          100% {
            transform: translateX(0);
          }
        }
      `;
      root.appendChild(style);
    }
    let toast = document.getElementById(PAGE_TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = PAGE_TOAST_ID;
      toast.setAttribute('aria-live', 'polite');
      toast.setAttribute('role', 'status');
      toast.setAttribute('data-show', 'false');
      applyNoTranslate(toast);
      root.appendChild(toast);
    }
    return toast;
  }

  function showPageToast(message, isError) {
    const toast = ensurePageToast();
    if (!toast) {
      return;
    }
    if (pageToastTimer) {
      window.clearTimeout(pageToastTimer);
      pageToastTimer = null;
    }
    let icon = toast.querySelector('i._x_extension_page_toast_icon_2026_unique_');
    let text = toast.querySelector('span._x_extension_page_toast_text_2026_unique_');
    if (!icon || !text) {
      toast.textContent = '';
      icon = document.createElement('i');
      icon.className = '_x_extension_page_toast_icon_2026_unique_ _x_extension_svg_2024_unique_ ri-icon ri-size-16 ri-share-circle-line';
      icon.setAttribute('aria-hidden', 'true');
      text = document.createElement('span');
      text.className = '_x_extension_page_toast_text_2026_unique_';
      applyNoTranslate(icon);
      applyNoTranslate(text);
      toast.appendChild(icon);
      toast.appendChild(text);
    }
    text.textContent = String(message || '');
    if (isError) {
      toast.style.setProperty('background', 'rgba(153, 27, 27, 0.92)');
    } else {
      toast.style.removeProperty('background');
    }
    toast.setAttribute('data-show', 'false');
    void toast.offsetWidth;
    toast.setAttribute('data-show', 'true');
    pageToastTimer = window.setTimeout(() => {
      toast.setAttribute('data-show', 'false');
      pageToastTimer = null;
    }, PAGE_TOAST_SHOW_DURATION_MS);
  }

  function fallbackCopyText(text) {
    const value = String(text || '');
    if (!value || !document.body) {
      return false;
    }
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (e) {
      copied = false;
    }
    document.body.removeChild(textarea);
    return copied;
  }

  async function copyCurrentPageUrlWithToast() {
    const url = location && location.href ? location.href : '';
    if (!url) {
      showPageToast(getMessage('copy_page_url_failed_retry', '复制失败，请重试'), true);
      return false;
    }
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
      } else if (!fallbackCopyText(url)) {
        throw new Error('fallback-copy-failed');
      }
      showPageToast(getMessage('copy_page_url_success', '已复制当前页面链接'));
      return true;
    } catch (error) {
      if (fallbackCopyText(url)) {
        showPageToast(getMessage('copy_page_url_success', '已复制当前页面链接'));
        return true;
      }
      showPageToast(getMessage('copy_page_url_failed_permission', '复制失败，请检查剪贴板权限'), true);
      return false;
    }
  }

  function reportTabVisible(reason) {
    if (document.visibilityState !== 'visible') {
      return;
    }
    const now = Date.now();
    if ((now - lastVisibleReportAt) < TAB_VISIBLE_REPORT_MIN_INTERVAL_MS) {
      return;
    }
    lastVisibleReportAt = now;
    try {
      chrome.runtime.sendMessage({
        action: 'reportTabVisible',
        at: now,
        reason: String(reason || '')
      });
    } catch (e) {
      // Ignore runtime bridge failures.
    }
  }

  function parseShortcut(shortcut) {
    const value = String(shortcut || '').trim();
    if (!value) {
      return null;
    }
    const parts = value.split('+').map((item) => String(item || '').trim()).filter(Boolean);
    if (parts.length === 0) {
      return null;
    }
    const keyToken = parts[parts.length - 1];
    const modifierTokens = parts.slice(0, -1);
    const spec = {
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
      key: ''
    };

    modifierTokens.forEach((token) => {
      const lower = token.toLowerCase();
      if (lower === 'ctrl' || lower === 'control' || lower === 'macctrl') {
        spec.ctrl = true;
      } else if (lower === 'alt' || lower === 'option') {
        spec.alt = true;
      } else if (lower === 'shift') {
        spec.shift = true;
      } else if (lower === 'command' || lower === 'cmd' || lower === 'meta' || lower === 'super') {
        spec.meta = true;
      }
    });

    const keyLower = keyToken.toLowerCase();
    const specialMap = {
      tab: 'Tab',
      enter: 'Enter',
      return: 'Enter',
      esc: 'Escape',
      escape: 'Escape',
      space: ' ',
      spacebar: ' ',
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      comma: ',',
      period: '.',
      slash: '/',
      semicolon: ';',
      quote: '\'',
      minus: '-',
      plus: '+',
      backslash: '\\',
      backquote: '`',
      bracketleft: '[',
      bracketright: ']'
    };
    if (specialMap[keyLower]) {
      spec.key = specialMap[keyLower];
      return spec;
    }
    if (/^f\d{1,2}$/.test(keyLower)) {
      spec.key = keyLower.toUpperCase();
      return spec;
    }
    if (keyLower.length === 1) {
      spec.key = keyLower;
      return spec;
    }
    spec.key = keyToken;
    return spec;
  }

  function getShortcutKeyTokenFromCode(rawCode) {
    const code = String(rawCode || '').trim();
    if (!code) {
      return '';
    }
    if (/^Key[A-Z]$/.test(code)) {
      return code.slice(3).toLowerCase();
    }
    if (/^Digit[0-9]$/.test(code)) {
      return code.slice(5);
    }
    const codeMap = {
      Backquote: '`',
      Minus: '-',
      Equal: '+',
      BracketLeft: '[',
      BracketRight: ']',
      Backslash: '\\',
      Semicolon: ';',
      Quote: '\'',
      Comma: ',',
      Period: '.',
      Slash: '/',
      Space: ' ',
      Tab: 'Tab',
      Enter: 'Enter',
      Escape: 'Escape',
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight'
    };
    if (codeMap[code]) {
      return codeMap[code];
    }
    if (/^F\d{1,2}$/.test(code)) {
      return code.toUpperCase();
    }
    return '';
  }

  function getShortcutKeyTokenFromEvent(event) {
    if (!event) {
      return '';
    }
    return getShortcutKeyTokenFromCode(event.code) || String(event.key || '');
  }

  function isEditableTarget(target) {
    const element = target && target.nodeType === 1 ? target : (target && target.parentElement ? target.parentElement : null);
    if (!element || !element.closest) {
      return false;
    }
    return Boolean(element.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
  }

  function shortcutMatchesEvent(event, spec) {
    if (!spec) {
      return false;
    }
    if (Boolean(event.ctrlKey) !== spec.ctrl ||
      Boolean(event.altKey) !== spec.alt ||
      Boolean(event.shiftKey) !== spec.shift ||
      Boolean(event.metaKey) !== spec.meta) {
      return false;
    }
    const eventKey = getShortcutKeyTokenFromEvent(event);
    if (spec.key.length === 1) {
      return eventKey.toLowerCase() === spec.key;
    }
    if (spec.key.startsWith('F')) {
      return eventKey.toUpperCase() === spec.key;
    }
    return eventKey === spec.key;
  }

  function refreshShortcut(force) {
    const now = Date.now();
    if (!force && (now - lastRefreshAt) < REFRESH_SHORTCUT_MS) {
      return;
    }
    lastRefreshAt = now;
    try {
      chrome.runtime.sendMessage({ action: 'getShowSearchShortcut' }, (response) => {
        if (chrome.runtime && chrome.runtime.lastError) {
          logHotkeyListenerDebug('shortcut-refresh-error', {
            error: chrome.runtime.lastError.message || 'unknown'
          });
          return;
        }
        const nextShortcut = response && typeof response.shortcut === 'string'
          ? response.shortcut
          : '';
        if (nextShortcut === shortcutRaw) {
          return;
        }
        shortcutRaw = nextShortcut;
        shortcutSpec = parseShortcut(nextShortcut);
        logHotkeyListenerDebug('shortcut-refresh', {
          shortcut: shortcutRaw,
          hasSpec: Boolean(shortcutSpec)
        });
      });
    } catch (e) {
      // Ignore runtime bridge failures on restricted frames.
      logHotkeyListenerDebug('shortcut-refresh-failed', {
        error: e && e.message ? e.message : String(e || '')
      });
    }
  }

  hydrateLocaleMessages();
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (providerStorageRuntime
        ? !providerStorageRuntime.isActiveAreaName(areaName)
        : storageAreaName && areaName !== storageAreaName) {
        return;
      }
      if (!changes) {
        return;
      }
      if (changes[LANGUAGE_STORAGE_KEY]) {
        currentLanguageMode = changes[LANGUAGE_STORAGE_KEY].newValue
          ? String(changes[LANGUAGE_STORAGE_KEY].newValue)
          : 'system';
        refreshLocaleMessages();
      }
    });
  }

  refreshShortcut(true);
  logHotkeyListenerDebug('listener-ready', {
    href: location && location.href ? location.href : ''
  });
  window.addEventListener('focus', () => refreshShortcut(true), true);
  window.addEventListener('focus', () => reportTabVisible('focus'), true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshShortcut(false);
      reportTabVisible('visibility');
    }
  }, true);
  window.addEventListener('pageshow', () => {
    reportTabVisible('pageshow');
  }, true);

  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!request) {
        return;
      }
      if (request.action === 'copyCurrentPageUrlFromCommand') {
        copyCurrentPageUrlWithToast().then((ok) => {
          sendResponse({ ok: Boolean(ok) });
        }).catch(() => {
          sendResponse({ ok: false });
        });
        return true;
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (!event || event.isComposing || event.repeat) {
      return;
    }
    if (window._x_extension_shortcut_key_observer_2026_unique_) {
      return;
    }
    refreshShortcut(false);
    const editableTarget = isEditableTarget(event.target);
    const matchedConfiguredShortcut = Boolean(shortcutSpec && shortcutMatchesEvent(event, shortcutSpec));
    if (matchedConfiguredShortcut) {
      logHotkeyListenerDebug('shortcut-matched', {
        key: String(event.key || ''),
        shortcut: shortcutRaw || '',
        defaultPrevented: Boolean(event.defaultPrevented),
        editable: editableTarget
      });
      if (editableTarget) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      triggerOverlay();
      return;
    }
    if (event.defaultPrevented) {
      return;
    }
    if (isEditableTarget(event.target)) {
      return;
    }
    if (event.metaKey && String(event.key || '').toLowerCase() === 't') {
      logHotkeyListenerDebug('meta-t-seen', {
        defaultPrevented: Boolean(event.defaultPrevented),
        targetTag: event.target && event.target.tagName ? String(event.target.tagName).toLowerCase() : '',
        shortcut: shortcutRaw || '',
        href: location && location.href ? location.href : ''
      });
    }
  }, true);
})();
