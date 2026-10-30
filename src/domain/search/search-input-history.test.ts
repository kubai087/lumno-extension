import { describe, expect, it } from 'vitest';
import { createSearchInputHistoryController, getShortcutDirection } from './search-input-history';
import { getFixedShortcutDefinitions, getShortcutReferenceGroups } from '../shortcut-reference';

// The history setting as the controller's storage port.
function createStorage(initial: unknown) {
  const state = { value: initial };
  return {
    state,
    read: async () => state.value,
    async write(value: unknown) {
      state.value = value;
    },
    subscribe: () => () => {}
  };
}

const KEYS = { ctrlKey: false, altKey: true, metaKey: false, shiftKey: false };

describe('search input history', () => {
  it('walks back through submitted input and forward again to the unfinished draft', async () => {
    const controller = createSearchInputHistoryController({ storage: createStorage(['first query', 'second query']) });
    await controller.load();
    expect(controller.move('previous', 'unfinished draft')).toEqual({ handled: true, value: 'second query' });
    expect(controller.move('previous', 'second query')).toEqual({ handled: true, value: 'first query' });
    expect(controller.move('next', 'first query')).toEqual({ handled: true, value: 'second query' });
    expect(controller.move('next', 'second query')).toEqual({ handled: true, value: 'unfinished draft' });
  });

  it('keeps each entry once, most recent last, within the limit, and saves it', async () => {
    const storage = createStorage(['one', 'two', 'one']);
    const controller = createSearchInputHistoryController({ maxEntries: 3, storage });
    await controller.load();
    expect(controller.getEntries()).toEqual(['two', 'one']);
    expect(controller.record('  three  ')).toBe(true);
    expect(controller.record('two')).toBe(true);
    expect(controller.getEntries()).toEqual(['one', 'three', 'two']);
    expect(storage.state.value).toEqual(['one', 'three', 'two']);
  });

  it('reads Alt+Up and Alt+Down as its shortcut, but not with Shift', () => {
    expect(getShortcutDirection({ ...KEYS, key: 'ArrowUp', code: 'ArrowUp' })).toBe('previous');
    expect(getShortcutDirection({ ...KEYS, key: 'ArrowDown', code: 'ArrowDown' })).toBe('next');
    expect(getShortcutDirection({ ...KEYS, key: 'ArrowUp', code: 'ArrowUp', shiftKey: true })).toBe('');
  });

  it('is listed in the shortcut reference', () => {
    const listed = [
      ...getShortcutReferenceGroups().flatMap((group) => group.items).map((item) => item.shortcut),
      ...getFixedShortcutDefinitions().map((item) => item.shortcut)
    ];
    expect(listed).toContain('Alt+ArrowUp / Alt+ArrowDown');
  });
});
