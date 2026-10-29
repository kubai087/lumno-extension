// Shortcut storage, favicons, loading, persistence, rendering and the add/edit
// dialog.
import * as ShortcutIconCache from '../../domain/favicon/shortcut-favicon/persisted';
import type { FolderBindingRuntime } from '../../platform/bookmark-folder-bindings';
import type { BookmarksRuntime } from '../bookmarks/bookmarks-runtime';
import type { BindTooltip, FormatMessage, ShowToast, Translate } from '../newtab-types';
import type { PageStructureRuntime } from '../react/page-structure';
import type {
  OnlineShortcutIcon,
  ShortcutDialogController,
  ShortcutDialogPayload
} from '../react/shortcut-dialog';
import type { ShortcutContextMenuMark, ShortcutsViewController, ShortcutsViewOptions } from '../react/shortcuts';
import type { ShortcutContextMenu } from './shortcut-context-menu';
import type { ShortcutDock } from './shortcut-dock';
import type { ShortcutIconStore } from './shortcut-icon-store';
import type { ShortcutPageActions } from './shortcut-page-actions';
import type { ShortcutFavicons } from './shortcut-favicons';
import type { ShortcutData } from './shortcut-data';
import { shortcutEvents } from './shortcut-events';
import type { ShortcutIconChange } from './shortcut-types';
import { getShortcutUrl, isShortcutFolder } from '../../domain/shortcuts/normalize';
import type { ShortcutItem, VisibleShortcutItem } from '../../domain/shortcuts/types';
import * as ShortcutConstants from '../../domain/shortcuts/constants';
import * as ShortcutNormalize from '../../domain/shortcuts/normalize';
import { NEWTAB_SHORTCUT_GRID_SETTINGS, newtabShortcutAddVisible, newtabShortcutColumns, newtabShortcutWidth } from '../../domain/settings/newtab-shortcuts';
import type { SettingsStore } from '../../platform/settings-store';
import * as NEWTAB_SHORTCUT_ICON_PLATE from './shortcut-icon-plate';
import { SHORTCUT_DIALOG_ITEM_BOOKMARK, SHORTCUT_DIALOG_ITEM_FOLDER } from '../menu-values';
import { DEFAULT_MAX_SHORTCUTS } from '../../domain/shortcuts/constants';
import { createShortcutsView } from '../react/shortcuts';
import { createShortcutDialog } from '../react/shortcut-dialog-lazy';
import type { ShortcutList } from './shortcut-list';
import type { BookmarkSectionParts } from '../bookmarks/bookmark-section-parts';
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
  shortcutIconStore: ShortcutIconStore;
  t: Translate;
  hideShortcutTooltip(): void;
  closeShortcutContextMenu(): void;
  syncOpenBookmarkCascadeAnchorVisual(): void;
  applyNewtabShortcutsVisibility(): void;
  updateShortcutLanguageStrings(): void;
  updateBookmarkSectionPosition(options?: { preserveSearchEntryLayout?: boolean }): void;
  pickShortcutIconPlateColor: ShortcutPageActions['pickShortcutIconPlateColor'];
  applyNewtabShortcutLayoutPreferences(): void;
  applyNewtabShortcutDockMagnification(): void;
  // The column count an older version's width setting stands for.
  inferNewtabShortcutColumnsFromWidth(value: unknown): number;
  showToast: ShowToast;
  formatMessage: FormatMessage;
  refreshOpenBookmarkCascadeMenu(): unknown;
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
  openShortcutDialog: ShortcutPageActions['openShortcutDialog'];
  openShortcutAddContextMenu: ShortcutContextMenu['openShortcutAddContextMenu'];
  handleShortcutDragPointerDown(event: PointerEvent): void;
  handleShortcutDockPointerOver: ShortcutDock['handleShortcutDockPointerOver'];
  handleShortcutDockPointerMove: ShortcutDock['handleShortcutDockPointerMove'];
  syncShortcutDockFolderMenu: ShortcutDock['syncShortcutDockFolderMenu'];
  bindShortcutDialogTooltip: BindTooltip;
  hideShortcutDialogTooltip(): void;
  handleShortcutGroupMenu: ShortcutContextMenu['openShortcutGroupMenu'];
  // Slides the tiles to where `apply` puts them.
  animateShortcutLayoutChange?(apply: () => void): void;
  shortcutList: Pick<ShortcutList, 'icons' | 'items' | 'replaceIcons' | 'replaceItems'>;
  bookmarkParts: Pick<BookmarkSectionParts, 'cascade'>;
  setShortcutError(message: string): void;
  dragSessions: Pick<DragSessions, 'shortcutDragging'>;
  getShortcutTileById(id: string): HTMLElement | null;
  openBookmarkCascadeMenu(folder: BookmarkNode & { type: 'folder' }, anchor: HTMLElement | null): void;
  openUrlFromNewtabCard: PageNavigation['openUrlFromNewtabCard'];
  locale: Pick<SurfaceLocale, 'store'>;
  shortcutFavicons: ShortcutFavicons;
  shortcutData: ShortcutData;
}

