// Wallpapers the user adds: imported files and URLs, link wallpapers,
// saving an online wallpaper locally, the online wallpaper menu, and
// deleting.
import { isNode } from '../../../shared/dom-guards';
import type { ToastTask } from '../../../shared/ui/toast-screen';
import type { SelectMenuOption } from '../../../shared/react/select-menu/menu-options';
import type { WallpaperImageCache } from '../../../shared/wallpaper-caches';
import * as LumnoNewtabDismissStack from '../../dismiss-stack';
import type { FormatMessage, ShowToast, Translate } from '../../newtab-types';
import type { RemoteContentClient } from '../../remote-content';
import type { WallpaperSelection } from './wallpaper-selection';
import type { WallpaperSources } from './wallpaper-sources';
import type { WallpaperStorage } from './wallpaper-storage';
import type {
  CachedWallpaperImage,
  LinkWallpaperEntry
} from './wallpaper-runtime-types';
import { createSelectMenuController } from '../../react/select-menu';
import { newtabLinkWallpapers } from '../../../domain/settings/newtab-wallpaper';
import { NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE, NEWTAB_WALLPAPER_DEFAULT_ID, NEWTAB_WALLPAPER_MODES } from '../wallpaper-options';
import type { WallpaperPanelUi } from './panel-ui';
import { isLinkWallpaperId, normalizeWallpaperUrl } from './wallpaper-library';
import type { WallpaperLibrary } from './wallpaper-library';
import type { WallpaperPanelView } from './panel-view';
import type { WallpaperImageCopies, WallpaperImageRecord } from './wallpaper-image-copies';

type SelectMenuController = ReturnType<typeof createSelectMenuController>;

// The context menu online photos open to save them locally.
interface OnlineWallpaperMenu {
  controller: SelectMenuController;
  control: HTMLElement;
  menu: HTMLElement;
}

interface CustomWallpapersDeps extends
  Pick<WallpaperImageCopies, 'fetchWallpaperFile' | 'readCachedWallpaperImages' | 'rememberCachedWallpaperImage'>,
  Pick<WallpaperStorage, 'buildCustomWallpaperRecordFromFile' | 'writeCustomWallpaperRecord' | 'normalizeCustomWallpaperRecord' | 'writeSetting' | 'getWritableWallpaperPrefs' | 'setWallpaperPrefs' |
    'getWritableLocalWallpaperOverrides' | 'writeCurrentWallpaperPrefs' | 'deleteCustomWallpaperRecord' |
    'writeLocalWallpaperValue' | 'buildLocalWallpaperStorageValue'>,
  Pick<WallpaperSelection,
    'persistNewtabWallpaper' | 'applyResolvedNewtabWallpaper' | 'loadCustomWallpapers'>,
  Pick<WallpaperSources, 'getCachedWallpaperImage' | 'getCustomWallpaperById'> {
  showToast: ShowToast;
  formatMessage: FormatMessage;
  // Shows a toast that follows a task to its end.
  beginToast(message: string): ToastTask;
  t: Translate;
  windowObj: Window & typeof globalThis;
  cachedWallpaperImages: Map<string, CachedWallpaperImage>;
  wallpaperImageCache: WallpaperImageCache | null;
  warnWallpaperStoreFailure(message: string): (error: unknown) => void;
  hideTopActionTooltip(): void;
  remoteClient: Pick<RemoteContentClient, 'getWallpaper'>;
  document: Document;
  panelUi: WallpaperPanelUi;
  library: WallpaperLibrary;
  panelView: WallpaperPanelView;
}

