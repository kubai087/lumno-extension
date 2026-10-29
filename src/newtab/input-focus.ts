// Focusing the search input: shortcut-triggered focus, typing anywhere on the
// page and auto-focus recovery.
import type { ShortcutSpec } from '../domain/shortcut-key-matcher';
import * as LumnoMessaging from '../platform/messaging';
import { newtabInputAutoFocusEnabled } from '../domain/settings/newtab-page';
import type { SettingsStore } from '../platform/settings-store';
import type { FocusResume } from './focus-resume';
import * as SHORTCUT_KEY_MATCHER from '../domain/shortcut-key-matcher';
import type { SearchBoxParts } from './search/search-box-parts';


interface InputFocusDeps {
  settings: Pick<SettingsStore, 'get'>;
  // Saves the search on screen before the focus reload.
  focusResume: Pick<FocusResume, 'prepareFocusReload'>;
  refreshTabsIfIdle(): void;
  // Settles once the auto-focus setting is read.
  initialNewtabInputAutoFocusReadyTask: PromiseLike<unknown>;
  isImeCompositionEvent(event: KeyboardEvent): boolean;
  searchBox: Pick<SearchBoxParts, 'focusInput' | 'inputParts' | 'modeController'>;
  isFolderColorPickerOpen(): boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function createInputFocus(deps: InputFocusDeps) {
  const {
    searchBox,
    settings,
    focusResume,
    refreshTabsIfIdle,
    initialNewtabInputAutoFocusReadyTask,
    isImeCompositionEvent,
    isFolderColorPickerOpen
  } = deps;


  let fallbackShortcutRaw = '';
  let fallbackShortcutSpec: ShortcutSpec | null = null;
  let fallbackShortcutRefreshAt = 0;

  function isEditableElement(el: EventTarget | null | undefined): boolean {
    if (!el) {
      return false;
    }
    const tagName = 'tagName' in el && typeof el.tagName === 'string' ? el.tagName.toLowerCase() : '';
    if (tagName === 'input' || tagName === 'textarea') {
      return true;
    }
    return 'isContentEditable' in el && Boolean(el.isContentEditable);
  }

  function refreshFallbackShortcut(force: boolean): void {
    const now = Date.now();
    if (!force && (now - fallbackShortcutRefreshAt) < 15000) {
      return;
    }
    fallbackShortcutRefreshAt = now;
    try {
      LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'getShowSearchShortcut' }, (response) => {
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
    } catch {
      // Ignore runtime bridge failures.
    }
  }

  function tryFocusSearchInput(force: boolean): boolean {
    if (!searchBox.inputParts || !searchBox.inputParts.input) {
      return false;
    }
    if (document.activeElement === searchBox.inputParts.input) {
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
    return searchBox.focusInput();
  }

  function activateNewtabShortcutFocus(): boolean {
    const input = searchBox.inputParts && searchBox.inputParts.input;
    if (!input || !tryFocusSearchInput(true)) {
      return false;
    }
    try {
      input.select();
    } catch {
      // Ignore selection failures.
    }
    return true;
  }

  // A New Tab opens with keyboard focus in the address bar, and focus()
  // inside the page cannot take it from there. Reopen the page on the focus
  // route, which hands focus to the page the way input auto-focus does.
  function reopenOnFocusRoute(): void {
    // The reloaded page brings back the query and its results.
    focusResume.prepareFocusReload();
    if (window.location.protocol === 'moz-extension:') {
      try {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'swapNewtabForFocus' }, () => {
          void chrome.runtime.lastError;
        });
      } catch {
        // Leave the page as it is when the background is unavailable.
      }
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('focus', '1');
    window.location.replace(url.href);
  }

  function isShortcutCommandSource(source: unknown): boolean {
    return source === 'commands' || source === 'commands-prefill';
  }

  function handleFocusInputMessage(
    message: Record<string, unknown>,
    sendResponse: (reply: { ok: boolean; reopened?: boolean }) => void
  ): boolean {
    if (document.hasFocus() || !isShortcutCommandSource(message.source)) {
      sendResponse({ ok: activateNewtabShortcutFocus() });
      return false;
    }
    // runtime messages reach every extension page, so only the addressed
    // tab may reopen itself.
    try {
      chrome.tabs.getCurrent((tab) => {
        if (chrome.runtime.lastError || !tab || tab.id !== message.tabId) {
          return;
        }
        sendResponse({ ok: true, reopened: true });
        reopenOnFocusRoute();
      });
    } catch {
      return false;
    }
    return true;
  }

  if (chrome && chrome.runtime && chrome.runtime.onMessage && typeof chrome.runtime.onMessage.addListener === 'function') {
    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (!isRecord(message) || message.action !== 'lumno:newtab-focus-input') {
        return undefined;
      }
      if (document.visibilityState !== 'visible') {
        return undefined;
      }
      return handleFocusInputMessage(message, sendResponse);
    });
  }

  function scheduleAutoFocusRecovery(): void {
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
      } catch {
        // Keep focus recovery independent from address cleanup failures.
      }
    };

    const retryDelays = [0, 60, 140, 280, 520, 900, 1400];
    const attemptFocusIfVisible = () => {
      // The search shortcut reopens the page with the focus hint even when
      // auto-focus is off; that load still focuses the input once.
      if (!settings.get(newtabInputAutoFocusEnabled) && !forceInitialFocusPending) {
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

  void Promise.resolve(initialNewtabInputAutoFocusReadyTask).then(() => {
    scheduleAutoFocusRecovery();
  });

  refreshFallbackShortcut(true);

  function handleGlobalTypingFocus(event: KeyboardEvent): void {
    if (isFolderColorPickerOpen()) return;
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
    if (searchBox.modeController &&
        typeof searchBox.modeController.shouldHandleModeMenuKeyEvent === 'function' &&
        searchBox.modeController.shouldHandleModeMenuKeyEvent(event)) {
      return;
    }
    const activeElement = document.activeElement;
    if (searchBox.inputParts && activeElement === searchBox.inputParts.icon) {
      return;
    }
    const input = searchBox.inputParts && searchBox.inputParts.input;
    if (!input || activeElement === input || isEditableElement(activeElement)) {
      return;
    }
    if (isImeCompositionEvent(event)) {
      searchBox.focusInput();
      return;
    }
    const key = event.key || '';
    if (!key || key === 'Tab' || key === 'Escape' || key.startsWith('Arrow')) {
      return;
    }
    searchBox.focusInput();
    const currentValue = input.value || '';
    if (key === 'Backspace') {
      if (currentValue) {
        input.value = currentValue.slice(0, -1);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      event.preventDefault();
      return;
    }
    if (key.length === 1) {
      input.value = currentValue + key;
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      event.preventDefault();
    }
  }

  return {
    isEditableElement,
    refreshFallbackShortcut,
    handleGlobalTypingFocus
  };
}

type InputFocus = ReturnType<typeof createInputFocus>;

export { createInputFocus };
export type { InputFocus, InputFocusDeps };
