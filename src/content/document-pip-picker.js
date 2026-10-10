(function() {
  if (window.__lumnoDocumentPiPPicker2026) {
    return;
  }

  const STATE_FLAG = '__lumno_document_pip_active_2026__';
  const ROOT_ID = '__lumno_document_pip_picker_root_2026__';
  const TOAST_HOST_ID = '__lumno_document_pip_toast_2026__';
  const TOAST = globalThis.LumnoToast;
  const HIGHLIGHT_ID = '__lumno_document_pip_highlight_2026__';
  const PICKER_HIGHLIGHT_PADDING = 4;
  const PIP_DOCK_CLEARANCE = 56;
  const PIP_CARD_GUTTER = 12;
  const PIP_MIN_WIDTH = 320;
  const PIP_MAX_WIDTH = 1200;
  const PIP_MIN_HEIGHT = 180;
  const PIP_MAX_HEIGHT = 900;
  const PIP_SYNC_DELAY_MS = 80;
  const PIP_STYLE_ANCHOR_ID = '__lumno_pip_style_anchor_2026__';
  const PICKER_Z_INDEX = '2147483646';
  const CONTEXT_LAYOUT_RESET = [
    ['display', 'block'],
    ['position', 'static'],
    ['float', 'none'],
    ['width', 'auto'],
    ['min-width', '0'],
    ['max-width', 'none'],
    ['height', 'auto'],
    ['min-height', '0'],
    ['max-height', 'none'],
    ['margin', '0'],
    ['padding', '0'],
    ['border', '0'],
    ['box-shadow', 'none'],
    ['overflow', 'visible'],
    ['transform', 'none'],
    ['contain', 'none']
  ];
  const state = {
    active: false,
    root: null,
    highlight: null,
    currentTarget: null,
    currentStack: [],
    currentStackIndex: 0,
    currentTheme: null,
    session: null,
    teardownSelection: null,
    toastHost: null,
    toastElement: null,
    toastController: null,
    toastStyleGate: null,
    opening: false,
    ownerToken: '',
    runtimeMessageHandlerBound: false
  };

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






  function getMessage(name, fallback) {
    try {
      if (chrome && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
        const value = chrome.i18n.getMessage(name);
        if (value) {
          return value;
        }
      }
    } catch (error) {
      // Ignore i18n failures in page context.
    }
    return fallback;
  }

  function getRuntimeUrl(path) {
    try {
      if (chrome && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        return chrome.runtime.getURL(path);
      }
    } catch (error) {
      // Ignore runtime URL failures.
    }
    return path;
  }

  function supportsDocumentPiP() {
    return getDocumentPiPSupportState().supported;
  }

  function isPictureInPictureAllowedByPolicy() {
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (!policy || typeof policy.allowsFeature !== 'function') {
      return true;
    }
    try {
      return policy.allowsFeature('picture-in-picture') !== false;
    } catch (error) {
      return true;
    }
  }

  function getDocumentPiPSupportState() {
    if (window.top !== window.self) {
      return { supported: false, reason: 'not-top-level' };
    }
    if (!window.isSecureContext) {
      return { supported: false, reason: 'not-secure-context' };
    }
    if (!window.documentPictureInPicture || typeof window.documentPictureInPicture.requestWindow !== 'function') {
      return { supported: false, reason: 'api-unavailable' };
    }
    if (!isPictureInPictureAllowedByPolicy()) {
      return { supported: false, reason: 'blocked-by-policy' };
    }
    return { supported: true, reason: 'ok' };
  }

  function getSupportFailureMessage(reason) {
    if (reason === 'blocked-by-policy') {
      return getMessage(
        'document_pip_picker_unsupported_policy',
        'This website disables Picture-in-Picture via site policy.'
      );
    }
    if (reason === 'not-top-level') {
      return getMessage(
        'document_pip_picker_unsupported_iframe',
        'Document Picture-in-Picture only works in the top-level page.'
      );
    }
    if (reason === 'not-secure-context') {
      return getMessage(
        'document_pip_picker_unsupported_insecure',
        'Document Picture-in-Picture requires HTTPS.'
      );
    }
    return getMessage(
      'document_pip_picker_unsupported',
      'This page does not support Document Picture-in-Picture.'
    );
  }

  function getOpenFailureMessage(error) {
    const name = String(error && error.name ? error.name : '');
    if (name === 'NotAllowedError') {
      return getMessage(
        'document_pip_picker_open_failed_not_allowed',
        'The website or browser blocked opening Document Picture-in-Picture.'
      );
    }
    if (name === 'NotSupportedError') {
      return getMessage(
        'document_pip_picker_open_failed_not_supported',
        'This selection cannot be opened in Document Picture-in-Picture on this page.'
      );
    }
    if (name === 'InvalidStateError') {
      return getMessage(
        'document_pip_picker_open_failed_invalid_state',
        'A floating window is already open or the page state changed. Try again.'
      );
    }
    if (name === 'SecurityError') {
      return getMessage(
        'document_pip_picker_open_failed_security',
        'The browser blocked this action for security reasons on this page.'
      );
    }
    return getMessage(
      'document_pip_picker_open_failed',
      'Failed to open the floating content window. Try a different area'
    );
  }

  function hasActiveVideoPiP() {
    return Boolean(document.pictureInPictureElement);
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      if (!chrome || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
        resolve({ ok: false, reason: 'no-runtime-sendMessage' });
        return;
      }
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve({
              ok: false,
              reason: chrome.runtime.lastError.message || 'runtime-lastError'
            });
            return;
          }
          resolve(response && typeof response === 'object'
            ? response
            : { ok: false, reason: 'empty-response' });
        });
      } catch (error) {
        resolve({ ok: false, reason: String(error) });
      }
    });
  }

  async function requestDocumentPipOwnership() {
    const response = await sendRuntimeMessage({
      action: 'pipRequestOwnership',
      kind: 'document'
    });
    if (response && response.ok && response.granted && response.token) {
      state.ownerToken = String(response.token);
      return { ok: true, granted: true };
    }
    return {
      ok: false,
      granted: false,
      reason: response && response.reason ? String(response.reason) : 'ownership-denied'
    };
  }

  function releaseDocumentPipOwnership() {
    const token = typeof state.ownerToken === 'string' ? state.ownerToken : '';
    state.ownerToken = '';
    if (!token) {
      return;
    }
    sendRuntimeMessage({
      action: 'pipReleaseOwnership',
      token: token
    }).catch(() => {});
  }

  function showVideoPiPConflictToast() {
    ensurePickerUi();
    applyPickerTheme(getPickerTheme(null));
    showToast(
      getMessage(
        'document_pip_picker_conflict_video_pip',
        'A video PiP is already active. Close it before starting content clipping.'
      ),
      'error'
    );
  }

  function isOwnNode(node) {
    return Boolean(node && node.nodeType === 1 && node.closest &&
      node.closest(`#${ROOT_ID}, #${TOAST_HOST_ID}`));
  }

  function getElementFromPoint(event) {
    if (!event || typeof document.elementFromPoint !== 'function') {
      return null;
    }
    const node = document.elementFromPoint(event.clientX, event.clientY);
    if (!node || isOwnNode(node)) {
      return null;
    }
    return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  }

  function isVisibleElement(element) {
    if (!(element instanceof Element) || !element.isConnected) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function isAllowedElement(element) {
    if (!(element instanceof Element) || !element.isConnected || isOwnNode(element)) {
      return false;
    }
    const tagName = String(element.tagName || '').toUpperCase();
    if (!tagName) {
      return false;
    }
    if ([
      'HTML',
      'BODY',
      'HEAD',
      'SCRIPT',
      'STYLE',
      'LINK',
      'META',
      'NOSCRIPT',
      'TITLE',
      'SOURCE',
      'TRACK',
      'BR',
      'IFRAME',
      'FRAME',
      'OBJECT',
      'EMBED'
    ].includes(tagName)) {
      return false;
    }
    return isVisibleElement(element);
  }

  function containsBlockedMediaContent(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const tagName = String(element.tagName || '').toUpperCase();
    if (tagName === 'VIDEO' || tagName === 'AUDIO' || tagName === 'IFRAME') {
      return true;
    }
    try {
      return Boolean(element.querySelector('video, audio, iframe'));
    } catch (error) {
      return true;
    }
  }

  function getElementStack(element) {
    const stack = [];
    let current = element;
    while (current && current instanceof Element) {
      if (isAllowedElement(current)) {
        stack.push(current);
      }
      if (current === document.body) {
        break;
      }
      current = current.parentElement;
    }
    return stack.slice(0, 8);
  }

  function getElementArea(element) {
    if (!(element instanceof Element)) {
      return 0;
    }
    const rect = element.getBoundingClientRect();
    return Math.max(0, Math.round((Number(rect.width) || 0) * (Number(rect.height) || 0)));
  }

  function hasPaintedSurface(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    const backgroundColor = parseCssColor(style.backgroundColor);
    return Boolean((backgroundColor && backgroundColor[3] > 0.04) || style.backgroundImage !== 'none');
  }

  function isLikelyLeafNode(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const childElements = Array.from(element.children || []).filter((child) => isVisibleElement(child));
    return childElements.length === 0;
  }

  function isLikelyToolbarLike(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const tagName = String(element.tagName || '').toLowerCase();
    const role = String(element.getAttribute('role') || '').toLowerCase();
    const classText = String(element.className || '').toLowerCase();
    if (tagName === 'nav' || tagName === 'header' || role === 'toolbar' || role === 'menubar' || role === 'navigation') {
      return true;
    }
    return /(toolbar|topbar|navbar|nav-|actions|action-bar|menu-bar|header-actions)/.test(classText);
  }

  function isLikelyInteractiveContainer(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    if (isLikelyToolbarLike(element)) {
      return true;
    }
    if (element.matches('button, a, input, select, textarea, summary, label')) {
      return true;
    }
    return Boolean(element.querySelector('button, a[href], input, select, textarea, [role="button"], [role="menuitem"], [aria-haspopup="true"]'));
  }

  function getCandidateScore(element) {
    if (!(element instanceof Element)) {
      return -1;
    }
    const area = getElementArea(element);
    const paintedBoost = hasPaintedSurface(element) ? 1400000 : 0;
    const semanticBoost = element.matches('article, section, main, aside, dialog, [role="dialog"], [role="region"], [role="article"]') ? 1200000 : 0;
    const containerBoost = !isLikelyLeafNode(element) ? 400000 : 0;
    const toolbarPenalty = isLikelyToolbarLike(element) ? -550000 : 0;
    const tinyPenalty = area < 22000 ? -700000 : 0;
    const giantPenalty = area > Math.max(window.innerWidth * window.innerHeight * 0.82, 900000) ? -350000 : 0;
    const interactivePenalty = isLikelyInteractiveContainer(element) && !hasPaintedSurface(element) ? -180000 : 0;
    return area + paintedBoost + semanticBoost + containerBoost + toolbarPenalty + tinyPenalty + giantPenalty + interactivePenalty;
  }

  function getDefaultStackIndex(stack) {
    if (!Array.isArray(stack) || stack.length === 0) {
      return 0;
    }
    let bestIndex = 0;
    let bestScore = -Infinity;
    stack.forEach((element, index) => {
      const score = getCandidateScore(element);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    return bestIndex;
  }



  function clampChannel(value) {
    return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
  }

  function clampAlpha(value) {
    return Math.max(0, Math.min(1, Number(value)));
  }

  function parseCssColor(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw || raw === 'transparent' || raw === 'initial' || raw === 'inherit') {
      return null;
    }
    const rgbaMatch = raw.match(/^rgba?\(([^)]+)\)$/);
    if (rgbaMatch) {
      const parts = rgbaMatch[1].split(',').map((item) => item.trim());
      if (parts.length < 3) {
        return null;
      }
      return [
        clampChannel(parts[0]),
        clampChannel(parts[1]),
        clampChannel(parts[2]),
        parts.length > 3 ? clampAlpha(parts[3]) : 1
      ];
    }
    const hexMatch = raw.match(/^#([0-9a-f]{3,8})$/i);
    if (!hexMatch) {
      return null;
    }
    const hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      const chars = hex.split('');
      return [
        parseInt(chars[0] + chars[0], 16),
        parseInt(chars[1] + chars[1], 16),
        parseInt(chars[2] + chars[2], 16),
        hex.length === 4 ? clampAlpha(parseInt(chars[3] + chars[3], 16) / 255) : 1
      ];
    }
    if (hex.length === 6 || hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        hex.length === 8 ? clampAlpha(parseInt(hex.slice(6, 8), 16) / 255) : 1
      ];
    }
    return null;
  }

  function rgbToCss(color, alphaOverride) {
    const parsed = Array.isArray(color) ? color : null;
    if (!parsed || parsed.length < 3) {
      return '';
    }
    const alpha = alphaOverride == null ? (parsed[3] == null ? 1 : parsed[3]) : alphaOverride;
    if (alpha >= 0.999) {
      return `rgb(${clampChannel(parsed[0])}, ${clampChannel(parsed[1])}, ${clampChannel(parsed[2])})`;
    }
    return `rgba(${clampChannel(parsed[0])}, ${clampChannel(parsed[1])}, ${clampChannel(parsed[2])}, ${clampAlpha(alpha).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')})`;
  }

  function getLuminance(color) {
    if (!Array.isArray(color) || color.length < 3) {
      return 1;
    }
    const normalize = (channel) => {
      const value = clampChannel(channel) / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * normalize(color[0]) + 0.7152 * normalize(color[1]) + 0.0722 * normalize(color[2]);
  }

  function findNearestPaintedElement(element) {
    let current = element;
    while (current && current instanceof Element) {
      const style = window.getComputedStyle(current);
      const backgroundColor = parseCssColor(style.backgroundColor);
      if ((backgroundColor && backgroundColor[3] > 0.04) || style.backgroundImage !== 'none') {
        return current;
      }
      current = current.parentElement;
    }
    return document.body || document.documentElement;
  }

  function getVisualTheme(element) {
    const surfaceElement = findNearestPaintedElement(element);
    const pageElement = document.body || document.documentElement;
    const surfaceStyle = window.getComputedStyle(surfaceElement);
    const pageStyle = window.getComputedStyle(pageElement);
    const surfaceColor = parseCssColor(surfaceStyle.backgroundColor) ||
      parseCssColor(pageStyle.backgroundColor) ||
      [255, 255, 255, 1];
    const pageColor = parseCssColor(pageStyle.backgroundColor) || surfaceColor;
    const isDark = getLuminance(surfaceColor) < 0.45;
    return {
      pageBackground: rgbToCss(pageColor),
      hudBackground: rgbToCss(surfaceColor, isDark ? 0.86 : 0.9),
      hudBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)',
      buttonBackground: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.08)',
      secondaryButtonBackground: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.05)',
      buttonText: isDark ? '#f8fafc' : '#0f172a',
      buttonShadow: isDark
        ? 'inset 0 0 0 1px rgba(255,255,255,0.1)'
        : 'inset 0 0 0 1px rgba(255,255,255,0.46)',
      cardShadow: isDark ? '0 22px 60px rgba(0, 0, 0, 0.34)' : '0 22px 60px rgba(15, 23, 42, 0.14)',
      highlightBorder: isDark ? 'rgba(147, 197, 253, 0.92)' : 'rgba(37, 99, 235, 0.72)',
      highlightBackground: isDark ? 'rgba(96, 165, 250, 0.14)' : 'rgba(37, 99, 235, 0.10)',
      highlightShadow: isDark
        ? '0 0 0 1px rgba(255,255,255,0.12), 0 20px 60px rgba(0, 0, 0, 0.28)'
        : '0 0 0 1px rgba(255,255,255,0.55), 0 20px 60px rgba(15, 23, 42, 0.18)',
      isDark
    };
  }

  function getPickerTheme(element) {
    return getVisualTheme(element || document.body || document.documentElement);
  }

  function ensurePickerUi() {
    if (state.root && state.root.isConnected) {
      return;
    }
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('aria-hidden', 'true');
    applyNoTranslate(root);
    root.style.cssText = [
      'position: fixed',
      'inset: 0',
      'pointer-events: none',
      `z-index: ${PICKER_Z_INDEX}`,
      'font-family: "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ].join(';');

    const highlight = document.createElement('div');
    highlight.id = HIGHLIGHT_ID;
    applyNoTranslate(highlight);
    highlight.style.cssText = [
      'position: fixed',
      'left: 0',
      'top: 0',
      'width: 0',
      'height: 0',
      'border: 3px dashed rgba(37, 99, 235, 0.72)',
      'border-radius: 10px',
      'background: rgba(37, 99, 235, 0.10)',
      'box-shadow: 0 0 0 1px rgba(255,255,255,0.55), 0 20px 60px rgba(15, 23, 42, 0.18)',
      'transform: translate3d(0, 0, 0)',
      'transition: width 80ms ease, height 80ms ease, transform 80ms ease, opacity 80ms ease',
      'opacity: 0'
    ].join(';');

    root.appendChild(highlight);
    document.documentElement.appendChild(root);

    state.root = root;
    state.highlight = highlight;
  }

  function applyPickerTheme(theme) {
    const resolvedTheme = theme || getPickerTheme(null);
    state.currentTheme = resolvedTheme;
    if (state.highlight) {
      state.highlight.style.borderColor = resolvedTheme.highlightBorder;
      state.highlight.style.borderStyle = 'dashed';
      state.highlight.style.background = resolvedTheme.highlightBackground;
      state.highlight.style.boxShadow = resolvedTheme.highlightShadow;
    }
    if (state.toastElement) {
      if (resolvedTheme.isDark) {
        state.toastElement.setAttribute('data-theme', 'dark');
      } else {
        state.toastElement.removeAttribute('data-theme');
      }
    }
  }

  function setHighlight(element) {
    ensurePickerUi();
    applyPickerTheme(getPickerTheme(element));
    if (!(element instanceof Element)) {
      state.highlight.style.opacity = '0';
      return;
    }
    const rect = element.getBoundingClientRect();
    const viewportWidth = Math.max(1, Number(window.innerWidth || document.documentElement.clientWidth || 0));
    const viewportHeight = Math.max(1, Number(window.innerHeight || document.documentElement.clientHeight || 0));
    const left = Math.max(0, Math.round(rect.left) - PICKER_HIGHLIGHT_PADDING);
    const top = Math.max(0, Math.round(rect.top) - PICKER_HIGHLIGHT_PADDING);
    const right = Math.min(viewportWidth, Math.round(rect.right) + PICKER_HIGHLIGHT_PADDING);
    const bottom = Math.min(viewportHeight, Math.round(rect.bottom) + PICKER_HIGHLIGHT_PADDING);
    state.highlight.style.opacity = '1';
    state.highlight.style.width = `${Math.max(0, right - left)}px`;
    state.highlight.style.height = `${Math.max(0, bottom - top)}px`;
    state.highlight.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  function clearToast() {
    if (state.toastController) {
      state.toastController.destroy();
    }
    if (state.toastStyleGate) {
      state.toastStyleGate.destroy();
    }
    if (state.toastHost && state.toastHost.isConnected) {
      state.toastHost.remove();
    }
    state.toastHost = null;
    state.toastElement = null;
    state.toastController = null;
    state.toastStyleGate = null;
  }

  // The shared Toast, in its own shadow root so page styles cannot reach it and
  // outside the aria-hidden picker root so screen readers still hear it.
  function ensureToast() {
    if (state.toastHost && state.toastHost.isConnected && state.toastController) {
      return true;
    }
    clearToast();
    if (!TOAST || typeof TOAST.createToastController !== 'function' || !document.documentElement) {
      return false;
    }
    const staleHost = document.getElementById(TOAST_HOST_ID);
    if (staleHost) {
      staleHost.remove();
    }
    const toastHost = document.createElement('div');
    toastHost.id = TOAST_HOST_ID;
    applyNoTranslate(toastHost);
    toastHost.style.cssText = [
      'all: initial',
      'position: fixed',
      'inset: 0',
      `z-index: ${PICKER_Z_INDEX}`,
      'display: block',
      'pointer-events: none'
    ].map((rule) => `${rule} !important`).join(';');
    const toastShadow = toastHost.attachShadow({ mode: 'closed' });
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = chrome.runtime.getURL('src/shared/toast.css');
    const toastElement = document.createElement('div');
    toastElement.className = 'x-lumno-toast';
    toastElement.setAttribute('data-show', 'false');
    toastElement.setAttribute('role', 'status');
    toastElement.setAttribute('aria-live', 'polite');
    toastElement.style.setProperty('--x-lumno-toast-top', 'max(24px, calc(env(safe-area-inset-top) + 12px))');
    toastElement.style.setProperty('--x-lumno-toast-z-index', PICKER_Z_INDEX);
    applyNoTranslate(toastElement);
    toastShadow.append(stylesheet, toastElement);
    document.documentElement.appendChild(toastHost);

    state.toastHost = toastHost;
    state.toastElement = toastElement;
    state.toastStyleGate = TOAST.createToastStyleGate(toastElement, {
      stylesheetElement: stylesheet,
      windowObj: window
    });
    state.toastController = TOAST.createToastController(toastElement, { windowObj: window });
    return true;
  }

  function hideToast() {
    if (state.toastController) {
      state.toastController.hide();
    }
  }

  function showToast(message, kind, options) {
    if (!ensureToast()) {
      return;
    }
    applyPickerTheme(state.currentTheme || getPickerTheme(state.currentTarget));
    const errorToast = kind === 'error';
    state.toastElement.setAttribute('role', errorToast ? 'alert' : 'status');
    state.toastElement.setAttribute('aria-live', errorToast ? 'assertive' : 'polite');
    state.toastController.show(message, {
      error: errorToast,
      duration: options && options.persistent ? 0 : undefined
    });
  }

  function selectTargetFromStack(index) {
    const nextIndex = Math.max(0, Math.min(Number(index || 0), state.currentStack.length - 1));
    state.currentStackIndex = nextIndex;
    state.currentTarget = state.currentStack[nextIndex] || null;
    setHighlight(state.currentTarget);
  }

  function updateCurrentTargetFromPointer(event) {
    const element = getElementFromPoint(event);
    if (!element) {
      state.currentStack = [];
      state.currentStackIndex = 0;
      state.currentTarget = null;
      setHighlight(null);
      return;
    }
    const stack = getElementStack(element);
    if (!stack.length) {
      state.currentStack = [];
      state.currentStackIndex = 0;
      state.currentTarget = null;
      setHighlight(null);
      return;
    }
    const previous = state.currentTarget;
    state.currentStack = stack;
    let nextIndex = 0;
    if (previous) {
      const matchedIndex = stack.indexOf(previous);
      if (matchedIndex >= 0) {
        nextIndex = matchedIndex;
      } else {
        nextIndex = getDefaultStackIndex(stack);
      }
    } else {
      nextIndex = getDefaultStackIndex(stack);
    }
    selectTargetFromStack(nextIndex);
  }

  function getPageStyleSheets() {
    const sheets = Array.from(document.styleSheets || []);
    const adopted = Array.isArray(document.adoptedStyleSheets) ? document.adoptedStyleSheets : [];
    return sheets.concat(adopted).filter((styleSheet) => styleSheet && !styleSheet.disabled);
  }

  function getStyleSheetRuleCount(styleSheet) {
    try {
      return styleSheet.cssRules ? styleSheet.cssRules.length : -1;
    } catch (error) {
      return -1;
    }
  }

  // Cheap enough to run on every page change: rule counts catch CSS-in-JS
  // libraries that insert rules without touching the DOM.
  function getStyleSheetSignature() {
    return getPageStyleSheets().map((styleSheet) => {
      const ownerNode = styleSheet.ownerNode;
      const textLength = ownerNode && ownerNode.textContent ? ownerNode.textContent.length : 0;
      const media = styleSheet.media ? styleSheet.media.mediaText : '';
      return `${styleSheet.href || 'inline'}#${getStyleSheetRuleCount(styleSheet)}#${textLength}#${media}`;
    }).join('|');
  }

  function getStyleSheetEntries() {
    return getPageStyleSheets().map((styleSheet) => {
      const ownerNode = styleSheet.ownerNode;
      const media = styleSheet.media ? styleSheet.media.mediaText : '';
      if (ownerNode instanceof HTMLLinkElement && ownerNode.href) {
        return { key: `link|${ownerNode.href}|${media}`, href: ownerNode.href, media: media };
      }
      let cssText = '';
      try {
        cssText = Array.from(styleSheet.cssRules || []).map((rule) => rule.cssText).join('\n');
      } catch (error) {
        cssText = ownerNode && ownerNode.textContent ? ownerNode.textContent : '';
      }
      return { key: `style|${media}|${cssText}`, cssText: cssText, media: media };
    });
  }

  // Page stylesheets go in front of this marker and the dock's own styles
  // after it, so page rules never restyle the dock.
  function ensurePiPStyleAnchor(pipDocument) {
    let anchor = pipDocument.getElementById(PIP_STYLE_ANCHOR_ID);
    if (!anchor) {
      anchor = pipDocument.createElement('meta');
      anchor.id = PIP_STYLE_ANCHOR_ID;
      pipDocument.head.appendChild(anchor);
    }
    return anchor;
  }

  function syncPiPStyleSheets(session) {
    const pipDocument = session.pipDocument;
    if (!pipDocument || !pipDocument.head) {
      return;
    }
    const signature = getStyleSheetSignature();
    if (signature === session.styleSignature) {
      return;
    }
    session.styleSignature = signature;
    const head = pipDocument.head;
    const anchor = ensurePiPStyleAnchor(pipDocument);
    // Reuse nodes that are still wanted, so unchanged stylesheets never reload
    // and the floating content does not flash while the page restyles itself.
    const reusable = new Map();
    Array.from(head.querySelectorAll('[data-lumno-pip-sheet="1"]')).forEach((node) => {
      reusable.set(node.getAttribute('data-lumno-pip-key'), node);
    });
    const nodes = getStyleSheetEntries().map((entry) => {
      const existing = reusable.get(entry.key);
      if (existing) {
        reusable.delete(entry.key);
        return existing;
      }
      const node = pipDocument.createElement(entry.href ? 'link' : 'style');
      node.setAttribute('data-lumno-pip-sheet', '1');
      node.setAttribute('data-lumno-pip-key', entry.key);
      if (entry.media) {
        node.setAttribute('media', entry.media);
      }
      if (entry.href) {
        node.rel = 'stylesheet';
        node.href = entry.href;
      } else {
        node.textContent = entry.cssText;
      }
      return node;
    });
    let reference = anchor;
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      if (nodes[index].nextSibling !== reference) {
        head.insertBefore(nodes[index], reference);
      }
      reference = nodes[index];
    }
    reusable.forEach((node) => node.remove());
  }

  function copyRootAttributes(source, target, names) {
    if (!source || !target) {
      return;
    }
    Array.from(target.attributes).forEach((attr) => {
      if (/^data-/.test(attr.name) && !source.hasAttribute(attr.name)) {
        target.removeAttribute(attr.name);
      }
    });
    Array.from(source.attributes).forEach((attr) => {
      if (/^data-/.test(attr.name) || names.includes(attr.name)) {
        target.setAttribute(attr.name, attr.value);
      }
    });
    target.className = source.className;
  }

  // Theme switches usually live on <html> or <body> (class, data-theme, CSS
  // variables in the style attribute); the PiP document follows them.
  function syncPiPRootAttributes(session) {
    const pipDocument = session.pipDocument;
    if (!pipDocument || !pipDocument.documentElement) {
      return;
    }
    copyRootAttributes(document.documentElement, pipDocument.documentElement, ['style', 'lang', 'dir']);
    copyRootAttributes(document.body, pipDocument.body, ['lang', 'dir']);
  }

  function ensurePiPDocumentBase(pipDocument) {
    if (!pipDocument || !pipDocument.head) {
      return;
    }
    let base = pipDocument.getElementById('__lumno_pip_base_2026__');
    if (!base) {
      base = pipDocument.createElement('base');
      base.id = '__lumno_pip_base_2026__';
      pipDocument.head.insertBefore(base, pipDocument.head.firstChild || null);
    }
    base.href = document.baseURI || window.location.href;
  }

  function cloneContextNodeShallow(sourceNode, pipDocument) {
    if (!(sourceNode instanceof Element) || !pipDocument) {
      return null;
    }
    const tagName = String(sourceNode.tagName || '').toLowerCase();
    if (!tagName) {
      return null;
    }
    const clone = pipDocument.createElement(tagName);
    if (sourceNode.id) {
      clone.id = sourceNode.id;
    }
    if (sourceNode.className && typeof sourceNode.className === 'string') {
      clone.className = sourceNode.className;
    }
    Array.from(sourceNode.attributes).forEach((attr) => {
      if (!attr || !attr.name) {
        return;
      }
      const name = attr.name;
      if (name === 'id' || name === 'class') {
        return;
      }
      if (
        name === 'style' ||
        name === 'role' ||
        name === 'dir' ||
        name === 'lang' ||
        name.startsWith('data-') ||
        name.startsWith('aria-')
      ) {
        clone.setAttribute(name, attr.value);
      }
    });
    // Ancestors stay only so the page's selectors, fonts and colors still
    // match; their page layout (grid columns, fixed heights, scroll boxes)
    // would squeeze the clip into a column of the small window.
    CONTEXT_LAYOUT_RESET.forEach(([property, value]) => {
      clone.style.setProperty(property, value, 'important');
    });
    return clone;
  }

  function buildPiPContextChain(element, pipDocument) {
    const root = pipDocument.createElement('div');
    root.setAttribute('data-lumno-pip-context-root', '1');
    root.style.cssText = [
      'position: relative',
      'width: 100%',
      'height: auto',
      'box-sizing: border-box'
    ].join(';');

    const ancestors = [];
    let current = element instanceof Element ? element.parentElement : null;
    while (current && current !== document.body && current !== document.documentElement) {
      ancestors.push(current);
      current = current.parentElement;
    }
    ancestors.reverse();

    let mountPoint = root;
    ancestors.forEach((ancestor) => {
      const clonedAncestor = cloneContextNodeShallow(ancestor, pipDocument);
      if (!clonedAncestor) {
        return;
      }
      mountPoint.appendChild(clonedAncestor);
      mountPoint = clonedAncestor;
    });

    return {
      root: root,
      mountPoint: mountPoint
    };
  }

  function ensurePiPDockAssets(pipDocument) {
    if (!pipDocument || !pipDocument.head) {
      return;
    }
    if (!pipDocument.getElementById('__lumno_pip_remixicon_css_2026__')) {
      const link = pipDocument.createElement('link');
      link.id = '__lumno_pip_remixicon_css_2026__';
      link.rel = 'stylesheet';
      link.href = getRuntimeUrl('assets/remixicon/fonts/remixicon.css');
      pipDocument.head.appendChild(link);
    }
    if (!pipDocument.getElementById('__lumno_pip_dock_style_2026__')) {
      const style = pipDocument.createElement('style');
      style.id = '__lumno_pip_dock_style_2026__';
      style.textContent = `
        .lumno-pip-dock-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 999px;
          width: 36px;
          min-width: 36px;
          height: 36px;
          padding: 0;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.2;
          cursor: pointer;
          transition: background-color 150ms ease, opacity 150ms ease;
          transform: none;
          opacity: 0.96;
          white-space: nowrap;
        }
        .lumno-pip-dock-btn:hover,
        .lumno-pip-dock-btn:focus-visible {
          transform: none;
          opacity: 1;
          outline: none;
        }
        [data-lumno-pip-dock="1"]:not([data-expanded="true"]) .lumno-pip-dock-btn {
          opacity: 0;
        }
        .lumno-pip-dock-btn > * {
          cursor: inherit;
          pointer-events: none;
        }
        .lumno-pip-dock-btn .ri-icon {
          font-size: 15px;
          line-height: 1;
          transform: none;
          transition: transform 150ms ease;
        }
        .lumno-pip-dock-btn:hover .ri-icon,
        .lumno-pip-dock-btn:focus-visible .ri-icon {
          transform: scale(1.03);
        }
        .lumno-pip-dock-btn .lumno-pip-dock-label {
          display: inline-block;
          max-width: 0;
          overflow: hidden;
          transition: max-width 160ms ease, opacity 160ms ease, margin 160ms ease;
          opacity: 0;
          margin-left: 0;
        }
        [data-lumno-pip-dock="1"]:hover .lumno-pip-dock-btn .lumno-pip-dock-label,
        [data-lumno-pip-dock="1"]:focus-within .lumno-pip-dock-btn .lumno-pip-dock-label {
          max-width: 88px;
          opacity: 1;
          margin-left: 2px;
        }
        [data-lumno-pip-dock="1"]:hover .lumno-pip-dock-btn,
        [data-lumno-pip-dock="1"]:focus-within .lumno-pip-dock-btn {
          width: auto;
          padding: 9px 12px;
        }
      `;
      pipDocument.head.appendChild(style);
    }
  }



  function getElementTree(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE || typeof root.querySelectorAll !== 'function') {
      return [];
    }
    return [root].concat(Array.from(root.querySelectorAll('*')));
  }

  function copyUrlAttribute(sourceNode, cloneNode, attrName, propertyName) {
    if (!sourceNode || !cloneNode || !attrName || typeof sourceNode.getAttribute !== 'function' ||
        typeof cloneNode.setAttribute !== 'function') {
      return;
    }
    const raw = sourceNode.getAttribute(attrName);
    if (!raw || /^\s*(#|data:|blob:|javascript:)/i.test(raw)) {
      return;
    }
    const resolved = sourceNode[propertyName || attrName];
    if (typeof resolved === 'string' && resolved) {
      cloneNode.setAttribute(attrName, resolved);
    }
  }

  function syncCloneRuntimeState(sourceRoot, cloneRoot) {
    const sourceNodes = getElementTree(sourceRoot);
    const cloneNodes = getElementTree(cloneRoot);
    const count = Math.min(sourceNodes.length, cloneNodes.length);
    for (let index = 0; index < count; index += 1) {
      const sourceNode = sourceNodes[index];
      const cloneNode = cloneNodes[index];
      const tagName = String(sourceNode && sourceNode.tagName || '').toLowerCase();
      if (!tagName) {
        continue;
      }
      if (tagName === 'input') {
        cloneNode.value = sourceNode.value;
        cloneNode.checked = Boolean(sourceNode.checked);
        cloneNode.indeterminate = Boolean(sourceNode.indeterminate);
      } else if (tagName === 'textarea') {
        cloneNode.value = sourceNode.value;
        cloneNode.textContent = sourceNode.value;
      } else if (tagName === 'select') {
        cloneNode.selectedIndex = sourceNode.selectedIndex;
        Array.from(sourceNode.options || []).forEach((sourceOption, optionIndex) => {
          const cloneOption = cloneNode.options && cloneNode.options[optionIndex];
          if (cloneOption) {
            cloneOption.selected = Boolean(sourceOption.selected);
          }
        });
      } else if (tagName === 'option') {
        cloneNode.selected = Boolean(sourceNode.selected);
      } else if (tagName === 'details') {
        cloneNode.open = Boolean(sourceNode.open);
      } else if (tagName === 'canvas' && typeof sourceNode.getContext === 'function' && typeof cloneNode.getContext === 'function') {
        try {
          const context = cloneNode.getContext('2d');
          if (context) {
            context.drawImage(sourceNode, 0, 0);
          }
        } catch (error) {
          // Ignore canvas copies that are blocked by browser security.
        }
      }

      if (tagName === 'img') {
        copyUrlAttribute(sourceNode, cloneNode, 'src', sourceNode.currentSrc ? 'currentSrc' : 'src');
      } else if (tagName === 'source' || tagName === 'track' || tagName === 'script') {
        copyUrlAttribute(sourceNode, cloneNode, 'src', 'src');
      } else if (tagName === 'a' || tagName === 'area') {
        copyUrlAttribute(sourceNode, cloneNode, 'href', 'href');
      }
    }
  }

  // The clip keeps its own look, but page-level placement (sticky headers,
  // fixed panels, outer margins) has no meaning in the floating window.
  function normalizeClipRoot(clone, element) {
    const computed = window.getComputedStyle(element);
    if (['fixed', 'sticky', 'absolute'].includes(computed.position)) {
      clone.style.setProperty('position', 'relative', 'important');
      ['top', 'right', 'bottom', 'left'].forEach((side) => {
        clone.style.setProperty(side, 'auto', 'important');
      });
    }
    clone.style.setProperty('margin', '0', 'important');
  }

  function buildPiPElementClone(element, pipDocument) {
    if (!element || !pipDocument) {
      return null;
    }
    const clone = typeof pipDocument.importNode === 'function'
      ? pipDocument.importNode(element, true)
      : element.cloneNode(true);
    if (clone && clone.nodeType === Node.ELEMENT_NODE) {
      syncCloneRuntimeState(element, clone);
      normalizeClipRoot(clone, element);
    }
    return clone;
  }

  function refreshPiPContent(session) {
    if (!session || !session.element || !session.pipDocument || !session.pipContentMount ||
        !session.pipWindow || session.pipWindow.closed) {
      return;
    }
    syncPiPStyleSheets(session);
    const clone = buildPiPElementClone(session.element, session.pipDocument);
    if (!clone) {
      return;
    }
    const scrollHost = session.pipContent || null;
    const scrollTop = scrollHost ? scrollHost.scrollTop : 0;
    const scrollLeft = scrollHost ? scrollHost.scrollLeft : 0;
    if (session.pipElementClone && session.pipElementClone.parentNode === session.pipContentMount) {
      session.pipContentMount.replaceChild(clone, session.pipElementClone);
    } else {
      session.pipContentMount.replaceChildren(clone);
    }
    session.pipElementClone = clone;
    if (scrollHost) {
      scrollHost.scrollTop = scrollTop;
      scrollHost.scrollLeft = scrollLeft;
    }
  }

  function schedulePiPContentRefresh(session) {
    if (!session || !session.element || !session.pipContentMount || session.contentSyncTimer != null) {
      return;
    }
    session.contentSyncTimer = window.setTimeout(() => {
      session.contentSyncTimer = null;
      refreshPiPContent(session);
    }, PIP_SYNC_DELAY_MS);
  }

  function schedulePiPDocumentSync(session) {
    if (!session || session.documentSyncTimer != null) {
      return;
    }
    session.documentSyncTimer = window.setTimeout(() => {
      session.documentSyncTimer = null;
      if (!session.pipWindow || session.pipWindow.closed) {
        return;
      }
      syncPiPRootAttributes(session);
      syncPiPStyleSheets(session);
    }, PIP_SYNC_DELAY_MS);
  }

  function hasFloatingSurface(element) {
    const style = window.getComputedStyle(element);
    return hasPaintedSurface(element) &&
      (style.boxShadow !== 'none' || (parseFloat(style.borderTopLeftRadius) || 0) > 0);
  }

  function getClipLayout(element) {
    const rect = element.getBoundingClientRect();
    // Cards with rounded corners or shadows get a little room so their edges
    // do not touch the window frame; flat regions use the whole window.
    const gutter = hasFloatingSurface(element) ? PIP_CARD_GUTTER : 0;
    const width = Math.round(rect.width || 520) + gutter * 2;
    const height = Math.round(rect.height || 360) + gutter * 2 + PIP_DOCK_CLEARANCE;
    return {
      gutter: gutter,
      width: Math.max(PIP_MIN_WIDTH, Math.min(PIP_MAX_WIDTH, width)),
      height: Math.max(PIP_MIN_HEIGHT, Math.min(PIP_MAX_HEIGHT, height))
    };
  }

  function createPiPScaffold(pipWindow, visualTheme, layout) {
    const pipDocument = pipWindow.document;
    ensurePiPDocumentBase(pipDocument);
    ensurePiPStyleAnchor(pipDocument);
    ensurePiPDockAssets(pipDocument);
    pipDocument.title = document.title || 'Lumno PiP';
    pipDocument.body.replaceChildren();
    pipDocument.body.style.cssText = [
      'margin: 0 !important',
      'padding: 0 !important',
      `background: ${visualTheme.pageBackground}`
    ].join(';');

    // The scroll box is ours, so page rules on <html>/<body> such as
    // overflow: hidden (for an open modal) cannot freeze the clip.
    const shell = pipDocument.createElement('div');
    shell.style.cssText = [
      'position: fixed',
      'inset: 0',
      `background: ${visualTheme.pageBackground}`,
      'box-sizing: border-box'
    ].join(';');

    const content = pipDocument.createElement('div');
    content.style.cssText = [
      'height: 100%',
      'overflow: auto',
      `padding: ${layout.gutter}px ${layout.gutter}px ${layout.gutter + PIP_DOCK_CLEARANCE}px`,
      'box-sizing: border-box'
    ].join(';');

    shell.appendChild(content);
    pipDocument.body.appendChild(shell);

    return {
      shell: shell,
      content: content
    };
  }

  function createPiPDock(pipContext) {
    const { pipWindow, pipDocument, shell, visualTheme } = pipContext;
    const dock = pipDocument.createElement('div');
    dock.setAttribute('data-lumno-pip-dock', '1');
    applyNoTranslate(dock);
    dock.style.cssText = [
      'position: fixed',
      'left: 50%',
      'bottom: 10px',
      'transform: translateX(-50%) translateY(calc(100% - 8px))',
      'display: flex',
      'align-items: center',
      'gap: 8px',
      'padding: 8px 10px 12px',
      'border-radius: 999px',
      `background: ${visualTheme.hudBackground}`,
      `border: 1px solid ${visualTheme.hudBorder}`,
      `box-shadow: ${visualTheme.cardShadow}`,
      'backdrop-filter: blur(16px)',
      '-webkit-backdrop-filter: blur(16px)',
      'transition: transform 180ms ease, opacity 180ms ease',
      'opacity: 0.92',
      'z-index: 2147483647'
    ].join(';');

    const buildDockButton = (label, iconClass) => {
      const button = pipDocument.createElement('button');
      button.type = 'button';
      button.className = 'lumno-pip-dock-btn';
      applyNoTranslate(button);
      button.style.cssText = [
        `background: ${visualTheme.buttonBackground}`,
        `color: ${visualTheme.buttonText}`,
        `box-shadow: ${visualTheme.buttonShadow}`
      ].join(';');
      const icon = pipDocument.createElement('i');
      icon.className = `ri-icon ${iconClass}`;
      applyNoTranslate(icon);
      const text = pipDocument.createElement('span');
      text.className = 'lumno-pip-dock-label';
      text.textContent = label;
      applyNoTranslate(text);
      button.appendChild(icon);
      button.appendChild(text);
      return button;
    };

    const showDock = () => {
      if (dock._xHideTimer) {
        pipWindow.clearTimeout(dock._xHideTimer);
        dock._xHideTimer = null;
      }
      dock.setAttribute('data-expanded', 'true');
      dock.style.transform = 'translateX(-50%) translateY(0)';
      dock.style.opacity = '1';
    };

    const hideDock = () => {
      if (dock._xHideTimer) {
        pipWindow.clearTimeout(dock._xHideTimer);
      }
      dock._xHideTimer = pipWindow.setTimeout(() => {
        dock._xHideTimer = null;
        dock.removeAttribute('data-expanded');
        dock.style.transform = 'translateX(-50%) translateY(calc(100% - 8px))';
        dock.style.opacity = '0.92';
      }, 140);
    };

    const closeButton = buildDockButton(getMessage('document_pip_picker_button_close', 'Close'), 'ri-close-line');
    closeButton.style.background = visualTheme.secondaryButtonBackground;
    closeButton.addEventListener('click', () => {
      restoreSession({ closeWindow: true });
    });

    const reselectButton = buildDockButton(getMessage('document_pip_picker_button_reselect', 'Reselect'), 'ri-focus-3-line');
    reselectButton.addEventListener('click', () => {
      restoreSession({ closeWindow: true });
      window.requestAnimationFrame(() => {
        startSelection();
      });
    });

    dock.appendChild(reselectButton);
    dock.appendChild(closeButton);
    dock.addEventListener('mouseenter', showDock);
    dock.addEventListener('mouseleave', hideDock);
    dock.addEventListener('focusin', showDock);
    dock.addEventListener('focusout', hideDock);
    pipDocument.addEventListener('mousemove', (event) => {
      const y = Number(event && event.clientY);
      const height = Number(pipWindow.innerHeight || 0);
      if (height > 0 && y >= height - 48) {
        showDock();
        return;
      }
      hideDock();
    });

    shell.appendChild(dock);
    return dock;
  }

  function restoreSession(options) {
    const session = state.session;
    if (!session) {
      releaseDocumentPipOwnership();
      return false;
    }
    state.session = null;
    window[STATE_FLAG] = false;

    [session.documentObserver, session.contentObserver, session.resizeObserver].forEach((observer) => {
      if (observer) {
        observer.disconnect();
      }
    });
    [session.contentSyncTimer, session.documentSyncTimer].forEach((timer) => {
      if (timer != null) {
        window.clearTimeout(timer);
      }
    });
    session.contentSyncTimer = null;
    session.documentSyncTimer = null;
    if (session.onMainPageHide) {
      window.removeEventListener('pagehide', session.onMainPageHide, true);
    }
    if (session.dock && session.dock._xHideTimer) {
      try {
        session.pipWindow.clearTimeout(session.dock._xHideTimer);
      } catch (error) {
        // Ignore timer cleanup failures.
      }
      session.dock._xHideTimer = null;
    }

    if (!options || options.closeWindow !== false) {
      try {
        if (session.pipWindow && !session.pipWindow.closed) {
          session.pipWindow.close();
        }
      } catch (error) {
        // Ignore close failures.
      }
    }
    setHighlight(null);
    releaseDocumentPipOwnership();
    return true;
  }

  function getPiPLinkUrl(link) {
    const rawHref = link.getAttribute('href') || '';
    try {
      return new URL(rawHref, document.baseURI || window.location.href);
    } catch (error) {
      return null;
    }
  }

  // The clip is a copy without the page's scripts, so following a link inside
  // the small window would replace the clip itself. Links open as tabs next
  // to the page instead, and in-page anchors scroll the clip.
  function handlePiPLinkClick(event, session) {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }
    const link = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('a[href], area[href]')
      : null;
    if (!link) {
      return;
    }
    event.preventDefault();
    const url = getPiPLinkUrl(link);
    if (!url) {
      return;
    }
    const pageUrl = new URL(window.location.href);
    if (url.hash && url.origin === pageUrl.origin && url.pathname === pageUrl.pathname &&
        url.search === pageUrl.search) {
      let anchorTarget = null;
      try {
        anchorTarget = session.pipDocument.getElementById(decodeURIComponent(url.hash.slice(1)));
      } catch (error) {
        anchorTarget = null;
      }
      if (anchorTarget) {
        anchorTarget.scrollIntoView({ block: 'start' });
      }
      return;
    }
    if (!/^(https?|mailto|tel):$/.test(url.protocol)) {
      return;
    }
    sendRuntimeMessage({
      action: 'createTab',
      url: url.href,
      disposition: event.metaKey || event.ctrlKey ? 'backgroundTab' : 'foregroundTab'
    });
  }

  function attachPiPDocumentHandlers(session) {
    const pipDocument = session.pipDocument;
    pipDocument.addEventListener('click', (event) => {
      handlePiPLinkClick(event, session);
    });
    pipDocument.addEventListener('submit', (event) => {
      event.preventDefault();
    }, true);
  }

  async function openDocumentPiP(element) {
    if (!isAllowedElement(element) || containsBlockedMediaContent(element)) {
      showToast(
        getMessage(
          'document_pip_picker_invalid',
          'This element cannot be opened in the floating window.'
        ),
        'error'
      );
      return { ok: false, reason: 'invalid-element' };
    }

    if (hasActiveVideoPiP()) {
      showVideoPiPConflictToast();
      return { ok: false, reason: 'video-pip-active' };
    }

    const visualTheme = getVisualTheme(element);
    const layout = getClipLayout(element);
    let pipWindow = null;
    try {
      // Browsers only open PiP while the click's user activation is fresh, so
      // the window comes first; slow work like waking the background service
      // worker must not run before it.
      pipWindow = await window.documentPictureInPicture.requestWindow({
        width: layout.width,
        height: layout.height
      });
    } catch (error) {
      showToast(getOpenFailureMessage(error), 'error');
      return {
        ok: false,
        reason: 'request-window-failed',
        errorName: error && error.name ? String(error.name) : '',
        errorMessage: error && error.message ? String(error.message) : ''
      };
    }

    let session = null;
    try {
      const pipDocument = pipWindow.document;
      const { shell, content } = createPiPScaffold(pipWindow, visualTheme, layout);
      const dock = createPiPDock({
        pipWindow,
        pipDocument,
        shell,
        visualTheme
      });
      const contextChain = buildPiPContextChain(element, pipDocument);
      content.appendChild(contextChain.root);

      session = {
        element: element,
        pipWindow: pipWindow,
        pipDocument: pipDocument,
        pipContent: content,
        pipContentMount: contextChain.mountPoint,
        pipElementClone: null,
        styleSignature: '',
        documentObserver: null,
        contentObserver: null,
        resizeObserver: null,
        contentSyncTimer: null,
        documentSyncTimer: null,
        dock: dock,
        onMainPageHide: null
      };

      session.documentObserver = new MutationObserver(() => {
        schedulePiPDocumentSync(session);
      });
      session.documentObserver.observe(document.documentElement, { attributes: true });
      if (document.body) {
        session.documentObserver.observe(document.body, { attributes: true });
      }
      if (document.head) {
        session.documentObserver.observe(document.head, {
          childList: true,
          subtree: true,
          characterData: true
        });
      }

      session.contentObserver = new MutationObserver(() => {
        schedulePiPContentRefresh(session);
      });
      session.contentObserver.observe(element, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true
      });

      if (typeof ResizeObserver === 'function') {
        session.resizeObserver = new ResizeObserver(() => {
          schedulePiPContentRefresh(session);
        });
        session.resizeObserver.observe(element);
      }

      session.onMainPageHide = () => {
        if (state.session === session) {
          restoreSession({ closeWindow: true });
        }
      };
      pipWindow.addEventListener('pagehide', () => {
        if (state.session === session) {
          restoreSession({ closeWindow: false });
        }
      }, { once: true });
      window.addEventListener('pagehide', session.onMainPageHide, true);
      attachPiPDocumentHandlers(session);

      state.session = session;
      syncPiPRootAttributes(session);
      refreshPiPContent(session);
      window[STATE_FLAG] = true;

    } catch (error) {
      if (state.session === session && session) {
        restoreSession({ closeWindow: true });
      } else {
        pipWindow.close();
      }
      throw error;
    }

    // Opening the window already closed any other PiP; claiming ownership
    // lets Lumno in other tabs drop their stale sessions.
    await requestDocumentPipOwnership();
    if (state.session !== session) {
      releaseDocumentPipOwnership();
    }
    return { ok: true };
  }

  function stopSelection(options) {
    state.active = false;
    state.currentTarget = null;
    state.currentStack = [];
    state.currentStackIndex = 0;
    state.currentTheme = null;
    state.opening = false;
    if (typeof state.teardownSelection === 'function') {
      state.teardownSelection();
      state.teardownSelection = null;
    }
    hideToast();
    if (!options || options.clearHighlight !== false) {
      setHighlight(null);
    }
  }

  async function confirmCurrentTarget() {
    if (!state.active || state.opening) {
      return;
    }
    const target = state.currentTarget;
    if (!target) {
      return;
    }
    state.opening = true;
    stopSelection({});
    try {
      const result = await openDocumentPiP(target);
      if (!result || result.ok !== true) {
        releaseDocumentPipOwnership();
        setHighlight(null);
      }
    } catch (error) {
      releaseDocumentPipOwnership();
      setHighlight(null);
      showToast(
        getMessage(
          'document_pip_picker_open_failed',
          'Failed to open the floating content window. Try a different area'
        ),
        'error'
      );
    }
  }

  function startSelection() {
    const support = getDocumentPiPSupportState();
    if (!support.supported) {
      showToast(
        getSupportFailureMessage(support.reason),
        'error'
      );
      return { ok: false, state: 'unsupported', reason: support.reason };
    }
    if (state.active) {
      return { ok: true, state: 'already-active' };
    }
    if (hasActiveVideoPiP()) {
      showVideoPiPConflictToast();
      return { ok: false, state: 'blocked-by-video-pip' };
    }
    ensurePickerUi();
    applyPickerTheme(getPickerTheme(null));
    state.active = true;

    const onMouseMove = (event) => {
      if (!state.active) {
        return;
      }
      updateCurrentTargetFromPointer(event);
    };

    const onWheel = (event) => {
      if (!state.active || !state.currentStack.length) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const delta = Math.sign(event.deltaY || 0);
      if (delta === 0) {
        return;
      }
      selectTargetFromStack(state.currentStackIndex + (delta > 0 ? 1 : -1));
    };

    const onKeyDown = (event) => {
      if (!state.active) {
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        stopSelection({});
        showToast(
          getMessage('document_pip_picker_cancelled', 'Content selection closed'),
          'info'
        );
        return;
      }
      if ((event.key === '[' || event.key === 'ArrowUp') && state.currentStack.length) {
        event.preventDefault();
        event.stopPropagation();
        selectTargetFromStack(state.currentStackIndex + 1);
        return;
      }
      if ((event.key === ']' || event.key === 'ArrowDown') && state.currentStack.length) {
        event.preventDefault();
        event.stopPropagation();
        selectTargetFromStack(state.currentStackIndex - 1);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'NumpadEnter') && state.currentTarget) {
        event.preventDefault();
        event.stopPropagation();
        confirmCurrentTarget();
      }
    };

    const onClick = async (event) => {
      if (!state.active) {
        return;
      }
      if (isOwnNode(event.target)) {
        return;
      }
      if (!state.currentTarget) {
        updateCurrentTargetFromPointer(event);
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await confirmCurrentTarget();
    };

    const onPointerBlockingEvent = (event) => {
      if (!state.active) {
        return;
      }
      if (isOwnNode(event.target)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerBlockingEvent, true);
    window.addEventListener('mousedown', onPointerBlockingEvent, true);
    window.addEventListener('mouseup', onPointerBlockingEvent, true);
    window.addEventListener('click', onClick, true);

    state.teardownSelection = () => {
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('wheel', onWheel, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerBlockingEvent, true);
      window.removeEventListener('mousedown', onPointerBlockingEvent, true);
      window.removeEventListener('mouseup', onPointerBlockingEvent, true);
      window.removeEventListener('click', onClick, true);
    };

    showToast(
      getMessage(
        'document_pip_picker_started',
        'Hover to select, press Enter to float. Scroll to change scope, or press Esc to cancel'
      ),
      'info',
      { persistent: true }
    );
    return { ok: true, state: 'started' };
  }

  function toggle() {
    if (state.session) {
      restoreSession({ closeWindow: true });
      showToast(
        getMessage('document_pip_picker_closed', 'Floating content window closed'),
        'info'
      );
      return { ok: true, state: 'closed' };
    }
    if (state.active) {
      stopSelection({});
      showToast(
        getMessage('document_pip_picker_cancelled', 'Content selection closed'),
        'info'
      );
      return { ok: true, state: 'cancelled' };
    }
    return startSelection();
  }

  function bindRuntimeMessageListener() {
    if (state.runtimeMessageHandlerBound) {
      return;
    }
    if (!chrome || !chrome.runtime || !chrome.runtime.onMessage ||
        typeof chrome.runtime.onMessage.addListener !== 'function') {
      return;
    }
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.action !== 'lumno:pip-force-surrender') {
        return;
      }
      if (state.active) {
        stopSelection({});
      }
      restoreSession({ closeWindow: true });
      sendResponse({ ok: true });
      return true;
    });
    state.runtimeMessageHandlerBound = true;
  }

  bindRuntimeMessageListener();

  window.__lumnoDocumentPiPPicker2026 = {
    toggle: toggle,
    restore: () => restoreSession({ closeWindow: true }),
    notifyVideoPiPConflict: () => {
      if (state.active) {
        stopSelection({});
      }
      showVideoPiPConflictToast();
      return { ok: false, state: 'blocked-by-video-pip' };
    }
  };
})();
