// What the worker or the page sends the switcher, read as untrusted: the
// context it opens with, the thumbnails captured after it opened, and the
// offsets that move its selection.
import type { TabSwitcherThumbnailUpdate } from '../react/tab-switcher';
import type { TabSwitcherTab } from '../react/tab-switcher-options';

// The context the worker opens the switcher with, as read from its message.
interface OpenContext {
  tabs: TabSwitcherTab[];
  selectedIndex: unknown;
  // The page's zoom, which the switcher undoes to keep its size.
  tabZoomFactor: unknown;
  advanceOnExisting: boolean;
  suppressInitialShortcutAdvance: boolean;
  shortcut: unknown;
  // Opened by the reverse command, on the oldest tab.
  reverse: boolean;
}

// The optional string fields a tab and a thumbnail update carry.
const TAB_TEXT_FIELDS = ['title', 'url', 'favIconUrl', 'thumbnail', 'thumbnailStatus', 'thumbnailReason'] as const;
const THUMBNAIL_TEXT_FIELDS = ['url', 'thumbnail', 'thumbnailStatus', 'thumbnailReason'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function readTab(value: unknown): TabSwitcherTab | null {
  if (!isRecord(value) || typeof value.id !== 'number') {
    return null;
  }
  const tab: TabSwitcherTab = { id: value.id, accentRgb: value.accentRgb };
  if (typeof value.windowId === 'number') {
    tab.windowId = value.windowId;
  } else if (value.windowId === null) {
    tab.windowId = null;
  }
  TAB_TEXT_FIELDS.forEach((field) => {
    const text = value[field];
    if (typeof text === 'string') {
      tab[field] = text;
    }
  });
  return tab;
}

// At most five tabs with an id; the rest of the context as sent.
function readOpenContext(value: unknown): OpenContext {
  const context = isRecord(value) ? value : {};
  const tabs = Array.isArray(context.tabs)
    ? context.tabs.map(readTab).filter((tab): tab is TabSwitcherTab => tab !== null).slice(0, 5)
    : [];
  return {
    tabs,
    selectedIndex: context.selectedIndex,
    tabZoomFactor: context.tabZoomFactor,
    advanceOnExisting: context.advanceOnExisting === true,
    suppressInitialShortcutAdvance: context.suppressInitialShortcutAdvance === true,
    shortcut: context.shortcut,
    reverse: context.reverse === true
  };
}

function readThumbnailUpdate(value: unknown): TabSwitcherThumbnailUpdate {
  const update: TabSwitcherThumbnailUpdate = {};
  if (!isRecord(value)) {
    return update;
  }
  if (typeof value.tabId === 'number') {
    update.tabId = value.tabId;
  }
  THUMBNAIL_TEXT_FIELDS.forEach((field) => {
    const text = value[field];
    if (typeof text === 'string') {
      update[field] = text;
    }
  });
  return update;
}

function clampSelectedIndex(index: unknown, length: number): number {
  if (length <= 0) {
    return 0;
  }
  const normalized = Number.isFinite(Number(index)) ? Number(index) : 0;
  return ((normalized % length) + length) % length;
}

function normalizeAdvanceOffset(value: unknown): number {
  const offset = Math.trunc(Number(value));
  return Number.isFinite(offset) && offset !== 0 ? offset : 1;
}

export type { OpenContext };
export { clampSelectedIndex, isRecord, normalizeAdvanceOffset, readOpenContext, readThumbnailUpdate };
