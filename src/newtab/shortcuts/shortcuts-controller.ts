// The shortcut tiles: drawing them as the shortcuts change, opening a
// shortcut, and the add tile.
import type { FolderBindingRuntime } from '../../platform/bookmark-folder-bindings';
import type { BookmarksRuntime } from '../bookmarks/bookmarks-runtime';
import type { BindTooltip, FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { PageStructureRuntime } from '../react/page-structure';
import type { ShortcutContextMenuMark, ShortcutsViewController, ShortcutsViewOptions } from '../react/shortcuts';
import type { ShortcutContextMenu } from './shortcut-context-menu';
import type { ShortcutDock } from './shortcut-dock';
import type { ShortcutPageActions } from './shortcut-page-actions';
import type { ShortcutFavicons } from './shortcut-favicons';
import type { ShortcutData } from './shortcut-data';
import type { ShortcutDialogActions } from './shortcut-dialog-actions';
import { shortcutEvents } from './shortcut-events';
import type { ShortcutItem, VisibleShortcutItem } from '../../domain/shortcuts/types';
import * as ShortcutNormalize from '../../domain/shortcuts/normalize';
import { NEWTAB_SHORTCUT_GRID_SETTINGS, newtabShortcutAddVisible, newtabShortcutColumns, newtabShortcutWidth } from '../../domain/settings/newtab-shortcuts';
import type { SettingsStore } from '../../platform/settings-store';
import * as NEWTAB_SHORTCUT_ICON_PLATE from './shortcut-icon-plate';
import { DEFAULT_MAX_SHORTCUTS } from '../../domain/shortcuts/constants';
import { createShortcutsView } from '../react/shortcuts';
import type { ShortcutList } from './shortcut-list';
import { adaptiveToneEvents } from '../wallpaper/tone-requests';
import type { DragSessions } from '../drag-sessions';
import * as NAVIGATION_DISPOSITION from '../../domain/navigation-disposition';
import type { PageNavigation } from '../page-navigation';
import type { BookmarkNode } from '../bookmarks/bookmarks-store';
import type { OpenEvent } from '../../domain/navigation-disposition';
import { playFolderPathMorph } from '../bookmarks/bookmark-folder-icon';
import { bookmarkSectionEvents } from '../bookmarks/bookmark-section-events';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';


// An option the shortcuts view is handed as it is.
type ViewOption<K extends keyof ShortcutsViewOptions> = NonNullable<ShortcutsViewOptions[K]>;

interface ShortcutsControllerDeps {
  settings: Pick<SettingsStore, 'get' | 'getStored' | 'include' | 'set' | 'subscribe'>;
  shortcutFolderRuntime: Pick<FolderBindingRuntime, 'ready' | 'flush' | 'getNode' | 'reconcile' | 'visibleItems'>;
  bookmarksRuntime: Pick<BookmarksRuntime,
    'getNode' | 'getNodeMap' | 'getSnapshot' | 'ensureReady' | 'runControlledMutation' | 'update'>;
  moveShortcutByKeyboard: ViewOption<'moveShortcut'>;
  t: Translate;
  hideShortcutTooltip(): void;
  closeShortcutContextMenu(): void;
  syncOpenBookmarkCascadeAnchorVisual(): void;
  applyNewtabShortcutsVisibility(): void;
  updateBookmarkSectionPosition(options?: { preserveSearchEntryLayout?: boolean }): void;
  applyNewtabShortcutLayoutPreferences(): void;
  applyNewtabShortcutDockMagnification(): void;
  // The column count an older version's width setting stands for.
  inferNewtabShortcutColumnsFromWidth(value: unknown): number;
  showToast: ShowToast;
  formatMessage: FormatMessage;
  resetShortcutDockHover: ShortcutDock['resetShortcutDockHover'];
  pageStructureRuntime: { shortcut: Pick<PageStructureRuntime['shortcut'], 'section' | 'grid'> };
  shortcutTiles: ViewOption<'tiles'>;
  shortcutGroupHeaders: ViewOption<'groupHeaders'>;
  initFolderPathMorph: ViewOption<'initFolderIcon'>;
  getHostFromUrl: ViewOption<'getHostFromUrl'>;
  getImmediateThemeForSuggestion: ViewOption<'getImmediateThemeForSuggestion'>;
  applyShortcutTileTheme: ViewOption<'applyShortcutTileTheme'>;
  queueThemeForTarget: ViewOption<'queueThemeForTarget'>;
  getTileThemeOnSiteChange: ViewOption<'getTileThemeOnSiteChange'>;
  attachFaviconWithFallbacks: ViewOption<'attachFaviconWithFallbacks'>;
  bindShortcutTooltip: BindTooltip;
  isMiddleClick: ViewOption<'isMiddleClick'>;
  isCardActivationSuppressed(): boolean;
  handleShortcutContextMenu: ShortcutContextMenu['handleShortcutContextMenu'];
  handleShortcutNativeDragStart: ShortcutPageActions['handleShortcutNativeDragStart'];
  openShortcutAddDialog: ShortcutDialogActions['openShortcutAddDialog'];
  openShortcutGroupDialog: ShortcutDialogActions['openShortcutGroupDialog'];
  openShortcutAddContextMenu: ShortcutContextMenu['openShortcutAddContextMenu'];
  handleShortcutDragPointerDown(event: PointerEvent): void;
  handleShortcutDockPointerOver: ShortcutDock['handleShortcutDockPointerOver'];
  handleShortcutDockPointerMove: ShortcutDock['handleShortcutDockPointerMove'];
  syncShortcutDockFolderMenu: ShortcutDock['syncShortcutDockFolderMenu'];
  handleShortcutGroupMenu: ShortcutContextMenu['openShortcutGroupMenu'];
  // Slides the tiles to where `apply` puts them.
  animateShortcutLayoutChange?(apply: () => void): void;
  shortcutList: Pick<ShortcutList, 'icons' | 'items' | 'replaceIcons' | 'replaceItems'>;
  dragSessions: Pick<DragSessions, 'shortcutDragging'>;
  getShortcutTileById(id: string): HTMLElement | null;
  openBookmarkCascadeMenu(folder: BookmarkNode & { type: 'folder' }, anchor: HTMLElement | null): void;
  openUrlFromNewtabCard: PageNavigation['openUrlFromNewtabCard'];
  locale: Pick<SurfaceLocale, 'store'>;
  shortcutFavicons: ShortcutFavicons;
  shortcutData: ShortcutData;
}

function createShortcutsController(deps: ShortcutsControllerDeps) {
  const {
    shortcutList,
    settings,
    shortcutFolderRuntime,
    bookmarksRuntime,
    moveShortcutByKeyboard,
    t,
    hideShortcutTooltip,
    closeShortcutContextMenu,
    syncOpenBookmarkCascadeAnchorVisual,
    applyNewtabShortcutsVisibility,
    updateBookmarkSectionPosition,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutDockMagnification,
    inferNewtabShortcutColumnsFromWidth,
    showToast,
    formatMessage,
    resetShortcutDockHover,
    pageStructureRuntime,
    shortcutTiles,
    shortcutGroupHeaders,
    initFolderPathMorph,
    getHostFromUrl,
    getImmediateThemeForSuggestion,
    applyShortcutTileTheme,
    queueThemeForTarget,
    getTileThemeOnSiteChange,
    attachFaviconWithFallbacks,
    bindShortcutTooltip,
    isMiddleClick,
    isCardActivationSuppressed,
    handleShortcutContextMenu,
    handleShortcutNativeDragStart,
    openShortcutAddDialog,
    openShortcutGroupDialog,
    openShortcutAddContextMenu,
    handleShortcutDragPointerDown,
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu,
    handleShortcutGroupMenu,
    animateShortcutLayoutChange,
    dragSessions,
    getShortcutTileById,
    openBookmarkCascadeMenu,
    openUrlFromNewtabCard,
    locale,
    shortcutFavicons,
    shortcutData
  } = deps;
  const {
    getShortcutFaviconCandidateUrl,
    getShortcutFaviconDataUrl,
    resolveShortcutFaviconDataUrl,
    getShortcutFaviconPolicyRevision
  } = shortcutFavicons;
  const {
    getShortcutFolderId,
    getShortcutStoreOptions,
    getVisibleShortcuts,
    isShortcutGroupLayoutActive,
    getShortcutGroups,
    getShortcutIconDataUrl,
    getShortcutTitle
  } = shortcutData;


  let shortcutsView: ShortcutsViewController | null = null;
  // A shortcut drag moves the rendered tiles by hand until it ends, so a
  // render asked for meanwhile (a favicon that resolved, a storage change)
  // waits and runs once the drag is over.
  let shortcutRenderDeferred = false;

  function renderShortcuts(): void {
    if (!shortcutsView) {
      return;
    }
    if (dragSessions.shortcutDragging) {
      shortcutRenderDeferred = true;
      return;
    }
    shortcutRenderDeferred = false;
    hideShortcutTooltip();
    closeShortcutContextMenu();
    shortcutList.replaceItems(ShortcutNormalize.normalizeShortcuts(shortcutList.items, getShortcutStoreOptions()));
    const items = getVisibleShortcuts();
    const grouped = isShortcutGroupLayoutActive();
    shortcutsView.render(items, {
      grouped,
      groups: getShortcutGroups()
    });
    if (grouped) {
      adaptiveToneEvents.emit('stale', {});
    }
    shortcutFolderRuntime.flush().catch(() => {});
    syncOpenBookmarkCascadeAnchorVisual();
    const section = pageStructureRuntime.shortcut.section;
    section.setAttribute('data-count', String(items.length));
    section.setAttribute('aria-label', t('newtab_shortcuts_section_label', 'Shortcuts'));
    applyNewtabShortcutsVisibility();
    updateBookmarkSectionPosition({
      preserveSearchEntryLayout: Boolean(
        document.body && document.body.getAttribute('data-nt-ready') === '1'
      )
    });
  }

  function flushDeferredShortcutRender(): void {
    if (shortcutRenderDeferred && !dragSessions.shortcutDragging) {
      renderShortcuts();
    }
  }

  // A drag moves tiles between groups without rendering; the grid follows
  // its longest row as the tile joins or leaves one.
  function fitShortcutGroupColumns(): boolean {
    return Boolean(shortcutsView && isShortcutGroupLayoutActive() &&
      shortcutsView.fitGroupedColumns(getVisibleShortcuts(), getShortcutGroups()));
  }

  // Reads the grid settings, filling in the columns of a device that only
  // stored the older width, then follows the add button's.
  function followNewtabShortcutPreferences(): Promise<void> {
    settings.subscribe(newtabShortcutAddVisible, () => renderShortcuts());
    return settings.include(NEWTAB_SHORTCUT_GRID_SETTINGS.concat(newtabShortcutWidth)).then(() => {
      if (settings.getStored(newtabShortcutColumns) === undefined) {
        void settings.set(newtabShortcutColumns, inferNewtabShortcutColumnsFromWidth(settings.getStored(newtabShortcutWidth)));
      }
      applyNewtabShortcutLayoutPreferences();
      applyNewtabShortcutsVisibility();
      applyNewtabShortcutDockMagnification();
    });
  }

  function hideShortcutAddFromContextMenu(sourceElement?: HTMLElement | null): void {
    if (!settings.get(newtabShortcutAddVisible)) {
      return;
    }
    void settings.set(newtabShortcutAddVisible, false);
    const addButton = sourceElement || getAddShortcutButton();
    if (addButton) {
      addButton.hidden = true;
    }
    hideShortcutTooltip();
    resetShortcutDockHover();
    applyNewtabShortcutsVisibility();
    updateBookmarkSectionPosition({ preserveSearchEntryLayout: true });
    adaptiveToneEvents.emit('stale', {});
    showToast(t(
      'newtab_shortcuts_add_hidden',
      '“+” hidden. Re-enable it in Settings → Appearance → Shortcuts → Show “+”.'
    ));
  }

  function createShortcutsSection(): void {
    const section = pageStructureRuntime.shortcut.section;
    section.setAttribute('aria-label', t('newtab_shortcuts_section_label', 'Shortcuts'));

    const grid = pageStructureRuntime.shortcut.grid;
    applyNewtabShortcutDockMagnification();

    const view = createShortcutsView({
      grid,
      tiles: shortcutTiles,
      maxShortcuts: DEFAULT_MAX_SHORTCUTS,
      initFolderIcon: initFolderPathMorph,
      animateFolderIcon: playFolderPathMorph,
      onFolderMenuChange: syncShortcutDockFolderMenu,
      getShortcutTitle,
      getHostFromUrl,
      getShortcutIconDataUrl,
      getShortcutFaviconDataUrl,
      resolveShortcutFaviconDataUrl,
      getShortcutFaviconPolicyRevision,
      getShortcutFaviconCandidateUrl,
      analyzeShortcutIcon: (image) => NEWTAB_SHORTCUT_ICON_PLATE.analyzeImage(image, { documentObj: document }),
      resolveShortcutIconPlate: NEWTAB_SHORTCUT_ICON_PLATE.resolvePlate,
      getImmediateThemeForSuggestion,
      applyShortcutTileTheme,
      queueThemeForTarget,
      getTileThemeOnSiteChange,
      attachFaviconWithFallbacks,
      bindTooltip: bindShortcutTooltip,
      hideTooltip: hideShortcutTooltip,
      formatOpenLabel: (title) => formatMessage('open_prefix', '打开 {title}', { title }),
      isMiddleClick,
      openShortcut: openShortcutUrl,
      isActivationSuppressed: isCardActivationSuppressed,
      moveShortcut: moveShortcutByKeyboard,
      onContextMenu: handleShortcutContextMenu,
      onNativeDragStart: handleShortcutNativeDragStart,
      getAddLabel: () => t('newtab_shortcuts_add', 'Add shortcut'),
      getAddVisible: () => settings.get(newtabShortcutAddVisible) && shortcutList.items.length < DEFAULT_MAX_SHORTCUTS,
      // The add tile asks what to add, or offers to hide itself.
      onAdd: openShortcutAddContextMenu,
      onAddContextMenu: () => {},
      groupHeaders: shortcutGroupHeaders,
      getGroupPlaceholder: () => t('newtab_shortcuts_group_title_placeholder', 'Add a title'),
      getGroupActionsLabel: (title) => formatMessage('newtab_shortcuts_group_actions', '{group} actions', {
        group: title || t('newtab_shortcuts_group_untitled_name', 'Untitled group')
      }),
      onGroupMenu: handleShortcutGroupMenu,
      onGroupRename: openShortcutGroupDialog,
      getGroupEmptyLabel: () => t('newtab_shortcuts_group_add_site', 'Add site'),
      onGroupAdd: (groupId, sourceElement) => openShortcutAddDialog(sourceElement, groupId)
    });
    shortcutsView = view;
    view.render([]);
    grid.addEventListener('pointerdown', handleShortcutDragPointerDown);
    grid.addEventListener('pointerover', handleShortcutDockPointerOver);
    grid.addEventListener('pointermove', handleShortcutDockPointerMove);
    grid.addEventListener('pointerleave', resetShortcutDockHover);
  }

  // A link opens its site; a folder opens its bookmarks in the folder menu.
  function openShortcutUrl(shortcut: ShortcutItem | VisibleShortcutItem | null | undefined, event?: OpenEvent | null): void {
    if (shortcut && shortcut.type === 'folder') {
      const tile = getShortcutTileById(shortcut.id);
      void bookmarksRuntime.ensureReady(false).then((ready) => {
        const node = ready && bookmarksRuntime.getNode(getShortcutFolderId(shortcut));
        if (!node || node.url) {
          showToast(t('newtab_shortcuts_folder_missing', 'This bookmark folder is no longer available.'), true);
          return;
        }
        openBookmarkCascadeMenu({ ...node, type: 'folder' }, tile);
      });
      return;
    }
    if (!shortcut || !('url' in shortcut) || !shortcut.url) {
      return;
    }
    openUrlFromNewtabCard(shortcut.url, {
      openInBackgroundTab: NAVIGATION_DISPOSITION.isBackgroundOpenEvent(event),
      openInOtherTab: Boolean(event && event.altKey),
      surface: 'shortcuts'
    });
  }

  // The add tile, while the grid shows one.
  function getAddShortcutButton(): HTMLButtonElement | null {
    return shortcutsView ? shortcutsView.getAddButton() : null;
  }

  function setShortcutContextMenuMark(mark: ShortcutContextMenuMark | null): void {
    if (shortcutsView) {
      shortcutsView.setContextMenuMark(mark);
    }
  }


  // Folder shortcuts show what their bookmark folders hold.
  bookmarkSectionEvents.on('loaded', () => {
    if (shortcutList.items.some((shortcut) => shortcut.type === 'folder')) {
      renderShortcuts();
    }
  });

  // The tiles draw their labels and menus in the page's language.
  locale.store.subscribe(() => renderShortcuts());
  shortcutEvents.on('stale', () => renderShortcuts());
  shortcutEvents.on('changed', ({ animateLayout }) => {
    if (animateLayout && animateShortcutLayoutChange) {
      animateShortcutLayoutChange(renderShortcuts);
    } else {
      renderShortcuts();
    }
  });
  return {
    openShortcutUrl,
    getAddShortcutButton,
    setShortcutContextMenuMark,
    renderShortcuts,
    flushDeferredShortcutRender,
    followNewtabShortcutPreferences,
    hideShortcutAddFromContextMenu,
    createShortcutsSection,
    fitShortcutGroupColumns
  };
}

type ShortcutsController = ReturnType<typeof createShortcutsController>;

export { createShortcutsController };
export type { ShortcutsController, ShortcutsControllerDeps };
