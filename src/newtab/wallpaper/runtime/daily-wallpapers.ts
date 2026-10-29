// Daily wallpapers: the Bing catalog and curated categories, the picks
// kept per day, refreshing them when a day has passed, and picking a Bing
// or curated photo.
import type { ToastTask } from '../../../shared/ui/toast-screen';
import type { FormatMessage, ShowToast, Translate } from '../../newtab-types';
import type { RemoteContentClient } from '../../remote-content';
import type { RemoteWallpaper } from '../../remote-content-types';
import type { WallpaperSelection } from './wallpaper-selection';
import type { WallpaperSources } from './wallpaper-sources';
import type { WallpaperStorage } from './wallpaper-storage';
import type { WallpaperItem } from './wallpaper-runtime-types';
import { newtabCuratedMixExcluded, newtabDailyWallpaperPicks } from '../../../domain/settings/newtab-wallpaper';
import * as REMOTE_CONTENT from '../../remote-content';
import { NEWTAB_WALLPAPER_DEFAULT_ID, NEWTAB_WALLPAPER_MODES } from '../wallpaper-options';
import type { OnlineWallpapers } from './online-wallpapers';
import type { WallpaperChoice } from './wallpaper-choice';
import type { WallpaperPanelView } from './panel-view';
import { playEnterMotion } from './motion';
import type { WallpaperEffects } from '../wallpaper-effects';

interface DailyWallpapersDeps extends
  Pick<WallpaperStorage,
    'getEffectiveWallpaperIdForMode' | 'getWallpaperSelectionIdForUi' |
    'writeSetting' | 'getWallpaperTileSelectionId' >,
  Pick<WallpaperSelection, 'applyResolvedNewtabWallpaper' | 'persistNewtabWallpaper'>,
  Pick<WallpaperSources, 'getWallpaperById'> {
  remoteClient: Pick<RemoteContentClient, 'getCatalog' | 'ensureWallpaper' | 'getWallpaper'>;
  document: Document;
  window: Window;
  showToast: ShowToast;
  t: Translate;
  formatMessage: FormatMessage;
  // Shows a toast that follows a task to its end.
  beginToast(message: string): ToastTask;
  online: OnlineWallpapers;
  choice: WallpaperChoice;
  panelView: WallpaperPanelView;
  wallpaperEffects: Pick<WallpaperEffects, 'isSourceStale' | 'refresh'>;
}

// Category names when their messages are missing.
const CURATED_CATEGORY_FALLBACKS: Readonly<Record<string, string>> = {
  random: 'Mix',
  nature: 'Nature',
  water: 'Water',
  city: 'City',
  minimal: 'Minimal',
  art: 'Art'
};

