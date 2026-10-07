(function(root) {
  // Focusing the search input: shortcut-triggered focus, typing anywhere on the
  // page and auto-focus recovery.
  function createInputFocus(deps) {
    const {
      SHORTCUT_KEY_MATCHER,
      refreshTabsIfIdle,
      initialNewtabInputAutoFocusReadyTask,
      isImeCompositionEvent
    } = deps;

    // Page state still owned by newtab.js; read and written through accessors.
    const pageState = deps.pageState;

    let fallbackShortcutRaw = '';
    let fallbackShortcutSpec = null;
    let fallbackShortcutRefreshAt = 0;

    function isEditableElement(el) {
      if (!el) {
        return false;
      }
      const tagName = el.tagName ? el.tagName.toLowerCase() : '';
      if (tagName === 'input' || tagName === 'textarea') {
        return true;
      }
      return Boolean(el.isContentEditable);
    }

    function refreshFallbackShortcut(force) {
      const now = Date.now();
      if (!force && (now - fallbackShortcutRefreshAt) < 15000) {
        return;
      }
      fallbackShortcutRefreshAt = now;
      try {
        chrome.runtime.sendMessage({ action: 'getShowSearchShortcut' }, (response) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            return;
          }
          const nextShortcut = response && typeof response.shortcut === 'string'
            ? response.shortcut
            : '';
          if (nextShortcut === fallbackShortcutRaw) {
            return;
          }
          fallbackShortcutRaw = nextShortcut;
          fallbackShortcutSpec = SHORTCUT_KEY_MATCHER.parseShortcut(nextShortcut);
        });
      } catch (e) {
        // Ignore runtime bridge failures.
      }
    }

    function focusSearchInputPreservingScroll() {
      if (!pageState.inputParts || !pageState.inputParts.input) {
        return false;
      }
      try {
        pageState.inputParts.input.focus({ preventScroll: true });
      } catch (error) {
        pageState.inputParts.input.focus();
      }
      return document.activeElement === pageState.inputParts.input;
    }

    function tryFocusSearchInput(force) {
      if (!pageState.inputParts || !pageState.inputParts.input) {
        return false;
      }
      if (document.activeElement === pageState.inputParts.input) {
        return true;
      }
      if (!force) {
        const activeElement = document.activeElement;
        const hasMeaningfulActiveElement = Boolean(activeElement) &&
          activeElement !== document.body &&
          activeElement !== document.documentElement;
        if (hasMeaningfulActiveElement) {
          return false;
        }
      }
      return focusSearchInputPreservingScroll();
    }

    function activateNewtabShortcutFocus() {
      if (!tryFocusSearchInput(true)) {
        return false;
      }
      try {
        pageState.inputParts.input.select();
      } catch (e) {
        // Ignore selection failures.
      }
      return true;
    }

    if (chrome && chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function') {
      chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || message.action !== 'lumno:newtab-focus-input') {
          return;
        }
        if (document.visibilityState !== 'visible') {
          return;
        }
        const focused = activateNewtabShortcutFocus();
        sendResponse({ ok: focused });
        return;
      });
    }

    function scheduleAutoFocusRecovery() {
      const hasExplicitFocusHint = window.location.search.includes('focus=1') ||
        window.location.hash.includes('focus');
      let forceInitialFocusPending = hasExplicitFocusHint;

      const clearExplicitFocusQuery = () => {
        try {
          const url = new URL(window.location.href);
          const hasFocusQuery = url.searchParams.get('focus') === '1';
          const hasFocusHash = url.hash === '#focus';
          if (!hasFocusQuery && !hasFocusHash) {
            return;
          }
          url.searchParams.delete('focus');
          if (hasFocusHash) {
            url.hash = '';
          }
          window.history.replaceState(window.history.state, '', url.toString());
        } catch (_error) {
          // Keep focus recovery independent from address cleanup failures.
        }
      };

      const retryDelays = [0, 60, 140, 280, 520, 900, 1400];
      const attemptFocusIfVisible = () => {
        if (!pageState.newtabInputAutoFocusEnabled) {
          return;
        }
        if (document.visibilityState !== 'visible') {
          return;
        }
        if (!document.hasFocus()) {
          return;
        }
        const focused = tryFocusSearchInput(forceInitialFocusPending);
        if (focused) {
          const consumedExplicitFocusHint = forceInitialFocusPending;
          forceInitialFocusPending = false;
          if (consumedExplicitFocusHint) {
            clearExplicitFocusQuery();
          }
        }
      };

      retryDelays.forEach((delay) => {
        setTimeout(attemptFocusIfVisible, delay);
      });

      if (document.body &&
          document.body.getAttribute('data-nt-ready') !== '1' &&
          typeof window.MutationObserver === 'function') {
        const readyObserver = new window.MutationObserver(() => {
          if (document.body.getAttribute('data-nt-ready') !== '1') {
            return;
          }
          readyObserver.disconnect();
          setTimeout(attemptFocusIfVisible, 0);
        });
        readyObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ['data-nt-ready']
        });
      }

      window.addEventListener('focus', () => {
        setTimeout(attemptFocusIfVisible, 0);
        setTimeout(refreshTabsIfIdle, 0);
      }, true);
      window.addEventListener('pageshow', () => {
        attemptFocusIfVisible();
        refreshTabsIfIdle();
      }, true);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          setTimeout(attemptFocusIfVisible, 0);
          setTimeout(refreshTabsIfIdle, 0);
        }
      }, true);
    }

    initialNewtabInputAutoFocusReadyTask.then(() => {
      scheduleAutoFocusRecovery();
    });

    refreshFallbackShortcut(true);

    function handleGlobalTypingFocus(event) {
      if (pageState.folderColorPicker && pageState.folderColorPicker.isOpen()) return;
      if (!event || event.defaultPrevented) {
        return;
      }
      refreshFallbackShortcut(false);
      if (fallbackShortcutSpec &&
          SHORTCUT_KEY_MATCHER.eventMatchesShortcut(event, fallbackShortcutSpec)) {
        event.preventDefault();
        event.stopPropagation();
        activateNewtabShortcutFocus();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (pageState.inputModeController &&
          typeof pageState.inputModeController.shouldHandleModeMenuKeyEvent === 'function' &&
          pageState.inputModeController.shouldHandleModeMenuKeyEvent(event)) {
        return;
      }
      const activeElement = document.activeElement;
      if (pageState.searchScopeIcon && activeElement === pageState.searchScopeIcon) {
        return;
      }
      if (activeElement === pageState.inputParts.input || isEditableElement(activeElement)) {
        return;
      }
      if (isImeCompositionEvent(event)) {
        focusSearchInputPreservingScroll();
        return;
      }
      const key = event.key || '';
      if (!key || key === 'Tab' || key === 'Escape' || key.startsWith('Arrow')) {
        return;
      }
      focusSearchInputPreservingScroll();
      const currentValue = pageState.inputParts.input.value || '';
      if (key === 'Backspace') {
        if (currentValue) {
          pageState.inputParts.input.value = currentValue.slice(0, -1);
          pageState.inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        event.preventDefault();
        return;
      }
      if (key.length === 1) {
        pageState.inputParts.input.value = currentValue + key;
        pageState.inputParts.input.setSelectionRange(pageState.inputParts.input.value.length, pageState.inputParts.input.value.length);
        pageState.inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
        event.preventDefault();
      }
    }

    return {
      isEditableElement,
      refreshFallbackShortcut,
      focusSearchInputPreservingScroll,
      handleGlobalTypingFocus
    };
  }

  root.LumnoNewtabInputFocus = { createInputFocus };
})(globalThis);
