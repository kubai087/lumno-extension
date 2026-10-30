import { describe, expect, it } from 'vitest';
import { getElements } from '../../fakes/dom';
import { readRepoFile } from '../../fakes/css';
import { defaultSearchEngine } from '../../../src/domain/settings/search';
import { SURFACES, openSearchSurface, type SearchSurface, type SurfaceName } from './surfaces';

// Two quick Tabs in an empty search input open the scope panel on the
// default scope; with a scope already active, one Tab does. The gesture's
// timing rules are covered by src/shared/react/search-input-mode.tab.test.ts,
// and which provider an engine becomes beside
// src/domain/search/utils/site-search-providers.ts.

const LANGUAGE_KEY = '_x_extension_language_2024_unique_';
const BING = { id: 'bing', host: 'www.bing.com', name: 'Bing', searchTemplate: 'https://www.bing.com/search?q={query}' };

function stored(name: SurfaceName, values: Record<string, unknown>) {
  return name === 'overlay' ? { settings: values } : { settings: values, local: values };
}

function footerHints(surface: SearchSurface): Array<string | null> {
  return getElements(surface.root(), '.x-lumno-search-input-mode__menu-footer-hint').map((hint) => hint.textContent);
}

async function doubleTab(surface: SearchSurface) {
  surface.press('Tab');
  await surface.settle(10);
  surface.press('Tab');
  await surface.settle(150);
}

describe.each(SURFACES)('%s double Tab', (name) => {
  it('opens the scope panel on the browser search engine and explains its keys', async () => {
    const surface = await openSearchSurface(name, stored(name, { [defaultSearchEngine.key]: BING }));
    await surface.settle(100);
    await doubleTab(surface);
    await surface.waitFor(() => surface.scopeMenuOpen() && footerHints(surface).length > 0, `the ${name} scope panel did not open`);
    expect(surface.scopeLabel()).toBe('Bing');
    expect(surface.scopeMenuOpen()).toBe(true);
    expect(footerHints(surface).slice(0, 3)).toEqual(['←↑↓→Move', 'EnterSwitch', 'TabSwitch focus']);
  });

  it('opens the panel on one Tab with a scope active, keeping the query', async () => {
    const surface = await openSearchSurface(name);
    await surface.type('history');
    surface.press('Tab');
    await surface.settle(80);
    await surface.type('cats');
    surface.press('Tab');
    await surface.settle(80);
    expect([surface.scopeLabel(), surface.scopeMenuOpen(), surface.input().value]).toEqual(['History', true, 'cats']);
  });

  it('follows a language change in the panel hint', async () => {
    const surface = await openSearchSurface(name);
    surface.changeSetting(LANGUAGE_KEY, 'ja');
    await surface.settle(200);
    expect(footerHints(surface).pop()).toMatch(/パネルを開く$/);
  });
});

describe('New Tab double Tab', () => {
  // In the overlay a single Tab already searches open tabs, so a later Tab
  // opens the panel for that scope.
  it('does not count two Tabs far apart', async () => {
    const surface = await openSearchSurface('newtab');
    surface.press('Tab');
    await surface.settle(900);
    surface.press('Tab');
    await surface.settle(100);
    expect(surface.scopeMenuOpen()).toBe(false);
  });

  it.each([['MacIntel', '⇥ ⇥Open panel'], ['Win32', 'Tab TabOpen panel']])('names the Tab key as %s does', async (platform, hint) => {
    const surface = await openSearchSurface('newtab', { platform });
    expect(footerHints(surface).pop()).toBe(hint);
  });
});

describe('Overlay double Tab', () => {
  // The overlay reads its settings, the stored engine among them, before its
  // input takes focus, so the fastest double Tab never flashes the fallback.
  it('commits the stored engine, not the Google fallback', async () => {
    const surface = await openSearchSurface('overlay', { settings: { [defaultSearchEngine.key]: BING } });
    await doubleTab(surface);
    await surface.settle(150);
    expect([surface.scopeLabel(), surface.scopeMenuOpen()]).toEqual(['Bing', true]);
  });

  it('picks the site search of the current site and leaves focus in the input', async () => {
    const surface = await openSearchSurface('overlay', { openContext: { currentTabUrl: 'https://www.youtube.com/watch?v=1' } });
    await doubleTab(surface);
    expect(surface.scopeLabel()).toBe('YouTube');
    expect(surface.root().activeElement).toBe(surface.input());
  });

  it('searches open tabs on a single Tab', async () => {
    const surface = await openSearchSurface('overlay');
    surface.press('Tab');
    await surface.settle(900);
    expect([surface.scopeLabel(), surface.scopeMenuOpen()]).toEqual(['Search open tabs', false]);
  });
});

describe('Scope panel shortcut copy', () => {
  const EXPECTED: Record<string, Record<string, string>> = {
    shortcut_reference_search_open_scope_menu_title: {
      en: 'Open search scope panel', ja: '検索範囲パネルを開く', zh_CN: '打开搜索范围面板', zh_TW: '開啟搜尋範圍面板'
    },
    shortcut_reference_search_open_scope_menu_desc: {
      en: 'When the input is empty, press Tab twice; with a search scope selected, press Tab once',
      ja: '入力欄が空のときは Tab を2回、検索範囲を選択済みのときは Tab を1回押します',
      zh_CN: '输入框为空时连续按两次 Tab；已选择搜索范围时按一次 Tab',
      zh_TW: '輸入框為空時連按兩次 Tab；已選擇搜尋範圍時按一次 Tab'
    },
    search_scope_menu_shortcut_hint: { en: 'Open panel', ja: 'パネルを開く', zh_CN: '打开面板', zh_TW: '開啟面板' },
    search_scope_menu_focus_toggle_hint: { en: 'Switch focus', ja: 'フォーカス切替', zh_CN: '切换聚焦', zh_TW: '切換聚焦' },
    search_scope_menu_select_hint: { en: 'Switch', ja: '切替', zh_CN: '切换', zh_TW: '切換' },
    search_scope_menu_filter_hint: {
      en: 'Type to filter',
      ja: 'パネルをクリックし、英字またはピンインで絞り込み',
      zh_CN: '点击面板，输入拼音或英文快速筛选',
      zh_TW: '點按面板，輸入拼音或英文快速篩選'
    }
  };

  it.each(['en', 'ja', 'zh_CN', 'zh_TW'])('localizes the panel hints and the shortcut reference in %s', (locale) => {
    const messages: unknown = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    expect(messages).toMatchObject(Object.fromEntries(Object.entries(EXPECTED).map(([key, byLocale]) => [key, { message: byLocale[locale] }])));
  });
});
