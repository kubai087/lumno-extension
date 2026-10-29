const assert = require('assert');
const fs = require('fs');
const helpCenterSearch = {
  ...require('../../src/domain/search/help-center/search.ts'),
  ...require('../../src/domain/search/help-center/index-build.ts'),
  ...require('../../src/domain/search/help-center/query.ts'),
  ...require('../../src/domain/search/help-center/score.ts')
};
const helpCenterIndex = require('../../src/platform/help-center-index.ts');
const communityLinks = require('../../src/domain/community-links.ts');
const searchUtils = require('../helpers/search-utils.ts');
const { loadBackground, wait } = require('../helpers/background-harness');
const { SURFACES, openSearchSurface } = require('../helpers/search-surfaces');
const { getInjectedScripts, getPageScripts, runsBefore } = require('../helpers/runtime-scripts');

const ORIGIN = 'https://lumno.kubai.design';
const index = helpCenterSearch.normalizeIndex([
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
  },
  { title: 'broken entry without href' },
  null
]);

assert.strictEqual(index.length, 3, 'malformed index entries should be dropped');

const newTabResults = helpCenterSearch.searchIndex(index, '新标签页', { origin: ORIGIN });
assert.deepStrictEqual(
  newTabResults.map((item) => item.url),
  [
    `${ORIGIN}/help/newtab-wallpaper/`,
    `${ORIGIN}/help/what-is-lumno/#new-tab`
  ],
  'a title hit should outrank a heading hit, and a heading hit should link to its section'
);
assert.strictEqual(newTabResults[1].detail, '新标签页：每次打开都是一幅画', 'a heading hit should show the heading');

const bodyResults = helpCenterSearch.searchIndex(index, 'tab', { origin: ORIGIN });
assert.strictEqual(bodyResults.length, 1);
assert.strictEqual(bodyResults[0].url, `${ORIGIN}/help/site-search/`, 'a body hit should link to the page itself');
assert.match(bodyResults[0].detail, /Tab/, 'a body hit should show the passage around the match');

assert.deepStrictEqual(
  helpCenterSearch.searchIndex(index, '壁纸 不存在', { origin: ORIGIN }),
  [],
  'every term must match, like the search box on the help center'
);
assert.deepStrictEqual(helpCenterSearch.searchIndex(index, '   ', { origin: ORIGIN }), []);
assert.strictEqual(
  helpCenterSearch.searchIndex(index, 'lumno', { origin: ORIGIN, limit: 1 }).length,
  1,
  'results should respect the limit'
);

