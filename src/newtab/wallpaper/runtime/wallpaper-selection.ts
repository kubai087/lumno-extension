// Choosing a wallpaper: loading custom wallpapers, applying the stored
// or picked wallpaper once it is ready, and saving the choice and whether
// wallpapers are on, per mode.
import type { WallpaperRecord } from '../../../shared/wallpaper-records';
import type { RemoteContentClient } from '../../remote-content';
import type { WallpaperEffectPrefsRuntime } from './wallpaper-effect-prefs';
import type { WallpaperSources } from './wallpaper-sources';
import type { StoredValue, WallpaperStorage } from './wallpaper-storage';
import type { WallpaperVisual } from './wallpaper-visual';
import { newtabCuratedMixExcluded, newtabDailyWallpaperPicks, newtabLinkWallpapers, newtabLocalWallpaper, newtabOnlineWallpaper, newtabWallpaper, newtabWallpaperEffect } from '../../../domain/settings/newtab-wallpaper';
import type { SettingsStore } from '../../../platform/settings-store';
import * as REMOTE_CONTENT from '../../remote-content';
import { NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE, NEWTAB_WALLPAPER_DEFAULT_ID, NEWTAB_WALLPAPER_MODES } from '../wallpaper-options';
import type {
  CachedWallpaperImage,
  WallpaperItem,
  WallpaperMode
} from './wallpaper-runtime-types';
import { newtabWallpaperPreload } from '../../../domain/settings/newtab-wallpaper';
import type { OnlineWallpapers } from './online-wallpapers';
import { isLinkWallpaperId } from './wallpaper-library';
import type { WallpaperLibrary } from './wallpaper-library';
import type { WallpaperChoice } from './wallpaper-choice';
import type { InitialWallpaper } from './initial-wallpaper';

