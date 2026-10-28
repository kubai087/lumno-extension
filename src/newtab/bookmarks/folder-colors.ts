// Folder accent colors: the per-folder color references kept in storage,
// applying them to bookmark and shortcut folders, migrating the legacy
// per-device map, and opening the color picker.
import { bookmarkFolderColorPresets, bookmarkFolderColorRefs, bookmarkFolderColorsLegacy } from '../../domain/settings/bookmarks';
import type { SettingsStore } from '../../platform/settings-store';
import type { createFolderColorPicker } from '../react/folder-color-picker';
import type { createFolderColorPickerApi } from '../react/folder-color-picker-lazy';
import type { BindTooltip, ShowToast, Translate } from '../newtab-types';
import type * as FolderIcon from './bookmark-folder-icon';
import type { FolderColorMap, FolderColorRefs } from './bookmark-folder-icon';
import type { BookmarksRuntime } from './bookmarks-runtime';

type FolderColorPicker = ReturnType<typeof createFolderColorPicker>;

interface FolderColorsState {
  // Made the first time a folder's color is changed.
  folderColorPicker: FolderColorPicker | null;
}

interface FolderColorsDeps {
  folderColorApi: ReturnType<typeof createFolderColorPickerApi> | undefined;
  NEWTAB_BOOKMARK_FOLDER_ICON: typeof FolderIcon;
  settings: Pick<SettingsStore, 'get' | 'include' | 'remove' | 'set' | 'subscribe'>;
  bookmarksRuntime: BookmarksRuntime;
  closeBookmarkCascadeMenu(): void;
  closeShortcutDialog(): void;
  hideCursorTooltip(): void;
  t: Translate;
  playFolderPathMorph: typeof FolderIcon.playFolderPathMorph;
  bindShortcutDialogTooltip: BindTooltip;
  hideShortcutDialogTooltip(): void;
  showToast: ShowToast;
  pageState: FolderColorsState;
}

