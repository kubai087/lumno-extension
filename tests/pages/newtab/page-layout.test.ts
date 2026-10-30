import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { newtabWidthMode } from '../../../src/domain/settings/newtab-page';
import { motionEffectsEnabled } from '../../../src/domain/settings/appearance';
import { parsePageCss, readPageSource } from '../../fakes/css';
import { getElementById } from '../../fakes/dom';
import { openDragPage } from './drag-page';

// New Tab's page-level layout as it runs: grid columns by viewport, resizing
// without reloading recent sites, and the entrance sequence.

const BOOKMARK_GRID_ID = '_x_extension_newtab_bookmarks_grid_2024_unique_';
const RECENT_GRID_ID = '_x_extension_newtab_recent_sites_grid_2024_unique_';
const SEARCH_ROOT_ID = '_x_extension_newtab_root_2024_unique_';
const HISTORY = Array.from({ length: 20 }, (_, index) => ({
  url: `https://site${index}.example/`,
  title: `Site ${index}`,
  lastVisitTime: Date.now() - index * 1000,
  visitCount: 3
}));

function openPage(width: number, sync: Record<string, unknown> = {}) {
  return openDragPage({ unplaced: true, viewport: { width }, recent: HISTORY, bookmarks: [{ title: 'A', url: 'https://a.example/' }], sync });
}

const columns = () => [
  getElementById(BOOKMARK_GRID_ID).style.getPropertyValue('--x-nt-bookmark-columns'),
  getElementById(RECENT_GRID_ID).style.getPropertyValue('--x-nt-recent-columns')
];

describe('New Tab grid columns', () => {
  it('default to six bookmark columns on a wide window', async () => {
    await openPage(1600);
    expect(columns()[0]).toBe('6');
  });

  it('show two columns in the mobile flow on a phone, and more from the loaded sites once widened', async () => {
    const newtab = await openPage(375);
    expect(columns()).toEqual(['2', '2']);
    expect(document.body.classList.contains('x-nt-mobile-flow')).toBe(true);

    const loads = vi.spyOn(newtab.browser.history, 'search');
    newtab.layout.viewport({ width: 1600 });
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
    });
    await newtab.advance(600);
    expect(columns()).toEqual(['6', '5']);
    expect(loads).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.x-nt-recent-card')).toHaveLength(10);
  });

  it.each([['standard', '4'], ['wide', '6']])('give recent sites more columns in wide mode: %s mode shows %s', async (mode, expected) => {
    await openPage(1800, { [newtabWidthMode.key]: mode });
    expect(columns()[1]).toBe(expected);
  });
});

describe('the New Tab entrance', () => {
  it('runs on the page and its shared search entry once the first layout is ready, and a key press ends it', async () => {
    let started: { ready: string | null; entrance: Array<string | null> } | null = null;
    let afterKey: Array<string | null> | null = null;
    const observer = new MutationObserver(() => {
      if (started || document.body.getAttribute('data-nt-enter') !== 'run') return;
      const searchRoot = getElementById(SEARCH_ROOT_ID);
      const entrance = () => [document.body.getAttribute('data-nt-enter'), searchRoot.getAttribute('data-lumno-search-entry')];
      started = { ready: document.body.getAttribute('data-nt-ready'), entrance: entrance() };
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      afterKey = entrance();
    });
    await openDragPage({
      unplaced: true,
      sync: { [motionEffectsEnabled.key]: true },
      beforeBoot: () => observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-nt-enter'] })
    });
    observer.disconnect();
    expect(started).toEqual({ ready: '1', entrance: ['run', 'run'] });
    expect(afterKey).toEqual(['done', 'done']);
  });

  it('does not run with motion off', async () => {
    await openDragPage({ unplaced: true, sync: { [motionEffectsEnabled.key]: false } });
    expect(document.body.getAttribute('data-nt-ready')).toBe('1');
    expect(document.body.getAttribute('data-nt-enter')).toBe('done');
  });
});

describe('the New Tab layout as shipped', () => {
  it('opts the search surface into the shared entry motion', () => {
    const page = new DOMParser().parseFromString(readPageSource('newtab.html'), 'text/html');
    expect(page.getElementById(SEARCH_ROOT_ID)?.classList.contains('x-lumno-search-entry')).toBe(true);
  });

  it('falls back to six bookmark columns before the script runs, as onboarding previews', () => {
    expect(parsePageCss('newtab.html').entries.some((entry) => /var\(--x-nt-bookmark-columns,\s*6\)/.test(entry.style.cssText))).toBe(true);
    expect(parsePageCss('src/onboarding/onboarding.html').entries.some((entry) => entry.style.getPropertyValue('--x-nt-bookmark-columns') === '6')).toBe(true);
  });
});
