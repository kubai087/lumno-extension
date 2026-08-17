(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoOverlaySiteFixes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const OVERLAY_STYLE_IDS = Object.freeze({
    input: '_x_extension_input_component_style_2026_unique_',
    suggestions: '_x_extension_overlay_suggestions_style_2026_unique_'
  });
  const OVERLAY_STYLE_FALLBACK_ATTRIBUTE = 'data-lumno-site-fix-style-fallback';

  const OVERLAY_STYLE_REVEAL_POLICY = Object.freeze({
    id: 'overlay-critical-style-reveal',
    waitForStyleSheets: true,
    styleIds: Object.freeze([
      OVERLAY_STYLE_IDS.input,
      OVERLAY_STYLE_IDS.suggestions
    ]),
    maxWaitMs: 80
  });

  const SITE_FIXES = Object.freeze([]);

  function normalizeHostname(value) {
    return String(value || '')
      .trim()
      .replace(/\.$/, '')
      .toLowerCase();
  }

  function getWindowHostname(win) {
    const targetWindow = win || (typeof window !== 'undefined' ? window : null);
    const locationLike = targetWindow && targetWindow.location ? targetWindow.location : null;
    return normalizeHostname(locationLike && locationLike.hostname ? locationLike.hostname : '');
  }

  function hostMatchesRule(hostname, rule) {
    const host = normalizeHostname(hostname);
    const normalizedRule = normalizeHostname(rule);
    if (!host || !normalizedRule) {
      return false;
    }
    return host === normalizedRule || host.endsWith(`.${normalizedRule}`);
  }

  function getActiveFixes(win) {
    const hostname = getWindowHostname(win);
    if (!hostname) {
      return [];
    }
    return SITE_FIXES.filter((fix) => {
      const hosts = Array.isArray(fix.hosts) ? fix.hosts : [];
      return hosts.some((host) => hostMatchesRule(hostname, host));
    });
  }

  function escapeAttributeValue(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function findById(rootNode, id) {
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

  function isStylesheetLink(node) {
    if (!node || typeof node.getAttribute !== 'function') {
      return false;
    }
    const rel = String(node.getAttribute('rel') || node.rel || '').toLowerCase();
    return rel.split(/\s+/).includes('stylesheet');
  }

  function isStylesheetLoaded(link) {
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
    } catch (error) {
      return false;
    }
    return false;
  }

  function markStylesheetReady(link) {
    if (link && link.dataset) {
      link.dataset.lumnoStylesheetReady = 'true';
    }
  }

  function collectStyleLinks(rootNode, styleIds) {
    const ids = Array.isArray(styleIds) ? styleIds : [];
    const links = [];
    ids.forEach((id) => {
      const link = findById(rootNode, id);
      if (isStylesheetLink(link) && !links.includes(link)) {
        links.push(link);
      }
    });
    return links;
  }

  function getTimerWindow(win) {
    return win || (typeof window !== 'undefined' ? window : null);
  }

  function waitForStyleLinks(win, links, maxWaitMs, onAllLoaded) {
    const targetWindow = getTimerWindow(win);
    const pendingLinks = (Array.isArray(links) ? links : []).filter((link) => !isStylesheetLoaded(link));
    if (pendingLinks.length === 0) {
      (Array.isArray(links) ? links : []).forEach(markStylesheetReady);
      if (typeof onAllLoaded === 'function') {
        onAllLoaded();
      }
      return Promise.resolve({ ok: true, reason: 'already-loaded' });
    }
    if (!targetWindow || typeof targetWindow.setTimeout !== 'function') {
      return Promise.resolve({ ok: false, reason: 'timer-unavailable' });
    }

    return new Promise((resolve) => {
      let initialResultSettled = false;
      let remaining = pendingLinks.length;
      let timer = null;
      let raf = null;
      const cleanups = [];
      const readyLinks = new Set();

      const settleInitialResult = (ok, reason) => {
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

      const handleReady = (link, reason) => {
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
        timer = targetWindow.setTimeout(() => {
          // Keep load listeners alive after the first-frame budget expires:
          // the panel can reveal with its safe fallback now and upgrade as soon
          // as the real stylesheets finish loading.
          settleInitialResult(false, 'timeout');
        }, waitMs);
      }
    });
  }

  function setOverlayDeferredVisibility(overlay, enabled, fixId) {
    if (!overlay || !overlay.style || typeof overlay.style.setProperty !== 'function') {
      return;
    }
    if (enabled) {
      overlay.setAttribute('data-lumno-site-fix-reveal', fixId || 'waiting');
      overlay.style.setProperty('visibility', 'hidden', 'important');
      return;
    }
    overlay.removeAttribute('data-lumno-site-fix-reveal');
    overlay.style.removeProperty('visibility');
  }

  function setOverlayStyleFallback(overlay, enabled, fixId) {
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

  function createNoopRevealGate() {
    return Object.freeze({
      active: false,
      fixId: '',
      waitUntilReady: () => Promise.resolve({ ok: true, reason: 'not-needed' }),
      release: () => {},
      cancel: () => {}
    });
  }

  function createOverlayRevealGate(win, options) {
    const settings = options && typeof options === 'object' ? options : {};
    const activeFix = getActiveFixes(win).find((fix) => fix && fix.waitForStyleSheets) ||
      OVERLAY_STYLE_REVEAL_POLICY;

    const overlay = settings.overlay || null;
    const styleRoot = settings.styleRoot ||
      (overlay && overlay._lumnoOverlayRoot ? overlay._lumnoOverlayRoot : null);
    if (!overlay || !styleRoot) {
      return createNoopRevealGate();
    }

    const styleIds = Array.isArray(settings.styleIds) && settings.styleIds.length > 0
      ? settings.styleIds
      : activeFix.styleIds;
    const maxWaitMs = Number.isFinite(Number(settings.maxWaitMs))
      ? Number(settings.maxWaitMs)
      : activeFix.maxWaitMs;
    let released = false;
    let stylesReady = false;
    let waitPromise = null;

    setOverlayDeferredVisibility(overlay, true, activeFix.id);

    function release() {
      if (released) {
        return;
      }
      released = true;
      setOverlayStyleFallback(overlay, !stylesReady, activeFix.id);
      setOverlayDeferredVisibility(overlay, false, activeFix.id);
    }

    function cancel() {
      released = true;
      setOverlayDeferredVisibility(overlay, false, activeFix.id);
      setOverlayStyleFallback(overlay, false, activeFix.id);
    }

    function waitUntilReady() {
      if (!waitPromise) {
        const links = collectStyleLinks(styleRoot, styleIds);
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
            setOverlayStyleFallback(overlay, false, activeFix.id);
          }).then((result) => ({
            ok: Boolean(result && result.ok),
            reason: result && result.reason ? result.reason : 'unknown',
            fixId: activeFix.id
          }));
        }
      }
      return waitPromise;
    }

    return Object.freeze({
      active: true,
      fixId: activeFix.id,
      waitUntilReady,
      release,
      cancel
    });
  }

  return Object.freeze({
    OVERLAY_STYLE_IDS,
    OVERLAY_STYLE_REVEAL_POLICY,
    SITE_FIXES,
    createOverlayRevealGate,
    getActiveFixes,
    hostMatchesRule
  });
});
