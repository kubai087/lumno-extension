import { describe, expect, it } from 'vitest';
import { getElement, getElements } from '../../fakes/dom';
import { readRepoFile } from '../../fakes/css';
import { bundledSiteSearchProviders } from '../overlay/boot';
import { SURFACES, openSearchSurface, type SearchSurface, type SurfaceMessage } from './surfaces';

// The scope panel both search surfaces share: what it lists, how it filters
// and hands focus around, and what a browser-content scope (top sites,
// bookmarks, history) asks the worker for.

const ITEM = '.x-lumno-search-input-mode__menu-item';

interface Provider {
  key: string;
  category?: string;
}

function providers(): Provider[] {
  return bundledSiteSearchProviders().flatMap((item) => (
    typeof item === 'object' && item !== null && 'key' in item && typeof item.key === 'string'
      ? [{ key: item.key, category: 'category' in item && typeof item.category === 'string' ? item.category : undefined }]
      : []
  ));
}

// The panel's cards under each group title, in order.
function menuGroups(surface: SearchSurface): Array<{ title: string; items: Array<string | null> }> {
  const content = getElement(surface.root(), '.x-lumno-search-input-mode__menu-content');
  const groups: Array<{ title: string; items: Array<string | null> }> = [];
  getElements(content, `.x-lumno-search-input-mode__menu-group, ${ITEM}`).forEach((element) => {
    if (element.classList.contains('x-lumno-search-input-mode__menu-group')) {
      groups.push({ title: String(element.textContent).trim(), items: [] });
    } else {
      groups[groups.length - 1]?.items.push(element.getAttribute('data-mode-id'));
    }
  });
  return groups;
}

function visibleItems(surface: SearchSurface): Array<string | null> {
  return getElements(surface.root(), ITEM).filter((item) => !item.hidden).map((item) => item.getAttribute('data-mode-id'));
}

function focused(surface: SearchSurface): Element | null {
  return surface.root().activeElement;
}

describe.each(SURFACES)('%s scope panel', (name) => {
  it('groups search engines, site search, AI search, then browser content', async () => {
    const surface = await openSearchSurface(name);
    await surface.openScopeMenu();
    const groups = menuGroups(surface);
    expect(groups.map((group) => group.title)).toEqual(['Search engines', 'Site search', 'AI search', 'Browser content']);
    const [engines = [], sites = [], ai = [], browserContent = []] = groups.map((group) => group.items);
    const all = providers();
    expect(engines.concat(sites, ai).sort()).toEqual(all.map((provider) => `provider:${provider.key}`).sort());
    expect(engines).toEqual(all.filter((provider) => provider.category === 'searchEngine').map((provider) => `provider:${provider.key}`));
    expect(ai).toEqual(expect.arrayContaining(['provider:gpt', 'provider:ds', 'provider:pplx']));
    expect(sites).toEqual(expect.arrayContaining(['provider:yt', 'provider:gh']));
    const local = ['local:topSite', 'local:bookmark', 'local:history'];
    expect(browserContent).toEqual(name === 'overlay' ? ['openTabs', ...local] : local);
  });

  it('filters as you type, matching a localized browser-content scope by its English name', async () => {
    const surface = await openSearchSurface(name, { settings: { _x_extension_language_2024_unique_: 'zh_CN' } });
    await surface.settle(100);
    await surface.openScopeMenu();
    expect(focused(surface)?.classList.contains('x-lumno-search-input-mode__menu')).toBe(true);
    for (const key of 'history') {
      surface.press(key);
      await surface.settle(5);
    }
    await surface.settle(40);
    expect(surface.input().value).toBe('');
    expect(visibleItems(surface)).toEqual(['local:history']);
    const card = focused(surface);
    expect(card?.getAttribute('data-mode-id')).toBe('local:history');
    expect(card?.querySelector('.x-lumno-search-input-mode__menu-match')?.textContent).toBe('历史');
    expect(card?.getAttribute('aria-label') || card?.textContent).toMatch(/历史/);

    surface.press('Enter');
    await surface.settle(60);
    expect(surface.scopeLabel()).toBe('历史');
    expect(surface.scopeMenuOpen()).toBe(true);
    expect(focused(surface)?.getAttribute('data-mode-id')).toBe('local:history');
    const checked = getElements(surface.root(), `${ITEM}[aria-checked="true"]`).map((item) => item.getAttribute('data-mode-id'));
    expect(checked).toEqual(['local:history']);
  });

  it('hands focus between the panel and the input with Tab, and to the input on a click', async () => {
    const surface = await openSearchSurface(name);
    await surface.openScopeMenu();
    const menu = getElement(surface.root(), '.x-lumno-search-input-mode__menu');
    surface.press('Tab');
    await surface.settle(40);
    expect(focused(surface)).toBe(surface.input());
    expect(surface.scopeMenuOpen()).toBe(true);
    expect(surface.input().placeholder).toBe('Search specific site content…');
    surface.press('Tab');
    await surface.settle(40);
    expect(focused(surface)).toBe(menu);

    surface.click(getElement(surface.root(), `${ITEM}[data-mode-id="provider:yt"]`));
    await surface.settle(60);
    expect(surface.scopeLabel()).toBe('YouTube');
    expect(focused(surface)).toBe(surface.input());
  });

  it('asks only for the chosen browser content, with no engine and no web search fallback', async () => {
    const surface = await openSearchSurface(name, {
      respond: (message: SurfaceMessage) => (message.action === 'getSearchSuggestions' ? { suggestions: [] } : undefined)
    });
    await surface.type('history');
    expect(getElement(surface.root(), '.x-lumno-search-input-mode__tab-hint').textContent?.trim()).toBe('TabOnly search History');
    surface.press('Tab');
    await surface.settle(80);
    expect(surface.scopeLabel()).toBe('History');
    expect(surface.input().value).toBe('');
    expect(surface.input().placeholder).toBe('Search within this scope; press Tab again to open the scope panel…');

    const before = surface.messages.length;
    await surface.type('cats');
    await surface.settle(120);
    const sent = surface.messages.slice(before);
    const request = sent.find((message) => message.action === 'getSearchSuggestions');
    expect(request).toBeDefined();
    expect([request?.sourceTypes, request?.includeOpenTabs]).toEqual([['history'], false]);
    expect(sent.some((message) => message.action === 'getSearchEngineSuggestions')).toBe(false);
    expect(getElement(surface.root(), name === 'overlay' ? '.x-ov-empty-state' : '.x-nt-empty-state').textContent?.trim()).toBe('No matching results');

    const afterQuery = surface.messages.length;
    surface.press('Enter');
    await surface.settle(80);
    expect(surface.messages).toHaveLength(afterQuery);
    expect(surface.navigation()).toBeNull();
  });
});

describe('Scope panel packaging', () => {
  it('lets the injected panel load the pinyin runtime on demand', () => {
    const manifest: unknown = JSON.parse(readRepoFile('manifest.json'));
    expect(manifest).toMatchObject({
      web_accessible_resources: expect.arrayContaining([expect.objectContaining({ resources: expect.arrayContaining(['build/pinyin.js']) })])
    });
  });

  it.each([
    ['en', 'Only search {source}'],
    ['zh_CN', '仅搜索{source}'],
    ['zh_TW', '僅搜尋{source}'],
    ['ja', '{source}のみ検索']
  ])('localizes the browser-content Tab hint in %s', (locale, message) => {
    const messages: unknown = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    expect(messages).toMatchObject({ local_search_tab_hint: { message } });
  });
});
