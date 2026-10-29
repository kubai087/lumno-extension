// Wallpapers the user adds: imported files and URLs, link wallpapers,
// saving an online wallpaper locally, caching wallpaper images (including
// tomorrow's daily ones), the online wallpaper menu, and deleting.
import { isNode } from '../../../shared/dom-guards';
import type { ToastTask } from '../../../shared/ui/toast-screen';
import type { SelectMenuOption } from '../../../shared/react/select-menu/menu-options';
import type { WallpaperRecordInput } from '../../../shared/wallpaper-records';
import type { WallpaperImageCache } from '../../../shared/wallpaper-caches';
import * as LumnoNewtabDismissStack from '../../dismiss-stack';
import type { FormatMessage, ShowToast, Translate } from '../../newtab-types';
import type { RemoteContentClient } from '../../remote-content';
import type { RemoteWallpaper } from '../../remote-content-types';
import type { WallpaperSelection } from './wallpaper-selection';
import type { WallpaperSources } from './wallpaper-sources';
import type { WallpaperStorage } from './wallpaper-storage';
import type { WallpaperVisual } from './wallpaper-visual';
import type {
  CachedWallpaperImage,
  LinkWallpaperEntry,
  WallpaperMode
} from './wallpaper-runtime-types';
import { readBootValue } from '../../../platform/boot-handoff';
import { createSelectMenuController } from '../../react/select-menu';
import { newtabLinkWallpapers } from '../../../domain/settings/newtab-wallpaper';
import * as REMOTE_CONTENT from '../../remote-content';
import { NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE, NEWTAB_WALLPAPER_DEFAULT_ID, NEWTAB_WALLPAPER_MODES } from '../wallpaper-options';
import type { WallpaperPanelUi } from './panel-ui';
import { getWallpaperUrlName, isLinkWallpaperId, normalizeWallpaperUrl } from './wallpaper-library';
import type { WallpaperLibrary } from './wallpaper-library';
import type { WallpaperChoice } from './wallpaper-choice';
import type { WallpaperPanelView } from './panel-view';

type SelectMenuController = ReturnType<typeof createSelectMenuController>;

// The context menu online photos open to save them locally.
interface OnlineWallpaperMenu {
  controller: SelectMenuController;
  control: HTMLElement;
  menu: HTMLElement;
}

// The image parts of a built record or a cached copy.
type WallpaperImageRecord = Pick<WallpaperRecordInput, 'imageDataUrl' | 'thumbnailDataUrl' | 'sampleDataUrl' | 'width' | 'height'>;

type FetchRemoteContent = (url: string, init: RequestInit) => Promise<Response>;

interface CustomWallpapersDeps extends
  Pick<WallpaperStorage,
    'buildCustomWallpaperRecordFromFile' | 'writeCustomWallpaperRecord' | 'normalizeCustomWallpaperRecord' |
    'writeWallpaperPreloadCache' | 'writeSetting' | 'getWritableWallpaperPrefs' | 'setWallpaperPrefs' |
    'getWritableLocalWallpaperOverrides' | 'writeCurrentWallpaperPrefs' | 'deleteCustomWallpaperRecord' |
    'writeLocalWallpaperValue' | 'buildLocalWallpaperStorageValue' | 'getEffectiveWallpaperIdForMode'>,
  Pick<WallpaperSelection,
    'persistNewtabWallpaper' | 'mergeCustomWallpaperRecords' | 'applyResolvedNewtabWallpaper' | 'loadCustomWallpapers'>,
  Pick<WallpaperSources, 'getCachedWallpaperImage' | 'getWallpaperById' | 'getShownWallpaperCopy' | 'getCustomWallpaperById'>,
  Pick<WallpaperVisual, 'waitForDocumentLoad'> {
  showToast: ShowToast;
  formatMessage: FormatMessage;
  renderWallpaperPanelState(): void;
  // Shows a toast that follows a task to its end.
  beginToast(message: string): ToastTask;
  t: Translate;
  options: { fetchRemoteContent?: FetchRemoteContent };
  windowObj: Window & typeof globalThis;
  cachedWallpaperImages: Map<string, CachedWallpaperImage>;
  wallpaperImageCache: WallpaperImageCache | null;
  warnWallpaperStoreFailure(message: string): (error: unknown) => void;
  window: Window & typeof globalThis;
  dailyWallpaperStandIns: Map<string, CachedWallpaperImage>;
  hideTopActionTooltip(): void;
  remoteClient: Pick<RemoteContentClient, 'getWallpaper'>;
  document: Document;
  // The appearance panel's elements by data-wallpaper-ref name.
  getWallpaperPanelRefs(): Readonly<Partial<Record<string, HTMLElement>>>;
  panelUi: WallpaperPanelUi;
  library: WallpaperLibrary;
  choice: WallpaperChoice;
  panelView: WallpaperPanelView;
}

