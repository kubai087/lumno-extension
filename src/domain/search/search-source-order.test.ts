import { describe, expect, it } from 'vitest';
import * as order from './search-source-order';
import { searchSourceOrder } from '../settings/search';

const KEY = '_x_extension_search_source_order_2026_unique_';

interface Item {
  orderKey?: string;
  key?: string;
  id?: string;
}

function keys(items: Item[]): Array<string | undefined> {
  return items.map((item) => item.orderKey || item.key || item.id);
}

// The search scope panel as it is built before ranking: aggregates, then
// engines, site searches and AI searches with custom ones first, then browser
// content led by "Search open tabs".
const PANEL_ITEMS = [
  { groupKey: 'aggregate', orderList: 'aggregate', orderKey: 'Agg1' },
  { groupKey: 'aggregate', orderList: 'aggregate', orderKey: 'Agg2' },
  { groupKey: 'engine', orderList: 'engine', orderKey: 'bd' },
  { groupKey: 'engine', orderList: 'engine', orderKey: 'gg' },
  { groupKey: 'site', orderList: 'custom', orderKey: 'mine' },
  { groupKey: 'site', orderList: 'site', orderKey: 'yt' },
  { groupKey: 'site', orderList: 'site', orderKey: 'gh' },
  { groupKey: 'ai', orderList: 'custom', orderKey: 'myai' },
  { groupKey: 'ai', orderList: 'ai', orderKey: 'gpt' },
  { groupKey: 'ai', orderList: 'ai', orderKey: 'ds' },
  { groupKey: 'local', orderList: 'pinned', orderKey: 'openTabs' },
  { groupKey: 'local', orderList: 'local', orderKey: 'topSite' },
  { groupKey: 'local', orderList: 'local', orderKey: 'bookmark' },
  { groupKey: 'local', orderList: 'local', orderKey: 'history' }
];