interface WallpaperSelectionDeps extends
  Pick<WallpaperSources,
    'getWallpaperById' | 'getWallpaperImageUrl' | 'normalizeNewtabWallpaperId' | 'normalizeWallpaperMode' |
    'getDisplayedWallpaperImageUrl' | 'getCachedWallpaperImage' | 'isCustomWallpaperId'>,
  Pick<WallpaperStorage,
    'readCustomWallpaperRecords' | 'normalizeCustomWallpaperRecord' | 'getResolvedWallpaperMode' |
    'writeWallpaperPreloadCache' | 'getEffectiveWallpaperIdForMode' | 'resolveSyncedWallpaperValue' |
    'resolveLocalWallpaperOverride' | 'applyLocalWallpaperMigrations' | 'setWallpaperPrefs' |
    'writeSyncedWallpaperValue' | 'getWallpaperStorageRawIds' | 'isOnlineWallpaperId' | 'writeLocalWallpaperValue' |
    'buildLocalWallpaperStorageValue' | 'readStoredSetting' | 'mergeOnlineWallpaperValue' |
    'getStoredCustomWallpaperIds' | 'hasLoadedStoredCustomWallpaper' | 'readCustomWallpaperRecordsByIds' |
    'getWritableWallpaperPrefs' | 'getWritableLocalWallpaperOverrides' | 'writeCurrentWallpaperPrefs' |
    'getWallpaperModePreferenceOrder' | 'hasAnyWallpaperEnabled' | 'getFirstEnabledWallpaperIdForModes' |
    'getCopyableWallpaperLocalOverrideForId' | 'getWallpaperEditMode' | 'getWallpaperLocalOverrideForMode'>,
  Pick<WallpaperVisual,
    'waitForWallpaperImageReady' | 'applyWallpaperVisualState' | 'scheduleWallpaperVisualRefresh' |
    'createWallpaperTransitionLayer' | 'releaseWallpaperTransitionLayer'>,
  Pick<WallpaperEffectPrefsRuntime,
    'synchronizeWallpaperEffectPrefsWithWallpaperModes' | 'applyWallpaperEffectForResolvedMode' |
    'getWallpaperEffectStorageValue' | 'getWallpaperEffectPrefsForEditMode' | 'setSharedWallpaperEffectPrefs' |
    'getWallpaperEffectPrefsForMode'> {
  // Reads this device's copies of these network images into the cache map.
  readCachedWallpaperImages(ids: string[]): Promise<void>;
  renderWallpaperPanelState(): void;
  // Starts caching every link wallpaper's image on this device.
  cacheListedLinkWallpapers(): void;
  refreshWallpaperAdaptiveSampler(): void;
  // Starts caching the images the modes show, and tomorrow's daily photos.
  cacheShownWallpaperImages(): void;
  bindWallpaperPageShownListeners(): void;
  // Shows the source tab of the wallpaper the edited mode uses.
  syncWallpaperSourceTabToEditMode(): void;
  settings: Pick<SettingsStore, 'getStored' | 'include' | 'set'>;
  // Adds the upload the preload already read, if any, to the loaded ones.
  takePreloadedCustomWallpaper(): Promise<void>;
  warnWallpaperStoreFailure(message: string): (error: unknown) => void;
  remoteClient: Pick<RemoteContentClient, 'restoreWallpaper' | 'setPinnedIds' | 'ensureWallpaper'>;
  dailyWallpaperStandIns: Map<string, CachedWallpaperImage>;
  window: Window;
  online: OnlineWallpapers;
  library: WallpaperLibrary;
  choice: WallpaperChoice;
  initialWallpaper: InitialWallpaper;
  beginVisualChange(): number;
  isLatestVisualChange(seq: number): boolean;
  getAppliedVisual(): { url: string; active: boolean };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function createWallpaperSelection(deps: WallpaperSelectionDeps) {
  const {
    initialWallpaper,
    beginVisualChange,
    isLatestVisualChange,
    getAppliedVisual,
    choice,
    library,
    online,
    settings,
    getWallpaperById,
    waitForWallpaperImageReady,
    getWallpaperImageUrl,
    readCachedWallpaperImages,
    readCustomWallpaperRecords,
    renderWallpaperPanelState,
    cacheListedLinkWallpapers,
    normalizeCustomWallpaperRecord,
    normalizeNewtabWallpaperId,
    normalizeWallpaperMode,
    getResolvedWallpaperMode,
    writeWallpaperPreloadCache,
    applyWallpaperVisualState,
    refreshWallpaperAdaptiveSampler,
    scheduleWallpaperVisualRefresh,
    getDisplayedWallpaperImageUrl,
    createWallpaperTransitionLayer,
    releaseWallpaperTransitionLayer,
    getEffectiveWallpaperIdForMode,
    cacheShownWallpaperImages,
    resolveSyncedWallpaperValue,
    resolveLocalWallpaperOverride,
    applyLocalWallpaperMigrations,
    setWallpaperPrefs,
    bindWallpaperPageShownListeners,
    synchronizeWallpaperEffectPrefsWithWallpaperModes,
    applyWallpaperEffectForResolvedMode,
    syncWallpaperSourceTabToEditMode,
    writeSyncedWallpaperValue,
    getWallpaperStorageRawIds,
    isOnlineWallpaperId,
    writeLocalWallpaperValue,
    buildLocalWallpaperStorageValue,
    getWallpaperEffectStorageValue,
    readStoredSetting,
    mergeOnlineWallpaperValue,
    takePreloadedCustomWallpaper,
    getStoredCustomWallpaperIds,
    hasLoadedStoredCustomWallpaper,
    readCustomWallpaperRecordsByIds,
    warnWallpaperStoreFailure,
    remoteClient,
    getCachedWallpaperImage,
    dailyWallpaperStandIns,
    window,
    getWritableWallpaperPrefs,
    getWritableLocalWallpaperOverrides,
    writeCurrentWallpaperPrefs,
    isCustomWallpaperId,
    getWallpaperEffectPrefsForEditMode,
    getWallpaperModePreferenceOrder,
    hasAnyWallpaperEnabled,
    getFirstEnabledWallpaperIdForModes,
    getCopyableWallpaperLocalOverrideForId,
    setSharedWallpaperEffectPrefs,
    getWallpaperEditMode,
    getWallpaperEffectPrefsForMode,
    getWallpaperLocalOverrideForMode
  } = deps;


  let hasWallpaperBootstrapStarted = false;
  let customWallpaperCatalogPromise: Promise<WallpaperRecord[]> | null = null;
  let lastActiveWallpaperId = '';
  const lastActiveWallpaperIdsByMode: Record<WallpaperMode, string> = {
    light: '',
    dark: ''
  };
  function primeWallpaperImage(id: unknown): Promise<void> {
    const wallpaper = getWallpaperById(id);
    return waitForWallpaperImageReady(wallpaper ? getWallpaperImageUrl(wallpaper) : '');
  }
  function loadCustomWallpapers(): Promise<WallpaperRecord[]> {
    if (library.state.uploadsLoaded) {
      return Promise.resolve(library.state.uploads);
    }
    if (customWallpaperCatalogPromise) {
      return customWallpaperCatalogPromise;
    }
    const linkImagesTask = readCachedWallpaperImages(library.state.links.map((item) => item.id));
    customWallpaperCatalogPromise = readCustomWallpaperRecords().then((records) => {
      const showRecords = () => {
        library.uploadsRead(records);
        return records;
      };
      // Wait for cached link images so the tiles do not load full images from the links first.
      return library.state.links.length ? linkImagesTask.then(showRecords) : showRecords();
    }).catch(() => {
      renderWallpaperPanelState();
      return library.state.uploads;
    }).finally(() => {
      customWallpaperCatalogPromise = null;
      cacheListedLinkWallpapers();
    });
    return customWallpaperCatalogPromise;
  }

  function refreshCustomWallpapers(): Promise<WallpaperRecord[]> {
    library.invalidateUploads();
    return loadCustomWallpapers();
  }

  function mergeCustomWallpaperRecords(records: readonly unknown[] | null | undefined): WallpaperRecord[] {
    const recordsById = new Map<string, WallpaperRecord>();
    library.state.uploads.forEach((record) => {
      if (record && record.id) {
        recordsById.set(record.id, record);
      }
    });
    (records || []).forEach((record) => {
      const normalized = normalizeCustomWallpaperRecord(record);
      if (normalized) {
        recordsById.set(normalized.id, normalized);
      }
    });
    library.setUploads(Array.from(recordsById.values()).sort((a, b) => a.updatedAt - b.updatedAt));
    return library.state.uploads;
  }

  function rememberActiveWallpaperId(mode: unknown, id: unknown): void {
    const nextId = normalizeNewtabWallpaperId(id);
    if (!nextId) {
      return;
    }
    const normalizedMode = normalizeWallpaperMode(mode);
    lastActiveWallpaperId = nextId;
    lastActiveWallpaperIdsByMode[normalizedMode] = nextId;
    if (choice.state.prefs && choice.state.prefs.sameForModes) {
      NEWTAB_WALLPAPER_MODES.forEach((item) => {
        lastActiveWallpaperIdsByMode[item] = nextId;
      });
    }
  }

  function applyNewtabWallpaper(value: unknown, options?: { mode?: WallpaperMode } | null): void {
    const config = options || {};
    const mode = normalizeWallpaperMode(config.mode || getResolvedWallpaperMode());
    const nextId = normalizeNewtabWallpaperId(value);
    const wallpaper = getWallpaperById(nextId);
    const imageUrl = wallpaper ? getWallpaperImageUrl(wallpaper) : '';
    const isInitialWallpaperApply = !initialWallpaper.applied;
    const visualSeq = beginVisualChange();
    choice.setShownId(wallpaper ? wallpaper.id : '');
    if (choice.state.shownId) {
      rememberActiveWallpaperId(mode, choice.state.shownId);
    }
    writeWallpaperPreloadCache();
    renderWallpaperPanelState();
    if (isInitialWallpaperApply) {
      applyWallpaperVisualState(wallpaper);
      refreshWallpaperAdaptiveSampler();
      scheduleWallpaperVisualRefresh(visualSeq);
      initialWallpaper.finish();
      if (getAppliedVisual().url !== imageUrl) {
        showWallpaperWhenReady(wallpaper, imageUrl, visualSeq);
      }
      return;
    }
    initialWallpaper.finish();
    showWallpaperWhenReady(wallpaper, imageUrl, visualSeq);
  }

  // Keeps the current wallpaper until the next one has loaded, or until its fallback is ready.
  function showWallpaperWhenReady(wallpaper: WallpaperItem | null, imageUrl: string, visualSeq: number): void {
    void waitForWallpaperImageReady(imageUrl).then(() => {
      return waitForWallpaperImageReady(wallpaper ? getDisplayedWallpaperImageUrl(wallpaper) : '');
    }).then(() => {
      if (!isLatestVisualChange(visualSeq)) {
        return;
      }
      const displayedUrl = wallpaper ? getDisplayedWallpaperImageUrl(wallpaper) : '';
      const applied = getAppliedVisual();
      const shouldAnimateVisualChange = displayedUrl !== applied.url || Boolean(wallpaper) !== applied.active;
      const transitionLayer = shouldAnimateVisualChange ? createWallpaperTransitionLayer() : null;
      applyWallpaperVisualState(wallpaper);
      releaseWallpaperTransitionLayer(transitionLayer);
      scheduleWallpaperVisualRefresh(visualSeq);
    });
  }

  function applyResolvedNewtabWallpaper(options?: { mode?: WallpaperMode } | null): void {
    const mode = getResolvedWallpaperMode();
    applyNewtabWallpaper(getEffectiveWallpaperIdForMode(mode), { ...options, mode });
    if (choice.state.loaded) cacheShownWallpaperImages();
  }

  function applyStoredWallpaperState(syncedValue: StoredValue, localValue: StoredValue): void {
    const syncedResolution = resolveSyncedWallpaperValue(syncedValue.value, syncedValue.hasValue);
    const localResolution = resolveLocalWallpaperOverride(localValue.value, localValue.hasValue);
    const migrated = applyLocalWallpaperMigrations(
      localResolution.overrides,
      syncedResolution.localMigrations
    );
    setWallpaperPrefs(syncedResolution.prefs, migrated.overrides);
    choice.markLoaded();
    bindWallpaperPageShownListeners();
    choice.setEditMode(syncedResolution.prefs.sameForModes
      ? getResolvedWallpaperMode()
      : normalizeWallpaperMode(choice.state.editMode));
    const didSyncWallpaperEffects = synchronizeWallpaperEffectPrefsWithWallpaperModes();
    applyWallpaperEffectForResolvedMode();
    applyResolvedNewtabWallpaper();
    syncWallpaperSourceTabToEditMode();
    renderWallpaperPanelState();
    if (syncedResolution.sanitizedValue !== null) {
      writeSyncedWallpaperValue(syncedResolution.sanitizedValue);
    } else if (!syncedValue.fromOnlineKey && getWallpaperStorageRawIds(syncedValue.value).some(isOnlineWallpaperId)) {
      // Move online picks saved under the shared key before older versions can clear them.
      writeSyncedWallpaperValue(syncedValue.value);
    }
    if (localResolution.shouldClear || migrated.changed) {
      writeLocalWallpaperValue(buildLocalWallpaperStorageValue(
        choice.state.overrides,
        syncedResolution.prefs.sameForModes
      ));
    }
    if (didSyncWallpaperEffects) {
      void settings.set(newtabWallpaperEffect, getWallpaperEffectStorageValue());
    }
  }

  function loadStoredWallpaperState(options?: { shouldApply?: () => boolean } | null): Promise<boolean> {
    const config = options || {};
    const changeSeq = choice.storageChange;
    return Promise.all([
      readStoredSetting(newtabWallpaper),
      readStoredSetting(newtabLocalWallpaper),
      readStoredSetting(newtabOnlineWallpaper),
      readStoredSetting(newtabLinkWallpapers),
      readStoredSetting(newtabDailyWallpaperPicks),
      readStoredSetting(newtabCuratedMixExcluded)
    ]).then((stored) => {
      online.restoreDailyPicks(stored[4].value);
      // Before any photo resolves: the random daily photo and the mix's pages follow it.
      REMOTE_CONTENT.setRandomMixExcluded(stored[5].value);
      const results = [mergeOnlineWallpaperValue(stored[0], stored[2]), stored[1]];
      const linksChanged = library.restoreLinks(stored[3].value);
      const linkIds = getWallpaperStorageRawIds(results[0].value).filter(isLinkWallpaperId);
      const customWallpaperPromise = takePreloadedCustomWallpaper().then(() => {
        const customWallpaperIds = getStoredCustomWallpaperIds(results)
          .filter((id) => !hasLoadedStoredCustomWallpaper(id));
        return customWallpaperIds.length > 0
          ? readCustomWallpaperRecordsByIds(customWallpaperIds).then((records) => {
            mergeCustomWallpaperRecords(records);
          })
          : null;
      }).catch(warnWallpaperStoreFailure('Could not read local wallpapers; showing the default.'));
      const remoteIds = getWallpaperStorageRawIds(results[0].value)
        .map((id) => normalizeNewtabWallpaperId(id))
        .filter((id) => REMOTE_CONTENT.wallpaperFromId(id));
      // Picks are dated Bing photos or bundled ones; restore them like any chosen photo.
      const pickIds = remoteIds.map((id) => online.getDailyPick(id)).filter(Boolean);
      const preloadedDailyCopies = readPreloadedDailyWallpaperCopies();
      // Read cached copies only once photos are restored: the daily Bing photo resolves from storage.
      const cachedImagesTask = Promise.all(remoteIds.concat(pickIds).map((id) => remoteClient.restoreWallpaper(id)))
        .then(() => readCachedWallpaperImages(linkIds.concat(remoteIds.map((id) => getWallpaperById(id))
          .filter((item): item is WallpaperItem => Boolean(item && item.cacheImage)).map((item) => item.dailyId || item.id))
          .concat(Array.from(preloadedDailyCopies.values()).map((image) => image.id))))
        .then(() => preloadedDailyCopies.forEach((image, slotId) => {
          const copy = getCachedWallpaperImage(image.id, image.url);
          if (copy && !dailyWallpaperStandIns.has(slotId)) dailyWallpaperStandIns.set(slotId, copy);
        }));
      return Promise.all([customWallpaperPromise, cachedImagesTask]).then(() => {
        if (!choice.isLatestStorageChange(changeSeq) ||
            typeof config.shouldApply === 'function' && !config.shouldApply()) {
          return false;
        }
        applyStoredWallpaperState(results[0], results[1]);
        cacheShownWallpaperImages();
        if (linksChanged && library.state.uploadsLoaded) {
          renderWallpaperPanelState();
          cacheListedLinkWallpapers();
        }
        remoteClient.setPinnedIds(remoteIds);
        if (remoteIds.includes(REMOTE_CONTENT.BING_DAILY_ID)) {
          void remoteClient.ensureWallpaper(REMOTE_CONTENT.BING_DAILY_ID).then(() => {
            if (getEffectiveWallpaperIdForMode(getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
              applyResolvedNewtabWallpaper();
            }
            renderWallpaperPanelState();
          }).catch(() => {
            // Offline or Bing is down: the built-in stand-in stays until the next visit.
          });
        }
        return true;
      });
    });
  }

  // The copy the preload painted for each daily slot (see wallpaper-preload.ts), which stands in
  // until the slot's photo of the day has its own copy, so the first frame and the runtime agree.
  function readPreloadedDailyWallpaperCopies(): Map<string, { id: string; url: string }> {
    const copies = new Map<string, { id: string; url: string }>();
    try {
      const data: unknown = JSON.parse(window.localStorage.getItem(newtabWallpaperPreload.key) || 'null');
      const wallpapers = isRecord(data) && isRecord(data.wallpapers) ? data.wallpapers : {};
      const today = REMOTE_CONTENT.localDay(Date.now());
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        const entry = wallpapers[mode];
        if (!isRecord(entry) || typeof entry.id !== 'string' || !REMOTE_CONTENT.isDailyWallpaperId(entry.id)) return;
        const next = isRecord(entry.next) ? entry.next : null;
        const image = next && next.day === today ? next.cachedImage : entry.cachedImage;
        if (isRecord(image) && typeof image.id === 'string' && typeof image.url === 'string') {
          copies.set(entry.id, { id: image.id, url: image.url });
        }
      });
    } catch {
      // Only a head start; a slot without a stand-in shows its photo once cached.
    }
    return copies;
  }

  function bootstrapInitialWallpaper(): Promise<void> {
    if (hasWallpaperBootstrapStarted) {
      return initialWallpaper.ready;
    }
    hasWallpaperBootstrapStarted = true;
    void loadStoredWallpaperState();
    return initialWallpaper.ready;
  }

  function normalizeWallpaperRestoreId(mode: unknown): string {
    const normalizedMode = normalizeWallpaperMode(mode);
    return normalizeNewtabWallpaperId(lastActiveWallpaperIdsByMode[normalizedMode]) ||
      normalizeNewtabWallpaperId(lastActiveWallpaperId) ||
      NEWTAB_WALLPAPER_DEFAULT_ID;
  }

  function persistWallpaperEnabled(enabled: boolean): void {
    online.dropSelections();
    choice.beginStorageChange();
    const prefs = getWritableWallpaperPrefs();
    const overrides = getWritableLocalWallpaperOverrides();
    if (enabled) {
      NEWTAB_WALLPAPER_MODES.forEach((mode) => {
        if (getEffectiveWallpaperIdForMode(mode)) {
          return;
        }
        overrides[mode] = null;
        prefs[mode] = normalizeWallpaperRestoreId(mode);
      });
      if (prefs.sameForModes) {
        const sharedId = prefs.light || prefs.dark || normalizeWallpaperRestoreId(getResolvedWallpaperMode());
        prefs.light = sharedId;
        prefs.dark = sharedId;
        overrides.dark = overrides.light;
      }
      setWallpaperPrefs(prefs, overrides);
      applyResolvedNewtabWallpaper();
      syncWallpaperSourceTabToEditMode();
      renderWallpaperPanelState();
      writeCurrentWallpaperPrefs({ showError: true });
      return;
    }
    NEWTAB_WALLPAPER_MODES.forEach((mode) => {
      const activeId = getEffectiveWallpaperIdForMode(mode);
      if (activeId) {
        rememberActiveWallpaperId(mode, activeId);
      }
      if (activeId && isCustomWallpaperId(activeId)) {
        overrides[mode] = NEWTAB_LOCAL_WALLPAPER_DISABLED_VALUE;
        return;
      }
      overrides[mode] = null;
      prefs[mode] = '';
    });
    if (prefs.sameForModes) {
      prefs.dark = prefs.light;
      overrides.dark = overrides.light;
    }
    setWallpaperPrefs(prefs, overrides);
    applyResolvedNewtabWallpaper();
    syncWallpaperSourceTabToEditMode();
    renderWallpaperPanelState();
    writeCurrentWallpaperPrefs({ showError: true });
  }

  function persistWallpaperModeConsistency(sameForModes: unknown): void {
    const nextSameForModes = sameForModes !== false;
    const prefs = getWritableWallpaperPrefs();
    const overrides = getWritableLocalWallpaperOverrides();
    if (prefs.sameForModes === nextSameForModes) {
      renderWallpaperPanelState();
      return;
    }
    if (!nextSameForModes) {
      const sharedEffectPrefs = getWallpaperEffectPrefsForEditMode();
      const modeOrder = getWallpaperModePreferenceOrder();
      const sharedId = hasAnyWallpaperEnabled()
        ? getFirstEnabledWallpaperIdForModes(modeOrder)
        : '';
      const sharedOverride = getCopyableWallpaperLocalOverrideForId(modeOrder, sharedId);
      prefs.sameForModes = false;
      prefs.light = sharedOverride
        ? (prefs.light || NEWTAB_WALLPAPER_DEFAULT_ID)
        : sharedId;
      prefs.dark = prefs.light;
      if (sharedOverride) {
        overrides.light = sharedOverride;
        overrides.dark = sharedOverride;
      } else {
        overrides.light = null;
        overrides.dark = null;
      }
      choice.setEditMode(getResolvedWallpaperMode());
      setSharedWallpaperEffectPrefs(sharedEffectPrefs);
    } else {
      const sharedMode = getWallpaperEditMode();
      const sharedEffectPrefs = getWallpaperEffectPrefsForMode(sharedMode);
      const sharedId = getEffectiveWallpaperIdForMode(sharedMode);
      const sharedOverride = getWallpaperLocalOverrideForMode(sharedMode);
      prefs.sameForModes = true;
      prefs.light = sharedOverride && isCustomWallpaperId(sharedOverride)
        ? (prefs[sharedMode] || NEWTAB_WALLPAPER_DEFAULT_ID)
        : sharedId;
      prefs.dark = prefs.light;
      overrides.light = sharedOverride || null;
      overrides.dark = overrides.light;
      choice.setEditMode(getResolvedWallpaperMode());
      setSharedWallpaperEffectPrefs(sharedEffectPrefs);
    }
    setWallpaperPrefs(prefs, overrides);
    applyWallpaperEffectForResolvedMode();
    applyResolvedNewtabWallpaper();
    syncWallpaperSourceTabToEditMode();
    renderWallpaperPanelState();
    writeCurrentWallpaperPrefs({ showError: true });
    void settings.set(newtabWallpaperEffect, getWallpaperEffectStorageValue());
  }

  function persistNewtabWallpaper(id: unknown): void {
    online.dropSelections();
    choice.beginStorageChange();
    const nextId = normalizeNewtabWallpaperId(id);
    const prefs = getWritableWallpaperPrefs();
    const overrides = getWritableLocalWallpaperOverrides();
    const targetModes = prefs.sameForModes
      ? NEWTAB_WALLPAPER_MODES.slice()
      : [getWallpaperEditMode()];
    targetModes.forEach((mode) => {
      if (nextId && isCustomWallpaperId(nextId)) {
        overrides[mode] = nextId;
        rememberActiveWallpaperId(mode, nextId);
        return;
      }
      overrides[mode] = null;
      prefs[mode] = nextId;
      if (nextId) {
        rememberActiveWallpaperId(mode, nextId);
      }
    });
    if (prefs.sameForModes) {
      prefs.dark = prefs.light;
      overrides.dark = overrides.light;
    }
    setWallpaperPrefs(prefs, overrides);
    remoteClient.setPinnedIds([prefs.light, prefs.dark]);
    applyResolvedNewtabWallpaper();
    renderWallpaperPanelState();
    if (nextId && isCustomWallpaperId(nextId)) {
      writeLocalWallpaperValue(
        buildLocalWallpaperStorageValue(choice.state.overrides, prefs.sameForModes),
        { showError: true }
      );
      return;
    }
    writeCurrentWallpaperPrefs({ showError: true });
  }

  return {
    primeWallpaperImage,
    loadCustomWallpapers,
    refreshCustomWallpapers,
    mergeCustomWallpaperRecords,
    applyResolvedNewtabWallpaper,
    loadStoredWallpaperState,
    bootstrapInitialWallpaper,
    persistWallpaperEnabled,
    persistWallpaperModeConsistency,
    persistNewtabWallpaper
  };
}

type WallpaperSelection = ReturnType<typeof createWallpaperSelection>;

export { createWallpaperSelection };
export type { WallpaperSelection, WallpaperSelectionDeps };
