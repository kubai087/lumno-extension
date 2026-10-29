// The bookmark bar's layout and background (its mode and a color for each
// theme): drawn from the settings store, followed, repaired and changed
// from the bar's menu.
import type { SettingsStore } from '../../platform/settings-store';
import type { ShowToast, Translate } from '../newtab-types';
import type * as BookmarksTopbar from '../react/bookmarks-topbar';
import * as BookmarkSettings from '../../domain/settings/bookmarks';
import * as NEWTAB_BOOKMARKS_TOPBAR from '../react/bookmarks-topbar';
import { BOOKMARK_TOPBAR_LAYOUT_ACTION, BOOKMARK_TOPBAR_PICK_COLOR_ACTION, BOOKMARK_TOPBAR_SURFACE_MODE_ACTION } from '../menu-values';
import type { AppliedThemeMode } from '../theme/applied-theme-mode';
import type { BookmarkSectionParts } from './bookmark-section-parts';
import { adaptiveToneEvents } from '../wallpaper/tone-requests';

type BookmarkViewMode = 'folder' | 'list' | 'top';
type BookmarkTopbarLayout = ReturnType<typeof BookmarksTopbar.normalizeLayout>;
type BookmarkTopbarSurfaceMode = ReturnType<typeof BookmarksTopbar.normalizeSurfaceMode>;
type ResolvedTheme = 'light' | 'dark';


interface BookmarkDisplaySettingsDeps {
  // The bar's material and layout stay on this device.
  settings: Pick<SettingsStore, 'get' | 'getStored' | 'include' | 'remove' | 'set' | 'subscribe'>;
  updateBookmarkModeMenu(): void;
  setNewtabTopLayout(layout: BookmarkTopbarLayout): void;
  showToast: ShowToast;
  t: Translate;
  bookmarkParts: Pick<BookmarkSectionParts, 'topbar'>;
  appliedTheme: Pick<AppliedThemeMode, 'firstApplied'>;
}

interface SurfaceAppearanceOptions {
  updateMenu?: boolean;
  scheduleTone?: boolean;
}

