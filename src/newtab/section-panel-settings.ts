// The appearance panel's bookmark and site-card sections, as a model the panel draws.
// The page owns the values and stores them under the same keys as the Options page and
// the sections' own menus, so the model reads through getters, its actions write through
// setters, and it is drawn again whenever one of those keys changes elsewhere.
import type { StorageChanges } from '../domain/storage-port';
import type { SelectMenuOption } from '../shared/react/select-menu/menu-options';
import type { BookmarkViewMode } from './bookmarks/bookmark-display-settings';
import type { Translate } from './newtab-types';
import type { SectionSettingsSlot } from './react/wallpaper-view';
import { createViewStore } from '../shared/react/view-store';
import type { PanelSelectModel, SectionSettingsActions, SectionSettingsModel } from './react/wallpaper-panel/panel-model';
import type { SliderChange } from './react/wallpaper-panel/panel-primitives';

// The bar backgrounds the panel offers; "custom" opens the color picker.
type PanelBookmarkTopbarSurfaceMode = 'adaptive' | 'transparent' | 'custom';
type PersistOptions = { persist: boolean };
type PersistedSetter<T> = (value: T, options: PersistOptions) => void;
type StorageChangeListener = (changes: StorageChanges) => void;

// Section counts are stored in multiples of four, one row each.
const ITEMS_PER_ROW = 4;
const BOOKMARK_ROWS_MIN = 1;
const BOOKMARK_ROWS_MAX = 8;
const BOOKMARK_COLUMNS_MIN = 4;
const BOOKMARK_COLUMNS_MAX = 8;
const SLIDER_SAVE_DELAY_MS = 140;
// Turning a section back on restores its last row count, or the stored defaults.
const BOOKMARK_COUNT_DEFAULT = 8;
const RECENT_COUNT_DEFAULT = 4;

// The page's section values, read through getters and changed through setters.
interface SectionPanelSettingsOptions {
  windowObj?: Window & typeof globalThis;
  chromeObj?: {
    storage?: {
      onChanged?: {
        addListener(listener: StorageChangeListener): void;
        removeListener(listener: StorageChangeListener): void;
      };
    };
  };
  t: Translate;
  // Storage keys whose changes elsewhere make the panel re-read the values.
  watchedKeys?: readonly string[];
  getBookmarkViewMode?(): string;
  setBookmarkViewMode?(mode: BookmarkViewMode): void;
  getBookmarkCount?(): number;
  setBookmarkCount?: PersistedSetter<number>;
  getBookmarkColumns?(): number;
  setBookmarkColumns?: PersistedSetter<number>;
  getBookmarkFolderIconsVisible?(): boolean;
  setBookmarkFolderIconsVisible?: PersistedSetter<boolean>;
  getBookmarkTopbarLayout?(): string;
  setBookmarkTopbarLayout?(layout: string): void;
  getBookmarkTopbarSurfaceMode?(): string;
  setBookmarkTopbarSurfaceMode?(mode: PanelBookmarkTopbarSurfaceMode): void;
  pickBookmarkTopbarSurfaceColor?(): void;
  getRecentMode?(): string;
  setRecentMode?(mode: string): void;
  getRecentCount?(): number;
  setRecentCount?: PersistedSetter<number>;
}


function isBookmarkViewMode(value: unknown): value is BookmarkViewMode {
  return value === 'folder' || value === 'list' || value === 'top';
}

function isBookmarkTopbarSurfaceMode(value: unknown): value is PanelBookmarkTopbarSurfaceMode {
  return value === 'adaptive' || value === 'transparent' || value === 'custom';
}

