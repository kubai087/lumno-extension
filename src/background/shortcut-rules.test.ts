import { describe, expect, it, vi } from 'vitest';
import bundledShortcutRules from '../../assets/data/shortcut-rules.json';
import { readShortcutRules } from '../domain/shortcut-rules-reader';
import { create, getShortcutUrlForScheme } from './shortcut-rules';

function respondWith(data: unknown) {
  return vi.fn(async (_url: string) => ({ json: async () => data }));
}

describe('loading the shortcut rules', () => {
  it('reads the packaged rules once and answers later loads from memory', async () => {
    const fetchImpl = respondWith({ items: [{ type: 'browserPage', keys: ['ext '], path: 'extensions' }] });
    const rules = create({
      chromeApi: { runtime: { getURL: (path) => `chrome-extension://id/${path}` } },
      navigatorLike: { userAgent: 'Chrome' },
      fetchImpl
    });

    const first = await rules.loadShortcutRules();
    const second = await rules.loadShortcutRules();

    expect(first).toEqual([{ type: 'browserPage', keys: ['ext '], path: 'extensions' }]);
    expect(second).toBe(first);
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual(['chrome-extension://id/assets/data/shortcut-rules.json']);
  });

  it('loads no rules from a file without a rule list', async () => {
    const rules = create({ fetchImpl: respondWith({ items: 'not-an-array' }) });

    expect(await rules.loadShortcutRules()).toEqual([]);
  });
});

describe('the page a rule word opens', () => {
  const rules = [
    { type: 'browserPage', keys: ['ext ', 'extensions '], path: 'extensions' },
    { type: 'url', keys: ['lumno '], url: 'https://lumno.app' },
    { type: 'url', keys: ['bad '] }
  ];

  it('opens the browser page under the given scheme, or the rule site', () => {
    expect(getShortcutUrlForScheme(' ext ', rules, 'edge://')).toBe('edge://extensions');
    expect(getShortcutUrlForScheme('LUMNO', rules, 'chrome://')).toBe('https://lumno.app');
  });

  it('searches a query that is not exactly a rule word', () => {
    expect(getShortcutUrlForScheme('ext test', rules, 'edge://')).toBeNull();
    expect(getShortcutUrlForScheme('extra', rules, 'edge://')).toBeNull();
    expect(getShortcutUrlForScheme('missing', rules, 'chrome://')).toBeNull();
    expect(getShortcutUrlForScheme('bad', rules, 'chrome://')).toBeNull();
    expect(getShortcutUrlForScheme('', rules, 'chrome://')).toBeNull();
    expect(getShortcutUrlForScheme('ext test', null, 'chrome://')).toBeNull();
  });

  it('opens the page in the browser the worker runs in', () => {
    const edge = create({ navigatorLike: { userAgent: 'Chrome Edg/123' } });
    const historyRules = [{ type: 'browserPage', keys: ['history '], path: 'history' }];

    expect(edge.getShortcutUrl('history', historyRules)).toBe('edge://history');
    expect(edge.getShortcutUrl('history of rome', historyRules)).toBeNull();
  });

  it('opens only rule sites in Firefox, which keeps its about: pages from extensions', () => {
    const firefox = create({ navigatorLike: { userAgent: 'Mozilla/5.0 (Macintosh; rv:157.0) Gecko/20100101 Firefox/157.0' } });

    expect(firefox.getShortcutUrl('ext', rules)).toBeNull();
    expect(firefox.getShortcutUrl('lumno', rules)).toBe('https://lumno.app');
  });
});

describe('the bundled browser page rules', () => {
  const rules = readShortcutRules(bundledShortcutRules);

  it.each([
    ['扩展程序', 'chrome://extensions/'],
    ['フラグ', 'chrome://flags/'],
    ['设置', 'chrome://settings/'],
    ['ショートカット', 'chrome://extensions/shortcuts'],
    ['web store', 'https://chromewebstore.google.com/'],
    ['history', 'chrome://history'],
    ['browser  history', 'chrome://history'],
    ['下载记录', 'chrome://downloads'],
    ['書籤', 'chrome://bookmarks'],
    ['密码', 'chrome://password-manager/passwords'],
    ['新規タブ', 'chrome://newtab'],
    ['版本', 'chrome://version'],
    ['内部页面', 'chrome://about'],
    ['chrome urls', 'chrome://chrome-urls'],
    ['gpu status', 'chrome://gpu'],
    ['GPU', 'chrome://gpu'],
    ['network log', 'chrome://net-export'],
    ['dns cache', 'chrome://dns'],
    ['クラッシュ', 'chrome://crashes'],
    ['inspect devices', 'chrome://inspect'],
    ['service worker', 'chrome://serviceworker-internals'],
    ['存储配额', 'chrome://quota-internals'],
    ['站点参与度', 'chrome://site-engagement'],
    ['タブ破棄', 'chrome://discards'],
    ['webrtc debug', 'chrome://webrtc-internals'],
    ['trace', 'chrome://tracing'],
    ['policies', 'chrome://policy'],
    ['管理ページ', 'chrome://management']
  ])('opens %s at %s', (query, url) => {
    expect(getShortcutUrlForScheme(query, rules, 'chrome://')).toBe(url);
  });

  it.each(['history of rome', 'histogram', 'passport', 'setup guide', 'extra', 'scala'])('searches %s', (query) => {
    expect(getShortcutUrlForScheme(query, rules, 'chrome://')).toBeNull();
  });
});