// The global timers with the DOM's numeric ids.
const globalTimers: Pick<Window, 'setTimeout' | 'clearTimeout'> = globalThis;

// Some hosts label images as generic binaries; these extensions then name the type.
const IMAGE_EXTENSION_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

// A copy read from the image cache or handed over by the preload, read as
// untrusted; null when it holds no image.
function readCachedWallpaperImage(value: unknown): CachedWallpaperImage | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id ||
      typeof value.imageDataUrl !== 'string' || !value.imageDataUrl) {
    return null;
  }
  return {
    id: value.id,
    url: typeof value.url === 'string' ? value.url : '',
    imageDataUrl: value.imageDataUrl,
    thumbnailDataUrl: typeof value.thumbnailDataUrl === 'string' ? value.thumbnailDataUrl : '',
    sampleDataUrl: typeof value.sampleDataUrl === 'string' ? value.sampleDataUrl : '',
    width: Number(value.width) || 0,
    height: Number(value.height) || 0,
    cachedAt: Number(value.cachedAt) || 0
  };
}

function createCustomWallpapers(deps: CustomWallpapersDeps) {
  const {
    panelView,
    choice,
    library,
    panelUi,
    showToast,
    formatMessage,
    renderWallpaperPanelState,
    beginToast,
    t,
    buildCustomWallpaperRecordFromFile,
    writeCustomWallpaperRecord,
    normalizeCustomWallpaperRecord,
    persistNewtabWallpaper,
    options,
    windowObj,
    getCachedWallpaperImage,
    cachedWallpaperImages,
    mergeCustomWallpaperRecords,
    wallpaperImageCache,
    warnWallpaperStoreFailure,
    applyResolvedNewtabWallpaper,
    getEffectiveWallpaperIdForMode,
    getWallpaperById,
    window,
    writeWallpaperPreloadCache,
    waitForDocumentLoad,
    getShownWallpaperCopy,
    dailyWallpaperStandIns,
    writeSetting,
    hideTopActionTooltip,
    getWritableWallpaperPrefs,
    setWallpaperPrefs,
    getWritableLocalWallpaperOverrides,
    writeCurrentWallpaperPrefs,
    remoteClient,
    loadCustomWallpapers,
    document,
    getWallpaperPanelRefs,
    getCustomWallpaperById,
    deleteCustomWallpaperRecord,
    writeLocalWallpaperValue,
    buildLocalWallpaperStorageValue
  } = deps;


  // Tomorrow's curated photo downloads once the page idles, or after this long at the latest.
  const UPCOMING_WALLPAPER_IDLE_TIMEOUT_MS = 30000;
  const wallpaperImageCaching = new Map<string, Promise<boolean>>();
  // The upcoming photos the page has scheduled to cache, so repeated applies do not queue them again.
  let upcomingWallpaperCacheKey = '';
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
      renderWallpaperPanelState();
      toastTask.done(t('newtab_wallpaper_import_done', 'Wallpaper imported'));
    }).catch(() => {
      toastTask.fail(t('newtab_wallpaper_import_error', 'Failed to import wallpaper'));
    }).finally(() => {
      panelUi.setImporting(false);
    });
  }

  // Some hosts label images as generic binaries; the file extension then names the type.
  function getCustomWallpaperUrlMimeType(url: string, type: string): string {
    const mime = String(type || '').split(';')[0].trim().toLowerCase();
    if (mime.startsWith('image/')) return mime === 'image/jpg' ? 'image/jpeg' : mime;
    const extension = (/\.([a-z0-9]{3,4})$/i.exec(new URL(url).pathname) || [])[1] || '';
    return IMAGE_EXTENSION_TYPES[extension.toLowerCase()] || mime;
  }

  async function fetchCustomWallpaperFile(url: string): Promise<File> {
    const fetcher: FetchRemoteContent = typeof options.fetchRemoteContent === 'function'
      ? options.fetchRemoteContent
      : windowObj.fetch.bind(windowObj);
    const controller = new AbortController();
    const timer = globalTimers.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetcher(url, {
        signal: controller.signal,
        credentials: 'omit',
        referrerPolicy: 'no-referrer'
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status}).`);
      }
      const blob = await response.blob();
      return new File([blob], getWallpaperUrlName(response.url || url), {
        type: getCustomWallpaperUrlMimeType(response.url || url, blob.type)
      });
    } finally {
      globalTimers.clearTimeout(timer);
    }
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
  // The preload already reads the shown photo's copy; take it instead of opening the cache again.
  function takePreloadedWallpaperImage(): Promise<void> {
    const wallpaperPreload = readBootValue('wallpaperPreload');
    const ready = wallpaperPreload && !wallpaperPreload.customImageId && wallpaperPreload.imageReady;
    if (!wallpaperPreload || !ready || typeof ready.then !== 'function') return Promise.resolve();
    wallpaperPreload.imageReady = null;
    return ready.then(() => {
      const record = readCachedWallpaperImage(wallpaperPreload.cachedImageRecord);
      if (record && !cachedWallpaperImages.has(record.id)) {
        cachedWallpaperImages.set(record.id, record);
      }
    }, () => {
      // The preload found no copy; the runtime reads the cache itself next.
    });
  }

  // Likewise for an upload: the preload read its record from the local wallpaper library.
  function takePreloadedCustomWallpaper(): Promise<void> {
    const wallpaperPreload = readBootValue('wallpaperPreload');
    const ready = wallpaperPreload && wallpaperPreload.customImageId && wallpaperPreload.imageReady;
    if (!wallpaperPreload || !ready || typeof ready.then !== 'function') return Promise.resolve();
    wallpaperPreload.imageReady = null;
    return ready.then(() => {
      const record = wallpaperPreload.cachedImageRecord;
      if (record) {
        mergeCustomWallpaperRecords([record]);
      }
    }, () => {
      // The preload found no record; the runtime reads the library itself next.
    });
  }

  function readCachedWallpaperImages(ids: string[]): Promise<void> {
    return takePreloadedWallpaperImage().then(() => readStoredCachedWallpaperImages(ids));
  }

  function readStoredCachedWallpaperImages(ids: string[]): Promise<void> {
    const missing = ids.filter((id) => !cachedWallpaperImages.has(id));
    if (!wallpaperImageCache || !missing.length) return Promise.resolve();
    return wallpaperImageCache.readByIds(missing).then((records) => {
      records.forEach((stored) => {
        const record = readCachedWallpaperImage(stored);
        if (record) cachedWallpaperImages.set(record.id, record);
      });
    }).catch(warnWallpaperStoreFailure('Could not read cached wallpaper images.'));
  }

  function rememberCachedWallpaperImage(id: string, url: string, record: WallpaperImageRecord): void {
    // The effects sample sampleDataUrl (or, for copies cached before it existed, the thumbnail), placed
    // by the copy's width and height.
    const image: CachedWallpaperImage = { id, url, imageDataUrl: record.imageDataUrl, thumbnailDataUrl: record.thumbnailDataUrl,
      sampleDataUrl: record.sampleDataUrl || '', width: record.width, height: record.height, cachedAt: Date.now() };
    cachedWallpaperImages.set(id, image);
    if (wallpaperImageCache) {
      wallpaperImageCache.write(image).catch(warnWallpaperStoreFailure('Could not cache a wallpaper image.'));
    }
  }

  // A link names a single image. Each device downloads it, or a curated photo or print, once and
  // keeps a downscaled copy, so new tabs skip the network and the wallpaper keeps showing if the
  // link later breaks.
  function cacheWallpaperImage(photoId: string, url: string | undefined): Promise<boolean> {
    if (getCachedWallpaperImage(photoId, url)) return Promise.resolve(true);
    const pending = wallpaperImageCaching.get(photoId);
    if (pending) return pending;
    if (!url) return Promise.resolve(false);
    const task = readCachedWallpaperImages([photoId]).then<CachedWallpaperImage | void>(() => getCachedWallpaperImage(photoId, url) ||
      fetchCustomWallpaperFile(url).then(buildCustomWallpaperRecordFromFile).then((record) => {
        rememberCachedWallpaperImage(photoId, url, record);
        pruneCachedWallpaperImages();
      }))
      .then(() => {
        const showing = NEWTAB_WALLPAPER_MODES.some((mode) => getEffectiveWallpaperPhotoId(mode) === photoId);
        if (showing) applyResolvedNewtabWallpaper();
        if (library.state.uploadsLoaded && isLinkWallpaperId(photoId)) renderWallpaperPanelState();
        return true;
      })
      .catch(() => false)
      .finally(() => wallpaperImageCaching.delete(photoId));
    wallpaperImageCaching.set(photoId, task);
    return task;
  }

  function cacheLinkWallpaper(id: string): Promise<boolean> {
    const entry = library.getLink(id);
    return entry ? cacheWallpaperImage(id, entry.url) : Promise.resolve(false);
  }

  // The photo a mode shows: the link itself, or the photo or print a curated or daily pick resolves to.
  function getEffectiveWallpaperPhotoId(mode: WallpaperMode): string {
    const id = getEffectiveWallpaperIdForMode(mode);
    if (isLinkWallpaperId(id)) return id;
    const item = id && REMOTE_CONTENT.wallpaperFromId(id) ? getWallpaperById(id) : null;
    return item && item.cacheImage ? item.dailyId || item.id : '';
  }

  function cacheShownWallpaperImages(): void {
    NEWTAB_WALLPAPER_MODES.forEach((mode) => {
      const id = getEffectiveWallpaperIdForMode(mode);
      if (isLinkWallpaperId(id)) {
        void cacheLinkWallpaper(id);
        return;
      }
      const item = id && REMOTE_CONTENT.wallpaperFromId(id) ? getWallpaperById(id) : null;
      if (item && item.cacheImage) void cacheWallpaperImage(item.dailyId || item.id, item.imageUrl);
    });
    scheduleUpcomingDailyWallpaperCache();
  }

  // Noon of the next local day, which stays on that date across a daylight-saving change.
  function getNextLocalDayTimestamp(timestamp: number): number {
    const date = new Date(timestamp);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 12).getTime();
  }

  // A curated daily slot follows the date alone, so tomorrow's photo is known today. Bing publishes
  // tomorrow's only tomorrow; its slot keeps today's copy until then.
  function getUpcomingDailyWallpaper(id: string): RemoteWallpaper | null {
    if (!REMOTE_CONTENT.isDailyWallpaperId(id) || id === REMOTE_CONTENT.BING_DAILY_ID) return null;
    const slot = REMOTE_CONTENT.wallpaperFromId(id);
    const pick = slot && REMOTE_CONTENT.getCuratedDailyWallpaper(slot.category || '',
      getNextLocalDayTimestamp(Date.now()));
    return pick && pick.cacheImage ? pick : null;
  }

  function getUpcomingDailyWallpapers(): RemoteWallpaper[] {
    const items: RemoteWallpaper[] = [];
    NEWTAB_WALLPAPER_MODES.forEach((mode) => {
      const item = getUpcomingDailyWallpaper(getEffectiveWallpaperIdForMode(mode));
      if (item && !items.some((existing) => existing.id === item.id)) items.push(item);
    });
    return items;
  }

  // Caches tomorrow's curated photo once the page is idle, so the first tab after midnight opens
  // on the new photo from this device's copy instead of waiting on Picsum. The copy is one more
  // download a day and, like every cached photo, stays on this device: sync and WebDAV never see it.
  function scheduleUpcomingDailyWallpaperCache(): void {
    const upcoming = getUpcomingDailyWallpapers()
      .filter((item) => !getCachedWallpaperImage(item.id, item.imageUrl));
    const key = upcoming.map((item) => item.id).join(' ');
    // Without idle callbacks the download could compete with the page, so it waits for the next tab.
    if (!key || key === upcomingWallpaperCacheKey || !wallpaperImageCache ||
        typeof window.requestIdleCallback !== 'function') {
      return;
    }
    upcomingWallpaperCacheKey = key;
    const cacheUpcoming = () => {
      // Today's copies go first, and open tabs take turns, so one tab downloads and the others
      // find its copy in IndexedDB.
      const task = () => Promise.all(upcoming.map((item) => cacheWallpaperImage(item.id, item.imageUrl)));
      const locks = window.navigator && window.navigator.locks;
      return Promise.all(Array.from(wallpaperImageCaching.values()))
        .then(async () => (locks && typeof locks.request === 'function'
          ? await locks.request('lumno-newtab-upcoming-wallpaper', task)
          : await task()))
        .then((results) => {
          if (results.every(Boolean)) {
            writeWallpaperPreloadCache();
          } else if (upcomingWallpaperCacheKey === key) {
            // Offline or the photo failed: the next apply or tab tries again.
            upcomingWallpaperCacheKey = '';
          }
        });
    };
    void waitForDocumentLoad().then(() => {
      window.requestIdleCallback(() => {
        cacheUpcoming().catch(() => {
          if (upcomingWallpaperCacheKey === key) upcomingWallpaperCacheKey = '';
        });
      }, { timeout: UPCOMING_WALLPAPER_IDLE_TIMEOUT_MS });
    });
  }

  // Saved links keep their copies; a curated photo or print stays only while a mode shows it, or
  // stands in for it, or is tomorrow's, so daily picks do not pile up one image per day.
  function pruneCachedWallpaperImages(): void {
    if (!wallpaperImageCache || !choice.state.loaded) return;
    const shownCopyIds = NEWTAB_WALLPAPER_MODES.map((mode) => {
      const id = getEffectiveWallpaperIdForMode(mode);
      const copy = id && REMOTE_CONTENT.wallpaperFromId(id) ? getShownWallpaperCopy(getWallpaperById(id)) : null;
      return copy ? copy.id : '';
    });
    const keep = new Set(library.state.links.map((item) => item.id)
      .concat(NEWTAB_WALLPAPER_MODES.map((mode) => getEffectiveWallpaperPhotoId(mode)), shownCopyIds,
        getUpcomingDailyWallpapers().map((item) => item.id)));
    // Narrowed here, for the callbacks below.
    const imageCache = wallpaperImageCache;
    imageCache.keys().then((keys) => keys.filter((key) => typeof key !== 'string' || !keep.has(key)).forEach((key) => {
      if (typeof key === 'string') {
        cachedWallpaperImages.delete(key);
        dailyWallpaperStandIns.forEach((copy, slotId) => {
          if (copy.id === key) dailyWallpaperStandIns.delete(slotId);
        });
      }
      imageCache.remove(key).catch(warnWallpaperStoreFailure('Could not prune a cached wallpaper image.'));
    })).catch(warnWallpaperStoreFailure('Could not list cached wallpaper images.'));
  }

  function cacheListedLinkWallpapers(): void {
    library.state.links.forEach((item) => { void cacheLinkWallpaper(item.id); });
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
    renderWallpaperPanelState();
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
        fetchCustomWallpaperFile(url).then(buildCustomWallpaperRecordFromFile)).then((record) => {
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
    void fetchCustomWallpaperFile(url).then(buildCustomWallpaperRecordFromFile).then((record) => {
      rememberCachedWallpaperImage(entry.id, url, record);
      writeLinkWallpapers(library.state.links.concat(entry));
      persistNewtabWallpaper(entry.id);
      renderWallpaperPanelState();
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
    const urlForm = getWallpaperPanelRefs().urlForm;
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
        renderWallpaperPanelState();
        writeLocalWallpaperValue(buildLocalWallpaperStorageValue(
          getWritableLocalWallpaperOverrides(),
          prefs.sameForModes
        ), { showError: true });
      } else {
        renderWallpaperPanelState();
      }
      showToast(t('newtab_wallpaper_delete_done', 'Deleted'), false);
    }).catch(() => {
      showToast(t('newtab_wallpaper_delete_error', 'Failed to delete wallpaper'), true);
    });
  }

  return {
    showLocalWallpaperLimitToast,
    importCustomWallpaperFile,
    fetchCustomWallpaperFile,
    setCustomWallpaperUrlFormOpen,
    takePreloadedCustomWallpaper,
    readCachedWallpaperImages,
    cacheShownWallpaperImages,
    getNextLocalDayTimestamp,
    getUpcomingDailyWallpaper,
    cacheListedLinkWallpapers,
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