const shortcutIndex = helpCenterSearch.normalizeIndex([
  {
    title: '快捷键',
    href: '/help/keyboard-shortcuts/',
    sections: [{ id: 'change', title: '修改快捷键' }],
    text: '下面是默认快捷键和修改方法。'
  },
  {
    title: 'Keyboard shortcuts',
    href: '/en/help/keyboard-shortcuts/',
    sections: [{ id: 'change', title: 'Change a shortcut' }],
    text: 'The default shortcuts and how to change them.'
  },
  {
    title: '更换壁纸',
    href: '/help/newtab-wallpaper/',
    sections: [{ id: 'sources', title: '壁纸来源' }],
    text: '选择名画和山水壁纸。'
  }
]);
assert.deepStrictEqual(helpCenterSearch.getExactTerms('怎么改快捷键'), ['改快捷键'], 'question words are not required to match');
assert.deepStrictEqual(helpCenterSearch.getExactTerms('how do I change the shortcut'), ['change', 'shortcut']);
assert.deepStrictEqual(helpCenterSearch.getExactTerms('怎么'), ['怎么'], 'a query made only of filler words is kept as typed');
assert.deepStrictEqual(
  helpCenterSearch.searchIndex(shortcutIndex, '怎么改快捷键', { origin: ORIGIN }),
  [{
    title: '快捷键',
    detail: '修改快捷键',
    context: [{ kind: 'text', text: '下面是默认快捷键和修改方法。' }],
    url: `${ORIGIN}/help/keyboard-shortcuts/#change`
  }],
  'a question should match the heading that answers it'
);
assert.strictEqual(
  helpCenterSearch.searchIndex(shortcutIndex, 'how do I change the shortcut', { origin: ORIGIN })[0].url,
  `${ORIGIN}/en/help/keyboard-shortcuts/#change`
);
assert.deepStrictEqual(
  helpCenterSearch.searchIndex(shortcutIndex, '快捷键没反应', { origin: ORIGIN }),
  [{
    title: '快捷键',
    detail: '下面是默认快捷键和修改方法。',
    context: [{ kind: 'text', text: '下面是默认快捷键和修改方法。' }],
    url: `${ORIGIN}/help/keyboard-shortcuts/`,
    recommended: true
  }],
  'a page sharing most of the query is recommended when no page contains it as typed'
);
assert.deepStrictEqual(
  helpCenterSearch.searchIndex(shortcutIndex, '天气预报', { origin: ORIGIN }),
  [],
  'unrelated queries should not recommend anything'
);
const mixedResults = helpCenterSearch.searchIndex(index, '新标签页 外观面板', { origin: ORIGIN });
assert.ok(mixedResults.length >= 1 && !mixedResults[0].recommended, 'exact matches come before recommendations');
assert.ok(
  helpCenterSearch.searchIndex(shortcutIndex, '改快捷键', { origin: ORIGIN, limit: 6 })
    .every((item, i, all) => !item.recommended || all.slice(i).every((next) => next.recommended)),
  'recommendations only follow exact matches'
);

const aliasIndex = [
  {
    title: '外观',
    href: '/help/appearance/',
    aliases: ['界面好看吗'],
    sections: [
      { id: 'theme', title: '深色模式', aliases: ['晚上太亮怎么办'] },
      { id: 'font', title: '字体' }
    ],
    text: '在设置中切换浅色、深色或跟随系统。'
  },
  {
    title: 'Keyboard shortcuts',
    href: '/en/help/keyboard-shortcuts/',
    sections: [{ id: 'change', title: 'Change a shortcut' }],
    text: 'The default shortcuts and how to change them.'
  },
  {
    title: 'Pinned tabs',
    href: '/en/help/pinned/',
    sections: [{ id: 'pin', title: 'Pin a tab' }],
    text: 'Pin the tabs you keep.'
  }
];
const synonyms = [['深色模式', '暗色模式', '黑色主题', '夜间模式', 'dark mode']];
assert.strictEqual(
  helpCenterSearch.searchIndex(aliasIndex, '怎么设置黑色主题', { origin: ORIGIN, synonyms })[0].url,
  `${ORIGIN}/help/appearance/#theme`,
  'a synonym finds the section that uses another word for it'
);
assert.deepStrictEqual(
  helpCenterSearch.searchIndex(aliasIndex, '晚上太亮', { origin: ORIGIN })[0],
  {
    title: '外观',
    detail: '深色模式',
    context: [{ kind: 'text', text: '在设置中切换浅色、深色或跟随系统。' }],
    url: `${ORIGIN}/help/appearance/#theme`
  },
  'a section alias opens its section but shows the real heading, never the alias'
);
assert.strictEqual(
  helpCenterSearch.searchIndex(aliasIndex, 'shorcut', { origin: ORIGIN })[0].url,
  `${ORIGIN}/en/help/keyboard-shortcuts/#change`,
  'a misspelt English word still finds the page'
);
assert.strictEqual(
  helpCenterSearch.searchIndex(aliasIndex, 'pinning', { origin: ORIGIN })[0].url,
  `${ORIGIN}/en/help/pinned/#pin`,
  'English word forms match their stem and open the section that names it'
);
assert.deepStrictEqual(
  helpCenterSearch.getExactTerms('我的最爱', [['收藏夹', '我的最爱']]),
  ['我的最爱'],
  'a synonym keeps characters that would otherwise be dropped as filler'
);
assert.deepStrictEqual(
  helpCenterSearch.searchIndex(aliasIndex, '天气', { origin: ORIGIN, synonyms: 'not a list' }),
  [],
  'a malformed synonym list is ignored'
);

