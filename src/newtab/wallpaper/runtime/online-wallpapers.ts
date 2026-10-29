// The online wallpapers this page knows: the Bing catalog as last loaded,
// the curated category and page shown, a Bing photo being saved, and the photo picked
// for each daily slot today. A selection started later supersedes one still
// saving, as does any change to the chosen wallpaper.
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';
import * as REMOTE_CONTENT from '../../remote-content';
import type { RemoteWallpaper } from '../../remote-content-types';
import type { DailyWallpaperPicks } from './wallpaper-runtime-types';

interface OnlineWallpapersState {
  bingItems: RemoteWallpaper[];
  bingStatus: '' | 'loading' | 'error';
  bingLoading: boolean;
  // A Bing photo is being saved.
  bingSelecting: boolean;
  curatedCategory: string;
  // The page of the curated category's tiles shown.
  curatedPage: number;
  // Bumped when the remote catalog's content changed outside this store: a
  // daily photo arrived, or the random mix's categories changed.
  remoteRevision: number;
  // Picks from another date no longer count.
  dailyPicks: DailyWallpaperPicks;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

// Stored picks as they may be: only a slot's own provider's photos count.
function normalizeDailyPicks(value: unknown): DailyWallpaperPicks {
  const picks: Record<string, string> = {};
  const stored = isRecord(value) ? value : {};
  const source = isRecord(stored.picks) ? stored.picks : {};
  Object.keys(source).forEach((dailyId) => {
    const pickId = String(source[dailyId] || '');
    if (REMOTE_CONTENT.isDailyWallpaperId(dailyId) && !REMOTE_CONTENT.isDailyWallpaperId(pickId) &&
        REMOTE_CONTENT.getWallpaperProvider(pickId) === REMOTE_CONTENT.getWallpaperProvider(dailyId)) {
      picks[dailyId] = pickId;
    }
  });
  return { day: typeof stored.day === 'string' ? stored.day : '', picks };
}

// Noon tomorrow, local time.
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

class OnlineWallpapers {
  readonly store: Store<OnlineWallpapersState> = createStore<OnlineWallpapersState>({
    bingItems: [],
    bingStatus: '',
    bingLoading: false,
    bingSelecting: false,
    curatedCategory: REMOTE_CONTENT.CURATED_CATEGORIES[0] || '',
    curatedPage: 0,
    remoteRevision: 0,
    dailyPicks: { day: '', picks: {} }
  });
  private selectionSeq = 0;

  get state(): OnlineWallpapersState {
    return this.store.getSnapshot();
  }

  // Starts a selection; returns its token for isLatestSelection.
  beginSelection(): number {
    this.selectionSeq += 1;
    return this.selectionSeq;
  }

  isLatestSelection(seq: number): boolean {
    return seq === this.selectionSeq;
  }

  // The chosen wallpaper changed some other way: a selection still saving
  // must not replace it.
  dropSelections(): void {
    this.selectionSeq += 1;
  }

  setBingSelecting(bingSelecting: boolean): void {
    this.store.setState({ bingSelecting });
  }

  startLoadingCatalog(): void {
    this.store.setState({ bingLoading: true, bingStatus: 'loading' });
  }

  catalogLoaded(bingItems: RemoteWallpaper[]): void {
    this.store.setState({ bingItems, bingStatus: '' });
  }

  catalogFailed(): void {
    this.store.setState({ bingStatus: 'error' });
  }

  stopLoadingCatalog(): void {
    this.store.setState({ bingLoading: false });
  }

  setCuratedCategory(curatedCategory: string): void {
    this.store.setState({ curatedCategory });
  }

  setCuratedPage(curatedPage: number): void {
    this.store.setState({ curatedPage });
  }

  remoteContentChanged(): void {
    this.store.setState((state) => ({ remoteRevision: state.remoteRevision + 1 }));
  }

  // The photo picked for a daily slot today; '' for its own photo.
  getDailyPick(dailyId: string): string {
    const { dailyPicks } = this.state;
    if (!REMOTE_CONTENT.isDailyWallpaperId(dailyId) || dailyPicks.day !== REMOTE_CONTENT.localDay(Date.now())) {
      return '';
    }
    return dailyPicks.picks[dailyId] || '';
  }

  setDailyPicks(dailyPicks: DailyWallpaperPicks): void {
    this.store.setState({ dailyPicks });
  }

  restoreDailyPicks(value: unknown): void {
    this.setDailyPicks(normalizeDailyPicks(value));
  }
}

export { OnlineWallpapers, getNextLocalDayTimestamp, getUpcomingDailyWallpaper };
export type { OnlineWallpapersState };
