import { describe, expect, it, vi } from 'vitest';
import { createModeMenuEntries } from './state';
import type { ModeMenuSearchIndex } from '../types';

describe('mode menu entries', () => {
  it('defers search index construction until a filter needs it', () => {
    const index: ModeMenuSearchIndex = { label: 'site', labelMap: [], units: null, searchTerms: [] };
    const build = vi.fn(() => index);
    const entries = createModeMenuEntries([{ id: 'site', label: 'Site' }], build);
    expect(build).not.toHaveBeenCalled();
    expect(entries[0].searchIndex).toBe(index);
    expect(build).toHaveBeenCalledTimes(1);
  });
});
