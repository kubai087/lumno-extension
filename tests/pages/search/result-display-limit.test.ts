import { describe, expect, it } from 'vitest';
import { getElement } from '../../fakes/dom';
import { parseStylesheet, readRepoFile } from '../../fakes/css';
import { searchResultDisplayLimit, searchResultPriority } from '../../../src/domain/settings/search';
import { overlayOpenTabsDefaultVisible } from '../../../src/domain/settings/overlay-panel';
import { SURFACES, openSearchSurface, type SurfaceMessage } from './surfaces';

// How many results a search surface shows, set in Settings (5 to 10; the
// slider is tested beside src/options/features/general/search-section.tsx).
// Open tabs are the exception: the overlay lists them all in a scrolling
// viewport that many rows tall.

const LIMIT = searchResultDisplayLimit.key;
const RESULTS = Array.from({ length: 12 }, (_, index) => ({ type: 'history', title: `Result ${index}`, url: `https://r${index}.test/` }));
const TABS = Array.from({ length: 12 }, (_, index) => ({ id: 100 + index, windowId: 1, title: `Tab ${index}`, url: `https://t${index}.test/` }));

const answerResults = (message: SurfaceMessage) => (message.action === 'getSearchSuggestions' ? { suggestions: RESULTS } : undefined);

function openTabsOverlay(tabs: typeof TABS) {
  return openSearchSurface('overlay', {
    openContext: { tabs },
    settings: { [LIMIT]: 5, [overlayOpenTabsDefaultVisible.key]: true },
    respond: (message) => (message.action === 'getTabsForOverlay' || message.action === 'getTabs' ? { tabs } : undefined)
  });
}

describe('Search result display limit', () => {
  it('is stored under its key', () => {
    expect(LIMIT).toBe('_x_extension_search_result_display_limit_2026_unique_');
  });

  it.each(['en', 'ja', 'zh_CN', 'zh_TW'])('is labelled in %s', (locale) => {
    const messages: unknown = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    expect(messages).toMatchObject({ settings_search_result_display_limit_title: { message: expect.stringMatching(/\S/) } });
  });

  it('shares the bookmark-rows slider sizing in Settings', () => {
    expect(parseStylesheet('src/options/options.css').entries.some((entry) => (
      entry.selectors.includes('#_x_extension_bookmark_rows_control_2026_unique_') &&
      entry.selectors.includes('#_x_extension_search_result_display_limit_control_2026_unique_')
    ))).toBe(true);
  });
});

describe.each(SURFACES)('%s result limit', (name) => {
  it('stops the results at the limit and applies a new one to the results showing', async () => {
    const surface = await openSearchSurface(name, { respond: answerResults, settings: { [LIMIT]: 5 } });
    await surface.type('result');
    await surface.settle(150);
    expect(surface.suggestions()).toHaveLength(5);
    surface.changeSetting(LIMIT, 8);
    await surface.settle(150);
    expect(surface.suggestions()).toHaveLength(8);
  });

  it.each([['search', true], ['autocomplete', false]])('with %s first asks for the search-first share (%s) and keeps to the limit', async (priority, searchFirst) => {
    const surface = await openSearchSurface(name, { respond: answerResults, settings: { [LIMIT]: 6, [searchResultPriority.key]: priority } });
    await surface.type('result');
    await surface.settle(250);
    const request = surface.messages.filter((message) => message.action === 'getSearchEngineSuggestions').pop();
    expect(Boolean(request?.searchFirst)).toBe(searchFirst);
    expect(surface.suggestions().length).toBeLessThanOrEqual(6);
  });
});

describe('Overlay open tabs and the result limit', () => {
  it('lists every open tab in a viewport as tall as the limit, which follows a new limit', async () => {
    const surface = await openTabsOverlay(TABS);
    await surface.settle(200);
    const container = getElement(surface.root(), '#_x_extension_suggestions_container_2024_unique_');
    expect(surface.suggestions()).toHaveLength(12);
    expect(container.getAttribute('data-open-tabs-visible-row-limit')).toBe('5');
    surface.changeSetting(LIMIT, 7);
    await surface.settle(150);
    expect(container.getAttribute('data-open-tabs-visible-row-limit')).toBe('7');
    await surface.type('Tab 11');
    await surface.settle(150);
    expect(surface.suggestions().some((row) => /Tab 11/.test(row.textContent || ''))).toBe(true);
  });

  it('keeps a short open tabs list at its natural height', async () => {
    const surface = await openTabsOverlay(TABS.slice(0, 3));
    await surface.settle(200);
    expect(getElement(surface.root(), '#_x_extension_suggestions_container_2024_unique_').getAttribute('data-open-tabs-visible-row-limit')).toBeNull();
  });

  it('gives the scrolling viewport a stable gutter and a Chromium scrollbar thumb', () => {
    const css = parseStylesheet('src/overlay/suggestions-view.css');
    const viewport = css.entries.filter((entry) => entry.selectors.some((selector) => selector.endsWith('.x-ov-suggestions-container[data-open-tabs-visible-row-limit]')));
    expect(viewport.some((entry) => entry.style.getPropertyValue('scrollbar-gutter') === 'stable')).toBe(true);
    expect(css.selectors().some((selector) => selector.endsWith('.x-ov-suggestions-container[data-open-tabs-visible-row-limit]::-webkit-scrollbar-thumb'))).toBe(true);
  });
});
