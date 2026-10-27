// The popup document's own state: its theme, which follows the theme setting
// and, under the system setting, the system's preference; and whether it
// scrolls, which follows its height.
import * as AppearanceSettings from '../../domain/settings/appearance';
import * as PageCacheSettings from '../../domain/settings/page-cache';
import type { SettingsStore } from '../../platform/settings-store';

const OVERFLOW_TOLERANCE_PX = 2;

// Applies the theme setting now and whenever it or the system's preference
// changes. The next popup paints the same theme before extension storage
// answers, from a page cached copy.
function followTheme(settingsStore: SettingsStore, doc: Document, win: Window): void {
  const darkQuery = win.matchMedia('(prefers-color-scheme: dark)');
  function apply(): void {
    const mode = settingsStore.get(AppearanceSettings.themeMode);
    const resolved = mode === 'system' ? (darkQuery.matches ? 'dark' : 'light') : mode;
    doc.body.setAttribute('data-theme', resolved);
    doc.documentElement.style.colorScheme = resolved;
    void settingsStore.set(PageCacheSettings.optionsThemePreload, mode);
  }
  apply();
  settingsStore.subscribe(AppearanceSettings.themeMode, apply);
  darkQuery.addEventListener('change', () => {
    if (settingsStore.get(AppearanceSettings.themeMode) === 'system') apply();
  });
}

// The browser sizes the popup to the page, up to 600px tall. Fractional
// line heights can leave the page a pixel taller than that window, which
// should not draw a scrollbar; content past the limit still scrolls.
function syncOverflow(doc: Document, win: Window): void {
  const page = doc.documentElement;
  page.style.overflowY = page.scrollHeight - win.innerHeight > OVERFLOW_TOLERANCE_PX ? 'auto' : 'hidden';
}

// Measures whenever the window or the popup's content changes height. A
// folding panel changes height in one step, after its rows fade on closing;
// measure once either settles.
function followOverflow(host: HTMLElement, doc: Document, win: Window): void {
  win.addEventListener('resize', () => syncOverflow(doc, win));
  host.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'height' || event.propertyName === 'opacity') syncOverflow(doc, win);
  });
}

export { followOverflow, followTheme, syncOverflow };
