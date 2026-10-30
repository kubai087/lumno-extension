import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHORTCUTS_SYNC_ITEM_BUDGET_BYTES,
  DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES,
  LEGACY_SHORTCUTS_CHUNK_KEYS,
  SHORTCUTS_SYNC_KEYS
} from './constants';
import { getShortcutStorageItemByteSize, normalizeShortcutGroups } from './normalize';
import {
  createShortcutStoragePlan,
  getShortcutSyncBudget,
  measureShortcutSyncUsage,
  readShortcutState,
  summarizeShortcutSync
} from './storage-plan';
import type { ShortcutStoragePlan, ShortcutSyncChunk, ShortcutSyncHead } from './types';

function isSyncHead(chunk: ShortcutSyncChunk | undefined): chunk is ShortcutSyncHead {
  return chunk !== undefined && 'g' in chunk && 'n' in chunk;
}

// The first sync key of a plan, which also holds the groups.
function headOf(plan: ShortcutStoragePlan): ShortcutSyncHead {
  const head = plan.payload[SHORTCUTS_SYNC_KEYS[0]];
  if (!isSyncHead(head)) {
    throw new Error('Expected the first sync key to hold the head.');
  }
  return head;
}

function createShortcutInputs(count: number, options: { titlePrefix?: string; path?: string; groupId?: (index: number) => string } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `shortcut-${index + 1}`,
    title: `${options.titlePrefix || 'Shortcut'} ${index + 1}`,
    url: `https://shortcut-${index + 1}.example/${options.path || ''}`,
    ...(options.groupId ? { groupId: options.groupId(index) } : {})
  }));
}

const copy = <T>(value: T): T => structuredClone(value);

