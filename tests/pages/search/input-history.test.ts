import { describe, expect, it } from 'vitest';
import { searchInputHistory } from '../../../src/domain/settings/search';
import { SURFACES, openSearchSurface } from './surfaces';

// Alt+Up / Alt+Down walk through what was submitted before, on both search
// surfaces, and come back to the unfinished draft. The history itself is
// unit-tested beside src/domain/search/search-input-history.ts.

describe.each(SURFACES)('%s input history', (name) => {
  it('walks the submitted input with Alt and the arrow keys', async () => {
    const surface = await openSearchSurface(name, { local: { [searchInputHistory.key]: ['first query', 'second query'] } });
    await surface.settle(80);
    await surface.type('unfinished draft');
    const step = async (key: string) => {
      surface.press(key, { altKey: true });
      await surface.settle(40);
      return surface.input().value;
    };
    expect([await step('ArrowUp'), await step('ArrowUp'), await step('ArrowDown'), await step('ArrowDown')])
      .toEqual(['second query', 'first query', 'second query', 'unfinished draft']);
  });
});
