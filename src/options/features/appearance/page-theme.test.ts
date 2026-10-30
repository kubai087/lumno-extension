import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOptionsTestSettings } from '../../../../tests/fakes/options-settings';
import { optionsThemePreload, themeMode } from '../../../domain/settings';
import { PageTheme } from './page-theme';

// The OS color scheme, which a test can change while the page is open.
function stubSystemScheme(dark: boolean) {
  const listeners = new Set<() => void>();
  const media = {
    matches: dark,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener)
  };
  vi.stubGlobal('matchMedia', () => media);
  return (nextDark: boolean) => {
    media.matches = nextDark;
    listeners.forEach((listener) => listener());
  };
}

function setUp(stored: Record<string, unknown> = {}, options: { systemDark?: boolean } = {}) {
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  document.head.appendChild(meta);
  const systemChanges = stubSystemScheme(Boolean(options.systemDark));
  const settings = createOptionsTestSettings({ sync: stored });
  const shown: string[] = [];
  const theme: PageTheme = new PageTheme(settings.store, {
    doc: document,
    win: window,
    // Records each mode the panel is redrawn for.
    animatePanel(mutate) {
      mutate();
      shown.push(theme.store.getSnapshot().mode);
      return false;
    }
  });
  theme.start();
  return {
    meta,
    settings,
    shown,
    systemChanges,
    theme,
    cached: () => window.localStorage.getItem(optionsThemePreload.key),
    pageTheme: () => document.body.getAttribute('data-theme')
  };
}

afterEach(() => {
  document.head.replaceChildren();
  ['data-theme-ready', 'data-options-theme-mode', 'style'].forEach((name) => document.documentElement.removeAttribute(name));
  document.body.removeAttribute('data-theme');
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('Options page theme', () => {
  it('shows the stored mode once read and refreshes the preloader\'s copy', async () => {
    const page = setUp({ [themeMode.key]: 'dark' });
    await page.settings.settle();
    expect(page.pageTheme()).toBe('dark');
    // The panel draws in the resolved theme.
    expect(page.theme.store.getSnapshot()).toEqual({ mode: 'dark', resolved: 'dark' });
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(page.meta.content).toBe('#111111');
    expect(document.documentElement.getAttribute('data-theme-ready')).toBe('true');
    expect(document.documentElement.getAttribute('data-options-theme-mode')).toBe('dark');
    expect(page.cached()).toBe('dark');
    expect(page.shown).toEqual(['dark']);
    page.systemChanges(true);
    expect(page.pageTheme()).toBe('dark');
  });

  it('follows the OS under "system", including changes while the page is open', async () => {
    const page = setUp({}, { systemDark: true });
    await page.settings.settle();
    expect(page.theme.store.getSnapshot().mode).toBe('system');
    expect(page.pageTheme()).toBe('dark');
    page.systemChanges(false);
    expect(page.pageTheme()).toBe('light');
  });

  it('saves a chosen mode and shows it', async () => {
    const page = setUp();
    await page.settings.settle();
    page.theme.choose('light');
    await page.settings.settle();
    expect(page.settings.writes).toEqual([{ [themeMode.key]: 'light' }]);
    expect(page.cached()).toBe('light');
    expect(page.pageTheme()).toBe('light');
  });

  it('shows a mode chosen on another page, and "system" from there follows the OS', async () => {
    const page = setUp({ [themeMode.key]: 'light' }, { systemDark: true });
    await page.settings.settle();
    expect(page.pageTheme()).toBe('light');
    await page.settings.change(themeMode, 'dark');
    expect(page.pageTheme()).toBe('dark');
    await page.settings.change(themeMode, undefined);
    expect(page.theme.store.getSnapshot().mode).toBe('system');
    page.systemChanges(false);
    expect(page.pageTheme()).toBe('light');
  });
});