describe('shortcut storage plan', () => {
  it('keeps two hundred ordinary shortcuts in browser sync, in a compact form', () => {
    const groups = [{ id: 'g0', title: '' }, { id: 'work', title: '工作' }, { id: 'read', title: '阅读' }];
    const items = Array.from({ length: 200 }, (_, index) => ({
      id: `s${index.toString(36)}`,
      title: index % 4 === 0 ? '' : `网站 ${index}`,
      url: `https://site-${index}.example.com/${'p'.repeat(index % 30)}`,
      groupId: groups[index % 3].id
    }));
    const plan = createShortcutStoragePlan({ groups, items }, { rev: 'r1', now: 1000 });

    expect(plan.overflowItems).toHaveLength(0);
    expect(plan.totalBytes).toBeLessThanOrEqual(DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES);
    SHORTCUTS_SYNC_KEYS.forEach((key) => {
      expect(getShortcutStorageItemByteSize(key, plan.payload[key])).toBeLessThanOrEqual(DEFAULT_SHORTCUTS_SYNC_ITEM_BUDGET_BYTES);
      // Every key of one save carries its revision.
      expect(plan.payload[key].r).toBe('r1');
    });
    const head = headOf(plan);
    expect(head.g).toEqual([['g0', ''], ['work', '工作'], ['read', '阅读']]);
    // The first save in the grouped format records when the device migrated.
    expect(head.m).toBe(1000);
    // A link entry drops the https scheme and a title that only repeats the host.
    expect(head.s[0]).toEqual(['s0', 0, '', 'site-0.example.com/']);

    const restored = readShortcutState(plan.payload, plan.overflowRecord);
    expect(restored.groups).toEqual(plan.state.groups);
    expect(restored.items).toEqual(plan.state.items);
    expect(restored.torn).toBe(false);
    expect(restored.rev).toBe('r1');
  });

  it('keeps the shortcuts past the byte budget in the overflow record and restores them into their groups', () => {
    const groups = [{ id: 'g0', title: '' }, { id: 'work', title: 'Work' }, { id: 'read', title: 'Read' }];
    const items = createShortcutInputs(90, {
      titlePrefix: `Long ${'标题'.repeat(12)}`,
      path: `?q=${'x'.repeat(200)}`,
      groupId: (index) => groups[Math.floor(index / 30)].id
    });
    const plan = createShortcutStoragePlan({ groups, items }, { rev: 'r2' });

    expect(plan.syncedItems.length).toBeGreaterThan(0);
    expect(plan.overflowItems.length).toBeGreaterThan(0);
    expect(plan.syncedItems.length + plan.overflowItems.length).toBe(90);
    // Every group is synced even when its shortcuts overflow, and overflow
    // entries remember their group.
    expect(headOf(plan).g.map((group) => group[0])).toEqual(['g0', 'work', 'read']);
    expect(plan.overflowRecord.items[0].groupId).toEqual(plan.overflowItems[0].groupId);

    const restored = readShortcutState(plan.payload, plan.overflowRecord);
    expect(restored.items.map((item) => item.id)).toEqual(items.map((item) => item.id));
    expect(restored.items.map((item) => item.groupId)).toEqual(items.map((item) => item.groupId));

    // A device without the overflow record still sees every group.
    const elsewhere = readShortcutState(plan.payload, null);
    expect(elsewhere.groups).toEqual(restored.groups);
    expect(elsewhere.items).toHaveLength(plan.syncedItems.length);
  });

  it('adds another save\'s overflow at the end of its groups without duplicating synced entries', () => {
    const groups = [{ id: 'g0', title: '' }, { id: 'work', title: 'Work' }];
    const syncedPlan = createShortcutStoragePlan({ groups, items: [
      { id: 'a', title: 'A', url: 'https://a.example/', groupId: 'g0' },
      { id: 'b', title: 'B renamed', url: 'https://b.example/', groupId: 'work' }
    ] }, { rev: 'new' });
    const state = readShortcutState(syncedPlan.payload, {
      version: 2,
      rev: 'old',
      authoritative: false,
      items: [
        { id: 'b', title: 'B', url: 'https://b.example/', groupId: 'work' },
        { id: 'c', title: 'C', url: 'https://c.example/', groupId: 'g0' },
        { id: 'legacy', title: 'Legacy', url: 'https://legacy.example/' }
      ]
    });

    expect(state.items.map((item) => [item.id, item.groupId])).toEqual([['a', 'g0'], ['c', 'g0'], ['legacy', 'g0'], ['b', 'work']]);
    expect(state.items.find((item) => item.id === 'b')).toMatchObject({ title: 'B renamed' });
  });

  it('reads the local record as the whole state after a failed sync write', () => {
    const syncedPlan = createShortcutStoragePlan({ items: [{ id: 'a', title: 'A', url: 'https://a.example/' }] }, { rev: 'new' });
    const authoritative = readShortcutState(syncedPlan.payload, {
      version: 2, authoritative: true, groups: [{ id: 'solo', title: 'Solo' }],
      items: [{ id: 'z', title: 'Z', url: 'https://z.example/' }]
    });

    expect(authoritative.groups).toEqual([{ id: 'solo', title: 'Solo' }]);
    expect(authoritative.items.map((item) => [item.id, item.groupId])).toEqual([['z', 'solo']]);
    expect(authoritative.source).toBe('local');
  });

  it('still reads an overflow record from before groups', () => {
    const legacyArray = readShortcutState({}, [{ id: 'old', title: 'Old', url: 'https://old.example/' }]);

    expect(legacyArray.items.map((item) => item.id)).toEqual(['shortcut-lumno-default', 'old']);
  });

  it('marks a read torn when its keys come from different saves, without losing entries', () => {
    const items = createShortcutInputs(120, { path: 'x'.repeat(60) });
    const plan = createShortcutStoragePlan({ items }, { rev: 'r3' });
    expect(headOf(plan).n).toBeGreaterThanOrEqual(2);

    const stale = copy(plan.payload);
    stale[SHORTCUTS_SYNC_KEYS[1]].r = 'older';
    const mixed = readShortcutState(stale, null);
    expect(mixed.torn).toBe(true);
    expect(mixed.items).toHaveLength(120);

    // A key the head counts on that has not arrived.
    const missing = copy(plan.payload);
    delete missing[SHORTCUTS_SYNC_KEYS[1]];
    expect(readShortcutState(missing, null).torn).toBe(true);
  });

  it('ignores keys past the ones the head counts', () => {
    const items = createShortcutInputs(2);
    const unused: Record<string, unknown> = copy(createShortcutStoragePlan({ items }, { rev: 'r4' }).payload);
    unused[SHORTCUTS_SYNC_KEYS[2]] = { r: 'ancient', s: [['ghost', 0, 'Ghost', 'ghost.example/']] };
    const small = readShortcutState(unused, null);

    expect(small.torn).toBe(false);
    expect(small.items.map((item) => item.id)).toEqual(['shortcut-1', 'shortcut-2']);
  });

  it('stores icon plate choices after an empty icon source slot older versions ignore', () => {
    const plan = createShortcutStoragePlan({
      groups: normalizeShortcutGroups(null),
      items: [{ id: 'a', url: 'https://plate.example/', iconPlate: 'on' }]
    }, { rev: 'r1', now: 1 });
    const entry = headOf(plan).s[0];

    expect(entry[4]).toBe('');
    expect(entry[5]).toBe('on');
    // Trailing empty plate fields are not stored.
    expect(entry).toHaveLength(6);
  });

  it('stores the bookmark origin mark after the plate fields', () => {
    const plan = createShortcutStoragePlan({
      groups: normalizeShortcutGroups(null),
      items: [{ id: 'a', url: 'https://copied.example/', fromBookmark: true }]
    }, { rev: 'r1', now: 1 });

    expect(headOf(plan).s[0].slice(4)).toEqual(['', '', '', 1]);
  });
});