assert.strictEqual(
  communityLinks.getHelpSearchSynonymsUrl('zh_TW'),
  `${ORIGIN}/zh-tw/help/search-synonyms.json`
);
assert.strictEqual(
  communityLinks.getHelpSearchIndexUrl('zh_CN'),
  `${ORIGIN}/help/search-index.json`,
  'Simplified Chinese reads the root index'
);
assert.strictEqual(communityLinks.getHelpSearchIndexUrl('zh_TW'), `${ORIGIN}/zh-tw/help/search-index.json`);
assert.strictEqual(communityLinks.getHelpSearchIndexUrl('ja'), `${ORIGIN}/ja/help/search-index.json`);
assert.strictEqual(communityLinks.getHelpSearchIndexUrl('fr'), `${ORIGIN}/en/help/search-index.json`);

const builtinProvider = searchUtils.getDefaultSiteSearchProviders().find((item) => item.key === 'lm');
assert.ok(searchUtils.isHelpCenterSiteSearchProvider(builtinProvider), 'the built-in provider searches the help center');
assert.ok(
  searchUtils.isHelpCenterSiteSearchProvider({ ...builtinProvider, key: 'help', builtinKey: 'lm', _xIsCustom: true }),
  'an edited built-in provider keeps its help center results'
);
assert.ok(
  !searchUtils.isHelpCenterSiteSearchProvider({ ...builtinProvider, template: 'https://example.com/?q={query}' }),
  'a provider pointed elsewhere should not list help center pages'
);
assert.ok(
  !searchUtils.isHelpCenterSiteSearchProvider(searchUtils.getDefaultSiteSearchProviders().find((item) => item.key === 'gh'))
);
const helpSearchUrl = searchUtils.buildSearchUrlFromTemplate(builtinProvider.template, 'shortcut');
assert.strictEqual(
  searchUtils.withHelpCenterLocale(helpSearchUrl, builtinProvider, 'zh_TW'),
  'https://lumno.kubai.design/help/what-is-lumno/?entry=ext&q=shortcut&lang=zh-TW',
  'the help center page opens in the interface language its results came from'
);
assert.strictEqual(searchUtils.withHelpCenterLocale(helpSearchUrl, builtinProvider, ''), helpSearchUrl);
const githubProvider = searchUtils.getDefaultSiteSearchProviders().find((item) => item.key === 'gh');
const githubUrl = searchUtils.buildSearchUrlFromTemplate(githubProvider.template, 'shortcut');
assert.strictEqual(
  searchUtils.withHelpCenterLocale(githubUrl, githubProvider, 'ja'),
  githubUrl,
  'other site searches keep their URL'
);
assert.deepStrictEqual(
  searchUtils.getSiteSearchProviderDisplayNameMessage(builtinProvider),
  { messageKey: 'site_search_name_lumno_help', fallback: 'Lumno Help Center' }
);
['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
  const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
  assert.match(messages.site_search_name_lumno_help.message, /^Lumno /, `${locale} should name the Lumno Help Center`);
});

async function testIndexLoader() {
  let now = 0;
  const requests = [];
  let failNext = true;
  const loader = helpCenterIndex.createIndexLoader({
    now: () => now,
    ttlMs: 1000,
    fetchImpl: (url) => {
      requests.push(url);
      if (failNext) {
        failNext = false;
        return Promise.reject(new Error('offline'));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ title: 'A', href: '/help/a/', text: '' }]) });
    }
  });
  await assert.rejects(loader.load('https://index.test/a.json'), /offline/);
  const first = await loader.load('https://index.test/a.json');
  assert.strictEqual(first.length, 1, 'a failed load should be retried by the next query');
  await loader.load('https://index.test/a.json');
  assert.strictEqual(requests.length, 2, 'a loaded index should be reused within its lifetime');
  now = 1500;
  await loader.load('https://index.test/a.json');
  assert.strictEqual(requests.length, 3, 'an expired index should be fetched again');
  await loader.load('https://index.test/b.json');
  assert.strictEqual(requests.length, 4, 'each language keeps its own index');
}