function createCustomWallpapers(deps: CustomWallpapersDeps) {
  const {
    fetchWallpaperFile,
    readCachedWallpaperImages,
    rememberCachedWallpaperImage,
    panelView,
    library,
    panelUi,
    showToast,
    formatMessage,
    beginToast,
    t,
    buildCustomWallpaperRecordFromFile,
    writeCustomWallpaperRecord,
    normalizeCustomWallpaperRecord,
    persistNewtabWallpaper,
    windowObj,
    getCachedWallpaperImage,
    cachedWallpaperImages,
    wallpaperImageCache,
    warnWallpaperStoreFailure,
    applyResolvedNewtabWallpaper,
    writeSetting,
    hideTopActionTooltip,
    getWritableWallpaperPrefs,
    setWallpaperPrefs,
    getWritableLocalWallpaperOverrides,
    writeCurrentWallpaperPrefs,
    remoteClient,
    loadCustomWallpapers,
    document,
    getCustomWallpaperById,
    deleteCustomWallpaperRecord,
    writeLocalWallpaperValue,
    buildLocalWallpaperStorageValue
  } = deps;


  const LINK_WALLPAPER_URL_MAX_LENGTH = 2048;
  // chrome.storage.sync holds 8 KB per item; normalized URLs are ASCII, so length counts bytes.
  const LINK_WALLPAPERS_MAX_BYTES = 8000;
  // The online photo the save menu is open for.
  let onlineWallpaperMenu: OnlineWallpaperMenu | null = null;

  function showLocalWallpaperLimitToast(): void {
    showToast(formatMessage('newtab_wallpaper_local_limit',
      'You can keep up to {count} local wallpapers. Delete some and try again.',
      { count: library.limit }), true);
  }

  function importCustomWallpaperFile(file: File | null | undefined): void {
    if (!file || panelUi.state.importing) {
      return;
    }
    if (library.isFull()) {
      showLocalWallpaperLimitToast();
      return;
    }
    panelUi.setImporting(true);
    const toastTask = beginToast(t('newtab_wallpaper_importing', 'Importing wallpaper…'));
    void buildCustomWallpaperRecordFromFile(file).then((record) => {
      return writeCustomWallpaperRecord(record).then(() => record);
    }).then((record) => {
      const nextWallpaper = normalizeCustomWallpaperRecord(record);
      if (!nextWallpaper) {
        throw new Error('Invalid wallpaper record.');
      }
      library.setUploads(library.state.uploads.concat(nextWallpaper));
      persistNewtabWallpaper(nextWallpaper.id);
      toastTask.done(t('newtab_wallpaper_import_done', 'Wallpaper imported'));
    }).catch(() => {
      toastTask.fail(t('newtab_wallpaper_import_error', 'Failed to import wallpaper'));
    }).finally(() => {
      panelUi.setImporting(false);
    });
  }

  function setCustomWallpaperUrlFormOpen(open: unknown): void {
    const nextOpen = Boolean(open);
    if (panelUi.state.urlFormOpen !== nextOpen) {
      panelUi.setUrlFormOpen(nextOpen);
    }
    if (nextOpen && panelView.controller) {
      panelView.controller.focus('urlInput');
    }
  }
  function writeLinkWallpapers(list: LinkWallpaperEntry[]): void {
    library.setLinks(list);
    writeSetting(newtabLinkWallpapers, list, () => {
      showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
    });
  }

  // Deleting a link removes it from every synced device, like the other synced settings.
  function deleteLinkWallpaper(id: string): void {
    hideTopActionTooltip();
    // Read the selection while the link still resolves.
    const prefs = getWritableWallpaperPrefs();
    const selected = NEWTAB_WALLPAPER_MODES.filter((mode) => prefs[mode] === id);
    selected.forEach((mode) => { prefs[mode] = NEWTAB_WALLPAPER_DEFAULT_ID; });
    writeLinkWallpapers(library.state.links.filter((item) => item.id !== id));
    cachedWallpaperImages.delete(id);
    if (wallpaperImageCache) {
      wallpaperImageCache.remove(id).catch(warnWallpaperStoreFailure('Could not remove a cached link wallpaper.'));
    }
    if (selected.length) {
      setWallpaperPrefs(prefs, getWritableLocalWallpaperOverrides());
      applyResolvedNewtabWallpaper();
      writeCurrentWallpaperPrefs({ showError: true });
    }
    showToast(t('newtab_wallpaper_delete_done', 'Deleted'), false);
  }

  // A new synced link entry, or null after telling the user the link no longer fits sync storage.
  function createLinkWallpaperEntry(url: string): LinkWallpaperEntry | null {
    const entry: LinkWallpaperEntry = {
      id: `link-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      url,
      addedAt: Date.now()
    };
    if (url.length > LINK_WALLPAPER_URL_MAX_LENGTH ||
        JSON.stringify(library.state.links.concat(entry)).length > LINK_WALLPAPERS_MAX_BYTES) {
      showToast(t('newtab_wallpaper_url_limit',
        'This link is too long, or too many links are saved. Remove some and try again.'), true);
      return null;
    }
    return entry;
  }

  function getOnlineWallpaperUrl(id: string): string {
    const wallpaper = remoteClient.getWallpaper(id);
    return normalizeWallpaperUrl(wallpaper && wallpaper.imageUrl);
  }

  function isOnlineWallpaperSaved(id: string): boolean {
    const url = getOnlineWallpaperUrl(id);
    return Boolean(url) && Boolean(library.findLinkByUrl(url));
  }

  // A Bing or curated photo joins the local library as a link, so it syncs like one; the copy this
  // device already keeps for the photo becomes the link's copy.
  function saveOnlineWallpaperToLocal(id: string): void {
    const url = getOnlineWallpaperUrl(id);
    if (!url || panelUi.state.importing) {
      return;
    }
    panelUi.setImporting(true);
    let toastTask: ToastTask | null = null;
    void loadCustomWallpapers().then(() => {
      if (library.findLinkByUrl(url)) {
        showToast(t('newtab_wallpaper_in_local', 'Already in local wallpapers'), false);
        return null;
      }
      if (library.isFull()) {
        showLocalWallpaperLimitToast();
        return null;
      }
      const entry = createLinkWallpaperEntry(url);
      if (!entry) {
        return null;
      }
      const task = beginToast(t('newtab_wallpaper_saving_local', 'Saving to local wallpapers…'));
      toastTask = task;
      return readCachedWallpaperImages([id]).then((): WallpaperImageRecord | Promise<WallpaperImageRecord> =>
        getCachedWallpaperImage(id, url) ||
        fetchWallpaperFile(url).then(buildCustomWallpaperRecordFromFile)).then((record) => {
        rememberCachedWallpaperImage(entry.id, url, record);
        writeLinkWallpapers(library.state.links.concat(entry));
        task.done(t('newtab_wallpaper_saved_local', 'Saved to local wallpapers'));
      });
    }).catch(() => {
      if (toastTask) {
        toastTask.fail(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'));
      } else {
        showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
      }
    }).finally(() => {
      panelUi.setImporting(false);
    });
  }

  function isOnlineWallpaperMenuOpen(): boolean {
    return Boolean(onlineWallpaperMenu && onlineWallpaperMenu.controller.isOpen(onlineWallpaperMenu.control));
  }

  function isOnlineWallpaperMenuNode(node: Node | null | undefined): boolean {
    return Boolean(node && onlineWallpaperMenu &&
      (onlineWallpaperMenu.control.contains(node) || onlineWallpaperMenu.menu.contains(node)));
  }

  function closeOnlineWallpaperMenu(): boolean {
    const wasOpen = Boolean(panelUi.state.onlineMenuId);
    if (wasOpen) {
      panelUi.setOnlineMenuId('');
    }
    const menu = onlineWallpaperMenu;
    if (menu && menu.controller.isOpen(menu.control)) {
      menu.controller.setOpen(menu.control, false);
    }
    return wasOpen;
  }

  function getOnlineWallpaperMenuOptions(id: string): SelectMenuOption[] {
    const saved = isOnlineWallpaperSaved(id);
    return [{
      action: 'save-local',
      value: 'save-local',
      label: saved
        ? t('newtab_wallpaper_in_local', 'Already in local wallpapers')
        : t('newtab_wallpaper_save_to_local', 'Save to local wallpapers'),
      disabled: saved
    }];
  }

  function createOnlineWallpaperMenu(): OnlineWallpaperMenu | null {
    const controller = createSelectMenuController({
      documentObj: document,
      windowObj,
      onBeforeOpen: () => hideTopActionTooltip()
    });
    const created = controller.createSelect({
      id: '_x_extension_newtab_wallpaper_context_menu_2026_unique_',
      selectId: '_x_extension_newtab_wallpaper_context_menu_select_2026_unique_',
      className: 'x-nt-shortcut-context-menu',
      iconOnly: true,
      triggerIconName: 'ri-more-line',
      menuClassName: 'x-nt-shortcut-context-menu-portal',
      menuAlign: 'middle',
      menuWidth: 'content',
      menuMinWidth: 124,
      menuMaxWidth: 220,
      menuPortal: true,
      menuPortalZIndex: 10050,
      menuPortalOffset: -6,
      value: 'save-local',
      ariaLabel: t('newtab_wallpaper_context_menu_label', 'Wallpaper actions'),
      options: [],
      onAction(payload) {
        const targetId = panelUi.state.onlineMenuId;
        closeOnlineWallpaperMenu();
        if (targetId && payload && payload.action === 'save-local') {
          saveOnlineWallpaperToLocal(targetId);
        }
      }
    });
    if (!created) {
      return null;
    }
    created.trigger.tabIndex = -1;
    [created.wrapper, created.menu].forEach((element) => {
      element.addEventListener('contextmenu', (event) => event.preventDefault());
    });
    document.addEventListener('pointerdown', (event) => {
      if (panelUi.state.onlineMenuId && !isOnlineWallpaperMenuNode(isNode(event.target) ? event.target : null)) {
        closeOnlineWallpaperMenu();
      }
    }, true);
    LumnoNewtabDismissStack.getDismissStack().register('wallpaper-context-menu', {
      isOpen: () => Boolean(panelUi.state.onlineMenuId || isOnlineWallpaperMenuOpen()),
      close: () => closeOnlineWallpaperMenu()
    });
    (document.body || document.documentElement).appendChild(created.wrapper);
    return { controller, control: created.wrapper, menu: created.menu };
  }

  function openOnlineWallpaperMenu(id: string, element: HTMLElement | null | undefined, point: { x: number; y: number }): void {
    if (!getOnlineWallpaperUrl(id) || !element) {
      return;
    }
    if (!onlineWallpaperMenu) {
      onlineWallpaperMenu = createOnlineWallpaperMenu();
    }
    const menu = onlineWallpaperMenu;
    if (!menu) {
      return;
    }
    closeOnlineWallpaperMenu();
    hideTopActionTooltip();
    panelUi.setOnlineMenuId(id);
    menu.control.style.left = `${Math.round(point.x)}px`;
    menu.control.style.top = `${Math.round(point.y)}px`;
    menu.controller.setOptions(menu.control, getOnlineWallpaperMenuOptions(id), 'save-local');
    menu.controller.setOpen(menu.control, true);
  }

  function finishCustomWallpaperUrlEntry(): void {
    panelUi.clearUrl();
    setCustomWallpaperUrlFormOpen(false);
  }

  function focusPanelElement(name: string): void {
    panelView.focus(name);
  }

  function submitCustomWallpaperUrl(value: unknown): void {
    const url = normalizeWallpaperUrl(value);
    if (!url) {
      panelUi.setUrlInvalid(true);
      showToast(t('newtab_wallpaper_url_invalid', 'Enter a link that starts with http:// or https://'), true);
      focusPanelElement('urlInput');
      return;
    }
    if (panelUi.state.urlInvalid) {
      panelUi.setUrlInvalid(false);
    }
    const existing = library.findLinkByUrl(url);
    if (existing) {
      persistNewtabWallpaper(existing.id);
      finishCustomWallpaperUrlEntry();
      return;
    }
    if (library.isFull()) {
      showLocalWallpaperLimitToast();
      return;
    }
    const entry = createLinkWallpaperEntry(url);
    if (!entry) {
      return;
    }
    panelUi.setImporting(true);
    const toastTask = beginToast(t('newtab_wallpaper_importing', 'Importing wallpaper…'));
    // Load the image before saving the link, so a broken link never reaches other devices.
    void fetchWallpaperFile(url).then(buildCustomWallpaperRecordFromFile).then((record) => {
      rememberCachedWallpaperImage(entry.id, url, record);
      writeLinkWallpapers(library.state.links.concat(entry));
      persistNewtabWallpaper(entry.id);
      finishCustomWallpaperUrlEntry();
      toastTask.done(t('newtab_wallpaper_import_done', 'Wallpaper imported'));
    }).catch(() => {
      toastTask.fail(t('newtab_wallpaper_url_import_error', 'Could not add an image from this link'));
      if (panelUi.state.urlFormOpen) focusPanelElement('urlInput');
    }).finally(() => {
      panelUi.setImporting(false);
    });
  }

  function closeCustomWallpaperUrlForm(): boolean {
    if (!panelUi.state.urlFormOpen || panelUi.state.tab !== 'local') {
      return false;
    }
    const urlForm = panelView.getRefs().urlForm;
    const hadFocus = Boolean(urlForm && urlForm.contains(document.activeElement));
    setCustomWallpaperUrlFormOpen(false);
    if (hadFocus) focusPanelElement('urlTile');
    return true;
  }
  function deleteCustomWallpaper(id: string): void {
    if (isLinkWallpaperId(id)) {
      deleteLinkWallpaper(id);
      return;
    }
    const targetWallpaper = getCustomWallpaperById(id);
    if (!targetWallpaper || panelUi.state.importing) {
      return;
    }
    hideTopActionTooltip();
    void deleteCustomWallpaperRecord(targetWallpaper).then(() => {
      library.setUploads(library.state.uploads.filter((item) => item && item.id !== targetWallpaper.id));
      const overrides = getWritableLocalWallpaperOverrides();
      let changed = false;
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        if (overrides[mode] !== targetWallpaper.id) {
          return;
        }
        overrides[mode] = NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE;
        changed = true;
      });
      if (changed) {
        const prefs = getWritableWallpaperPrefs();
        setWallpaperPrefs(prefs, overrides);
        applyResolvedNewtabWallpaper();
        writeLocalWallpaperValue(buildLocalWallpaperStorageValue(
          getWritableLocalWallpaperOverrides(),
          prefs.sameForModes
        ), { showError: true });
      }
      showToast(t('newtab_wallpaper_delete_done', 'Deleted'), false);
    }).catch(() => {
      showToast(t('newtab_wallpaper_delete_error', 'Failed to delete wallpaper'), true);
    });
  }

  return {
    showLocalWallpaperLimitToast,
    importCustomWallpaperFile,
    setCustomWallpaperUrlFormOpen,
    isOnlineWallpaperMenuNode,
    closeOnlineWallpaperMenu,
    openOnlineWallpaperMenu,
    submitCustomWallpaperUrl,
    closeCustomWallpaperUrlForm,
    deleteCustomWallpaper
  };
}

type CustomWallpapers = ReturnType<typeof createCustomWallpapers>;

export { createCustomWallpapers };
export type { CustomWallpapers, CustomWallpapersDeps };