describe('shortcut sync budget', () => {
  it('leaves room in browser sync for other settings', () => {
    expect(getShortcutSyncBudget({ totalBytes: 0 })).toBe(DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES);
    // The legacy copy counts against the shortcut ceiling, never against other settings.
    expect(getShortcutSyncBudget({ totalBytes: 12000, shortcutBytes: 2000, legacyBytes: 10000 }))
      .toBe(DEFAULT_SHORTCUTS_SYNC_TOTAL_BUDGET_BYTES - 10000);
    // Shortcuts never take the space reserved for other settings.
    expect(getShortcutSyncBudget({ quotaBytes: 102400, totalBytes: 30000, shortcutBytes: 5000 })).toBe(102400 - 65536 - 25000);
    expect(getShortcutSyncBudget({ quotaBytes: 102400, totalBytes: 60000 })).toBe(0);
  });

  it('measures the bytes of the grouped copy, the legacy copy and everything else', () => {
    const usage = measureShortcutSyncUsage({
      [SHORTCUTS_SYNC_KEYS[0]]: { r: 'a' },
      [LEGACY_SHORTCUTS_CHUNK_KEYS[0]]: [],
      other: 'value'
    });

    expect(usage.shortcutBytes).toBe(getShortcutStorageItemByteSize(SHORTCUTS_SYNC_KEYS[0], { r: 'a' }));
    expect(usage.legacyBytes).toBe(getShortcutStorageItemByteSize(LEGACY_SHORTCUTS_CHUNK_KEYS[0], []));
    expect(usage.totalBytes).toBe(usage.shortcutBytes + usage.legacyBytes + getShortcutStorageItemByteSize('other', 'value'));
  });
});

describe('shortcut sync summary', () => {
  it('counts the shortcuts browser sync carries and those only this device keeps', () => {
    const items = createShortcutInputs(30, { path: `?q=${'z'.repeat(200)}` });
    const split = createShortcutStoragePlan({ items }, { maxTotalBytes: 3000 });
    expect(split.overflowItems.length).toBeGreaterThan(0);
    expect(split.syncedItems.length).toBeGreaterThan(0);
    expect(summarizeShortcutSync(split.payload, split.overflowRecord))
      .toEqual({ total: 30, synced: split.syncedItems.length, localOnly: split.overflowItems.length, syncFailed: false });

    const fits = createShortcutStoragePlan({ items: items.slice(0, 3) });
    expect(summarizeShortcutSync(fits.payload, fits.overflowRecord)).toEqual({ total: 3, synced: 3, localOnly: 0, syncFailed: false });
  });

  it('counts every shortcut local after a failed sync write', () => {
    const items = createShortcutInputs(4);
    const fits = createShortcutStoragePlan({ items: items.slice(0, 3) });

    expect(summarizeShortcutSync(fits.payload, { version: 2, authoritative: true, items }))
      .toEqual({ total: 4, synced: 0, localOnly: 4, syncFailed: true });
  });

  it('does not count the default shortcut or the legacy list as local-only', () => {
    const items = createShortcutInputs(6);

    expect(summarizeShortcutSync({}, null)).toEqual({ total: 1, synced: 1, localOnly: 0, syncFailed: false });
    // Its old overflow array counts as local.
    expect(summarizeShortcutSync({ [LEGACY_SHORTCUTS_CHUNK_KEYS[0]]: items.slice(0, 2) }, [items[5]]).localOnly).toBe(1);
  });
});
