import { describe, expect, it, vi } from 'vitest';
import { createShortcutsController } from './shortcuts-controller';
import { ShortcutList } from './shortcut-list';
import type { ShortcutData } from './shortcut-data';
import type { ShortcutFavicons } from './shortcut-favicons';
import { createSettingsStore } from '../../platform/settings-store';
import { createStore } from '../../shared/state/store';
import { createBrowserFake } from '../../../tests/fakes/browser';
import type { ShortcutTilesState } from '../react/shortcuts';
import type { Store } from '../../shared/state/store';
import type { SurfaceLocaleState } from '../../shared/i18n/surface-locale';

// A shortcut drag moves React-rendered tiles by hand, so renders asked for
// while it runs (favicons resolving, storage changes) must wait and run once
// after the drag ends.

// The grid view counts each set of tiles the controller hands it.
const view = vi.hoisted(() => ({ renders: 0 }));
vi.mock('../react/shortcuts', () => ({
  createShortcutsView: ({ tilesState }: { tilesState: Store<ShortcutTilesState> }) => {
    tilesState.subscribe(() => {
      view.renders += 1;
    });
    return { getAddButton: () => null };
  }
}));

function createShortcutData(shortcutList: ShortcutList): ShortcutData {
  return {
    getShortcutById: vi.fn(),
    getShortcutFolderId: vi.fn(),
    getVisibleShortcuts: () => [],
    getShortcutTitle: vi.fn(),
    getShortcutIconDataUrl: vi.fn(),
    getShortcutStoreOptions: () => ({}),
    refreshShortcutFolderReferences: vi.fn(),
    followStoredShortcutData: vi.fn(),
    loadVisibleShortcuts: vi.fn(),
    persistShortcuts: vi.fn(),
    isWebDavBackingUpShortcuts: vi.fn(),
    getShortcutGroups: () => [],
    isShortcutGroupLayoutActive: () => false,
    getLastShortcutGroupId: vi.fn(),
    getShortcutGroupDisplayTitle: vi.fn(),
    showGroupLimitToast: vi.fn(),
    createShortcutLinkRecord: vi.fn(),
    createShortcutGroup: vi.fn(),
    renameShortcutGroup: vi.fn(),
    moveShortcutGroup: vi.fn(),
    moveShortcutGroupToIndex: vi.fn(),
    deleteShortcutGroup: vi.fn(),
    applyShortcutGroupDeleteRecord: vi.fn(),
    hasShortcutForSite: () => shortcutList.items.length > 0,
    addSiteToShortcuts: vi.fn(),
    removeShortcutById: vi.fn()
  };
}

function createShortcutFavicons(): ShortcutFavicons {
  return {
    getShortcutFaviconPolicyRevision: () => 0,
    getShortcutFaviconDataUrl: () => '',
    getShortcutFaviconCandidateUrl: () => '',
    saveShortcutFaviconSnapshot: vi.fn(),
    resolveShortcutFaviconDataUrl: async () => '',
    loadShortcutFavicons: vi.fn(),
    pruneShortcutFavicons: vi.fn(),
    getFolderItemIconUrl: vi.fn(),
    getFolderItemIcon: vi.fn(),
    getFolderItemIconForShortcut: vi.fn(),
    updateFolderItemIcons: vi.fn(),
    getNextFolderItemIcon: vi.fn(),
    getShortcutDialogOnlineIconUrl: vi.fn(),
    getShortcutDialogBuiltinIconUrl: vi.fn(),
    getShortcutDialogOnlineIconSource: vi.fn(),
    isShortcutDialogIconSourceAvailable: vi.fn(),
    refreshShortcutDialogOnlineIcon: vi.fn()
  };
}

function createController() {
  const shortcutList = new ShortcutList();
  // A shortcut drag runs while `drag.active` is set.
  const drag = { active: false };
  const controller = createShortcutsController({
    settings: createSettingsStore({ chromeApi: createBrowserFake(), settings: [] }),
    shortcutFolderRuntime: { ready: Promise.resolve(), flush: async () => {}, getNode: vi.fn(), reconcile: vi.fn(), visibleItems: vi.fn() },
    shortcutLayoutAnimation: { change: (apply) => apply() },
    t: (_key, fallback) => fallback || '',
    hideShortcutTooltip: vi.fn(),
    closeShortcutContextMenu: vi.fn(),
    syncOpenBookmarkCascadeAnchorVisual: vi.fn(),
    applyNewtabShortcutsVisibility: vi.fn(),
    updateBookmarkSectionPosition: vi.fn(),
    applyNewtabShortcutLayoutPreferences: vi.fn(),
    applyNewtabShortcutDockMagnification: vi.fn(),
    inferNewtabShortcutColumnsFromWidth: () => 10,
    formatMessage: (_key, fallback) => fallback || '',
    resetShortcutDockHover: vi.fn(),
    pageStructureRuntime: { shortcut: { section: document.createElement('section'), grid: document.createElement('div') } },
    shortcutTiles: [],
    shortcutGroupHeaders: [],
    initFolderPathMorph: vi.fn(),
    getHostFromUrl: () => '',
    getImmediateThemeForSuggestion: vi.fn(),
    applyShortcutTileTheme: vi.fn(),
    queueThemeForTarget: vi.fn(),
    getTileThemeOnSiteChange: vi.fn(),
    attachFaviconWithFallbacks: vi.fn(),
    bindShortcutTooltip: vi.fn(),
    isMiddleClick: () => false,
    isCardActivationSuppressed: () => false,
    handleShortcutContextMenu: vi.fn(),
    handleShortcutNativeDragStart: vi.fn(),
    openShortcutAddDialog: vi.fn(),
    openShortcutGroupDialog: vi.fn(),
    openShortcutAddContextMenu: vi.fn(),
    handleShortcutDockPointerOver: vi.fn(),
    handleShortcutDockPointerMove: vi.fn(),
    syncShortcutDockFolderMenu: vi.fn(),
    handleShortcutGroupMenu: vi.fn(),
    shortcutList,
    dragSessions: {
      get shortcutDragging() {
        return drag.active;
      }
    },
    locale: { store: createStore<SurfaceLocaleState>({ mode: 'system', locale: 'en', messages: null }) },
    shortcutFavicons: createShortcutFavicons(),
    shortcutData: createShortcutData(shortcutList),
    openShortcutUrl: vi.fn()
  });
  controller.createShortcutsSection();
  view.renders = 0;
  return { controller, drag };
}

describe('drawing the shortcuts during a drag', () => {
  it('renders right away while no drag runs', () => {
    const { controller } = createController();

    controller.renderShortcuts();
    expect(view.renders).toBe(1);
  });

  it('holds renders while a shortcut drag runs and runs them once after it', () => {
    const { controller, drag } = createController();

    drag.active = true;
    controller.renderShortcuts();
    controller.renderShortcuts();
    expect(view.renders).toBe(0);
    // A flush during the drag still waits.
    controller.flushDeferredShortcutRender();
    expect(view.renders).toBe(0);

    drag.active = false;
    controller.flushDeferredShortcutRender();
    expect(view.renders).toBe(1);
    // Nothing is left to flush afterwards.
    controller.flushDeferredShortcutRender();
    expect(view.renders).toBe(1);
  });

  it('drops the held render when a render runs after the drag', () => {
    const { controller, drag } = createController();

    drag.active = true;
    controller.renderShortcuts();
    drag.active = false;
    controller.renderShortcuts();
    controller.flushDeferredShortcutRender();
    expect(view.renders).toBe(1);
  });
});
