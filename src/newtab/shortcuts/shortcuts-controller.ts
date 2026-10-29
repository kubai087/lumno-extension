// The shortcut tiles: drawing them as the shortcuts change, opening a
// shortcut, and the add tile.
import type { FolderBindingRuntime } from '../../platform/bookmark-folder-bindings';
import type { BindTooltip, FormatMessage, Translate } from '../newtab-types';
import type { PageStructureRuntime } from '../react/page-structure';
import type { ShortcutsViewController, ShortcutsViewOptions } from '../react/shortcuts';
import type { ShortcutContextMenu } from './shortcut-context-menu';
import type { ShortcutDock } from '../dom/shortcut-dock';
import type { ShortcutPageActions } from './shortcut-page-actions';
import type { ShortcutFavicons } from './shortcut-favicons';
import type { ShortcutData } from './shortcut-data';
import type { ShortcutDialogActions } from './shortcut-dialog-actions';
import type { ShortcutLayoutAnimation } from '../dom/shortcut-layout-animation';
import { shortcutEvents } from './shortcut-events';
import * as ShortcutNormalize from '../../domain/shortcuts/normalize';
import { NEWTAB_SHORTCUT_GRID_SETTINGS, newtabShortcutAddVisible, newtabShortcutColumns, newtabShortcutWidth } from '../../domain/settings/newtab-shortcuts';
import type { SettingsStore } from '../../platform/settings-store';
import * as NEWTAB_SHORTCUT_ICON_PLATE from './shortcut-icon-plate';
import { DEFAULT_MAX_SHORTCUTS } from '../../domain/shortcuts/constants';
import { createShortcutsView } from '../react/shortcuts';
import type { ShortcutList } from './shortcut-list';
import { adaptiveToneEvents } from '../wallpaper/tone-requests';
import type { DragSessions } from '../drag-sessions';
import { playFolderPathMorph } from '../dom/folder-icon';
import { bookmarkSectionEvents } from '../bookmarks/bookmark-section-events';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';


// An option the shortcuts view is handed as it is.
type ViewOption<K extends keyof ShortcutsViewOptions> = NonNullable<ShortcutsViewOptions[K]>;

interface ShortcutsControllerDeps {
  settings: Pick<SettingsStore, 'get' | 'getStored' | 'include' | 'set' | 'subscribe'>;
  shortcutFolderRuntime: Pick<FolderBindingRuntime, 'ready' | 'flush' | 'getNode' | 'reconcile' | 'visibleItems'>;
  shortcutLayoutAnimation: Pick<ShortcutLayoutAnimation, 'change'>;
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
  handleShortcutDockPointerOver: ShortcutDock['handleShortcutDockPointerOver'];
  handleShortcutDockPointerMove: ShortcutDock['handleShortcutDockPointerMove'];
  syncShortcutDockFolderMenu: ShortcutDock['syncShortcutDockFolderMenu'];
  handleShortcutGroupMenu: ShortcutContextMenu['openShortcutGroupMenu'];
  shortcutList: Pick<ShortcutList, 'icons' | 'items' | 'replaceIcons' | 'replaceItems'>;
  dragSessions: Pick<DragSessions, 'shortcutDragging'>;
  locale: Pick<SurfaceLocale, 'store'>;
  shortcutFavicons: ShortcutFavicons;
  shortcutData: ShortcutData;
  openShortcutUrl: ShortcutPageActions['openShortcutUrl'];
}

function createShortcutsController(deps: ShortcutsControllerDeps) {
  const {
    shortcutList,
    settings,
    shortcutFolderRuntime,
    shortcutLayoutAnimation,
    t,
    hideShortcutTooltip,
    closeShortcutContextMenu,
    syncOpenBookmarkCascadeAnchorVisual,
    applyNewtabShortcutsVisibility,
    updateBookmarkSectionPosition,
    applyNewtabShortcutLayoutPreferences,
    applyNewtabShortcutDockMagnification,
    inferNewtabShortcutColumnsFromWidth,
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
    handleShortcutDockPointerOver,
    handleShortcutDockPointerMove,
    syncShortcutDockFolderMenu,
    handleShortcutGroupMenu,
    dragSessions,
    locale,
    shortcutFavicons,
    shortcutData,
    openShortcutUrl
  } = deps;
  const {
    getShortcutFaviconCandidateUrl,
    getShortcutFaviconDataUrl,
    resolveShortcutFaviconDataUrl,
    getShortcutFaviconPolicyRevision
  } = shortcutFavicons;
  const {
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
      moveShortcut: (shortcutId, direction) => shortcutEvents.emit('moveRequested', { shortcutId, direction: direction > 0 ? 1 : -1 }),
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
    grid.addEventListener('pointerover', handleShortcutDockPointerOver);
    grid.addEventListener('pointermove', handleShortcutDockPointerMove);
    grid.addEventListener('pointerleave', resetShortcutDockHover);
  }


  // The add tile, while the grid shows one.
  function getAddShortcutButton(): HTMLButtonElement | null {
    return shortcutsView ? shortcutsView.getAddButton() : null;
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
  shortcutEvents.on('menuMarked', ({ mark }) => {
    if (shortcutsView) {
      shortcutsView.setContextMenuMark(mark);
    }
  });
  shortcutEvents.on('changed', ({ animateLayout }) => {
    if (animateLayout) {
      shortcutLayoutAnimation.change(renderShortcuts);
    } else {
      renderShortcuts();
    }
  });
  return {
    getAddShortcutButton,
    renderShortcuts,
    flushDeferredShortcutRender,
    followNewtabShortcutPreferences,
    createShortcutsSection,
    fitShortcutGroupColumns
  };
}

type ShortcutsController = ReturnType<typeof createShortcutsController>;

export { createShortcutsController };
export type { ShortcutsController, ShortcutsControllerDeps };