function createFolderColors(deps: FolderColorsDeps) {
  const {
    folderColorApi,
    NEWTAB_BOOKMARK_FOLDER_ICON,
    settings,
    bookmarksRuntime,
    closeBookmarkCascadeMenu,
    closeShortcutDialog,
    hideCursorTooltip,
    t,
    playFolderPathMorph,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    showToast
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  let folderColors: FolderColorMap = {};
  // Synced colors keyed by folder path.
  let folderColorRefs: FolderColorRefs = {};
  // Colors another device saved arrive here; see applyFolderColorRefs for
  // why they are not written back.
  settings.subscribe(bookmarkFolderColorRefs, () => {
    folderColorRefs = NEWTAB_BOOKMARK_FOLDER_ICON.normalizeFolderColorRefs(settings.get(bookmarkFolderColorRefs));
    void syncFolderColorsWithBookmarks(false).catch(() => {});
  });

  let folderColorPreview: { folderId: string; color: string } | null = null;
  pageState.folderColorPicker = null;

  function getFolderColor(folderId: unknown): string {
    return folderColorPreview && folderColorPreview.folderId === String(folderId)
      ? folderColorPreview.color
      : folderColors[String(folderId)] || NEWTAB_BOOKMARK_FOLDER_ICON.DEFAULT_FOLDER_COLOR;
  }

  function applySavedFolderColor(icon: Element | null): void {
    if (!icon) return;
    const svg = icon.querySelector('svg[data-folder-color-id]');
    const folderId = svg && svg.getAttribute('data-folder-color-id');
    if (folderId) NEWTAB_BOOKMARK_FOLDER_ICON.applyFolderColor(icon, getFolderColor(folderId));
  }

  function refreshFolderColors() {
    document.querySelectorAll('svg[data-folder-color-id]').forEach((svg) => {
      applySavedFolderColor(svg.parentElement);
    });
  }

  function readFolderColorRefs(): Promise<FolderColorRefs> {
    return settings.include(bookmarkFolderColorRefs).then(() =>
      NEWTAB_BOOKMARK_FOLDER_ICON.normalizeFolderColorRefs(settings.get(bookmarkFolderColorRefs)));
  }

  function writeFolderColorRefs(refs: FolderColorRefs): Promise<void> {
    return settings.set(bookmarkFolderColorRefs, refs);
  }

  // The colors saved in the picker, read as untrusted.
  function readSavedFolderColors(): Promise<unknown> {
    return settings.include(bookmarkFolderColorPresets).then(() => settings.get(bookmarkFolderColorPresets));
  }

  function saveSavedFolderColors(colors: string[]): Promise<void> {
    return settings.set(bookmarkFolderColorPresets, colors);
  }

  // Bookmark ids and paths can change underneath the synced map; resolving
  // again also moves a renamed or moved folder's color to its new path.
  // Only this device's own load or bookmark changes write that move back.
  // A map arriving from another device whose bookmarks have not caught up
  // would otherwise move the entry back and forth between the two devices.
  function applyFolderColorRefs(persist: boolean): Promise<void> {
    const resolved = NEWTAB_BOOKMARK_FOLDER_ICON.resolveFolderColors(folderColorRefs, bookmarksRuntime.getNodeMap());
    folderColors = resolved.colors;
    refreshFolderColors();
    if (!resolved.changed || !persist) return Promise.resolve();
    folderColorRefs = resolved.refs;
    return writeFolderColorRefs(resolved.refs).catch((error) => {
      console.warn('[Lumno] Could not update folder color references.', error);
    });
  }

  function syncFolderColorsWithBookmarks(persist: boolean): Promise<void> {
    if (!Object.keys(folderColorRefs).length) {
      folderColors = {};
      refreshFolderColors();
      return Promise.resolve();
    }
    return bookmarksRuntime.ensureReady(false).then((ready) => {
      if (ready) return applyFolderColorRefs(persist);
      return undefined;
    });
  }

  // Bookmark sync can deliver many changes at once; resolve after they settle.
  let folderColorSyncTimer = 0;
  function scheduleFolderColorSync(): void {
    if (!Object.keys(folderColorRefs).length) return;
    window.clearTimeout(folderColorSyncTimer);
    folderColorSyncTimer = window.setTimeout(() => {
      folderColorSyncTimer = 0;
      syncFolderColorsWithBookmarks(true).catch(() => {});
    }, 200);
  }

  // Colors saved before they synced were keyed by this device's bookmark ids.
  async function migrateLegacyFolderColors(): Promise<void> {
    await settings.include(bookmarkFolderColorsLegacy);
    const legacy = NEWTAB_BOOKMARK_FOLDER_ICON.normalizeFolderColorMap(settings.get(bookmarkFolderColorsLegacy));
    if (!Object.keys(legacy).length) return;
    if (!await bookmarksRuntime.ensureReady(false)) return;
    const refs = await readFolderColorRefs();
    const next = NEWTAB_BOOKMARK_FOLDER_ICON.importFolderColorMap(legacy, refs, bookmarksRuntime.getNodeMap());
    if (JSON.stringify(next) !== JSON.stringify(refs)) await writeFolderColorRefs(next);
    await settings.remove(bookmarkFolderColorsLegacy);
  }

  function loadFolderColors(): Promise<void> {
    return migrateLegacyFolderColors().catch((error) => {
      console.warn('[Lumno] Could not migrate folder colors.', error);
    }).then(readFolderColorRefs).then((refs) => {
      folderColorRefs = refs;
      return syncFolderColorsWithBookmarks(true);
    }).catch(() => {});
  }

  async function saveFolderColor(folderId: string, color: string | null): Promise<void> {
    const [refs, ready] = await Promise.all([readFolderColorRefs(), bookmarksRuntime.ensureReady(false)]);
    const next = ready
      ? NEWTAB_BOOKMARK_FOLDER_ICON.setFolderColorRef(refs, folderId, color, bookmarksRuntime.getNodeMap())
      : null;
    if (!next) throw new Error('Folder is unavailable');
    await writeFolderColorRefs(next);
    folderColorRefs = next;
    await applyFolderColorRefs(true);
  }

  async function createPicker(): Promise<FolderColorPicker | null> {
    if (!folderColorApi) {
      return null;
    }
    try {
      return await folderColorApi.createFolderColorPicker({
        documentObj: document, t,
        initFolderIcon: NEWTAB_BOOKMARK_FOLDER_ICON.initFolderPathMorph,
        animateFolderIcon: playFolderPathMorph,
        applyFolderColor: NEWTAB_BOOKMARK_FOLDER_ICON.applyFolderColor,
        bindTooltip: bindShortcutDialogTooltip,
        hideTooltip: hideShortcutDialogTooltip,
        readSavedColors: readSavedFolderColors,
        saveSavedColors: saveSavedFolderColors,
        onPreview: (id, color) => {
          folderColorPreview = { folderId: id, color };
          refreshFolderColors();
        },
        onSubmit: saveFolderColor,
        onClose: () => { folderColorPreview = null; refreshFolderColors(); }
      });
    } catch {
      return null;
    }
  }

  async function openFolderColorPicker(folderId: unknown, title: string, sourceElement?: HTMLElement | null): Promise<void> {
    closeBookmarkCascadeMenu();
    closeShortcutDialog();
    hideCursorTooltip();
    const picker = pageState.folderColorPicker || await createPicker();
    if (!picker) {
      showToast(t('folder_color_save_failed', 'Could not save the folder color. Try again.'), true);
      return;
    }
    pageState.folderColorPicker = picker;
    picker.open({ folderId: String(folderId), title, color: getFolderColor(folderId), sourceElement });
  }

  return {
    applySavedFolderColor,
    readSavedFolderColors,
    saveSavedFolderColors,
    syncFolderColorsWithBookmarks,
    scheduleFolderColorSync,
    loadFolderColors,
    openFolderColorPicker
  };
}

type FolderColors = ReturnType<typeof createFolderColors>;

export { createFolderColors };
export type { FolderColorPicker, FolderColors, FolderColorsDeps, FolderColorsState };
