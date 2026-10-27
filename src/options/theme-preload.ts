// Paints the Options page in the cached theme and opens the linked tab
// before the page script runs, then follows the stored theme once read.
import * as AppearanceSettings from '../domain/settings/appearance';
import * as PageCacheSettings from '../domain/settings/page-cache';
import type { ThemeMode } from '../domain/settings/appearance';
import { getContextSettingsStore } from '../platform/settings-store';
import { normalizeSettingsTabKey, SETTINGS_TAB_KEYS } from './features/navigation/tabs';

(function() {
  const PRELOAD_THEME_ATTRIBUTE = 'data-options-preload-theme';
  const PRELOAD_THEME_MODE_ATTRIBUTE = 'data-options-theme-mode';
  const BACKGROUND_PRELOAD_ID = '_x_extension_options_background_preload_2026_unique_';
  const PANEL_ID = '_x_extension_settings_panel_2024_unique_';
  const root = document.documentElement;

  let resolvedTheme: 'dark' | 'light' = 'light';
  let currentThemeMode: ThemeMode = 'system';
  let bodyObserver: MutationObserver | null = null;
  let routeObserver: MutationObserver | null = null;

  function getInitialTabKey(): string {
    try {
      const rawHash = String(globalThis.location && globalThis.location.hash || '')
        .replace(/^#/, '')
        .trim();
      return normalizeSettingsTabKey(rawHash.split(':')[0] || '');
    } catch (e) {
      return 'general';
    }
  }

  function applyInitialTabState(): boolean {
    const tabKey = getInitialTabKey();
    const tabButtons = Array.from(document.querySelectorAll(
      '._x_extension_settings_tab_button_2024_unique_[data-tab]'
    ));
    const tabContents = Array.from(document.querySelectorAll(
      '._x_extension_settings_content_2024_unique_[data-content]'
    ));
    if (tabButtons.length < SETTINGS_TAB_KEYS.length || tabContents.length < SETTINGS_TAB_KEYS.length) {
      return false;
    }
    tabButtons.forEach((button) => {
      button.setAttribute('data-active', button.getAttribute('data-tab') === tabKey ? 'true' : 'false');
    });
    tabContents.forEach((content) => {
      content.setAttribute('data-active', content.getAttribute('data-content') === tabKey ? 'true' : 'false');
    });
    root.setAttribute('data-options-initial-tab', tabKey);
    if (routeObserver) {
      routeObserver.disconnect();
      routeObserver = null;
    }
    return true;
  }

  function getSystemTheme(): 'dark' | 'light' {
    try {
      return globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
    return mode === 'system' ? getSystemTheme() : mode;
  }

  function readCachedThemeMode(): ThemeMode {
    try {
      return AppearanceSettings.themeMode.parse(globalThis.localStorage.getItem(PageCacheSettings.optionsThemePreload.key));
    } catch (e) {
      return 'system';
    }
  }

  function cacheThemeMode(mode: ThemeMode): void {
    try {
      globalThis.localStorage.setItem(PageCacheSettings.optionsThemePreload.key, mode);
    } catch (e) {
      // Best effort only; chrome.storage remains the source of truth.
    }
  }

  function updateBackgroundPreload(theme: 'dark' | 'light'): void {
    if (!document.head) {
      return;
    }
    const href = chrome.runtime.getURL(
      theme === 'dark'
        ? 'assets/images/settings-bg-dark.webp'
        : 'assets/images/settings-bg-light.webp'
    );
    // The link this script added on an earlier pass.
    const existing = document.getElementById(BACKGROUND_PRELOAD_ID);
    if (!existing || !('href' in existing)) {
      const link = document.createElement('link');
      link.id = BACKGROUND_PRELOAD_ID;
      link.rel = 'preload';
      link.as = 'image';
      link.fetchPriority = 'high';
      link.href = href;
      document.head.appendChild(link);
      return;
    }
    existing.href = href;
  }

  function applyTheme(theme: 'dark' | 'light'): void {
    resolvedTheme = theme === 'dark' ? 'dark' : 'light';
    root.setAttribute(PRELOAD_THEME_ATTRIBUTE, resolvedTheme);
    root.setAttribute(PRELOAD_THEME_MODE_ATTRIBUTE, currentThemeMode);
    root.setAttribute('data-theme-ready', 'true');
    root.style.colorScheme = resolvedTheme;
    updateBackgroundPreload(resolvedTheme);

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', resolvedTheme === 'dark' ? '#111111' : '#f1f5f9');
    }
    if (document.body) {
      document.body.setAttribute('data-theme', resolvedTheme);
    }
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      panel.setAttribute('data-theme', resolvedTheme);
    }
    if (document.body && panel && bodyObserver) {
      bodyObserver.disconnect();
      bodyObserver = null;
    }
  }

  currentThemeMode = readCachedThemeMode();
  applyTheme(resolveTheme(currentThemeMode));
  const initialTabApplied = applyInitialTabState();

  if (!document.body || !document.getElementById(PANEL_ID)) {
    bodyObserver = new MutationObserver(() => applyTheme(resolvedTheme));
    bodyObserver.observe(root, { childList: true, subtree: true });
  }
  if (!initialTabApplied) {
    routeObserver = new MutationObserver(applyInitialTabState);
    routeObserver.observe(root, { childList: true, subtree: true });
  }

  // The cached or system theme already made the page paintable; the stored
  // one replaces it once read.
  if (globalThis.chrome && globalThis.chrome.storage) {
    const settingsStore = getContextSettingsStore(globalThis.chrome, window);
    void settingsStore.include(AppearanceSettings.themeMode).then(() => {
      const storedMode = settingsStore.get(AppearanceSettings.themeMode);
      currentThemeMode = storedMode;
      cacheThemeMode(storedMode);
      applyTheme(resolveTheme(storedMode));
    });
  }
})();
