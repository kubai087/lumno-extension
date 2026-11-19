// Pins the toolbar popup's page among the New Tab's recent sites, in the
// list the New Tab keeps (one card per site, a tracked card per work). An
// episode or chapter starts tracked, as when it is pinned on the New Tab.
import type { SettingsStore } from '../platform/settings-store';
import { pinnedRecentSites } from '../domain/settings/recent-sites';
import type { RecentPinStatus, RecentPinToggleStatus } from '../domain/messages';
import type { RecentSite, RecentSiteOptions } from '../domain/recent-sites-store';

// The recent sites store functions the controller uses.
interface RecentSitesStoreApi {
  normalizeRecentSiteItem(item: unknown, options?: RecentSiteOptions | null): RecentSite | null;
  isSamePinnedRecentSite(a: unknown, b: unknown, options?: RecentSiteOptions | null): boolean;
  normalizePinnedRecentSites(items: unknown, options?: RecentSiteOptions | null): RecentSite[];
}

// The popup's page.
interface PopupPage {
  url: string;
  title: string;
}

interface RecentPinOptions {
  store: RecentSitesStoreApi;
  // The settings the pinned sites are read from and saved to.
  settingsStore: SettingsStore;
  storeOptions?: RecentSiteOptions;
  // Whether a page reads as an episode or chapter, which starts tracked.
  probeSeries?: (url: string) => Promise<boolean>;
  createProgressId?: (now: number) => string;
}

interface RecentPinToggleResult {
  status: RecentPinToggleStatus;
  tracking?: boolean;
}

interface RecentPinController {
  getStatus(page: PopupPage | null): Promise<RecentPinStatus>;
  toggle(page: PopupPage | null): Promise<RecentPinToggleResult>;
  pin(page: PopupPage | null): Promise<RecentPinToggleResult>;
}

function createController(options: RecentPinOptions): RecentPinController {
  const opts = options;
  const store = opts.store;
  const settingsStore = opts.settingsStore;
  const storeOptions = opts.storeOptions || {};
  const maxPinned = Number(storeOptions.maxPinned) || 3;
  const probeSeries = typeof opts.probeSeries === 'function' ? opts.probeSeries : () => Promise.resolve(false);
  const createProgressId = typeof opts.createProgressId === 'function'
    ? opts.createProgressId
    : (now: number) => `p${Number(now).toString(36)}`;
  let chain: Promise<unknown> = Promise.resolve();

  function toItem(page: PopupPage | null): RecentSite | null {
    const url = String((page && page.url) || '');
    if (!/^https?:\/\//i.test(url)) return null;
    return store.normalizeRecentSiteItem({ url, title: String((page && page.title) || '') }, {
      ...storeOptions,
      ignoreBlacklist: true
    });
  }

  async function readPinned(): Promise<RecentSite[]> {
    await settingsStore.ready;
    return store.normalizePinnedRecentSites(settingsStore.getStored(pinnedRecentSites), storeOptions);
  }

  function findPinned(pinned: readonly RecentSite[], item: RecentSite): number {
    return pinned.findIndex((pinnedItem) => store.isSamePinnedRecentSite(pinnedItem, item, storeOptions));
  }

  // available: the page can be pinned at all; pinned: it (or its site) is;
  // full: nothing more fits.
  async function getStatus(page: PopupPage | null): Promise<RecentPinStatus> {
    const item = toItem(page);
    if (!item) return { available: false, pinned: false, full: false };
    const pinned = await readPinned();
    return {
      available: true,
      pinned: findPinned(pinned, item) >= 0,
      full: pinned.length >= maxPinned
    };
  }

  // Unpins what the popup showed as pinned, otherwise pins the page in
  // front. One toggle at a time, so two quick clicks read each other's list.
  function toggle(page: PopupPage | null, pinOnly = false): Promise<RecentPinToggleResult> {
    const job = chain.catch(() => {}).then(async (): Promise<RecentPinToggleResult> => {
      const item = toItem(page);
      if (!item) return { status: 'invalid' };
      const pinned = await readPinned();
      const index = findPinned(pinned, item);
      const save = (items: unknown[]): Promise<RecentSite[]> => {
        const normalized = store.normalizePinnedRecentSites(items, storeOptions);
        return settingsStore.set(pinnedRecentSites, normalized).then(() => normalized);
      };
      if (index >= 0) {
        if (pinOnly) return { status: 'pinned' };
        await save(pinned.filter((_, position) => position !== index));
        return { status: 'unpinned' };
      }
      if (pinned.length >= maxPinned) return { status: 'limit' };
      const tracking = await probeSeries(item.url).then((series) => series === true, () => false);
      const now = Date.now();
      await save([{
        ...item,
        pinnedAt: now,
        ...(tracking ? { progressTracking: true, progressId: createProgressId(now) } : {})
      }].concat(pinned));
      return { status: 'pinned', tracking };
    });
    chain = job;
    return job.catch((error: unknown): RecentPinToggleResult => {
      console.warn('[Lumno] Could not pin the page to recent sites.', error);
      return { status: 'failed' };
    });
  }

  return { getStatus, toggle, pin: (page) => toggle(page, true) };
}

export { createController };
export type { PopupPage, RecentPinController, RecentPinOptions, RecentPinToggleResult, RecentSitesStoreApi };