function testFeedbackSuggestions() {
  const links = {
    wechatQr: `${ORIGIN}/qrcode.webp`,
    githubIssue: 'https://github.com/kubai087/lumno-extension/issues/new',
    x: 'https://x.com/kubai087',
    chromeReview: 'https://chromewebstore.google.com/detail/lumno/reviews'
  };
  const t = (key, fallback) => `${key}|${fallback}`;
  assert.deepStrictEqual(
    helpCenterSearch.buildFeedbackSuggestions({ links, channel: 'wechat', t }).map((item) => [item.feedbackKey, item.url]),
    [
      ['community', links.wechatQr],
      ['github-issue', links.githubIssue],
      ['contact-author', links.x]
    ],
    'an empty search offers the WeChat group, an issue and the author, but not a store rating'
  );
  assert.deepStrictEqual(
    helpCenterSearch.buildFeedbackSuggestions({ links, channel: 'x', t }).map((item) => item.feedbackKey),
    ['github-issue', 'contact-author'],
    'readers outside the WeChat community reach the author on X'
  );
  assert.strictEqual(
    helpCenterSearch.buildFeedbackSuggestions({ links, channel: 'wechat', t })[1].title,
    'settings_feedback_support_github_issue_action|创建 Issue',
    'the rows reuse the Settings labels'
  );

  const sent = [];
  const source = helpCenterSearch.createSuggestionSource({
    sendMessage: (message, callback) => {
      sent.push(callback);
      return true;
    }
  });
  const feedback = { links, channel: 'wechat', t };
  assert.deepStrictEqual(source.getSuggestions('天气预报', 'zh_CN', 'tile.png', feedback), [], 'nothing shows while the pages load');
  sent[0]({ items: [] });
  assert.deepStrictEqual(
    source.getSuggestions('天气预报', 'zh_CN', 'tile.png', feedback).map((item) => item.type),
    ['helpFeedback', 'helpFeedback', 'helpFeedback'],
    'a search with no pages offers ways to ask instead'
  );
  source.getSuggestions('天气', 'zh_CN', 'tile.png', feedback);
  sent[1]({ items: [], reason: 'help-center-index-unavailable' });
  assert.deepStrictEqual(
    source.getSuggestions('天气', 'zh_CN', 'tile.png', feedback),
    [],
    'an index that could not load is not reported as missing content'
  );
}

function testSuggestionSource() {
  const sent = [];
  const updates = [];
  const source = helpCenterSearch.createSuggestionSource({
    sendMessage: (message, callback) => {
      sent.push({ message, callback });
      return true;
    },
    onUpdate: (query) => updates.push(query)
  });
  assert.deepStrictEqual(source.getSuggestions('新标签页', 'zh_CN', 'tile.png'), [], 'nothing shows before the first answer');
  assert.deepStrictEqual(sent[0].message, {
    action: 'getHelpCenterSearchResults',
    query: '新标签页',
    locale: 'zh_CN'
  });
  source.getSuggestions('新标签页', 'zh_CN', 'tile.png');
  assert.strictEqual(sent.length, 1, 'a repeated render should not send the same request again');
  sent[0].callback({ items: [{ title: '新标签页的壁纸与外观', detail: '滤镜', url: `${ORIGIN}/help/newtab-wallpaper/` }] });
  assert.deepStrictEqual(updates, ['新标签页'], 'arriving pages should re-render the list');
  assert.deepStrictEqual(source.getSuggestions('新标签页', 'zh_CN', 'tile.png'), [{
    type: 'helpArticle',
    title: '新标签页的壁纸与外观',
    detail: '滤镜',
    url: `${ORIGIN}/help/newtab-wallpaper/`,
    context: [],
    favicon: 'tile.png',
    recommended: false
  }]);
  assert.strictEqual(
    source.getSuggestions('新标签页 壁纸', 'zh_CN', 'tile.png').length,
    1,
    'the previous pages stay in place while the next query loads'
  );
  sent[1].callback(null);
  assert.deepStrictEqual(source.getSuggestions('新标签页 壁纸', 'zh_CN', 'tile.png'), [], 'an unavailable index shows no pages');
  sent[0].callback({ items: [{ title: 'stale', url: 'https://stale.test/' }] });
  assert.strictEqual(updates.length, 2, 'a late answer for an older query should be ignored');
}

