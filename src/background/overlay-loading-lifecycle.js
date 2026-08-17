(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoOverlayLoadingLifecycle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const DEFAULT_RECORD_TTL_MS = 5 * 60 * 1000;
  const DEFAULT_NAVIGATION_STATE_TTL_MS = 5 * 60 * 1000;
  const MAX_INPUT_VALUE_LENGTH = 64 * 1024;

  function createTopFrameNavigationState(details, now) {
    const input = details && typeof details === 'object' ? details : {};
    if (typeof input.tabId !== 'number' || input.tabId < 0 || input.frameId !== 0) {
      return null;
    }
    const createdAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    return {
      tabId: input.tabId,
      url: typeof input.url === 'string' ? input.url.trim() : '',
      startedAt: createdAt,
      updatedAt: createdAt
    };
  }

  function updateTopFrameNavigationState(record, details, now) {
    const input = details && typeof details === 'object' ? details : {};
    if (!record || typeof record.tabId !== 'number' || input.frameId !== 0 ||
        (typeof input.tabId === 'number' && input.tabId !== record.tabId)) {
      return null;
    }
    const updatedAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const nextUrl = typeof input.url === 'string' && input.url.trim()
      ? input.url.trim()
      : String(record.url || '');
    return {
      ...record,
      url: nextUrl,
      updatedAt
    };
  }

  function isNavigationStateExpired(state, now, ttlMs) {
    if (!state || typeof state.tabId !== 'number') {
      return true;
    }
    const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const maxAge = Number.isFinite(Number(ttlMs)) && Number(ttlMs) > 0
      ? Number(ttlMs)
      : DEFAULT_NAVIGATION_STATE_TTL_MS;
    return currentTime - Number(state.updatedAt || state.startedAt || 0) > maxAge;
  }

  function applyTopFrameNavigationState(tab, state, options) {
    if (!tab || typeof tab.id !== 'number' || !state || state.tabId !== tab.id) {
      return tab;
    }
    const settings = options && typeof options === 'object' ? options : {};
    if (isNavigationStateExpired(state, settings.now, settings.ttlMs)) {
      return tab;
    }
    const reportedPendingUrl = typeof tab.pendingUrl === 'string'
      ? tab.pendingUrl.trim()
      : '';
    return {
      ...tab,
      status: 'loading',
      pendingUrl: reportedPendingUrl || String(state.url || '')
    };
  }

  function isLoadingTab(tab) {
    if (!tab || typeof tab.id !== 'number') {
      return false;
    }
    return tab.status === 'loading' || Boolean(
      typeof tab.pendingUrl === 'string' && tab.pendingUrl.trim()
    );
  }

  function getPendingInjectableUrl(tab, canInjectUrl) {
    if (!isLoadingTab(tab) || typeof canInjectUrl !== 'function') {
      return '';
    }
    const currentUrl = typeof tab.url === 'string' ? tab.url.trim() : '';
    const pendingUrl = typeof tab.pendingUrl === 'string' ? tab.pendingUrl.trim() : '';
    if (!pendingUrl || canInjectUrl(currentUrl) || !canInjectUrl(pendingUrl)) {
      return '';
    }
    return pendingUrl;
  }

  function shouldDeferRestrictedLoadingTab(tab, canInjectUrl) {
    if (!isLoadingTab(tab) || typeof canInjectUrl !== 'function') {
      return false;
    }
    const currentUrl = typeof tab.url === 'string' ? tab.url.trim() : '';
    if (canInjectUrl(currentUrl)) {
      return false;
    }
    const pendingUrl = typeof tab.pendingUrl === 'string' ? tab.pendingUrl.trim() : '';
    return !pendingUrl || canInjectUrl(pendingUrl);
  }

  function createRecord(tab, source, now) {
    if (!isLoadingTab(tab)) {
      return null;
    }
    const createdAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    return {
      tabId: tab.id,
      source: String(source || ''),
      documentId: '',
      session: null,
      createdAt,
      updatedAt: createdAt
    };
  }

  function clampSelectionOffset(value, inputLength, fallback) {
    const numeric = Number(value);
    const resolved = Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
    return Math.max(0, Math.min(inputLength, resolved));
  }

  function normalizeSessionState(value, previousSession, now) {
    const input = value && typeof value === 'object' ? value : {};
    const previous = previousSession && typeof previousSession === 'object'
      ? previousSession
      : null;
    const rawInputValue = typeof input.inputValue === 'string'
      ? input.inputValue
      : (previous && typeof previous.inputValue === 'string' ? previous.inputValue : '');
    const inputValue = rawInputValue.slice(0, MAX_INPUT_VALUE_LENGTH);
    const inputLength = inputValue.length;
    const previousStart = previous && Number.isFinite(Number(previous.selectionStart))
      ? Number(previous.selectionStart)
      : inputLength;
    const selectionStart = clampSelectionOffset(
      input.selectionStart,
      inputLength,
      Math.min(previousStart, inputLength)
    );
    const previousEnd = previous && Number.isFinite(Number(previous.selectionEnd))
      ? Number(previous.selectionEnd)
      : selectionStart;
    const selectionEnd = Math.max(selectionStart, clampSelectionOffset(
      input.selectionEnd,
      inputLength,
      Math.min(previousEnd, inputLength)
    ));
    const selectionDirection = input.selectionDirection === 'backward' ||
      input.selectionDirection === 'forward'
      ? input.selectionDirection
      : 'none';
    const updatedAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    return {
      inputValue,
      selectionStart,
      selectionEnd,
      selectionDirection,
      focused: input.focused !== false,
      revision: Math.max(0, Number(previous && previous.revision) || 0) + 1,
      updatedAt
    };
  }

  function applySessionUpdate(record, value, options) {
    if (!record) {
      return { action: 'none', record: null, reason: 'not-tracked' };
    }
    const settings = options && typeof options === 'object' ? options : {};
    const senderDocumentId = typeof settings.documentId === 'string'
      ? settings.documentId
      : '';
    const trackedDocumentId = String(record.documentId || '');
    if (senderDocumentId && trackedDocumentId && senderDocumentId !== trackedDocumentId) {
      return { action: 'keep', record, reason: 'stale-document' };
    }
    const updatedAt = Number.isFinite(Number(settings.now))
      ? Number(settings.now)
      : Date.now();
    return {
      action: 'keep',
      record: {
        ...record,
        documentId: trackedDocumentId || senderDocumentId,
        session: normalizeSessionState(value, record.session, updatedAt),
        updatedAt
      },
      reason: 'session-updated'
    };
  }

  function getMainFrameResult(results) {
    const list = Array.isArray(results) ? results.filter(Boolean) : [];
    return list.find((item) => item.frameId === 0) || list[0] || null;
  }

  function withResultDocument(record, result, now) {
    if (!record) {
      return null;
    }
    const nextDocumentId = result && typeof result.documentId === 'string'
      ? result.documentId
      : '';
    const updatedAt = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    return {
      ...record,
      documentId: nextDocumentId || record.documentId || '',
      updatedAt
    };
  }

  function applyInvocationResult(record, results, now) {
    if (!record) {
      return { action: 'none', record: null, reason: 'not-tracked' };
    }
    const mainResult = getMainFrameResult(results);
    const payload = mainResult && mainResult.result && typeof mainResult.result === 'object'
      ? mainResult.result
      : null;
    if (!payload || payload.ok !== true) {
      return { action: 'keep', record, reason: 'invocation-unconfirmed' };
    }
    if (payload.overlayOpen !== true) {
      return { action: 'clear', record: null, reason: 'overlay-closed' };
    }
    return {
      action: 'keep',
      record: withResultDocument(record, mainResult, now),
      reason: 'overlay-open'
    };
  }

  function isExpired(record, now, ttlMs) {
    if (!record) {
      return true;
    }
    const currentTime = Number.isFinite(Number(now)) ? Number(now) : Date.now();
    const maxAge = Number.isFinite(Number(ttlMs)) && Number(ttlMs) > 0
      ? Number(ttlMs)
      : DEFAULT_RECORD_TTL_MS;
    return currentTime - Number(record.createdAt || 0) > maxAge;
  }

  function decideRecovery(record, results, options) {
    const settings = options && typeof options === 'object' ? options : {};
    const now = Number.isFinite(Number(settings.now)) ? Number(settings.now) : Date.now();
    if (!record) {
      return { action: 'none', record: null, reason: 'not-tracked' };
    }
    if (isExpired(record, now, settings.ttlMs)) {
      return { action: 'clear', record: null, reason: 'expired' };
    }
    const mainResult = getMainFrameResult(results);
    const payload = mainResult && mainResult.result && typeof mainResult.result === 'object'
      ? mainResult.result
      : null;
    if (!payload) {
      return { action: 'restore', record, reason: 'probe-unavailable' };
    }
    const nextRecord = withResultDocument(record, mainResult, now);
    if (payload.overlayConnected === true) {
      if (settings.complete === true && settings.stable === true) {
        return { action: 'clear', record: null, reason: 'stable-complete-and-connected' };
      }
      return {
        action: 'keep',
        record: nextRecord,
        reason: settings.complete === true
          ? 'complete-awaiting-stability'
          : 'connected'
      };
    }
    const previousDocumentId = String(record.documentId || '');
    const currentDocumentId = String(mainResult.documentId || '');
    const comparableDocumentIds = Boolean(previousDocumentId && currentDocumentId);
    const documentChanged = comparableDocumentIds && previousDocumentId !== currentDocumentId;
    if (payload.runtimeReady === true && payload.overlayOpenState === 'closed' && !documentChanged) {
      return { action: 'clear', record: null, reason: 'closed-in-same-document' };
    }
    return {
      action: 'restore',
      record: nextRecord,
      reason: documentChanged ? 'document-changed' : 'overlay-host-lost'
    };
  }

  return Object.freeze({
    DEFAULT_NAVIGATION_STATE_TTL_MS,
    DEFAULT_RECORD_TTL_MS,
    applyTopFrameNavigationState,
    applyInvocationResult,
    applySessionUpdate,
    createTopFrameNavigationState,
    createRecord,
    decideRecovery,
    getMainFrameResult,
    getPendingInjectableUrl,
    isExpired,
    isLoadingTab,
    isNavigationStateExpired,
    normalizeSessionState,
    shouldDeferRestrictedLoadingTab,
    updateTopFrameNavigationState
  });
});
