import { describe, expect, it } from 'vitest';
import { getElement } from '../../fakes/dom';
import { parseStylesheet, readRepoFile } from '../../fakes/css';
import { SURFACES, openSearchSurface, suggestionOf, type SurfaceMessage, type SurfaceName } from './surfaces';

// Holding the primary modifier (⌘ on macOS, Ctrl elsewhere) over results
// arms number jump mode with a Toast; releasing it shows a number on each
// result, and a digit opens that result. The timing is unit-tested beside
// src/shared/search/suggestion-navigation.ts.

const RESULTS = Array.from({ length: 4 }, (_, index) => ({ type: 'history', title: `Result ${index}`, url: `https://r${index}.test/` }));

type Modifier = [key: string, code: string, flag: 'ctrlKey' | 'metaKey' | 'altKey'];

const PARTS: Record<SurfaceName, { container: string; badge: string; modifier: Modifier }> = {
  overlay: { container: '#_x_extension_suggestions_container_2024_unique_', badge: '.x-ov-suggestion-number-shortcut', modifier: ['Control', 'ControlLeft', 'ctrlKey'] },
  newtab: { container: '#_x_extension_newtab_suggestions_container_2024_unique_', badge: '.x-nt-suggestion-number-shortcut', modifier: ['Meta', 'MetaLeft', 'metaKey'] }
};

async function openWithResults(name: SurfaceName) {
  const surface = await openSearchSurface(name, {
    respond: (message: SurfaceMessage) => (message.action === 'getSearchSuggestions' ? { suggestions: RESULTS } : undefined)
  });
  await surface.type('result');
  await surface.settle(150);
  const parts = PARTS[name];
  const container = getElement(surface.root(), parts.container);
  const mode = () => [container.getAttribute('data-number-shortcuts-active'), container.getAttribute('data-number-shortcuts-scroll-locked')];
  const hold = async ([key, code, flag]: Modifier) => {
    surface.press(key, { code, [flag]: true });
    await surface.settle(450);
  };
  const release = async () => {
    surface.keyup(parts.modifier[0], { code: parts.modifier[1] });
    await surface.settle(40);
  };
  return { surface, parts, mode, hold, release };
}

describe.each(SURFACES)('%s number shortcuts', (name) => {
  it('numbers the results, arms on a hold, shows the numbers on release and opens the result of a digit', async () => {
    const { surface, parts, mode, hold, release } = await openWithResults(name);
    const badges = surface.suggestions().map((row) => getElement(row, parts.badge).textContent);
    expect(badges).toEqual(badges.map((_badge, index) => String(index)));
    const second = suggestionOf(surface.suggestions()[2] || document.body).url;
    expect(mode()).toEqual([null, null]);
    await hold(parts.modifier);
    expect(mode()).toEqual([null, 'true']);
    expect(surface.toast()).toEqual({ shown: true, text: 'Release to show numbers' });
    await release();
    expect(mode()).toEqual(['true', 'true']);
    expect(surface.toast().shown).toBe(false);
    surface.press('2', { code: 'Digit2' });
    await surface.settle(120);
    expect(surface.navigation()).toEqual({ url: second });
    expect(mode()).toEqual([null, null]);
  });

  it('leaves number mode when the pointer is used', async () => {
    const { surface, parts, mode, hold, release } = await openWithResults(name);
    await hold(parts.modifier);
    await release();
    surface.trusted(surface.suggestions()[0] || document.body, new MouseEvent('pointerdown', { bubbles: true, composed: true }));
    await surface.settle(30);
    expect(mode()).toEqual([null, null]);
  });

  it('does not arm on the background-open modifier alone', async () => {
    const { mode, hold } = await openWithResults(name);
    await hold(['Alt', 'AltLeft', 'altKey']);
    expect(mode()).toEqual([null, null]);
  });
});

describe('Number shortcut styles', () => {
  it.each([
    ['New Tab', ['src/newtab/styles/suggestions.css', 'src/newtab/styles/page-overrides.css', 'src/newtab/styles/notices-and-suggestions.css'], 'x-nt'],
    ['Overlay', ['src/overlay/suggestions-view.css'], 'x-ov']
  ])('%s shows the numbers and locks scrolling only in number mode', (_surface, files, prefix) => {
    const entries = files.flatMap((file) => parseStylesheet(file).entries).filter((entry) => entry.conditions.length === 0);
    const badge = `.${prefix}-suggestion-number-shortcut`;
    const declares = (test: (selector: string) => boolean, property: string, value: string) => (
      entries.some((entry) => entry.selectors.some(test) && entry.style.getPropertyValue(property) === value)
    );
    expect(declares((selector) => selector.includes('[data-number-shortcuts-active="true"]') && selector.endsWith(badge), 'display', 'inline-flex')).toBe(true);
    expect(declares((selector) => selector.endsWith('[data-number-shortcuts-scroll-locked="true"]'), 'overflow-y', 'hidden')).toBe(true);
  });

  it('styles the number badges of the onboarding previews', () => {
    const onboarding = new DOMParser().parseFromString(readRepoFile('src/onboarding/onboarding.html'), 'text/html');
    expect(onboarding.querySelector('link[rel="stylesheet"][href="../overlay/suggestions-view.css"]')).not.toBeNull();
    expect(parseStylesheet('src/onboarding/styles/newtab-preview.css').selectors()
      .some((selector) => selector.includes('.x-nt-suggestion-number-shortcut'))).toBe(true);
  });
});
