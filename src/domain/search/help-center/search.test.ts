import { describe, expect, it } from 'vitest';
import { normalizeIndex } from './index-build';
import { buildFeedbackSuggestions, createSuggestionSource, searchIndex } from './search';
import type { HelpSearchResponse } from './types';

const ORIGIN = 'https://lumno.kubai.design';

const INDEX = normalizeIndex([
  {
    title: 'Lumno 是什么',
    href: '/help/what-is-lumno/',
    sections: [
      { id: 'command-bar', title: '命令栏：一搜即达' },
      { id: 'new-tab', title: '新标签页：每次打开都是一幅画' }
    ],
    text: 'Lumno 是一款免费、开源的浏览器扩展。在任意网页按下快捷键，唤出命令栏；把新标签页换成简洁的起始页。'
  },
  {
    title: '新标签页的壁纸与外观',
    href: '/help/newtab-wallpaper/',
    sections: [{ id: 'filters', title: '滤镜' }],
    text: '在新标签页右下角打开外观面板，选择壁纸和滤镜。'
  },
  {
    title: '站内搜索与问 AI',
    href: '/help/site-search/',
    sections: [{ id: 'how', title: '如何使用站内搜索' }],
    text: '输入网站的缩写，按 Tab 进入站内搜索。'
  }
]);

const SHORTCUT_INDEX = normalizeIndex([
  { title: '快捷键', href: '/help/keyboard-shortcuts/', sections: [{ id: 'change', title: '修改快捷键' }], text: '下面是默认快捷键和修改方法。' },
  {
    title: 'Keyboard shortcuts',
    href: '/en/help/keyboard-shortcuts/',
    sections: [{ id: 'change', title: 'Change a shortcut' }],
    text: 'The default shortcuts and how to change them.'
  },
  { title: '更换壁纸', href: '/help/newtab-wallpaper/', sections: [{ id: 'sources', title: '壁纸来源' }], text: '选择名画和山水壁纸。' }
]);

const ALIAS_INDEX = [
  {
    title: '外观',
    href: '/help/appearance/',
    aliases: ['界面好看吗'],
    sections: [{ id: 'theme', title: '深色模式', aliases: ['晚上太亮怎么办'] }, { id: 'font', title: '字体' }],
    text: '在设置中切换浅色、深色或跟随系统。'
  },
  {
    title: 'Keyboard shortcuts',
    href: '/en/help/keyboard-shortcuts/',
    sections: [{ id: 'change', title: 'Change a shortcut' }],
    text: 'The default shortcuts and how to change them.'
  },
  { title: 'Pinned tabs', href: '/en/help/pinned/', sections: [{ id: 'pin', title: 'Pin a tab' }], text: 'Pin the tabs you keep.' }
];

const search = (index: unknown, query: string, options: object = {}) => searchIndex(index, query, { origin: ORIGIN, ...options });

describe('help center search', () => {
  it('ranks a title hit over a heading hit, which links to its section and shows the heading', () => {
    const results = search(INDEX, '新标签页');
    expect(results.map((item) => item.url)).toEqual([`${ORIGIN}/help/newtab-wallpaper/`, `${ORIGIN}/help/what-is-lumno/#new-tab`]);
    expect(results[1]?.detail).toBe('新标签页：每次打开都是一幅画');
  });

  it('links a body hit to the page and shows the passage around it', () => {
    const results = search(INDEX, 'tab');
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe(`${ORIGIN}/help/site-search/`);
    expect(results[0]?.detail).toMatch(/Tab/);
  });

  it('needs every term to match, finds nothing for a blank query and keeps to the limit', () => {
    expect(search(INDEX, '壁纸 不存在')).toEqual([]);
    expect(search(INDEX, '   ')).toEqual([]);
    expect(search(INDEX, 'lumno', { limit: 1 })).toHaveLength(1);
  });

  it('matches a question to the heading that answers it, in either language', () => {
    expect(search(SHORTCUT_INDEX, '怎么改快捷键')).toEqual([{
      title: '快捷键',
      detail: '修改快捷键',
      context: [{ kind: 'text', text: '下面是默认快捷键和修改方法。' }],
      url: `${ORIGIN}/help/keyboard-shortcuts/#change`
    }]);
    expect(search(SHORTCUT_INDEX, 'how do I change the shortcut')[0]?.url).toBe(`${ORIGIN}/en/help/keyboard-shortcuts/#change`);
  });

  it('recommends a page sharing most of the query when none contains it, after any exact matches', () => {
    expect(search(SHORTCUT_INDEX, '快捷键没反应')).toEqual([{
      title: '快捷键',
      detail: '下面是默认快捷键和修改方法。',
      context: [{ kind: 'text', text: '下面是默认快捷键和修改方法。' }],
      url: `${ORIGIN}/help/keyboard-shortcuts/`,
      recommended: true
    }]);
    expect(search(SHORTCUT_INDEX, '天气预报')).toEqual([]);
    const mixed = search(INDEX, '新标签页 外观面板');
    expect(mixed.length).toBeGreaterThanOrEqual(1);
    expect(mixed[0]?.recommended).toBeFalsy();
    expect(search(SHORTCUT_INDEX, '改快捷键', { limit: 6 })
      .every((item, index, all) => !item.recommended || all.slice(index).every((next) => next.recommended))).toBe(true);
  });

  it('finds a section through a synonym or an alias, showing its real heading', () => {
    const synonyms = [['深色模式', '暗色模式', '黑色主题', '夜间模式', 'dark mode']];
    expect(search(ALIAS_INDEX, '怎么设置黑色主题', { synonyms })[0]?.url).toBe(`${ORIGIN}/help/appearance/#theme`);
    expect(search(ALIAS_INDEX, '晚上太亮')[0]).toEqual({
      title: '外观',
      detail: '深色模式',
      context: [{ kind: 'text', text: '在设置中切换浅色、深色或跟随系统。' }],
      url: `${ORIGIN}/help/appearance/#theme`
    });
  });

  it('finds English pages through a misspelling or another word form', () => {
    expect(search(ALIAS_INDEX, 'shorcut')[0]?.url).toBe(`${ORIGIN}/en/help/keyboard-shortcuts/#change`);
    expect(search(ALIAS_INDEX, 'pinning')[0]?.url).toBe(`${ORIGIN}/en/help/pinned/#pin`);
  });

  it('ignores a malformed synonym list', () => {
    expect(search(ALIAS_INDEX, '天气', { synonyms: 'not a list' })).toEqual([]);
  });
});

