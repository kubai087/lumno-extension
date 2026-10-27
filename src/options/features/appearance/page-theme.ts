// The Options page's color mode: system, light or dark. This is its one
// owner: it shows the stored mode on the document (following the system
// while the mode says so), keeps the copy theme-preload.ts paints from on
// the next load, and animates the panel when a mode change shows or hides
// rows. The picker and the overlay section follow its store.
import { flushSync } from 'react-dom';
import { optionsThemePreload, themeMode } from '../../../domain/settings';
import type { ThemeMode } from '../../../domain/settings/appearance';
import type { SettingsStore } from '../../../platform/settings-store';
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';
import type { LayoutMutation } from '../../options-panel-motion';

interface PageThemeState {
  mode: ThemeMode;
}

interface PageThemeDocument {
  doc: Document;
  win: Window;
  // The settings panel, which carries the resolved theme too.
  panel: HTMLElement;
  // Animates the panel's height across a layout change.
  animatePanel(mutateLayout: LayoutMutation): boolean;
}

class PageTheme {
  readonly store: Store<PageThemeState> = createStore<PageThemeState>({ mode: 'system' });
  private readonly settingsStore: Pick<SettingsStore, 'include' | 'get' | 'set' | 'subscribe'>;
  private readonly page: PageThemeDocument;
  private readonly darkQuery: MediaQueryList;

  constructor(settingsStore: Pick<SettingsStore, 'include' | 'get' | 'set' | 'subscribe'>, page: PageThemeDocument) {
    this.settingsStore = settingsStore;
    this.page = page;
    this.darkQuery = page.win.matchMedia('(prefers-color-scheme: dark)');
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
    const { doc, panel } = this.page;
    doc.body.setAttribute('data-theme', resolved);
    panel.setAttribute('data-theme', resolved);
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
