// The Options page's color mode: system, light or dark. This is its one
// owner: it shows the stored mode on the document (following the system
// while the mode says so), keeps the copy theme-preload.ts paints from on
// the next load, and animates the panel when a mode change shows or hides
// rows. The panel, the picker and the overlay section follow its store.
import { flushSync } from 'react-dom';
import { optionsThemePreload, themeMode } from '../../../domain/settings';
import type { ThemeMode } from '../../../domain/settings/appearance';
import type { SettingsStore } from '../../../platform/settings-store';
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';
import type { LayoutMutation } from '../../options-panel-motion';

interface PageThemeState {
  mode: ThemeMode;
  // What the mode shows as now; the settings panel draws in it.
  resolved: 'dark' | 'light';
}

interface PageThemeDocument {
  doc: Document;
  win: Window;
  // Animates the panel's height across a layout change.
  animatePanel(mutateLayout: LayoutMutation): boolean;
}

class PageTheme {
  readonly store: Store<PageThemeState>;
  private readonly settingsStore: Pick<SettingsStore, 'include' | 'get' | 'set' | 'subscribe'>;
  private readonly page: PageThemeDocument;
  private readonly darkQuery: MediaQueryList;

  constructor(settingsStore: Pick<SettingsStore, 'include' | 'get' | 'set' | 'subscribe'>, page: PageThemeDocument) {
    this.settingsStore = settingsStore;
    this.page = page;
    this.darkQuery = page.win.matchMedia('(prefers-color-scheme: dark)');
    // theme-preload.ts painted the cached theme before this ran.
    const preloaded = page.doc.documentElement.getAttribute('data-options-preload-theme');
    this.store = createStore<PageThemeState>({ mode: 'system', resolved: preloaded === 'dark' ? 'dark' : 'light' });
  }

  // theme-preload.ts has already painted the cached (or system) theme and
  // marked the page ready; this shows the stored mode once read, and every
  // change to it, here or on another page.
  start(): void {
    void this.settingsStore.include(themeMode).then(() => {
      this.show(this.settingsStore.get(themeMode));
      this.page.doc.documentElement.setAttribute('data-theme-ready', 'true');
    });
    this.settingsStore.subscribe(themeMode, () => this.show(this.settingsStore.get(themeMode)));
    this.darkQuery.addEventListener('change', () => {
      if (this.store.getSnapshot().mode === 'system') {
        this.applyResolved();
      }
    });
  }

  // The reader's choice; it shows once stored.
  choose(mode: unknown): void {
    void this.settingsStore.set(themeMode, themeMode.parse(mode)).catch(() => {});
  }

  private show(mode: ThemeMode): void {
    this.cacheMode(mode);
    // Rows that only apply under "system" come or go with the mode.
    this.page.animatePanel(() => {
      const followedSystem = this.store.getSnapshot().mode === 'system';
      this.page.doc.documentElement.setAttribute('data-options-theme-mode', mode);
      flushSync(() => this.store.setState({ mode }));
      return followedSystem !== (mode === 'system');
    });
    this.applyResolved();
  }

  private applyResolved(): void {
    const mode = this.store.getSnapshot().mode;
    const resolved = mode === 'system' ? (this.darkQuery.matches ? 'dark' : 'light') : mode;
    const { doc } = this.page;
    this.store.setState({ resolved });
    doc.body.setAttribute('data-theme', resolved);
    doc.documentElement.style.colorScheme = resolved;
    const themeColorMeta = doc.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', resolved === 'dark' ? '#111111' : '#f1f5f9');
    }
  }

  private cacheMode(mode: ThemeMode): void {
    try {
      this.page.win.localStorage.setItem(optionsThemePreload.key, mode);
    } catch (error) {
      // The early theme preloader falls back to the system theme when caching is unavailable.
    }
  }
}

export { PageTheme };
export type { PageThemeDocument, PageThemeState };
