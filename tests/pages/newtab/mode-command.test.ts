import { describe, expect, it, vi } from 'vitest';
import { themeMode } from '../../../src/domain/settings/appearance';
import { newtabThemeMode } from '../../../src/domain/settings/newtab-page';
import { createBrowserFake } from '../../fakes/browser';
import { openSearchPage, pause, type SearchPage } from './search-page';

// /mode on New Tab switches the theme the page is showing: the global theme
// while New Tab follows it, or New Tab's own override when it has one. The
// appearance panel's Global / New Tab scope picker is covered by
// src/newtab/react/wallpaper-view.test.tsx.
const THEME = themeMode.key;
const NEWTAB_THEME = newtabThemeMode.key;

type Activate = (search: SearchPage, row: HTMLElement) => Promise<unknown>;

async function runMode(sync: Record<string, unknown>, activate: Activate) {
  const browser = createBrowserFake({ sync });
  const set = vi.spyOn(browser.storage.sync, 'set');
  const search = await openSearchPage(browser);
  await search.type('/mode');
  await search.waitForRows();
  const [row] = search.rows();
  expect(row.textContent).toContain('switch to Dark mode');
  set.mockClear();
  await activate(search, row);
  await pause(100);
  return {
    theme: document.body.getAttribute('data-theme'),
    writes: set.mock.calls.map((call) => call[0]).filter((write) => THEME in write || NEWTAB_THEME in write)
  };
}

describe.each<[string, Activate]>([
  ['Enter', (search) => search.press('Enter')],
  ['a click', (search, row) => search.click(row)]
])('/mode on New Tab with %s', (_how, activate) => {
  it('switches the global theme while New Tab follows it', async () => {
    const result = await runMode({ [THEME]: 'light' }, activate);

    expect(result.theme).toBe('dark');
    expect(result.writes).toEqual([{ [THEME]: 'dark' }]);
  });

  it('switches only New Tab’s own theme when it has one', async () => {
    const result = await runMode({ [THEME]: 'light', [NEWTAB_THEME]: 'light' }, activate);

    expect(result.theme).toBe('dark');
    expect(result.writes).toEqual([{ [NEWTAB_THEME]: 'dark' }]);
  });
});
