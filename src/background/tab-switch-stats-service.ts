// How often each tab is switched to, kept per tab in session storage, and the
// ranking the search overlay's open-tabs list uses to sort and describe tabs.
//
// A module of the service worker; background.ts imports it before its own code
// runs.

import { warnBackgroundFailure, workerSettings } from './worker-context';
import type { OverlayTab, TabRankFields } from '../domain/messages';
import { tabSwitchStats } from '../domain/settings/features';

// When a tab was switched to in the last day, and last of all.
interface TabSwitchStat {
  events: number[];
  lastSwitchAt: number;
}

interface TabSwitchRank {
  score: number;
  shortCount: number;
  dayCount: number;
  highFreq: boolean;
  hint: string;
  lastSwitchAt: number;
}

// A tab as the overlay's listing reads it.
interface ListedTab {
  id?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  lastAccessed?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

const TAB_SWITCH_WINDOW_SHORT_MS = 30 * 60 * 1000;
const TAB_SWITCH_WINDOW_DAY_MS = 24 * 60 * 60 * 1000;
const TAB_SWITCH_HIGH_FREQ_SHORT_THRESHOLD = 2;
const TAB_SWITCH_HIGH_FREQ_DAY_THRESHOLD = 5;
const TAB_SWITCH_EVENT_HISTORY_LIMIT = 60;
// Tab switch stats: persisted on every change to session storage and merged
// back by ensureTabSwitchStatsLoaded on wake.
const tabSwitchEventsByTabId = new Map<number, TabSwitchStat>();
// Rebuilt from tab.lastAccessed on the next tab listing.
const tabLastAccessedByTabId = new Map<number, number>();
// Debug counter and request sequence numbers; restarting them is harmless.
let tabSwitchEventDebugTotal = 0;
let tabSwitchStatsLoaded = false;
let tabSwitchStatsLoadPromise: Promise<void> | null = null;
// Tabs whose stats were cleared before the stored stats were merged back; the
// merge skips their stored entries so a cleared stat is not resurrected.
const tabSwitchStatsClearedBeforeLoad = new Set<number>();


function normalizeTabSwitchStatEntry(raw: unknown, now: number): TabSwitchStat | null {
  if (!isRecord(raw)) {
    return null;
  }
  const minTs = now - TAB_SWITCH_WINDOW_DAY_MS;
  const rawEvents: unknown[] = Array.isArray(raw.events) ? raw.events : [];
  const events = rawEvents
    .map((item) => Number(item) || 0)
    .filter((item) => item >= minTs)
    .sort((a, b) => a - b)
    .slice(-TAB_SWITCH_EVENT_HISTORY_LIMIT);
  const lastSwitchAtRaw = Number(raw.lastSwitchAt) || 0;
  const lastSwitchAt = Math.max(lastSwitchAtRaw, events.length > 0 ? events[events.length - 1] : 0);
  if (events.length <= 0 && lastSwitchAt <= 0) {
    return null;
  }
  return {
    events: events,
    lastSwitchAt: lastSwitchAt
  };
}

function mergeTabSwitchStat(target: TabSwitchStat | null, incoming: TabSwitchStat, now: number): TabSwitchStat | null {
  const left = normalizeTabSwitchStatEntry(target, now) || { events: [], lastSwitchAt: 0 };
  const right = normalizeTabSwitchStatEntry(incoming, now) || { events: [], lastSwitchAt: 0 };
  const mergedEvents = left.events.concat(right.events)
    .filter((item) => typeof item === 'number' && item > 0)
    .sort((a, b) => a - b)
    .slice(-TAB_SWITCH_EVENT_HISTORY_LIMIT);
  const lastSwitchAt = Math.max(left.lastSwitchAt || 0, right.lastSwitchAt || 0, mergedEvents.length > 0 ? mergedEvents[mergedEvents.length - 1] : 0);
  if (mergedEvents.length <= 0 && lastSwitchAt <= 0) {
    return null;
  }
  return {
    events: mergedEvents,
    lastSwitchAt: lastSwitchAt
  };
}

function applyPersistedTabSwitchStats(payload: unknown): void {
  const now = Date.now();
  if (!isRecord(payload)) {
    return;
  }
  Object.keys(payload).forEach((tabIdKey) => {
    const tabId = Number.parseInt(tabIdKey, 10);
    if (!Number.isFinite(tabId) || tabSwitchStatsClearedBeforeLoad.has(tabId)) {
      return;
    }
    const incoming = normalizeTabSwitchStatEntry(payload[tabIdKey], now);
    if (!incoming) {
      return;
    }
    const existing = tabSwitchEventsByTabId.get(tabId) || null;
    const merged = mergeTabSwitchStat(existing, incoming, now);
    if (merged) {
      tabSwitchEventsByTabId.set(tabId, merged);
    }
  });
}

function exportTabSwitchStatsSnapshot(): Record<string, TabSwitchStat> {
  const now = Date.now();
  const out: Record<string, TabSwitchStat> = {};
  tabSwitchEventsByTabId.forEach((stat, tabId) => {
    if (typeof tabId !== 'number') {
      return;
    }
    const normalized = normalizeTabSwitchStatEntry(stat, now);
    if (!normalized) {
      return;
    }
    out[String(tabId)] = normalized;
  });
  return out;
}

function persistTabSwitchStatsNow(): Promise<boolean> {
  if (!tabSwitchStatsLoaded) {
    // A tab activation can wake the worker; writing before the stored stats
    // are merged back would replace them with just this one event.
    return ensureTabSwitchStatsLoaded().then(() => persistTabSwitchStatsNow());
  }
  const snapshot = exportTabSwitchStatsSnapshot();
  return workerSettings.set(tabSwitchStats, snapshot).then(() => true, () => false);
}

export function ensureTabSwitchStatsLoaded(): Promise<void> {
  if (tabSwitchStatsLoaded) {
    return Promise.resolve();
  }
  if (tabSwitchStatsLoadPromise) {
    return tabSwitchStatsLoadPromise;
  }
  tabSwitchStatsLoadPromise = new Promise((resolve) => {
    void workerSettings.ready.then(() => {
      applyPersistedTabSwitchStats(workerSettings.getStored(tabSwitchStats));
      tabSwitchStatsClearedBeforeLoad.clear();
      tabSwitchStatsLoaded = true;
      tabSwitchStatsLoadPromise = null;
      resolve();
    });
  });
  return tabSwitchStatsLoadPromise;
}

function getTabSwitchStat(tabId: number | null, createIfMissing: boolean): TabSwitchStat | null {
  if (typeof tabId !== 'number') {
    return null;
  }
  const existing = tabSwitchEventsByTabId.get(tabId);
  if (existing || !createIfMissing) {
    return existing || null;
  }
  const created: TabSwitchStat = {
    events: [],
    lastSwitchAt: 0
  };
  tabSwitchEventsByTabId.set(tabId, created);
  return created;
}

function pruneTabSwitchStat(stat: TabSwitchStat | null, now: number): void {
  if (!stat || !Array.isArray(stat.events)) {
    return;
  }
  const minTs = now - TAB_SWITCH_WINDOW_DAY_MS;
  stat.events = stat.events.filter((ts) => typeof ts === 'number' && ts >= minTs);
  if (stat.events.length > TAB_SWITCH_EVENT_HISTORY_LIMIT) {
    stat.events = stat.events.slice(-TAB_SWITCH_EVENT_HISTORY_LIMIT);
  }
}

export function recordTabSwitchEvent(tabId: number, at?: number): void {
  const stat = getTabSwitchStat(tabId, true);
  if (!stat) {
    return;
  }
  const now = typeof at === 'number' ? at : Date.now();
  const lastRecordedAt = Number(stat.lastSwitchAt) || 0;
  if (lastRecordedAt > 0 && Math.abs(now - lastRecordedAt) < 450) {
    return;
  }
  stat.events.push(now);
  stat.lastSwitchAt = now;
  tabSwitchEventDebugTotal += 1;
  pruneTabSwitchStat(stat, now);
  persistTabSwitchStatsNow().catch(warnBackgroundFailure('Failed to save tab switch stats.'));
}

export function clearTabSwitchStat(tabId: unknown): void {
  if (typeof tabId !== 'number') {
    return;
  }
  tabLastAccessedByTabId.delete(tabId);
  const hadStat = tabSwitchEventsByTabId.delete(tabId);
  if (!tabSwitchStatsLoaded) {
    // The stored copy of this stat has not been merged in yet; drop it too.
    tabSwitchStatsClearedBeforeLoad.add(tabId);
  }
  if (hadStat || !tabSwitchStatsLoaded) {
    persistTabSwitchStatsNow().catch(warnBackgroundFailure('Failed to save tab switch stats.'));
  }
}

function forgetClosedTabs(aliveIds: ReadonlySet<number>): void {
  const staleIds: number[] = [];
  tabLastAccessedByTabId.forEach((_, tabId) => {
    if (!aliveIds.has(tabId)) {
      staleIds.push(tabId);
    }
  });
  staleIds.forEach((tabId) => {
    tabLastAccessedByTabId.delete(tabId);
  });
}

// The most recently used tab counts as a switch unless it was recorded at
// that time already.
function recordLatestSwitch(tabId: number, lastAccessed: number): void {
  const existing = getTabSwitchStat(tabId, false);
  const lastRecordedAt = Number(existing && existing.lastSwitchAt) || 0;
  if (lastAccessed > (lastRecordedAt + 250)) {
    recordTabSwitchEvent(tabId, lastAccessed);
  }
}

// Records the switches a listing reveals: tabs used since the last listing.
export function syncTabSwitchStatsFromTabList(tabs: readonly (ListedTab | null | undefined)[]): void {
  const list = Array.isArray(tabs) ? tabs : [];
  const aliveIds = new Set<number>();
  let mostRecentTabId: number | null = null;
  let mostRecentLastAccessed = 0;
  for (let i = 0; i < list.length; i += 1) {
    const tab = list[i];
    if (!tab || typeof tab.id !== 'number') {
      continue;
    }
    const tabId = tab.id;
    aliveIds.add(tabId);
    const lastAccessed = Number(tab.lastAccessed) || 0;
    if (lastAccessed <= 0) {
      continue;
    }
    if (lastAccessed > mostRecentLastAccessed) {
      mostRecentLastAccessed = lastAccessed;
      mostRecentTabId = tabId;
    }
    const previous = Number(tabLastAccessedByTabId.get(tabId)) || 0;
    tabLastAccessedByTabId.set(tabId, lastAccessed);
    if (previous > 0 && lastAccessed > previous + 250) {
      recordTabSwitchEvent(tabId, lastAccessed);
    }
  }
  forgetClosedTabs(aliveIds);
  if (typeof mostRecentTabId === 'number' && mostRecentLastAccessed > 0) {
    recordLatestSwitch(mostRecentTabId, mostRecentLastAccessed);
  }
}

function getTabSwitchRank(tab: ListedTab | null | undefined, now: number): TabSwitchRank {
  const safeNow = typeof now === 'number' ? now : Date.now();
  const stat = getTabSwitchStat(tab && typeof tab.id === 'number' ? tab.id : null, false);
  if (!stat) {
    return {
      score: 0,
      shortCount: 0,
      dayCount: 0,
      highFreq: false,
      hint: '',
      lastSwitchAt: 0
    };
  }
  pruneTabSwitchStat(stat, safeNow);
  const shortBoundary = safeNow - TAB_SWITCH_WINDOW_SHORT_MS;
  const dayBoundary = safeNow - TAB_SWITCH_WINDOW_DAY_MS;
  let shortCount = 0;
  let dayCount = 0;
  for (let i = 0; i < stat.events.length; i += 1) {
    const ts = Number(stat.events[i]) || 0;
    if (ts >= dayBoundary) {
      dayCount += 1;
    }
    if (ts >= shortBoundary) {
      shortCount += 1;
    }
  }
  const lastSwitchAt = Number(stat.lastSwitchAt) || 0;
  const minutesSinceSwitch = lastSwitchAt > 0 ? (safeNow - lastSwitchAt) / 60000 : 999999;
  const recencyBoost = Math.exp(-Math.max(0, minutesSinceSwitch) / 16);
  const score = (shortCount * 8) + (dayCount * 2.6) + (recencyBoost * 3.2);
  const highFreq = shortCount >= TAB_SWITCH_HIGH_FREQ_SHORT_THRESHOLD || dayCount >= TAB_SWITCH_HIGH_FREQ_DAY_THRESHOLD;
  const hint = highFreq
    ? (shortCount >= TAB_SWITCH_HIGH_FREQ_SHORT_THRESHOLD
      ? `近30分钟切换${shortCount}次`
      : `近24小时切换${dayCount}次`)
    : '';
  return {
    score: score,
    shortCount: shortCount,
    dayCount: dayCount,
    highFreq: highFreq,
    hint: hint,
    lastSwitchAt: lastSwitchAt
  };
}

// The Command Bar uses recency; other callers keep the frequency-weighted order.
export function sortTabsForOverlay<T extends ListedTab>(tabs: readonly T[], sortByRecency = false): Array<T & TabRankFields> {
  const list = Array.isArray(tabs) ? tabs.slice() : [];
  const now = Date.now();
  const sortAt = now;
  return list
    .map((tab, index) => {
      const rank = getTabSwitchRank(tab, now);
      const lastAccessed = Number(tab && tab.lastAccessed) || 0;
      const idleMinutes = lastAccessed > 0 ? (now - lastAccessed) / 60000 : 999999;
      const accessBoost = Math.exp(-Math.max(0, idleMinutes) / 30);
      const ranked: T & TabRankFields = {
        ...tab,
        _xTabRankScore: rank.score,
        _xTabSwitchCount30m: rank.shortCount,
        _xTabSwitchCount24h: rank.dayCount,
        _xTabDebugEventTotal: tabSwitchEventDebugTotal,
        _xTabLastAccessedRaw: lastAccessed,
        _xTabSortAt: sortAt,
        _xTabRankHighFreq: rank.highFreq,
        _xTabRankHint: rank.hint
      };
      return {
        tab: ranked,
        score: rank.score + accessBoost,
        lastAccessed: lastAccessed,
        lastUsedAt: Math.max(lastAccessed, rank.lastSwitchAt),
        index: index
      };
    })
    .sort((a, b) => {
      if (sortByRecency) {
        return b.lastUsedAt - a.lastUsedAt || a.index - b.index;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.lastAccessed !== a.lastAccessed) {
        return b.lastAccessed - a.lastAccessed;
      }
      return a.index - b.index;
    })
    .map((item) => item.tab);
}

export function createOverlayTabPayload(tab: ListedTab & TabRankFields & { id: number }, fetchSeq: number): OverlayTab {
  return {
    id: tab.id,
    title: typeof tab.title === 'string' ? tab.title : '',
    url: typeof tab.url === 'string' ? tab.url : '',
    favIconUrl: typeof tab.favIconUrl === 'string' ? tab.favIconUrl : '',
    _xTabRankScore: tab._xTabRankScore,
    _xTabSwitchCount30m: tab._xTabSwitchCount30m,
    _xTabSwitchCount24h: tab._xTabSwitchCount24h,
    _xTabDebugEventTotal: tab._xTabDebugEventTotal,
    _xTabLastAccessedRaw: tab._xTabLastAccessedRaw,
    _xTabSortAt: tab._xTabSortAt,
    _xTabRankHighFreq: tab._xTabRankHighFreq,
    _xTabRankHint: tab._xTabRankHint,
    _xTabFetchSeq: fetchSeq
  };
}