function createBookmarkDisplaySettings(deps: BookmarkDisplaySettingsDeps) {
  const {
    bookmarkParts,
    settings,
    updateBookmarkModeMenu,
    setNewtabTopLayout,
    showToast,
    t,
    appliedTheme
  } = deps;


  const BOOKMARK_TOPBAR_RESET_COLOR_ACTION = 'reset-bookmark-topbar-color';
  // A custom background is kept for each theme.
  const SURFACE_COLOR_SETTINGS = {
    light: BookmarkSettings.bookmarkTopbarSurfaceColorLight,
    dark: BookmarkSettings.bookmarkTopbarSurfaceColorDark
  };
  const BAR_SETTINGS = [
    BookmarkSettings.bookmarkTopbarLayout,
    BookmarkSettings.bookmarkTopbarSurfaceMode,
    BookmarkSettings.bookmarkTopbarSurfaceColorLight,
    BookmarkSettings.bookmarkTopbarSurfaceColorDark,
    BookmarkSettings.bookmarkTopbarSurfaceColorLegacy
  ];

  function getBookmarkTopbarLayout(): BookmarkTopbarLayout {
    return NEWTAB_BOOKMARKS_TOPBAR.normalizeLayout(settings.get(BookmarkSettings.bookmarkTopbarLayout));
  }

  function showBookmarkTopbarLayout(updateMenu: boolean): void {
    const layout = getBookmarkTopbarLayout();
    if (bookmarkParts.topbar) {
      bookmarkParts.topbar.setLayout(layout);
    }
    setNewtabTopLayout(layout);
    if (updateMenu) {
      updateBookmarkModeMenu();
    }
  }

  function normalizeBookmarkTopbarSurfaceColor(value: unknown): string {
    return NEWTAB_BOOKMARKS_TOPBAR.normalizeSurfaceColor(value);
  }

  function isBookmarkTopbarSurfaceMode(value: unknown): value is BookmarkTopbarSurfaceMode {
    return value === 'adaptive' ||
      value === 'clear' ||
      value === 'transparent' ||
      value === 'custom';
  }

  function getCurrentBookmarkTopbarResolvedTheme(): ResolvedTheme {
    return document.body && document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function getSurfaceColor(theme: ResolvedTheme = getCurrentBookmarkTopbarResolvedTheme()): string {
    return normalizeBookmarkTopbarSurfaceColor(settings.get(SURFACE_COLOR_SETTINGS[theme]));
  }

  // The stored background choice; with none stored, a stored color means
  // a custom one.
  function getBookmarkTopbarSurfaceMode(): BookmarkTopbarSurfaceMode {
    const stored = settings.get(BookmarkSettings.bookmarkTopbarSurfaceMode);
    if (isBookmarkTopbarSurfaceMode(stored)) {
      return stored;
    }
    return getSurfaceColor() ? 'custom' : 'adaptive';
  }

  // The background picked in the menus: match the page's glass style, transparent or a custom
  // color. 'clear' (liquid glass) was a choice of its own before the style setting took it over.
  function getEffectiveBookmarkTopbarSurfaceMode(): BookmarkTopbarSurfaceMode {
    const mode = getBookmarkTopbarSurfaceMode();
    if (mode === 'clear') {
      return 'adaptive';
    }
    return mode === 'custom' && !getSurfaceColor() ? 'adaptive' : mode;
  }

  // The surface the bar draws: matching the style means adaptive mist, frosted or liquid glass.
  function getAppliedBookmarkTopbarSurfaceMode(): BookmarkTopbarSurfaceMode | 'frosted' {
    const selected = getEffectiveBookmarkTopbarSurfaceMode();
    if (selected !== 'adaptive') {
      return selected;
    }
    const glassStyle = document.body ? document.body.getAttribute('data-glass-style') : '';
    if (glassStyle === 'liquid') {
      return 'clear';
    }
    return glassStyle === 'frosted' ? 'frosted' : 'adaptive';
  }

  function syncBookmarkTopbarSurfaceAppearance(options?: SurfaceAppearanceOptions): BookmarkTopbarSurfaceMode | 'frosted' {
    const config = options || {};
    const effectiveMode = getAppliedBookmarkTopbarSurfaceMode();
    if (bookmarkParts.topbar) {
      bookmarkParts.topbar.setLayout(getBookmarkTopbarLayout());
      bookmarkParts.topbar.setSurfaceMode(effectiveMode);
      bookmarkParts.topbar.setSurfaceColor(effectiveMode === 'custom' ? getSurfaceColor() : '');
    }
    if (config.updateMenu !== false) {
      updateBookmarkModeMenu();
    }
    if (config.scheduleTone !== false) {
      adaptiveToneEvents.emit('stale', {});
    }
    return effectiveMode;
  }

  function saveSurfaceMode(mode: unknown): void {
    void settings.set(BookmarkSettings.bookmarkTopbarSurfaceMode, NEWTAB_BOOKMARKS_TOPBAR.normalizeSurfaceMode(mode, 'adaptive'))
      .catch(() => {});
  }

  function saveSurfaceColor(color: string): void {
    void settings.set(SURFACE_COLOR_SETTINGS[getCurrentBookmarkTopbarResolvedTheme()], color).catch(() => {});
  }

  // A color saved for both themes moves to the theme on screen, unless
  // that theme has its own.
  function migrateLegacySurfaceColor(): void {
    const legacy = settings.getStored(BookmarkSettings.bookmarkTopbarSurfaceColorLegacy);
    if (typeof legacy === 'undefined') {
      return;
    }
    const color = normalizeBookmarkTopbarSurfaceColor(legacy);
    const target = SURFACE_COLOR_SETTINGS[getCurrentBookmarkTopbarResolvedTheme()];
    const moved = color && typeof settings.getStored(target) === 'undefined'
      ? settings.set(target, color)
      : Promise.resolve();
    void moved.then(() => settings.remove(BookmarkSettings.bookmarkTopbarSurfaceColorLegacy)).catch(() => {});
  }

  // Invalid stored colors are written back normalized, and a missing
  // background choice is saved as the one the page shows.
  function repairStoredSurface(): void {
    (['light', 'dark'] as const).forEach((theme) => {
      const stored = settings.getStored(SURFACE_COLOR_SETTINGS[theme]);
      const color = getSurfaceColor(theme);
      if (stored && stored !== color) {
        void settings.set(SURFACE_COLOR_SETTINGS[theme], color).catch(() => {});
      }
    });
    if (!isBookmarkTopbarSurfaceMode(settings.getStored(BookmarkSettings.bookmarkTopbarSurfaceMode))) {
      saveSurfaceMode(getBookmarkTopbarSurfaceMode());
    }
  }

  // Draws the stored bar and follows changes to it until the page closes.
  // Settles once the layout is drawn: the page reveals after it, so the
  // bar never changes shape after it first appears. The colors wait for
  // the theme, since each theme has its own.
  function followBookmarkTopbar(): Promise<void> {
    settings.subscribe(BookmarkSettings.bookmarkTopbarLayout, () => showBookmarkTopbarLayout(true));
    settings.subscribe([
      BookmarkSettings.bookmarkTopbarSurfaceMode,
      BookmarkSettings.bookmarkTopbarSurfaceColorLight,
      BookmarkSettings.bookmarkTopbarSurfaceColorDark
    ], () => syncBookmarkTopbarSurfaceAppearance());
    settings.subscribe(BookmarkSettings.bookmarkTopbarSurfaceColorLegacy, () => {
      void appliedTheme.firstApplied.then(migrateLegacySurfaceColor);
    });
    const read = settings.include(BAR_SETTINGS);
    void read.then(() => appliedTheme.firstApplied).then(() => {
      migrateLegacySurfaceColor();
      repairStoredSurface();
      syncBookmarkTopbarSurfaceAppearance();
    });
    return read.then(() => showBookmarkTopbarLayout(false));
  }

  function pickBookmarkTopbarSurfaceColor(): Promise<boolean> {
    const EyeDropperApi = window.EyeDropper;
    if (typeof EyeDropperApi !== 'function') {
      showToast(t(
        'bookmark_topbar_color_unsupported',
        'Screen color picking is not supported in this browser.'
      ), true);
      return Promise.resolve(false);
    }
    const openPicker = () => {
      try {
        return new EyeDropperApi().open();
      } catch {
        return null;
      }
    };
    const request = openPicker();
    if (!request) {
      showToast(t('bookmark_topbar_color_failed', 'Could not pick a color. Try again.'), true);
      return Promise.resolve(false);
    }
    return request.then((result) => {
      const color = normalizeBookmarkTopbarSurfaceColor(result && result.sRGBHex);
      if (!color) {
        showToast(t('bookmark_topbar_color_failed', 'Could not pick a color. Try again.'), true);
        return false;
      }
      saveSurfaceColor(color);
      saveSurfaceMode('custom');
      showToast(t('bookmark_topbar_color_picked', 'Color picked'));
      return true;
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') {
        return false;
      }
      showToast(t('bookmark_topbar_color_failed', 'Could not pick a color. Try again.'), true);
      return false;
    });
  }

  function resetBookmarkTopbarSurfaceColor(): void {
    saveSurfaceColor('');
    saveSurfaceMode('adaptive');
    showToast(t('bookmark_topbar_color_reset_done', 'Automatic colors restored'));
  }

  function handleBookmarkModeMenuAction(action: string): void {
    if (action === BOOKMARK_TOPBAR_PICK_COLOR_ACTION) {
      pickBookmarkTopbarSurfaceColor();
      return;
    }
    if (action === BOOKMARK_TOPBAR_RESET_COLOR_ACTION) {
      resetBookmarkTopbarSurfaceColor();
      return;
    }
    const layoutPrefix = `${BOOKMARK_TOPBAR_LAYOUT_ACTION}:`;
    if (String(action || '').startsWith(layoutPrefix)) {
      void settings.set(
        BookmarkSettings.bookmarkTopbarLayout,
        NEWTAB_BOOKMARKS_TOPBAR.normalizeLayout(String(action).slice(layoutPrefix.length))
      ).catch(() => {});
      return;
    }
    const surfaceModePrefix = `${BOOKMARK_TOPBAR_SURFACE_MODE_ACTION}:`;
    if (String(action || '').startsWith(surfaceModePrefix)) {
      const nextMode = String(action).slice(surfaceModePrefix.length);
      if (nextMode === 'adaptive' ||
          nextMode === 'clear' ||
          nextMode === 'transparent') {
        saveSurfaceMode(nextMode);
      }
    }
  }

  return {
    followBookmarkTopbar,
    // Keys whose changes alter the bar's shape or background.
    bookmarkTopbarStorageKeys: [
      BookmarkSettings.bookmarkTopbarLayout.key,
      BookmarkSettings.bookmarkTopbarSurfaceMode.key,
      BookmarkSettings.bookmarkTopbarSurfaceColorLight.key,
      BookmarkSettings.bookmarkTopbarSurfaceColorDark.key
    ],
    getEffectiveBookmarkTopbarSurfaceMode,
    getBookmarkTopbarLayout,
    syncBookmarkTopbarSurfaceAppearance,
    handleBookmarkModeMenuAction
  };
}

type BookmarkDisplaySettings = ReturnType<typeof createBookmarkDisplaySettings>;

export { createBookmarkDisplaySettings };
export type {
  BookmarkDisplaySettings,
  BookmarkDisplaySettingsDeps,
  BookmarkTopbarLayout,
  BookmarkViewMode
};