assert.ok(
  runsBefore(getInjectedScripts('overlay'), 'src/domain/search/help-center/search.ts', 'src/overlay/app/main.ts'),
  'the overlay should load the help center module before the search panel'
);
assert.ok(
  runsBefore(getPageScripts('newtab.html'), 'src/domain/search/help-center/search.ts', 'src/newtab/search/suggestions-controller.ts'),
  'the new tab should load the help center module before its suggestions controller'
);

// The worker searches the help center index with the language's synonym
// list; a language without one (404) is remembered as having none.
async function testWorkerSearchesTheIndex() {
  const fetched = [];
  const worker = loadBackground({
    fetch: async (url) => {
      fetched.push(String(url));
      if (/search-index\.json$/.test(url)) {
        return { ok: true, status: 200, json: async () => [{ title: 'Wallpapers', href: '/help/wallpaper/', sections: [], text: 'Change the New Tab wallpaper' }] };
      }
      if (/search-synonyms\.json$/.test(url)) {
        return { ok: false, status: 404, json: async () => { throw new Error('not found'); } };
      }
      throw new Error(`network disabled: ${url}`);
    }
  });
  await wait(30);
  const first = await worker.sendMessage({ action: 'getHelpCenterSearchResults', query: 'wallpaper', locale: 'en' });
  const second = await worker.sendMessage({ action: 'getHelpCenterSearchResults', query: 'wallpapers', locale: 'en' });
  assert.ok(first && first.items.some((item) => /\/help\/wallpaper\//.test(item.url)), 'a matching help page should be found');
  assert.ok(second && second.items.length > 0);
  assert.strictEqual(fetched.filter((url) => /search-synonyms\.json$/.test(url)).length, 1,
    'a missing synonym list should be asked for once, then remembered as empty');
  assert.strictEqual(fetched.filter((url) => /search-index\.json$/.test(url)).length, 1, 'the index should be loaded once');
}

// With the Help Center scope active, both surfaces list matching help pages
// under the scope's search row.
async function testSurfacesListHelpPages(name) {
  const surface = await openSearchSurface(name, {
    respond(message) {
      if (message.action === 'getHelpCenterSearchResults') {
        return { items: [{ title: 'Change the wallpaper', url: `${ORIGIN}/help/wallpaper/` }] };
      }
      return undefined;
    }
  });
  await surface.chooseScope('provider:lm');
  await surface.type('wallpaper');
  await surface.settle(200);
  const rows = surface.suggestions().map((row) => row._xSuggestion || {});
  assert.strictEqual(rows[0].type, 'siteSearch', `${name}: the scope's search row should come first`);
  assert.ok(rows.slice(1).some((row) => row.url === `${ORIGIN}/help/wallpaper/`), `${name}: matching help pages should follow it`);
  surface.close();
}

testSuggestionSource();
testFeedbackSuggestions();
testIndexLoader().then(async () => {
  await testWorkerSearchesTheIndex();
  for (const name of SURFACES) {
    await testSurfacesListHelpPages(name);
  }
  console.log('help center search tests passed');
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
