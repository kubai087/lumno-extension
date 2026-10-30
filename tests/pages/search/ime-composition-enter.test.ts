import { describe, expect, it } from 'vitest';
import { parseStylesheet } from '../../fakes/css';
import { SURFACES, openSearchSurface, type SearchSurface } from './surfaces';

// On both surfaces, the Enter that commits an IME candidate does not search;
// the guard's timing is unit-tested beside src/domain/search/ime-key-guard.ts.

async function composeNi(surface: SearchSurface) {
  const input = surface.input();
  const composition = (type: string) => surface.trusted(input, new CompositionEvent(type, { bubbles: true, composed: true, data: '你' }));
  composition('compositionstart');
  input.value = 'ni';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await surface.settle(60);
  surface.press('Enter', { isComposing: true, keyCode: 229 });
  await surface.settle(60);
  expect(surface.navigation()).toBeNull();
  input.value = '你';
  composition('compositionend');
}

describe.each(SURFACES)('%s IME composition', (name) => {
  it('picks the candidate on an Enter while composing, and searches on the next Enter', async () => {
    const surface = await openSearchSurface(name);
    await composeNi(surface);
    surface.keyup('Enter', { keyCode: 13 });
    surface.press('Enter', { keyCode: 13 });
    await surface.settle(120);
    expect(surface.navigation()).toEqual({ search: '你' });
  });

  // The overlay hears keys at the window, where a key's target is the overlay
  // host rather than the input that composed, so its commit window never
  // matches the Enter (reported, not fixed here).
  (name === 'overlay' ? it.fails : it)('does not search on an Enter right after the composition ends', async () => {
    const surface = await openSearchSurface(name);
    await composeNi(surface);
    surface.press('Enter', { keyCode: 13 });
    await surface.settle(60);
    expect(surface.navigation()).toBeNull();
  });
});

describe('New Tab search box before the page is ready', () => {
  it('stays focusable, so early keys reach the IME', () => {
    const root = parseStylesheet('src/newtab/styles/page.css').rule('#_x_extension_newtab_root_2024_unique_');
    expect(root).not.toBeNull();
    expect(root?.get('visibility')).not.toBe('hidden');
  });
});
