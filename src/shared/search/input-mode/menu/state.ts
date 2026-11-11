// What the mode menu shows and where it is between opening and closing,
// and the changes to its entries. The state belongs to the menu: only its
// own modules read and write it.
import type { ModeMenuEntry, ModeMenuItem, ModeMenuSearchIndex } from '../types';

interface ModeMenuState {
  destroyed: boolean;
  open: boolean;
  // The open motion has played; false while it waits for its frame.
  revealed: boolean;
  // An open or refresh is waiting for its items.
  pending: boolean;
  busy: boolean;
  // Focus is in the panel, where typing filters it.
  searchActive: boolean;
  // The input has text: the panel lifts a little.
  hasQuery: boolean;
  // The tile that takes Tab focus; empty for none.
  focusId: string;
  filterQuery: string;
  entries: ModeMenuEntry[];
  // Counts open and refresh requests, so a late answer knows it is stale.
  requestId: number;
}

function createModeMenuState(): ModeMenuState {
  return {
    destroyed: false,
    open: false,
    revealed: false,
    pending: false,
    busy: false,
    searchActive: false,
    hasQuery: false,
    focusId: '',
    filterQuery: '',
    entries: [],
    requestId: 0
  };
}

function isModeMenuItem(item: ModeMenuItem | null | undefined): item is ModeMenuItem {
  return Boolean(item && item.id && item.label);
}

// The entries for the items that can be shown.
function createModeMenuEntries(
  items: ReadonlyArray<ModeMenuItem | null | undefined> | null | undefined,
  buildSearchIndex: (item: ModeMenuItem) => Readonly<ModeMenuSearchIndex>
): ModeMenuEntry[] {
  const shown = Array.isArray(items) ? items.filter(isModeMenuItem) : [];
  return shown.map((item) => ({
    checked: Boolean(item.active),
    group: item.group ? String(item.group) : '',
    item,
    labelText: String(item.label),
    // Indexing is only needed when the user filters the menu.
    get searchIndex() { return buildSearchIndex(item); }
  }));
}

function findModeMenuEntry(entries: readonly ModeMenuEntry[], id: string): ModeMenuEntry | undefined {
  return entries.find((entry) => String(entry.item.id) === id);
}

// Marks the mode as the selected one; false when no entry shows it.
function selectModeMenuEntry(entries: readonly ModeMenuEntry[], modeId: string): boolean {
  let matched = false;
  entries.forEach((entry) => {
    entry.checked = Boolean(modeId && String(entry.item.id) === modeId);
    matched = matched || entry.checked;
  });
  return matched;
}

// The entries with the moved ones, in their given order, where the last of
// them was; null when none of the ids is an entry.
function moveModeMenuEntries(
  entries: readonly ModeMenuEntry[],
  orderedIds: readonly string[]
): { entries: ModeMenuEntry[]; moved: ModeMenuEntry[] } | null {
  const moved = orderedIds
    .map((orderedId) => findModeMenuEntry(entries, orderedId))
    .filter((entry): entry is ModeMenuEntry => Boolean(entry));
  if (moved.length === 0) {
    return null;
  }
  const movedSet = new Set(moved);
  let lastIndex = -1;
  entries.forEach((entry, index) => {
    if (movedSet.has(entry)) {
      lastIndex = index;
    }
  });
  return {
    entries: [
      ...entries.slice(0, lastIndex + 1).filter((entry) => !movedSet.has(entry)),
      ...moved,
      ...entries.slice(lastIndex + 1)
    ],
    moved
  };
}

// The keys of the groups in the order their titles show.
function getModeMenuGroupKeys(entries: readonly ModeMenuEntry[]): string[] {
  const keys: string[] = [];
  let previousGroup = '';
  entries.forEach((entry) => {
    if (entry.group && entry.group !== previousGroup) {
      keys.push(entry.item.groupKey ? String(entry.item.groupKey) : '');
      previousGroup = entry.group;
    }
  });
  return keys.filter(Boolean);
}

export type { ModeMenuState };
export {
  createModeMenuEntries,
  createModeMenuState,
  findModeMenuEntry,
  getModeMenuGroupKeys,
  moveModeMenuEntries,
  selectModeMenuEntry
};
