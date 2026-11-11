import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { overlayOpenTabsDefaultVisible } from '../../../src/domain/settings/overlay-panel';
import { parseStylesheet } from '../../fakes/css';
import { SURFACES, openSearchSurface, suggestionOf, type SearchSurface } from './surfaces';

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
  // host, not the input that composed; the commit window still holds there.
  it('does not search on an Enter right after the composition ends', async () => {
    const surface = await openSearchSurface(name);
    await composeNi(surface);
    surface.press('Enter', { keyCode: 13 });
    await surface.settle(60);
    expect(surface.navigation()).toBeNull();
  });

  it('searches the full committed query when Enter is pressed before the new suggestions arrive', async () => {
    const never = new Promise(() => {});
    const surface = await openSearchSurface(name, {
      respond(message) {
        if (message.action === 'getSearchSuggestions' && message.query === 'react 教程入门') {
          return never;
        }
        if (message.action === 'getSearchSuggestions' && message.query === 'react 教程') {
          return { suggestions: [{ type: 'history', title: 'React 教程', url: 'https://react.example.test/' }] };
        }
        return undefined;
      }
    });
    await surface.type(' react 教程');
    await surface.waitFor(() => surface.suggestions().length > 0, `${name}: prefix suggestions did not render`);

    const input = surface.input();
    const composition = (type: string, data: string) =>
      surface.trusted(input, new CompositionEvent(type, { bubbles: true, composed: true, data }));
    composition('compositionstart', 'r');
    act(() => {
      input.value = ' react 教程rumen';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      input.value = ' react 教程入门';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    composition('compositionend', '入门');
    surface.keyup(' ', { code: 'Space', keyCode: 32 });
    surface.press('Enter', { keyCode: 13 });
    await surface.settle(120);

    expect(surface.navigation()).toEqual({ search: 'react 教程入门' });
  });

  it('searches the full query instead of an earlier prefix search row when Enter races suggestion rendering', async () => {
    const never = new Promise(() => {});
    const surface = await openSearchSurface(name, {
      respond(message) {
        if (message.action === 'getSearchSuggestions' && message.query === 'react 教程入门') {
          return never;
        }
        return undefined;
      }
    });
    await surface.type(' react 教程');
    await surface.waitFor(
      () => suggestionOf(surface.suggestions()[0] || document.body).searchQuery === 'react 教程',
      `${name}: prefix search row did not render`
    );

    const input = surface.input();
    act(() => {
      input.value = ' react 教程入门';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    surface.press('Enter', { keyCode: 13 });
    await surface.settle(120);

    expect(surface.navigation()).toEqual({ search: 'react 教程入门' });
  });
});

describe('Overlay Enter while initial open tabs are still shown', () => {
  it('searches the typed query instead of switching to the first open tab while suggestions are pending', async () => {
    const never = new Promise(() => {});
    const tabs = [{ id: 9, windowId: 1, title: 'Open Tab', url: 'https://open-tab.example.test/' }];
    const surface = await openSearchSurface('overlay', {
      openContext: { tabs },
      settings: { [overlayOpenTabsDefaultVisible.key]: true },
      respond(message) {
        if (message.action === 'getTabsForOverlay' || message.action === 'getTabs') return { tabs };
        if (message.action === 'getSearchSuggestions') return never;
        return undefined;
      }
    });
    await surface.waitFor(() => surface.suggestions().length > 0, 'overlay open tabs did not render');

    const input = surface.input();
    const before = surface.messages.length;
    act(() => {
      input.value = 'react 教程入门';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    surface.press('Enter', { keyCode: 13 });
    await surface.settle(120);

    expect(surface.messages.slice(before).some((message) => message.action === 'switchToTab')).toBe(false);
    expect(surface.navigation()).toEqual({ search: 'react 教程入门' });
  });
});

describe('New Tab search box before the page is ready', () => {
  it('stays focusable, so early keys reach the IME', () => {
    const root = parseStylesheet('src/newtab/styles/page.css').rule('#_x_extension_newtab_root_2024_unique_');
    expect(root).not.toBeNull();
    expect(root?.get('visibility')).not.toBe('hidden');
  });
});