const LINKS = {
  wechatQr: `${ORIGIN}/qrcode.webp`,
  githubIssue: 'https://github.com/kubai087/lumno-extension/issues/new',
  x: 'https://x.com/kubai087',
  chromeReview: 'https://chromewebstore.google.com/detail/lumno/reviews'
};
const t = (key: string, fallback: string) => `${key}|${fallback}`;

// A worker that answers each request when the test says.
function createWorker() {
  const sent: Array<{ message: object; answer: (response?: HelpSearchResponse | null) => void }> = [];
  const sendMessage = (message: object, callback: (response?: HelpSearchResponse) => void) => {
    sent.push({ message, answer: (response) => callback(response || undefined) });
    return true;
  };
  const answer = (index: number, response?: HelpSearchResponse | null) => {
    const request = sent[index];
    if (!request) throw new Error(`No request ${index} was sent.`);
    request.answer(response);
  };
  return { sent, sendMessage, answer };
}

describe('help center feedback rows', () => {
  it('offers the WeChat group, an issue and the author, but no store rating, with the Settings labels', () => {
    const wechat = buildFeedbackSuggestions({ links: LINKS, channel: 'wechat', t });
    expect(wechat.map((item) => [item.feedbackKey, item.url])).toEqual([
      ['community', LINKS.wechatQr],
      ['github-issue', LINKS.githubIssue],
      ['contact-author', LINKS.x]
    ]);
    expect(wechat[1]?.title).toBe('settings_feedback_support_github_issue_action|创建 Issue');
  });

  it('reaches the author on X outside the WeChat community', () => {
    expect(buildFeedbackSuggestions({ links: LINKS, channel: 'x', t }).map((item) => item.feedbackKey)).toEqual(['github-issue', 'contact-author']);
  });

  it('offers ways to ask once a search finds no pages, but not when the index could not load', () => {
    const worker = createWorker();
    const source = createSuggestionSource({ sendMessage: worker.sendMessage });
    const feedback = { links: LINKS, channel: 'wechat', t };
    expect(source.getSuggestions('天气预报', 'zh_CN', 'tile.png', feedback)).toEqual([]);
    worker.answer(0, { items: [] });
    expect(source.getSuggestions('天气预报', 'zh_CN', 'tile.png', feedback).map((item) => item.type))
      .toEqual(['helpFeedback', 'helpFeedback', 'helpFeedback']);
    source.getSuggestions('天气', 'zh_CN', 'tile.png', feedback);
    worker.answer(1, { items: [], reason: 'help-center-index-unavailable' });
    expect(source.getSuggestions('天气', 'zh_CN', 'tile.png', feedback)).toEqual([]);
  });
});

describe('help center suggestion source', () => {
  it('asks the worker once per query, redraws when pages arrive and lists them', () => {
    const worker = createWorker();
    const updates: unknown[] = [];
    const source = createSuggestionSource({ sendMessage: worker.sendMessage, onUpdate: (query) => updates.push(query) });
    expect(source.getSuggestions('新标签页', 'zh_CN', 'tile.png')).toEqual([]);
    expect(worker.sent[0]?.message).toEqual({ action: 'getHelpCenterSearchResults', query: '新标签页', locale: 'zh_CN' });
    source.getSuggestions('新标签页', 'zh_CN', 'tile.png');
    expect(worker.sent).toHaveLength(1);
    worker.answer(0, { items: [{ title: '新标签页的壁纸与外观', detail: '滤镜', url: `${ORIGIN}/help/newtab-wallpaper/` }] });
    expect(updates).toEqual(['新标签页']);
    expect(source.getSuggestions('新标签页', 'zh_CN', 'tile.png')).toEqual([{
      type: 'helpArticle',
      title: '新标签页的壁纸与外观',
      detail: '滤镜',
      url: `${ORIGIN}/help/newtab-wallpaper/`,
      context: [],
      favicon: 'tile.png',
      recommended: false
    }]);
  });

  it('keeps the previous pages while the next query loads, shows none for an unavailable index and ignores a late older answer', () => {
    const worker = createWorker();
    const updates: unknown[] = [];
    const source = createSuggestionSource({ sendMessage: worker.sendMessage, onUpdate: (query) => updates.push(query) });
    source.getSuggestions('新标签页', 'zh_CN', 'tile.png');
    worker.answer(0, { items: [{ title: '新标签页的壁纸与外观', detail: '滤镜', url: `${ORIGIN}/help/newtab-wallpaper/` }] });
    expect(source.getSuggestions('新标签页 壁纸', 'zh_CN', 'tile.png')).toHaveLength(1);
    worker.answer(1, null);
    expect(source.getSuggestions('新标签页 壁纸', 'zh_CN', 'tile.png')).toEqual([]);
    worker.answer(0, { items: [{ title: 'stale', url: 'https://stale.test/' }] });
    expect(updates).toHaveLength(2);
  });
});