function createDailyWallpapers(deps: DailyWallpapersDeps) {
  const {
    wallpaperEffects,
    panelView,
    choice,
    online,
    remoteClient,
    getEffectiveWallpaperIdForMode,
    applyResolvedNewtabWallpaper,
    document,
    window,
    getWallpaperSelectionIdForUi,
    writeSetting,
    showToast,
    t,
    getWallpaperTileSelectionId,
    formatMessage,
    persistNewtabWallpaper,
    getWallpaperById,
    beginToast
  } = deps;


  let bingCatalogSeq = 0;
  // Three full rows; the refresh button pages through the category.
  const CURATED_TILE_LIMIT = 9;
  let dailyWallpaperCheckedDay = '';
  let hasWallpaperPageShownListeners = false;

  function formatBingDate(date: string | undefined): string {
    return date && /^\d{8}$/.test(date)
      ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : '';
  }

  // Bing credits read "Place (© Photographer)"; show them as "Place · © Photographer".
  function formatBingCopyright(copyright: unknown): string {
    const text = String(copyright || '').trim();
    const match = /^(.*?)\s*[(（]\s*(©[^()（）]*)[)）]\s*$/.exec(text);
    return match ? [match[1], match[2].trim()].filter(Boolean).join(' · ') : text;
  }

  function getBingWallpaperLabel(item: WallpaperItem | null | undefined): string {
    return item ? [item.name, formatBingDate(item.date)].filter(Boolean).join(' · ') : '';
  }

  async function loadBingCatalog(refresh?: boolean): Promise<void> {
    if (!panelView.controller) return;
    const seq = ++bingCatalogSeq;
    online.startLoadingCatalog();
    try {
      const items = await remoteClient.getCatalog(Boolean(refresh));
      if (seq !== bingCatalogSeq) return;
      online.catalogLoaded(items);
      if (NEWTAB_WALLPAPER_MODES.some((mode) => getEffectiveWallpaperIdForMode(mode) === REMOTE_CONTENT.BING_DAILY_ID)) {
        await remoteClient.ensureWallpaper(REMOTE_CONTENT.BING_DAILY_ID).catch(() => {
          // The list loaded; if the daily photo still fails, the current wallpaper simply stays.
        });
        if (seq !== bingCatalogSeq) return;
        if (getEffectiveWallpaperIdForMode(choice.getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
          applyResolvedNewtabWallpaper();
        }
      }
    } catch {
      if (seq !== bingCatalogSeq) return;
      online.catalogFailed();
    } finally {
      if (seq === bingCatalogSeq) {
        online.stopLoadingCatalog();
      }
    }
  }

  // A New Tab can stay open past midnight; pick up the new daily photo when it is shown again.
  function refreshDailyWallpapersIfStale(): void {
    if (!choice.state.loaded || document.visibilityState === 'hidden') return;
    const day = REMOTE_CONTENT.localDay(Date.now());
    if (day === dailyWallpaperCheckedDay) return;
    const dailyIds = NEWTAB_WALLPAPER_MODES.map((mode) => getEffectiveWallpaperIdForMode(mode))
      .filter((id) => REMOTE_CONTENT.isDailyWallpaperId(id));
    if (!dailyIds.length) return;
    dailyWallpaperCheckedDay = day;
    // Curated picks follow the date alone, so the new one is ready without a request.
    if (dailyIds.some((id) => id !== REMOTE_CONTENT.BING_DAILY_ID)) {
      applyResolvedNewtabWallpaper();
      online.remoteContentChanged();
    }
    if (!dailyIds.includes(REMOTE_CONTENT.BING_DAILY_ID)) return;
    void remoteClient.ensureWallpaper(REMOTE_CONTENT.BING_DAILY_ID).then(() => {
      if (getEffectiveWallpaperIdForMode(choice.getResolvedWallpaperMode()) === REMOTE_CONTENT.BING_DAILY_ID) {
        applyResolvedNewtabWallpaper();
      }
      online.remoteContentChanged();
    }).catch(() => {
      // Offline at midnight: yesterday's photo stays until the next check.
    });
  }

  // A background tab can miss the effect redraw for a photo that changed while it was hidden.
  function syncWallpaperEffectSource(): void {
    const effects = wallpaperEffects;
    if (document.visibilityState === 'hidden' || !effects ||
        typeof effects.isSourceStale !== 'function' || !effects.isSourceStale()) {
      return;
    }
    void effects.refresh({ immediate: true });
  }

  function handleWallpaperPageShown(): void {
    refreshDailyWallpapersIfStale();
    syncWallpaperEffectSource();
  }

  // Bound once the stored wallpaper loads, so a tab that never opens the panel still rolls over.
  function bindWallpaperPageShownListeners(): void {
    if (hasWallpaperPageShownListeners) return;
    hasWallpaperPageShownListeners = true;
    dailyWallpaperCheckedDay = REMOTE_CONTENT.localDay(Date.now());
    if (window && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', handleWallpaperPageShown, { passive: true });
    }
    if (document && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', handleWallpaperPageShown, { passive: true });
    }
  }

  function getActiveDailyWallpaperId(provider: string): string {
    const id = getWallpaperSelectionIdForUi();
    return REMOTE_CONTENT.isDailyWallpaperId(id) && REMOTE_CONTENT.getWallpaperProvider(id) === provider ? id : '';
  }

  // Choosing today's own photo, or restoring it, simply drops the pick.
  function setDailyWallpaperPick(dailyId: string, pickId: string): void {
    const today = REMOTE_CONTENT.localDay(Date.now());
    const current = online.state.dailyPicks;
    const picks: Record<string, string> = current.day === today ? { ...current.picks } : {};
    const scheduled = remoteClient.getWallpaper(dailyId);
    if (!pickId || scheduled && scheduled.dailyId === pickId) delete picks[dailyId];
    else picks[dailyId] = pickId;
    const dailyPicks = { day: today, picks };
    online.setDailyPicks(dailyPicks);
    writeSetting(newtabDailyWallpaperPicks,
      Object.keys(picks).length ? dailyPicks : '', () => {
        showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
      });
    applyResolvedNewtabWallpaper();
  }

  function clearDailyWallpaperPick(dailyId: string): void {
    if (online.getDailyPick(dailyId)) setDailyWallpaperPick(dailyId, '');
  }

  function getCuratedTileItems(): RemoteWallpaper[] {
    const items = REMOTE_CONTENT.getCuratedWallpapers(online.state.curatedCategory);
    if (!items.length) return [];
    // Wrap around the end of the category so every page fills both rows.
    const start = (online.state.curatedPage * CURATED_TILE_LIMIT) % items.length;
    return Array.from({ length: Math.min(CURATED_TILE_LIMIT, items.length) },
      (_, index) => items[(start + index) % items.length]);
  }

  // Pages keep a fixed order, so choosing a photo never reshuffles the grid; instead the list
  // opens on the page that holds the chosen or daily photo.
  function showCuratedPageOfSelection(): void {
    const selectedId = getWallpaperTileSelectionId(getWallpaperSelectionIdForUi());
    const index = REMOTE_CONTENT.getCuratedWallpapers(online.state.curatedCategory).findIndex((item) => item.id === selectedId);
    online.setCuratedPage(index >= 0 ? Math.floor(index / CURATED_TILE_LIMIT) : 0);
  }

  // Paintings are named by title, photos by photographer.
  function getCuratedPhotoLabel(item: WallpaperItem | null | undefined): string {
    if (item && item.title) return item.title;
    return item && item.name && item.name !== 'Picsum'
      ? formatMessage('newtab_curated_photo_by', 'Photo by {name}', { name: item.name })
      : '';
  }

  function getCuratedPhotoMeta(item: WallpaperItem | null | undefined): string {
    if (item && item.title) {
      return [item.name, t('newtab_curated_art_meta', 'The Cleveland Museum of Art')].filter(Boolean).join(' · ');
    }
    return t('newtab_curated_source_meta', 'Unsplash · via Lorem Picsum');
  }

  function getCuratedCategoryLabel(category: string): string {
    return t(`newtab_curated_category_${category}`, CURATED_CATEGORY_FALLBACKS[category] || category);
  }

  function isCuratedDailyWallpaperActive(): boolean {
    const selectedId = getWallpaperSelectionIdForUi();
    return REMOTE_CONTENT.isDailyWallpaperId(selectedId) &&
      REMOTE_CONTENT.getWallpaperProvider(selectedId) === 'curated';
  }

  function selectCuratedCategory(category: string): void {
    if (!REMOTE_CONTENT.CURATED_CATEGORIES.includes(category) || category === online.state.curatedCategory) return;
    online.setCuratedCategory(category);
    showCuratedPageOfSelection();
    playEnterMotion(window, panelView.getRefs().curatedItemsHost, 'enter');
  }
  function setCuratedMixCategory(category: string, included: boolean): void {
    const excluded = REMOTE_CONTENT.CURATED_CATEGORIES
      .filter((value) => value !== REMOTE_CONTENT.RANDOM_CATEGORY &&
        !REMOTE_CONTENT.getRandomMixCategories().includes(value));
    const next = included ? excluded.filter((value) => value !== category) : excluded.concat(category);
    const normalized = REMOTE_CONTENT.normalizeRandomMixExcluded(next);
    if (normalized.length !== next.length || normalized.join() === excluded.join()) return;
    REMOTE_CONTENT.setRandomMixExcluded(normalized);
    writeSetting(newtabCuratedMixExcluded, normalized.length ? normalized : '', () => {
      showToast(t('newtab_wallpaper_save_error', 'Failed to save wallpaper'), true);
    });
    showCuratedPageOfSelection();
    // The random daily photo may now come from another category.
    applyResolvedNewtabWallpaper();
    online.remoteContentChanged();
    playEnterMotion(window, panelView.getRefs().curatedItemsHost, 'enter');
  }
  function showMoreCuratedWallpapers(): void {
    online.setCuratedPage(online.state.curatedPage + 1);
    playEnterMotion(window, panelView.getRefs().curatedItemsHost, 'enter');
  }
  function setCuratedDailyWallpaper(enabled: boolean): void {
    if (enabled) {
      const dailyId = REMOTE_CONTENT.curatedDailyId(online.state.curatedCategory);
      clearDailyWallpaperPick(dailyId);
      persistNewtabWallpaper(dailyId);
      showCuratedPageOfSelection();
    } else {
      // Keep the photo on screen, picked or not, as turning off the Bing daily wallpaper does.
      const daily = getWallpaperById(getWallpaperSelectionIdForUi());
      persistNewtabWallpaper(daily && daily.dailyId || NEWTAB_WALLPAPER_DEFAULT_ID);
    }
  }

  // Whether the two modes share one wallpaper.
  function isSameForModes(): boolean {
    return choice.state.prefs ? choice.state.prefs.sameForModes : true;
  }

  async function selectBingWallpaper(id: string, options?: { asDailyPick?: boolean } | null): Promise<void> {
    if (online.state.bingSelecting) return;
    // A tile chosen while the daily photo is on replaces it for today only.
    const dailyId = options && options.asDailyPick ? getActiveDailyWallpaperId('bing') : '';
    const seq = online.beginSelection();
    const mode = choice.getWallpaperEditMode();
    const sameForModes = isSameForModes();
    online.setBingSelecting(true);
    // The new wallpaper is its own success signal, so only a failure leaves a message.
    const toastTask = beginToast(t('newtab_bing_saving', 'Saving wallpaper…'));
    try {
      await remoteClient.ensureWallpaper(id);
      toastTask.done();
      if (!online.isLatestSelection(seq) || mode !== choice.getWallpaperEditMode() ||
          sameForModes !== isSameForModes()) return;
      if (dailyId) setDailyWallpaperPick(dailyId, id);
      else persistNewtabWallpaper(id);
    } catch {
      toastTask.fail(online.isLatestSelection(seq)
        ? t('newtab_bing_save_error', 'Could not save wallpaper. Please try again.')
        : '');
    } finally {
      online.setBingSelecting(false);
    }
  }

  // A New Tab left open is checked for a new day's photo once the stored choice is in.
  choice.store.subscribe(() => {
    if (choice.state.loaded) {
      bindWallpaperPageShownListeners();
    }
  });

  return {
    formatBingCopyright,
    getBingWallpaperLabel,
    loadBingCatalog,
    getActiveDailyWallpaperId,
    setDailyWallpaperPick,
    clearDailyWallpaperPick,
    getCuratedTileItems,
    showCuratedPageOfSelection,
    getCuratedPhotoLabel,
    getCuratedPhotoMeta,
    getCuratedCategoryLabel,
    isCuratedDailyWallpaperActive,
    selectCuratedCategory,
    setCuratedMixCategory,
    showMoreCuratedWallpapers,
    setCuratedDailyWallpaper,
    selectBingWallpaper
  };
}

type DailyWallpapers = ReturnType<typeof createDailyWallpapers>;

export { createDailyWallpapers };
export type { DailyWallpapers, DailyWallpapersDeps };
