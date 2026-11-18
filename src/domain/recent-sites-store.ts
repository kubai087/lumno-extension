// The New Tab's recent sites: the cards pinned in front, the sites hidden
// until their next visit, and the card each site's page becomes.

interface RecentSite {
  title: string;
  url: string;
  // Normalized host, the key that makes a card one per site.
  host: string;
  siteName: string;
  lastVisitTime: number;
  visitCount: number;
  // When the card was pinned; 0 for an unpinned site.
  pinnedAt: number;
  // A pinned card that follows the episodes of one work (Labs).
  progressTracking?: true;
  progressId?: string;
  // Set on merged lists: the card is one of the pinned ones.
  _xPinned?: boolean;
}

// A site hidden until a visit later than the one it was hidden at.
interface HiddenRecentSite {
  url: string;
  lastVisitTime: number;
  hiddenAt: number;
}

interface RecentSiteOptions {
  normalizeHost?: (hostname: string) => string;
  // The page a favicon proxy URL stands for.
  getCanonicalPageUrlForFavicon?: (url: string) => string;
  sanitizeDisplayText?: (text: unknown) => string;
  getSiteDisplayName?: (host: string, title: string) => string;
  // Sites the search blacklist leaves out; pinned cards ignore it.
  shouldExcludeUrl?: (url: string) => boolean;
  ignoreBlacklist?: boolean;
  maxPinned?: number;
  maxHidden?: number;
  // A page a tracked card already stands for.
  belongsToTrackedWork?: (item: RecentSite) => boolean;
  // Open tabs that go ahead of history and top sites.
  shouldPrioritizeTabUrl?: (url: string) => boolean;
}

type RecentSiteSource = 'tabs' | 'history' | 'topSites';

interface RecentSiteSources extends RecentSiteOptions {
  limit?: number;
  // How many source candidates to consider; at least `limit`.
  candidateLimit?: number;
  // 'most' ranks history by visits; otherwise by the latest visit.
  mode?: string;
  pinned?: unknown;
  hidden?: unknown;
  // chrome.tabs, chrome.topSites and chrome.history results.
  tabs?: unknown;
  topSites?: unknown;
  historyItems?: unknown;
}

interface RecentSiteCollector {
  items: RecentSite[];
  isFull(): boolean;
  append(item: unknown, isPinned: boolean): boolean;
  appendNormalized(normalized: RecentSite | null, isPinned: boolean): boolean;
}

const DEFAULT_MAX_PINNED = 3;
const DEFAULT_MAX_HIDDEN = 60;
// The hidden list is one chrome.storage.sync item, which holds 8192 bytes with
// its key. Long URLs fill it before the count cap does, and a write over it
// fails, so the oldest entries make room instead.
const HIDDEN_LIST_BYTE_BUDGET = 7936;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeRecentCount(value: unknown): number {
  const parsed = Number.parseInt(String(value), 10);
  if (parsed === 0 || parsed === 4 || parsed === 8) {
    return parsed;
  }
  return 4;
}

function defaultNormalizeHost(hostname: string): string {
  return String(hostname || '').trim().toLowerCase().replace(/^www\./i, '');
}

function getNormalizeHost(options: RecentSiteOptions | null | undefined): (hostname: string) => string {
  return options && typeof options.normalizeHost === 'function'
    ? options.normalizeHost
    : defaultNormalizeHost;
}

function getCanonicalPageUrl(url: string, options: RecentSiteOptions | null | undefined): string {
  if (options && typeof options.getCanonicalPageUrlForFavicon === 'function') {
    return options.getCanonicalPageUrlForFavicon(url) || String(url || '');
  }
  return String(url || '');
}

function getHostFromUrl(url: string, options: RecentSiteOptions | null | undefined): string {
  const normalizeHost = getNormalizeHost(options);
  try {
    return normalizeHost(new URL(getCanonicalPageUrl(url, options)).hostname);
  } catch (_error) {
    return '';
  }
}