function createRuntime(options: SectionPanelSettingsOptions) {
  const config = options;
  const window = config.windowObj || globalThis.window;
  const t = config.t;
  const watchedKeys = new Set(config.watchedKeys || []);
  // The sections' model in the panel, set from the panel's first open on.
  const settingsState = createViewStore<SectionSettingsSlot>({ model: null });
  let bound = false;
  let bookmarkExpanded = false;
  let recentExpanded = false;
  let lastBookmarkCount = 0;
  let lastRecentCount = 0;
  let updateTimer = 0;
  let unsubscribe: (() => void) | null = null;
  // A slider being dragged keeps its thumb, whatever the page reads meanwhile,
  // until the value settles; a pause in the drag saves it.
  const drags = new Map<'rows' | 'columns', { value: number; timer: number }>();

  const getBookmarkCount = () => Number(config.getBookmarkCount?.()) || 0;
  const getRecentCount = () => Number(config.getRecentCount?.()) || 0;

  function rememberCounts(): void {
    const bookmarkCount = getBookmarkCount();
    const recentCount = getRecentCount();
    if (bookmarkCount > 0) lastBookmarkCount = bookmarkCount;
    if (recentCount > 0) lastRecentCount = recentCount;
  }

  function getViewModeSelect(viewMode: BookmarkViewMode): PanelSelectModel {
    return {
      ariaLabel: t('display_mode_title', 'Display mode'),
      options: [
        { value: 'folder', label: t('bookmark_view_mode_folder', 'Multi-layer folder view') },
        { value: 'list', label: t('bookmark_view_mode_list', 'Multi-level list view') },
        { value: 'top', label: t('bookmark_view_mode_top', 'Top bookmarks bar') }
      ],
      value: viewMode,
      onChange: (mode) => {
        if (isBookmarkViewMode(mode)) config.setBookmarkViewMode?.(mode);
        update();
      }
    };
  }

  // Same choices as the bar's own menu; "Custom color" opens the screen color picker and
  // only becomes the selection once a color is picked.
  function getSurfaceSelect(surfaceMode: PanelBookmarkTopbarSurfaceMode): PanelSelectModel {
    const surfaceOption = (
      value: PanelBookmarkTopbarSurfaceMode,
      labelKey: string,
      fallback: string,
      extra?: Partial<SelectMenuOption>
    ): SelectMenuOption => ({
      value,
      label: t(labelKey, fallback),
      radio: true,
      checked: surfaceMode === value,
      ...extra
    });
    return {
      ariaLabel: t('bookmark_topbar_surface_title', 'Bar background'),
      options: [
        surfaceOption('adaptive', 'bookmark_topbar_surface_follow', 'Match style'),
        surfaceOption('transparent', 'bookmark_topbar_surface_transparent', 'Transparent'),
        surfaceOption('custom', 'bookmark_topbar_surface_custom', 'Custom color', {
          trailingIconName: 'ri-dropper-line'
        })
      ],
      value: surfaceMode,
      onChange: (mode) => {
        if (!isBookmarkTopbarSurfaceMode(mode)) return false;
        if (mode === 'custom') {
          config.pickBookmarkTopbarSurfaceColor?.();
          return false;
        }
        config.setBookmarkTopbarSurfaceMode?.(mode);
        update();
        return undefined;
      }
    };
  }

  // A section switched on comes back with its last row count, or the default.
  function setSectionVisible(
    visible: boolean,
    expand: () => void,
    lastCount: () => number,
    fallbackCount: number,
    setCount: PersistedSetter<number> | undefined
  ): void {
    rememberCounts();
    if (visible) expand();
    setCount?.(visible ? lastCount() || fallbackCount : 0, { persist: true });
    update();
  }

  // The page previews each step; storage (and so sync) only sees where the thumb settles.
  function setCountFromSlider(
    key: 'rows' | 'columns',
    setter: PersistedSetter<number> | undefined,
    sliderValue: number,
    toCount: (value: number) => number,
    change: SliderChange
  ): void {
    const drag = drags.get(key);
    if (drag) window.clearTimeout(drag.timer);
    if (change.final) {
      drags.delete(key);
      setter?.(toCount(sliderValue), { persist: true });
    } else {
      setter?.(toCount(sliderValue), { persist: false });
      drags.set(key, {
        value: sliderValue,
        timer: window.setTimeout(() => {
          drags.delete(key);
          setter?.(toCount(sliderValue), { persist: true });
          update();
        }, SLIDER_SAVE_DELAY_MS)
      });
    }
    update();
  }

  const actions: SectionSettingsActions = {
    toggleBookmarkExpanded() {
      if (getBookmarkCount() <= 0) return;
      bookmarkExpanded = !bookmarkExpanded;
      update();
    },
    setBookmarkVisible(visible) {
      setSectionVisible(visible, () => { bookmarkExpanded = true; }, () => lastBookmarkCount,
        BOOKMARK_COUNT_DEFAULT, config.setBookmarkCount);
    },
    setBookmarkRows(rows, change) {
      setCountFromSlider('rows', config.setBookmarkCount, rows, (value) => value * ITEMS_PER_ROW, change);
    },
    setBookmarkColumns(columns, change) {
      setCountFromSlider('columns', config.setBookmarkColumns, columns, (value) => value, change);
    },
    setBookmarkFolderIconsVisible(visible) {
      config.setBookmarkFolderIconsVisible?.(visible, { persist: true });
      update();
    },
    setBookmarkTopbarLayout(layout) {
      config.setBookmarkTopbarLayout?.(layout);
      update();
    },
    toggleRecentExpanded() {
      if (getRecentCount() <= 0) return;
      recentExpanded = !recentExpanded;
      update();
    },
    setRecentVisible(visible) {
      setSectionVisible(visible, () => { recentExpanded = true; }, () => lastRecentCount,
        RECENT_COUNT_DEFAULT, config.setRecentCount);
    },
    setRecentMode(mode) {
      config.setRecentMode?.(mode);
      update();
    },
    setRecentRows(rows) {
      config.setRecentCount?.(Number(rows) * ITEMS_PER_ROW, { persist: true });
      update();
    }
  };

  function getModel(): SectionSettingsModel {
    rememberCounts();
    const bookmarkCount = getBookmarkCount();
    const storedViewMode = config.getBookmarkViewMode?.();
    const viewMode = isBookmarkViewMode(storedViewMode) ? storedViewMode : 'folder';
    const storedSurfaceMode = config.getBookmarkTopbarSurfaceMode?.();
    const surfaceMode = isBookmarkTopbarSurfaceMode(storedSurfaceMode) ? storedSurfaceMode : 'adaptive';
    const bookmarkRows = Math.round((bookmarkCount || lastBookmarkCount || BOOKMARK_COUNT_DEFAULT) / ITEMS_PER_ROW);
    const folderIconsLabel = t('settings_bookmark_folder_icons_visible_title', 'Show icons inside bookmark folders');
    const topbarLayoutLabel = t('bookmark_topbar_layout_title', 'Bar style');
    const recentCount = getRecentCount();
    const recentRows = Math.round((recentCount || lastRecentCount || RECENT_COUNT_DEFAULT) / ITEMS_PER_ROW);
    const displayModeLabel = t('display_mode_title', 'Display mode');
    const recentRowsLabel = t('newtab_recent_rows_title', 'Site card rows');
    return {
      bookmark: {
        title: t('bookmarks_heading', 'Bookmarks'),
        enabled: bookmarkCount > 0,
        expanded: bookmarkExpanded,
        viewModeLabel: displayModeLabel,
        viewModeSelect: getViewModeSelect(viewMode),
        topbarMode: viewMode === 'top',
        rows: {
          label: t('settings_bookmarks_title', 'Bookmark rows'),
          min: BOOKMARK_ROWS_MIN,
          max: BOOKMARK_ROWS_MAX,
          value: drags.get('rows')?.value ?? Math.min(BOOKMARK_ROWS_MAX, Math.max(BOOKMARK_ROWS_MIN, bookmarkRows))
        },
        columns: {
          label: t('settings_bookmark_columns_title', 'Bookmarks per row'),
          min: BOOKMARK_COLUMNS_MIN,
          max: BOOKMARK_COLUMNS_MAX,
          value: drags.get('columns')?.value ?? (Number(config.getBookmarkColumns?.()) || 6)
        },
        folderIconsTitle: folderIconsLabel,
        folderIcons: { checked: config.getBookmarkFolderIconsVisible?.() !== false, label: folderIconsLabel },
        topbarLayoutLabel,
        topbarLayout: {
          active: config.getBookmarkTopbarLayout?.() === 'floating' ? 'floating' : 'docked',
          label: topbarLayoutLabel,
          options: [
            { value: 'docked', label: t('bookmark_topbar_layout_docked', 'Docked to top') },
            { value: 'floating', label: t('bookmark_topbar_layout_floating', 'Floating') }
          ]
        },
        topbarSurfaceLabel: t('bookmark_topbar_surface_title', 'Bar background'),
        topbarSurfaceSelect: getSurfaceSelect(surfaceMode)
      },
      recent: {
        title: t('settings_recent_sites_title', 'Site cards'),
        enabled: recentCount > 0,
        expanded: recentExpanded,
        modeLabel: displayModeLabel,
        mode: {
          active: config.getRecentMode?.() === 'most' ? 'most' : 'latest',
          label: displayModeLabel,
          options: [
            { value: 'latest', label: t('recent_mode_latest', 'Recent') },
            { value: 'most', label: t('recent_mode_most', 'Most visited') }
          ]
        },
        rowsLabel: recentRowsLabel,
        rows: {
          active: recentRows === 2 ? '2' : '1',
          label: recentRowsLabel,
          options: [
            { value: '1', label: '1' },
            { value: '2', label: '2' }
          ]
        }
      },
      actions
    };
  }

  function update(): void {
    if (!bound) return;
    window.clearTimeout(updateTimer);
    updateTimer = 0;
    settingsState.setState({ model: getModel() });
  }

  // Storage listeners run in registration order; reading after them sees the page's new values.
  function scheduleUpdate(): void {
    if (!bound || updateTimer) return;
    updateTimer = window.setTimeout(update, 0);
  }

  function handleStorageChange(changes: StorageChanges | null | undefined): void {
    if (changes && Object.keys(changes).some((key) => watchedKeys.has(key))) scheduleUpdate();
  }

  // Sets the sections' model for the panel from now on.
  function bindSettings(): void {
    if (bound) return;
    bound = true;
    const onChanged = config.chromeObj && config.chromeObj.storage && config.chromeObj.storage.onChanged;
    if (onChanged) {
      onChanged.addListener(handleStorageChange);
      unsubscribe = () => onChanged.removeListener(handleStorageChange);
    }
    update();
  }

  return Object.freeze({
    bindSettings,
    settingsState,
    update,
    updateLanguage: update,
    handleStorageChange,
    destroy() {
      window.clearTimeout(updateTimer);
      drags.forEach((drag) => window.clearTimeout(drag.timer));
      drags.clear();
      if (unsubscribe) unsubscribe();
      bound = false;
    }
  });
}

type SectionPanelSettingsRuntime = ReturnType<typeof createRuntime>;

export { createRuntime };
export type { SectionPanelSettingsOptions, SectionPanelSettingsRuntime };