describe('search source order', () => {
  it('is stored under its key with the usual groups and lists', () => {
    expect(searchSourceOrder.key).toBe(KEY);
    expect(order.DEFAULT_GROUP_ORDER).toEqual(['aggregate', 'engine', 'site', 'ai', 'local']);
    expect(order.LIST_IDS).toEqual(['custom', 'engine', 'site', 'ai', 'aggregate']);
  });

  it.each([undefined, null, 'x', [], { version: 99, groups: ['ai'] }])('keeps the usual order without a valid record (%j)', (value) => {
    const record = order.normalizeOrder(value);
    expect(record.groups).toEqual(['aggregate', 'engine', 'site', 'ai', 'local']);
    expect(record.local).toEqual(['topSite', 'bookmark', 'history']);
    order.LIST_IDS.forEach((listId) => expect(record.lists[listId]).toEqual([]));
    expect(keys(order.rankScopeItems(PANEL_ITEMS, value))).toEqual(keys(PANEL_ITEMS));
  });

  it('ranks whole groups by the stored group order', () => {
    const record = order.withGroups(null, ['local', 'ai']);
    expect(record.groups).toEqual(['local', 'ai', 'aggregate', 'engine', 'site']);
    expect(keys(order.rankScopeItems(PANEL_ITEMS, record))).toEqual([
      'openTabs', 'topSite', 'bookmark', 'history', 'myai', 'gpt', 'ds',
      'Agg1', 'Agg2', 'bd', 'gg', 'mine', 'yt', 'gh'
    ]);
  });

  it('orders lists inside their group, keeping custom searches and "Search open tabs" first', () => {
    let record = order.withList(null, 'site', ['gh', 'yt']);
    record = order.withList(record, 'aggregate', ['Agg2']);
    record = order.withLocal(record, ['history']);
    expect(keys(order.rankScopeItems(PANEL_ITEMS, record))).toEqual([
      'Agg2', 'Agg1', 'bd', 'gg', 'mine', 'gh', 'yt', 'myai', 'gpt', 'ds',
      'openTabs', 'history', 'topSite', 'bookmark'
    ]);
  });

  it('puts sources the record does not list after the listed ones, in their own order', () => {
    const record = order.withList(null, 'custom', ['myai', 'mine']);
    const items = [{ key: 'mine' }, { key: 'myai' }, { key: 'later' }];
    expect(order.sortList(items, record, 'custom').map((item) => item.key)).toEqual(['myai', 'mine', 'later']);
  });

  it('matches keys without case, but keeps the case of aggregate ids', () => {
    const record = order.withList(null, 'site', ['GH', 'YT']);
    expect(record.lists.site).toEqual(['gh', 'yt']);
    expect(order.sortList([{ key: 'yt' }, { key: 'Gh' }], record, 'site').map((item) => item.key)).toEqual(['Gh', 'yt']);
    expect(order.withList(null, 'aggregate', ['AbC']).lists.aggregate).toEqual(['AbC']);
  });

  it('reads local source types in their camelCase spelling', () => {
    const record = order.normalizeOrder({ version: 1, local: ['TOPSITE', 'history', 'nope'] });
    expect(record.local).toEqual(['topSite', 'history', 'bookmark']);
    expect(order.sortLocalSourceTypes(['bookmark', 'history', 'topSite'], record)).toEqual(['topSite', 'history', 'bookmark']);
  });

  it('leaves the slot of a stored but hidden source alone when shown rows move', () => {
    const stored = order.withList(null, 'site', ['yt', 'sf', 'gh', 'bb']);
    expect(order.applyMove(stored, 'site', ['yt', 'gh', 'bb'], ['bb', 'yt', 'gh']).lists.site).toEqual(['bb', 'sf', 'yt', 'gh']);
    expect(order.applyMove(null, 'engine', ['bd', 'gg', 'bi'], ['gg', 'bd', 'bi']).lists.engine).toEqual(['gg', 'bd', 'bi']);
  });

  it('applies a scope menu move to its list, keeping custom searches of other groups in place', () => {
    const stored = order.withList(null, 'custom', ['mine', 'myai', 'other']);
    const next = order.applyScopeMenuMove(stored, {
      list: 'custom',
      listItems: [{ orderKey: 'other' }, { orderKey: 'mine' }, { orderKey: 'myai' }],
      movedItems: [{ orderKey: 'other' }, { orderKey: 'mine' }]
    });
    expect(next.lists.custom).toEqual(['other', 'myai', 'mine']);
    const local = order.applyScopeMenuMove(null, {
      list: 'local',
      listItems: [{ orderKey: 'history' }, { orderKey: 'topSite' }],
      movedItems: [{ orderKey: 'history' }, { orderKey: 'topSite' }]
    });
    expect(local.local).toEqual(['history', 'bookmark', 'topSite']);
    expect(order.applyScopeMenuMove(stored, { list: 'pinned', movedItems: [] })).toEqual(order.normalizeOrder(stored));
  });

  it('keeps the record inside the sync budget', () => {
    const many = Array.from({ length: 400 }, (_, index) => `provider-key-${index}-padding-text`);
    const record = order.normalizeOrder({
      version: 1,
      lists: { custom: many, engine: many, site: many, ai: many, aggregate: many }
    });
    expect(JSON.stringify(record).length + KEY.length).toBeLessThanOrEqual(order.MAX_RECORD_BYTES);
    order.LIST_IDS.forEach((listId) => {
      expect(record.lists[listId].length).toBeLessThanOrEqual(order.MAX_LIST_ENTRIES);
    });
  });

  it('moves an item to an index, ignoring an index past the end', () => {
    expect(order.moveIndex(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(order.moveIndex(['a', 'b', 'c'], 0, 5)).toEqual(['a', 'b', 'c']);
  });

  it('swaps a shown group with its neighbour while a hidden group keeps its slot', () => {
    const shown = ['engine', 'site', 'ai', 'local'];
    const next = order.applyGroupMove(null, shown, 'ai', -1);
    expect(next.groups).toEqual(['aggregate', 'engine', 'ai', 'site', 'local']);
    expect(order.applyGroupMove(next, shown, 'engine', -1).groups).toEqual(next.groups);
    expect(order.applyGroupMove(null, shown, 'local', 1).groups).toEqual(['aggregate', 'engine', 'site', 'ai', 'local']);
    expect(order.applyGroupMove(null, ['aggregate', 'engine'], 'aggregate', 1).groups).toEqual(['engine', 'aggregate', 'site', 'ai', 'local']);
  });

  it('undoes and redoes moves, drops the redo branch on a new move and stops at a record changed elsewhere', () => {
    const history = order.createHistory({ limit: 3 });
    const a = order.normalizeOrder(null);
    const b = order.withGroups(a, ['ai']);
    const c = order.withGroups(b, ['local']);
    const d = order.withGroups(c, ['site']);
    const same = (left: order.SearchSourceOrder | null, right: order.SearchSourceOrder) => left !== null && order.isSameOrder(left, right);
    expect(history.canUndo()).toBe(false);
    history.record(a, b);
    history.record(b, c);
    history.record(c, c);
    expect(history.canRedo()).toBe(false);
    expect(same(history.undo(c), b)).toBe(true);
    expect(same(history.undo(b), a)).toBe(true);
    expect(history.undo(a)).toBeNull();
    expect(same(history.redo(a), b)).toBe(true);
    expect(same(history.redo(b), c)).toBe(true);
    expect(history.redo(c)).toBeNull();

    history.undo(c);
    history.record(b, d);
    expect(history.canRedo()).toBe(false);
    expect(history.undo(c)).toBeNull();
    expect(history.canUndo()).toBe(false);

    [a, b, c, d].forEach((record, index, all) => {
      if (index) history.record(all[index - 1], record);
    });
    history.record(d, a);
    expect(same(history.undo(a), d)).toBe(true);
    expect(same(history.undo(d), c)).toBe(true);
    expect(same(history.undo(c), b)).toBe(true);
    expect(history.canUndo()).toBe(false);
  });

  it('reads undo and redo shortcuts', () => {
    expect(order.getHistoryShortcut({ key: 'z', metaKey: true })).toBe('undo');
    expect(order.getHistoryShortcut({ key: 'z', ctrlKey: true })).toBe('undo');
    expect(order.getHistoryShortcut({ key: 'Z', metaKey: true, shiftKey: true })).toBe('redo');
    expect(order.getHistoryShortcut({ key: 'y', ctrlKey: true })).toBe('redo');
    expect(order.getHistoryShortcut({ key: 'y', metaKey: true })).toBe('');
    expect(order.getHistoryShortcut({ key: 'z', ctrlKey: true, altKey: true })).toBe('');
    expect(order.getHistoryShortcut({ key: 'z' })).toBe('');
  });
});
