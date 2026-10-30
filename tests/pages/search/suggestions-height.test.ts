import { describe, expect, it } from 'vitest';
import { getElement } from '../../fakes/dom';
import { SURFACES, openSearchSurface, type SurfaceMessage } from './surfaces';

// Both surfaces leave their result list at its natural height; the policy is
// unit-tested beside src/shared/search/suggestions-height-layout.ts.

const CONTAINERS = {
  overlay: '#_x_extension_suggestions_container_2024_unique_',
  newtab: '#_x_extension_newtab_suggestions_container_2024_unique_'
};
const RESULTS = Array.from({ length: 6 }, (_, index) => ({ type: 'history', title: `Result ${index}`, url: `https://r${index}.test/` }));

describe.each(SURFACES)('%s result list height', (name) => {
  it('is not held at a fixed height and does not animate', async () => {
    const surface = await openSearchSurface(name, {
      respond: (message: SurfaceMessage) => (message.action === 'getSearchSuggestions' ? { suggestions: RESULTS } : undefined)
    });
    await surface.type('result');
    await surface.settle(150);
    const style = getElement(surface.root(), CONTAINERS[name]).style;
    expect(['height', 'flex', 'overflow-y', 'will-change'].map((property) => style.getPropertyValue(property))).toEqual(['', '', '', '']);
    expect(style.getPropertyValue('transition')).toBe('none');
  });
});