// The icon choice a dialog submitted.
interface DialogIconState {
  action?: ShortcutDialogPayload['iconAction'];
  dataUrl?: string;
  source?: ShortcutDialogPayload['iconSource'];
  plate?: ShortcutDialogPayload['iconPlate'];
  plateColor?: string;
}


// What the dialog submitted for a shortcut.
interface ShortcutDialogSubmission {
  mode: ShortcutDialogPayload['mode'];
  shortcutId: string;
  iconAction: ShortcutDialogPayload['iconAction'];
  iconDataUrl: string;
  iconSource?: ShortcutDialogPayload['iconSource'];
  iconPlate?: ShortcutDialogPayload['iconPlate'];
  iconPlateColor?: string;
}

// What the dialog submitted for a bookmark or folder inside a shortcut folder.
interface BookmarkDialogSubmission {
  itemType: ShortcutDialogPayload['itemType'];
  itemId: string;
  shortcutId: string;
  iconSource?: ShortcutDialogPayload['iconSource'];
  iconAction: ShortcutDialogPayload['iconAction'];
  iconDataUrl: string;
  onlineIcon?: OnlineShortcutIcon;
}

function createShortcutsController(deps: ShortcutsControllerDeps) {
  const {
    bookmarkParts,
    shortcutList,
    settings,
    shortcutFolderRuntime,
    bookmarksRuntime,
    moveShortcutByKeyboard,
    shortcutIconStore,
    t,
    hideShortcutTooltip,
    closeShortcutContextMenu,
    syncOpenBookmarkCascadeAnchorVisual,
    applyNewtabShortcutsVisibility,
    updateShortcutLanguageStrings,
    updateBookmarkSectionPosition,
    pickShortcutIconPlateColor,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutDockMagnification,
    inferNewtabShortcutColumnsFromWidth,
    showToast,
    formatMessage,
    refreshOpenBookmarkCascadeMenu,
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
    openShortcutDialog,
    openShortcutAddContextMenu,
    handleShortcutDragPointerDown,
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu,
    bindShortcutDialogTooltip,
    hideShortcutDialogTooltip,
    handleShortcutGroupMenu,
    animateShortcutLayoutChange,
    setShortcutError,
    dragSessions,
    getShortcutTileById,
    openBookmarkCascadeMenu,
    openUrlFromNewtabCard,
    locale,
    shortcutFavicons,
    shortcutData
  } = deps;
  const {
    getNextFolderItemIcon,
    getShortcutDialogBuiltinIconUrl,
    getShortcutDialogOnlineIconSource,
    getShortcutDialogOnlineIconUrl,
    getShortcutFaviconCandidateUrl,
    getShortcutFaviconDataUrl,
    isShortcutDialogIconSourceAvailable,
    refreshShortcutDialogOnlineIcon,
    resolveShortcutFaviconDataUrl,
    saveShortcutFaviconSnapshot,
    updateFolderItemIcons,
    getShortcutFaviconPolicyRevision
  } = shortcutFavicons;
  const {
    createShortcutGroup,
    createShortcutLinkRecord,
    deleteShortcutGroup,
    getLastShortcutGroupId,
    getShortcutFolderId,
    getShortcutGroupDisplayTitle,
    getShortcutStoreOptions,
    getVisibleShortcuts,
    isShortcutGroupLayoutActive,
    persistShortcuts,
    renameShortcutGroup,
    showGroupLimitToast,
    getShortcutGroups,
    getShortcutIconDataUrl,
    getShortcutTitle,
    getShortcutById
  } = shortcutData;


  let shortcutsView: ShortcutsViewController | null = null;
  // The group a site added from the dialog joins, and the group the
  // dialog renames ('' while it creates one).
  let shortcutAddTargetGroupId = '';
  let shortcutGroupDialogTargetId = '';
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
    pageStructureRuntime.shortcut.section.setAttribute('data-count', String(items.length));
    applyNewtabShortcutsVisibility();
    updateShortcutLanguageStrings();
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

  function openShortcutAddDialog(sourceElement: HTMLElement | null, groupId?: string): void {
    hideShortcutTooltip();
    shortcutAddTargetGroupId = groupId || getLastShortcutGroupId();
    void openShortcutDialog({ sourceElement });
  }

  // Groups are named in the shortcut dialog: an empty groupId creates one.
  function openShortcutGroupDialog(groupId: string, sourceElement: HTMLElement | null): void {
    const group = groupId ? getShortcutGroups().find((item) => item.id === groupId) : null;
    if (groupId && !group) {
      return;
    }
    if (!group && getShortcutGroups().length >= ShortcutConstants.DEFAULT_MAX_SHORTCUT_GROUPS) {
      showGroupLimitToast();
      return;
    }
    hideShortcutTooltip();
    shortcutGroupDialogTargetId = group ? group.id : '';
    void openShortcutDialog({
      sourceElement,
      itemType: 'group',
      mode: group ? 'edit' : 'add',
      shortcut: group ? { id: group.id, title: group.title } : null
    });
  }

  function saveShortcutGroupFromDialog(title: string): Promise<boolean> {
    return shortcutGroupDialogTargetId
      ? renameShortcutGroup(shortcutGroupDialogTargetId, title)
      : createShortcutGroup(title);
  }

  // Deleting a group with its sites removes them all at once, so it asks
  // first; keeping the sites is a plain move and does not.
  function confirmDeleteShortcutGroupWithSites(groupId: string, sourceElement: HTMLElement | null): Promise<boolean> {
    const count = shortcutList.items.filter((item) => item.groupId === groupId).length;
    if (!count) {
      return deleteShortcutGroup(groupId, false);
    }
    void openShortcutDialog({
      sourceElement,
      confirmationTitle: formatMessage(
        'newtab_shortcuts_group_delete_confirm_title',
        'Delete “{group}” and its sites?',
        { group: getShortcutGroupDisplayTitle(groupId) }
      ),
      confirmationDescription: formatMessage(
        'newtab_shortcuts_group_delete_confirm_description',
        'The group and its {count} sites will be deleted.',
        { count }
      ),
      confirmLabel: t('newtab_shortcuts_group_delete_confirm_button', 'Delete'),
      onConfirm() {
        return deleteShortcutGroup(groupId, false);
      }
    });
    return Promise.resolve(true);
  }

  // The change the dialog's icon choice makes; none when it kept the icon.
  function getDialogIconChange(shortcutId: string, iconState: DialogIconState): ShortcutIconChange | undefined {
    if (iconState.action === 'replace') {
      return { shortcutId, action: 'replace', dataUrl: iconState.dataUrl || '' };
    }
    return iconState.action === 'remove' ? { shortcutId, action: 'remove' } : undefined;
  }

  function saveNewShortcutFromDialog(title: string, url: string, iconState: DialogIconState): Promise<boolean> {
    const nextShortcut = createShortcutLinkRecord({ title, url,
      iconSource: iconState.source,
      iconPlate: iconState.plate,
      iconPlateColor: iconState.plateColor });
    if (!nextShortcut) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
      return Promise.resolve(false);
    }
    const withoutDuplicate = shortcutList.items.filter((item) => getShortcutUrl(item) !== nextShortcut.url);
    if (withoutDuplicate.length >= DEFAULT_MAX_SHORTCUTS) {
      setShortcutError(formatMessage(
        'newtab_shortcuts_limit_reached',
        'You can add up to {count} shortcuts.',
        { count: DEFAULT_MAX_SHORTCUTS }
      ));
      return Promise.resolve(false);
    }
    // A site added from the dialog joins the group it was added from.
    const groupId = getShortcutGroups().some((group) => group.id === shortcutAddTargetGroupId)
      ? shortcutAddTargetGroupId
      : getLastShortcutGroupId();
    shortcutAddTargetGroupId = '';
    const nextShortcuts = withoutDuplicate.concat(groupId ? { ...nextShortcut, groupId } : nextShortcut);
    return persistShortcuts(
      nextShortcuts,
      t('newtab_shortcuts_added', 'Shortcut added'),
      getDialogIconChange(nextShortcut.id, iconState),
      {
        syncOverflowShortcutId: nextShortcut.id,
        animateLayout: true
      }
    );
  }

  function saveEditedShortcutFromDialog(title: string, url: string, shortcutId: string, iconState: DialogIconState): Promise<boolean> {
    const currentShortcut = getShortcutById(shortcutId);
    // Folders are edited as bookmarks.
    if (!currentShortcut || isShortcutFolder(currentShortcut)) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
      return Promise.resolve(false);
    }
    const keepsPlate = typeof iconState.plate === 'undefined';
    const nextShortcut = createShortcutLinkRecord({ title, url,
      iconSource: iconState.source || currentShortcut.iconSource,
      iconPlate: keepsPlate ? currentShortcut.iconPlate : iconState.plate,
      iconPlateColor: keepsPlate ? currentShortcut.iconPlateColor : iconState.plateColor,
      fromBookmark: currentShortcut.fromBookmark === true &&
        ShortcutNormalize.normalizeShortcutUrl(url) === currentShortcut.url });
    if (!nextShortcut) {
      setShortcutError(t('newtab_shortcuts_invalid_url', 'Enter a valid http, https, or browser internal URL.'));
      return Promise.resolve(false);
    }
    nextShortcut.id = currentShortcut.id;
    if (currentShortcut.groupId) {
      nextShortcut.groupId = currentShortcut.groupId;
    }
    const nextShortcuts: ShortcutItem[] = [];
    shortcutList.items.forEach((item) => {
      if (item.id === currentShortcut.id) {
        nextShortcuts.push(nextShortcut);
        return;
      }
      if (getShortcutUrl(item) === nextShortcut.url) {
        return;
      }
      nextShortcuts.push(item);
    });
    return persistShortcuts(
      nextShortcuts,
      t('newtab_shortcuts_edited', 'Shortcut updated'),
      getDialogIconChange(nextShortcut.id, iconState)
    );
  }

  function saveShortcutFromDialog(title: string, url: string, dialogState: ShortcutDialogSubmission): Promise<boolean> {
    const iconState: DialogIconState = {
      action: dialogState.iconAction,
      dataUrl: dialogState.iconDataUrl,
      source: dialogState.iconSource,
      plate: dialogState.iconPlate,
      plateColor: dialogState.iconPlateColor
    };
    if (dialogState.mode === 'edit') {
      return saveEditedShortcutFromDialog(title, url, dialogState.shortcutId, iconState);
    }
    return saveNewShortcutFromDialog(title, url, iconState);
  }

  function saveBookmarkFromDialog(title: string, url: string, dialogState: BookmarkDialogSubmission): Promise<boolean> {
    const itemId = String(dialogState.itemId || dialogState.shortcutId || '');
    const isFolder = dialogState.itemType === SHORTCUT_DIALOG_ITEM_FOLDER;
    const nextUrl = String(url || '').trim();
    if (!itemId || (!isFolder && !nextUrl)) {
      setShortcutError(t('bookmarks_invalid_url', 'Enter a valid URL.'));
      return Promise.resolve(false);
    }
    const changes: { title: string; url?: string } = {
      title: String(title || '').trim()
    };
    if (!isFolder) {
      changes.url = nextUrl;
    }
    const iconEntry = !isFolder && dialogState.iconSource
      ? getNextFolderItemIcon(itemId, nextUrl, {
        source: dialogState.iconSource,
        action: dialogState.iconAction,
        dataUrl: dialogState.iconDataUrl,
        onlineIcon: dialogState.onlineIcon
      })
      : undefined;
    const keepCascadeOpen = Boolean(bookmarkParts.cascade && bookmarkParts.cascade.isOpen());
    return bookmarksRuntime.runControlledMutation(() => {
      return bookmarksRuntime.update(itemId, changes);
    }).then(() => {
      return iconEntry === undefined ? null : updateFolderItemIcons({ [itemId]: iconEntry });
    }).then(() => {
      bookmarkSectionEvents.emit('changed', { keepCascadeOpen: keepCascadeOpen });
      if (keepCascadeOpen) {
        refreshOpenBookmarkCascadeMenu();
      }
      showToast(t(
        isFolder ? 'bookmarks_folder_updated' : 'bookmarks_updated',
        isFolder ? 'Folder updated' : 'Bookmark updated'
      ));
      return true;
    }).catch((error: unknown) => {
      console.warn('[Lumno] Failed to update bookmark', error);
      setShortcutError(t('bookmarks_update_failed', 'Could not update bookmark.'));
      return false;
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
    updateShortcutLanguageStrings();
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

  // The dialog module loads on first use.
  function createShortcutDialogComponent(): Promise<ShortcutDialogController | null> {
    return createShortcutDialog({
      documentObj: document,
      windowObj: window,
      t,
      bindTooltip: bindShortcutDialogTooltip,
      hideTooltip: hideShortcutDialogTooltip,
      prepareIconFile: shortcutIconStore.prepareFile,
      getOnlineIconUrl: getShortcutDialogOnlineIconUrl,
      getOnlineIconSource: getShortcutDialogOnlineIconSource,
      getBuiltinIconUrl: getShortcutDialogBuiltinIconUrl,
      isIconSourceAvailable: isShortcutDialogIconSourceAvailable,
      refreshOnlineIcon: refreshShortcutDialogOnlineIcon,
      analyzeIcon: (image) => NEWTAB_SHORTCUT_ICON_PLATE.analyzeImage(image, { documentObj: document }),
      resolveIconPlate: NEWTAB_SHORTCUT_ICON_PLATE.resolvePlate,
      getIconPlateColorChoices: NEWTAB_SHORTCUT_ICON_PLATE.getPlateColorChoices,
      pickIconPlateColor: pickShortcutIconPlateColor,
      onSubmit(payload) {
        if (payload.itemType === 'group') {
          return saveShortcutGroupFromDialog(payload.title);
        }
        if (payload.itemType === SHORTCUT_DIALOG_ITEM_BOOKMARK ||
            payload.itemType === SHORTCUT_DIALOG_ITEM_FOLDER) {
          return saveBookmarkFromDialog(payload.title, payload.url, {
            itemType: payload.itemType,
            itemId: payload.itemId,
            shortcutId: payload.shortcutId,
            iconSource: payload.iconSource,
            iconAction: payload.iconAction,
            iconDataUrl: payload.iconDataUrl,
            onlineIcon: payload.onlineIcon
          });
        }
        return saveShortcutFromDialog(payload.title, payload.url, {
          mode: payload.mode,
          shortcutId: payload.shortcutId,
          iconAction: payload.iconAction,
          iconDataUrl: payload.iconDataUrl,
          iconSource: payload.iconSource,
          iconPlate: payload.iconPlate,
          iconPlateColor: payload.iconPlateColor
        }).then((saved) => {
          const onlineIcon = payload.onlineIcon;
          const pageUrl = ShortcutIconCache.normalizePageUrl(
            ShortcutNormalize.normalizeShortcutUrl(payload.url)
          );
          if (saved && onlineIcon && pageUrl && pageUrl === onlineIcon.pageUrl) {
            saveShortcutFaviconSnapshot(pageUrl, onlineIcon.dataUrl, onlineIcon.sourceUrl, true);
            renderShortcuts();
          }
          return saved;
        });
      }
    });
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
    createShortcutDialogComponent,
    fitShortcutGroupColumns,
    openShortcutAddDialog,
    openShortcutGroupDialog,
    confirmDeleteShortcutGroupWithSites
  };
}

type ShortcutsController = ReturnType<typeof createShortcutsController>;

export { createShortcutsController };
export type { ShortcutsController, ShortcutsControllerDeps };