function sanitizeDisplayText(text: unknown, options: RecentSiteOptions): string {
  if (typeof options.sanitizeDisplayText === 'function') {
    return options.sanitizeDisplayText(text);
  }
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function getSiteDisplayName(host: string, title: string, options: RecentSiteOptions): string {
  if (typeof options.getSiteDisplayName === 'function') {
    return options.getSiteDisplayName(host, title);
  }
  return host || title || '';
}

function shouldExcludeUrl(url: string, options: RecentSiteOptions): boolean {
  return Boolean(typeof options.shouldExcludeUrl === 'function' && options.shouldExcludeUrl(url));
}

function getRecentSiteUrlKey(item: unknown): string {
  if (!isRecord(item) || !item.url) {
    return '';
  }
  return String(item.url).trim();
}

function getRecentSiteHostKey(item: unknown, options?: RecentSiteOptions | null): string {
  if (!isRecord(item)) {
    return '';
  }
  const normalizeHost = getNormalizeHost(options);
  const rawHost = item.host || getHostFromUrl(String(item.url || ''), options);
  return normalizeHost(String(rawHost || ''));
}

// The card's title, and the site name shown under it.
function readSiteLabels(
  item: Record<string, unknown>,
  url: string,
  host: string,
  opts: RecentSiteOptions
): Pick<RecentSite, 'title' | 'siteName'> {
  const title = sanitizeDisplayText(item.title || item.siteName || host || url, opts);
  const siteName = sanitizeDisplayText(
    item.siteName || getSiteDisplayName(host, title, opts) || host || title || url,
    opts
  );
  return { title, siteName };
}

function normalizeRecentSiteItem(item: unknown, options?: RecentSiteOptions | null): RecentSite | null {
  const opts = options && typeof options === 'object' ? options : {};
  const ignoreBlacklist = opts.ignoreBlacklist === true;
  if (!isRecord(item) || !item.url) {
    return null;
  }
  const url = String(item.url).trim();
  if (!url || (!ignoreBlacklist && shouldExcludeUrl(url, opts))) {
    return null;
  }
  const host = getRecentSiteHostKey(item, opts);
  return {
    ...readSiteLabels(item, url, host, opts),
    url,
    host,
    lastVisitTime: Number(item.lastVisitTime) || 0,
    visitCount: Number(item.visitCount) || 0,
    pinnedAt: Number(item.pinnedAt) || 0
  };
}

function isSameRecentSite(a: unknown, b: unknown, options?: RecentSiteOptions | null): boolean {
  const aUrlKey = getRecentSiteUrlKey(a);
  const bUrlKey = getRecentSiteUrlKey(b);
  if (aUrlKey && bUrlKey && aUrlKey === bUrlKey) {
    return true;
  }
  const aHostKey = getRecentSiteHostKey(a, options);
  const bHostKey = getRecentSiteHostKey(b, options);
  return Boolean(aHostKey && bHostKey && aHostKey === bHostKey);
}

// Progress tracking (Labs) lives on pinned cards only. A tracked card
// stands for one work rather than its whole site, and keeps a stable id
// that its change history is stored under.
function withProgressFields(nextItem: RecentSite | null, item: unknown): RecentSite | null {
  if (!nextItem || !isRecord(item) || item.progressTracking !== true) {
    return nextItem;
  }
  const progressId = String(item.progressId || '').trim();
  return {
    ...nextItem,
    progressTracking: true,
    ...(progressId ? { progressId } : {})
  };
}

function isProgressTracked(item: unknown): boolean {
  return isRecord(item) && item.progressTracking === true;
}

// Pinned cards are one per site, except tracked cards: they are one per
// work, so another page on the same site is a different card.
function isSamePinnedRecentSite(a: unknown, b: unknown, options?: RecentSiteOptions | null): boolean {
  if (isProgressTracked(a) || isProgressTracked(b)) {
    const aUrlKey = getRecentSiteUrlKey(a);
    return Boolean(aUrlKey && aUrlKey === getRecentSiteUrlKey(b));
  }
  return isSameRecentSite(a, b, options);
}

function normalizePinnedRecentSites(items: unknown, options?: RecentSiteOptions | null): RecentSite[] {
  const opts = options && typeof options === 'object' ? options : {};
  const maxPinned = Number.isFinite(Number(opts.maxPinned))
    ? Math.max(0, Number(opts.maxPinned))
    : DEFAULT_MAX_PINNED;
  if (!Array.isArray(items) || maxPinned <= 0) {
    return [];
  }
  const source: unknown[] = items;
  const normalized: RecentSite[] = [];
  for (const item of source) {
    const nextItem = withProgressFields(normalizeRecentSiteItem(item, {
      ...opts,
      ignoreBlacklist: true
    }), item);
    if (!nextItem) {
      continue;
    }
    const duplicated = normalized.some((existingItem) =>
      isSamePinnedRecentSite(existingItem, nextItem, opts)
    );
    if (duplicated) {
      continue;
    }
    normalized.push(nextItem);
    if (normalized.length >= maxPinned) {
      break;
    }
  }
  return normalized;
}

// A hidden entry, also as older versions stored it (the bare URL).
function normalizeHiddenRecentSiteEntry(item: unknown): HiddenRecentSite | null {
  if (!item) {
    return null;
  }
  const fields = isRecord(item) ? item : {};
  const url = typeof item === 'string'
    ? String(item).trim()
    : String(fields.url || '').trim();
  if (!url) {
    return null;
  }
  const lastVisitTime = typeof item === 'string'
    ? 0
    : Math.max(0, Number(fields.lastVisitTime) || 0);
  return {
    url,
    lastVisitTime,
    hiddenAt: Math.max(0, Number(fields.hiddenAt) || Date.now())
  };
}

function normalizeHiddenRecentSites(items: unknown, options?: RecentSiteOptions | null): HiddenRecentSite[] {
  const opts = options && typeof options === 'object' ? options : {};
  const maxHidden = Number.isFinite(Number(opts.maxHidden))
    ? Math.max(0, Number(opts.maxHidden))
    : DEFAULT_MAX_HIDDEN;
  if (!Array.isArray(items) || maxHidden <= 0) {
    return [];
  }
  const source: unknown[] = items;
  const normalized: HiddenRecentSite[] = [];
  for (const item of source) {
    const entry = normalizeHiddenRecentSiteEntry(item);
    if (!entry) {
      continue;
    }
    const duplicatedIndex = normalized.findIndex((existingItem) => existingItem.url === entry.url);
    if (duplicatedIndex >= 0) {
      normalized[duplicatedIndex] = entry.lastVisitTime >= normalized[duplicatedIndex].lastVisitTime
        ? entry
        : normalized[duplicatedIndex];
      continue;
    }
    normalized.push(entry);
    if (normalized.length >= maxHidden) {
      break;
    }
  }
  const encoder = new TextEncoder();
  while (normalized.length > 1 &&
      encoder.encode(JSON.stringify(normalized)).byteLength > HIDDEN_LIST_BYTE_BUDGET) {
    normalized.pop();
  }
  return normalized;
}

function isRecentSiteHidden(item: unknown, hiddenSites: readonly (HiddenRecentSite | null | undefined)[] | null | undefined): boolean {
  const key = getRecentSiteUrlKey(item);
  if (!key || !Array.isArray(hiddenSites)) {
    return false;
  }
  const entry = hiddenSites.find((candidate) => candidate && candidate.url === key);
  if (!entry) {
    return false;
  }
  const lastVisitTime = Math.max(0, Number(isRecord(item) ? item.lastVisitTime : 0) || 0);
  return lastVisitTime <= entry.lastVisitTime;
}

export {
  DEFAULT_MAX_HIDDEN,
  DEFAULT_MAX_PINNED,
  HIDDEN_LIST_BYTE_BUDGET,
  defaultNormalizeHost,
  getCanonicalPageUrl,
  getHostFromUrl,
  getNormalizeHost,
  getRecentSiteHostKey,
  getRecentSiteUrlKey,
  getSiteDisplayName,
  isProgressTracked,
  isRecentSiteHidden,
  isRecord,
  isSamePinnedRecentSite,
  isSameRecentSite,
  normalizeHiddenRecentSiteEntry,
  normalizeHiddenRecentSites,
  normalizePinnedRecentSites,
  normalizeRecentCount,
  normalizeRecentSiteItem,
  readSiteLabels,
  sanitizeDisplayText,
  shouldExcludeUrl,
  withProgressFields
};
export type {
  HiddenRecentSite,
  RecentSite,
  RecentSiteCollector,
  RecentSiteOptions,
  RecentSiteSource,
  RecentSiteSources
};
