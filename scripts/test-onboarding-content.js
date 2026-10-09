const assert = require('assert');
const fs = require('fs');
const path = require('path');

const onboarding = require('../src/onboarding/onboarding-content.js');
const GITHUB_HOMEPAGE_URL = 'https://github.com/kubai087/lumno-extension';
const COMPATIBILITY_TOOLTIP =
  '受浏览器限制，Lumno 无法提供单独关闭新标签页的入口，但它可以与其他新标签页插件同时使用。\n具体而言，安装 Lumno 后，再覆盖安装或重新启用你正在使用的新标签页插件，让它继续接管新标签页即可。';
const SHORTCUT_ACTION_TOOLTIP =
  '由于浏览器限制，请在浏览器的扩展快捷键页面修改 Lumno 的快捷键，点击前往。';
const DIA_BROWSER_DISCLOSURE_TEXT =
  '在 Dia 中，若聚焦搜索浮窗的快捷键不可用，请进入浏览器的快捷键设置页面，将“Open command bar”从“In Dia”改为“Global”。';
const SHORTCUTS_PAGE_URL = 'chrome://extensions/shortcuts';
const LOCAL_FILE_ACCORDION_TEXT =
  '请前往扩展程序详情页，为 Lumno 开启“允许访问文件网址”，开启后刷新对应标签页。';
const EXTENSION_DETAILS_URL = 'chrome://extensions/?id=nkbkcafoocmnnconoijmhloecgamfcai';

assert.strictEqual(typeof onboarding.getOnboardingBlueprint, 'function');
assert.strictEqual(typeof onboarding.getSupportedLocales, 'function');
assert.strictEqual(typeof onboarding.createOnboardingState, 'function');
assert.strictEqual(typeof onboarding.reduceOnboardingState, 'function');
assert.strictEqual(typeof onboarding.getShortcutDisplayTokens, 'function');
assert.strictEqual(typeof onboarding.formatShortcutForDisplay, 'function');
assert.strictEqual(typeof onboarding.parseShortcutHotkey, 'function');
assert.strictEqual(typeof onboarding.shortcutHotkeyMatchesEvent, 'function');
assert.strictEqual(typeof onboarding.getOnboardingRuntimeCopy, 'function');

const locales = onboarding.getSupportedLocales();
assert.deepStrictEqual(locales, ['zh_CN', 'zh_TW', 'ja', 'en']);
const localeDirs = fs.readdirSync(path.join(__dirname, '..', '_locales'))
  .filter((name) => fs.existsSync(path.join(__dirname, '..', '_locales', name, 'messages.json')))
  .sort();
assert.deepStrictEqual(
  locales.slice().sort(),
  localeDirs,
  'onboarding locales should stay aligned with the extension locale files'
);

const blueprint = onboarding.getOnboardingBlueprint('zh_CN');
assert.strictEqual(blueprint.brand, 'Lumno');
assert.strictEqual(blueprint.locale, 'zh_CN');
assert.strictEqual(blueprint.htmlLang, 'zh-CN');
assert.strictEqual(blueprint.mode, 'paginated');
assert.ok(Array.isArray(blueprint.slides), 'blueprint should expose slides');
assert.ok(blueprint.slides.length >= 3, 'framework should support a multi-page onboarding flow');
assert.ok(blueprint.slides.length <= 5, 'initial framework should stay focused');

blueprint.slides.forEach((slide, index) => {
  assert.strictEqual(slide.sequence, index + 1, 'slides should have stable presentation order');
  assert.ok(slide.id, 'slides should have stable ids for analytics and deep linking');
  assert.ok(Array.isArray(slide.left.interactionSlots), 'left side should reserve interaction component slots');
  assert.strictEqual(slide.visual.mountId, 'onboarding-visual-stage', 'right side should render into the shared visual stage');
  assert.ok(slide.visual.kind.endsWith('-surface'), 'right side should declare a replaceable UI surface kind');
  assert.strictEqual(typeof slide.visual.visible, 'boolean', 'slides should declare whether the right illustration is visible');
  assert.strictEqual(typeof slide.cursor.enabled, 'boolean', 'slides should declare cursor animation readiness');
  assert.ok(slide.actions && typeof slide.actions === 'object', 'slides should expose lower-left action slots');
});

locales.forEach((locale) => {
  const localeBlueprint = onboarding.getOnboardingBlueprint(locale);
  localeBlueprint.slides.forEach((slide) => {
    slide.left.interactionSlots.forEach((slot) => {
      const accordion = slot && slot.accordion;
      if (!accordion || !Array.isArray(accordion.links)) {
        return;
      }
      accordion.links.forEach((link) => {
        assert.ok(
          String(accordion.text || '').includes(link.label),
          `${locale} ${slot.id} accordion text should include the inline link label "${link.label}"`
        );
      });
    });
  });
});

const firstSlide = blueprint.slides[0];
assert.strictEqual(firstSlide.id, 'intro');
assert.strictEqual(firstSlide.copy.title, '让浏览器的书签一搜即达');
assert.deepStrictEqual(firstSlide.copy.titleLines, ['让浏览器的书签', '一搜即达']);
assert.deepStrictEqual(
  firstSlide.copy.titleLogo,
  {
    label: 'Lumno',
    src: '../../assets/images/lumno.png'
  },
  'first slide title should expose the trailing Lumno logo mark'
);
assert.deepStrictEqual(
  firstSlide.copy.titleCycle,
  {
    prefix: '让浏览器的',
    items: [
      { id: 'bookmark', label: '书签', tone: 'bookmark' },
      { id: 'history', label: '历史', tone: 'history' },
      { id: 'top-sites', label: '常用网站', tone: 'top-sites' },
      { id: 'settings', label: '设置项', tone: 'settings' }
    ]
  },
  'first slide title should expose the rotating browser data source labels'
);
assert.strictEqual(
  firstSlide.copy.body,
  '开源浏览器聚焦搜索 & 极简新标签页'
);
assert.deepStrictEqual(
  firstSlide.left.interactionSlots.map((slot) => slot.label),
  [
    '开源、隐私边界透明、注重用户体验',
    '支持主流浏览器',
    '兼容其他新标签页插件'
  ],
  'first slide should expose exactly the requested centered content rows'
);
assert.deepStrictEqual(
  firstSlide.left.interactionSlots.map((slot) => slot.icon),
  [
    'ri-shield-check-line',
    'ri-chrome-line',
    'ri-puzzle-line'
  ],
  'first slide auxiliary rows should expose the requested Remix icon classes'
);
const trustSlot = firstSlide.left.interactionSlots.find((slot) => slot.kind === 'trust-row');
assert.ok(trustSlot, 'first slide should expose the trust row');
assert.deepStrictEqual(
  trustSlot.linkButton,
  {
    icon: 'ri-github-fill',
    label: 'GitHub 仓库',
    tooltip: '以 GPL-3.0 许可证开源，点击访问 GitHub 仓库。',
    href: GITHUB_HOMEPAGE_URL
  },
  'trust row should expose a compact GitHub homepage link button'
);
const browserSlot = firstSlide.left.interactionSlots.find((slot) => slot.kind === 'browser-row');
assert.ok(browserSlot, 'first slide should expose the Chromium browser support row');
assert.deepStrictEqual(
  browserSlot.browserAvatars,
  {
    prefix: '支持',
    suffix: '主流浏览器',
    browsers: [
      { id: 'chrome', name: 'Chrome', src: '../../assets/images/browser-logos/google-chrome-2022.svg' },
      { id: 'edge', name: 'Edge', src: '../../assets/images/browser-logos/microsoft-edge-2019.svg' },
      { id: 'dia', name: 'Dia', src: '../../assets/images/browser-logos/dia.jpg' },
      { id: 'comet', name: 'Comet', src: '../../assets/images/browser-logos/comet.jpg' }
    ]
  },
  'browser row should keep the browser avatar source list for the info tooltip'
);
assert.deepStrictEqual(
  browserSlot.infoTooltip,
  {
    icon: 'ri-information-line',
    label: '支持的浏览器',
    type: 'browser-avatars',
    text: ''
  },
  'browser row should expose a Lumno-style info tooltip for the browser avatars'
);
const compatibilitySlot = firstSlide.left.interactionSlots.find((slot) => slot.kind === 'compatibility-row');
assert.ok(compatibilitySlot, 'first slide should expose the compatibility row');
assert.deepStrictEqual(
  compatibilitySlot.infoTooltip,
  {
    icon: 'ri-information-line',
    label: '兼容说明',
    type: '',
    text: COMPATIBILITY_TOOLTIP
  },
  'compatibility row should expose a Lumno-style info tooltip'
);
assert.strictEqual(firstSlide.visual.kind, 'lumno-web-wordmark-surface');
assert.strictEqual(firstSlide.visual.visible, true);
assert.strictEqual(firstSlide.cursor.enabled, true);
assert.deepStrictEqual(
  firstSlide.actions,
  {
    primary: {
      actionId: 'next',
      label: '快速上手',
      icon: 'ri-arrow-right-line'
    },
    secondary: null,
    ghost: null
  },
  'first page should only expose the primary quick-start action'
);

const secondSlide = blueprint.slides[1];
assert.strictEqual(secondSlide.id, 'setup');
assert.deepStrictEqual(
  secondSlide.copy,
  {
    eyebrow: '',
    title: '原生聚焦搜索体验',
    body: '在任意网站按下快捷键{shortcut}，唤起聚焦搜索悬浮窗。'
  },
  'second page should show the focus search title without the removed shortcut note'
);
assert.strictEqual(
  Object.prototype.hasOwnProperty.call(secondSlide.copy, 'note'),
  false,
  'second page should not expose the removed shortcut-change note'
);
assert.strictEqual(secondSlide.visual.kind, 'bookmark-focus-surface');
assert.strictEqual(secondSlide.visual.visible, true);
assert.strictEqual(secondSlide.cursor.enabled, true);
assert.deepStrictEqual(
  secondSlide.left.interactionSlots,
  [
    {
      id: 'setup-interaction-1',
      kind: 'accordion-row',
      actionId: 'toggleInteractionAccordion',
      accordionId: 'dia-browser',
      icon: 'ri-information-line',
      label: '致 Dia 浏览器用户',
      description: '',
      browserOnly: 'chromium',
      accordion: {
        icon: 'ri-arrow-left-s-line',
        text: DIA_BROWSER_DISCLOSURE_TEXT,
        links: [
          {
            label: '快捷键设置页面',
            href: SHORTCUTS_PAGE_URL,
            actionId: 'openShortcuts'
          }
        ],
        expandedByDefault: false
      }
    },
    {
      id: 'setup-interaction-2',
      kind: 'accordion-row',
      actionId: 'toggleInteractionAccordion',
      accordionId: 'local-file-search',
      icon: 'ri-information-line',
      label: '在本地 PDF/HTML 标签页中使用聚焦搜索',
      description: '',
      browserOnly: 'chromium',
      accordion: {
        icon: 'ri-arrow-left-s-line',
        text: LOCAL_FILE_ACCORDION_TEXT,
        links: [
          {
            label: '扩展程序详情页',
            href: EXTENSION_DETAILS_URL,
            actionId: 'openExtensionDetails'
          }
        ],
        expandedByDefault: false
      }
    }
  ],
  'second page should expose two shared accordion rows below the subtitle'
);
assert.deepStrictEqual(
  secondSlide.actions,
  {
    primary: {
      actionId: 'next',
      label: '下一页',
      icon: 'ri-arrow-right-line'
    },
    secondary: {
      actionId: 'prev',
      label: '返回',
      icon: ''
    },
    ghost: {
      actionId: 'openShortcuts',
      label: '更换快捷键',
      icon: 'ri-external-link-line',
      tooltip: SHORTCUT_ACTION_TOOLTIP,
      tooltipMaxWidth: 260
    }
  },
  'second page should expose next, previous, and right-aligned shortcut actions'
);

const thirdSlide = blueprint.slides[2];
assert.strictEqual(thirdSlide.id, 'search');
assert.deepStrictEqual(
  thirdSlide.copy,
  {
    eyebrow: '',
    title: '精美新标签页',
    body: '支持海量自定义样式，轻松管理你的书签、访问记录。'
  },
  'third page should introduce the customizable new tab page'
);
assert.strictEqual(thirdSlide.visual.kind, 'newtab-preview-surface');
assert.strictEqual(thirdSlide.visual.visible, true);
assert.strictEqual(thirdSlide.cursor.enabled, true);
assert.deepStrictEqual(
  thirdSlide.left.interactionSlots,
  [
    {
      id: 'search-interaction-1',
      kind: 'compatibility-row',
      actionId: '',
      accordionId: '',
      icon: 'ri-puzzle-line',
      label: '兼容其他新标签页插件',
      description: COMPATIBILITY_TOOLTIP
    }
  ],
  'slide=2 should display the first-page new-tab compatibility explanation inline'
);
assert.deepStrictEqual(
  thirdSlide.actions,
  {
    primary: {
      actionId: 'next',
      label: '下一页',
      icon: 'ri-arrow-right-line'
    },
    secondary: null,
    ghost: null
  },
  'third page should expose a lower-left next action instead of a return action'
);

const fourthSlide = blueprint.slides[3];
assert.strictEqual(fourthSlide.id, 'newtab');
assert.deepStrictEqual(
  fourthSlide.copy,
  {
    eyebrow: '',
    title: 'AI / 站内搜索一键直达',
    body: '输入关键词，按下 Tab，直接搜索站点内结果。'
  },
  'fourth page should introduce the Tab-triggered site search list after the newtab page'
);
assert.strictEqual(fourthSlide.visual.kind, 'site-search-demo-surface');
assert.strictEqual(fourthSlide.visual.visible, true);
assert.strictEqual(fourthSlide.cursor.enabled, true);
assert.deepStrictEqual(
  fourthSlide.left.interactionSlots,
  [],
  'fourth page should not render nonexistent placeholder interaction rows'
);
assert.deepStrictEqual(
  fourthSlide.actions,
  {
    primary: {
      actionId: 'next',
      label: '下一页',
      icon: 'ri-arrow-right-line'
    },
    secondary: null,
    ghost: {
      actionId: 'openSiteSearchOptions',
      label: '支持列表',
      icon: 'ri-external-link-line',
      tooltip: '支持自定义，点击前往设置。'
    }
  },
  'fourth page should expose next plus a right-aligned support list ghost action'
);

assert.deepStrictEqual(
  blueprint.slides.map((slide) => slide.cursor.enabled),
  [true, true, true, true, true],
  'the animated cursor should remain available on every onboarding page'
);

const fifthSlide = blueprint.slides[4];
assert.strictEqual(fifthSlide.id, 'finish');
assert.deepStrictEqual(
  fifthSlide.copy,
  {
    eyebrow: '',
    title: '更多实用功能',
    body: '围绕浏览器提效领域，做最关心用户体验的插件。'
  },
  'final page after site search should introduce more practical browser productivity features'
);
assert.deepStrictEqual(
  blueprint.slides.map((slide) => slide.visual.visible),
  [true, true, true, true, true],
  'all onboarding pages should keep the right-side visual area populated'
);
assert.strictEqual(
  fifthSlide.visual.kind,
  'feature-cards-surface',
  'final page should render the practical features card surface on the right'
);
assert.strictEqual(fifthSlide.visual.visible, true);
assert.deepStrictEqual(
  fifthSlide.left.interactionSlots,
  [],
  'final page should not render empty left-side placeholder interaction rows'
);
assert.deepStrictEqual(
  fifthSlide.actions,
  {
    primary: {
      actionId: 'openNewtab',
      label: '开始体验',
      icon: 'ri-arrow-right-line'
    },
    secondary: {
      actionId: 'openChromeWebStore',
      label: '为我们评分',
      icon: '',
      browserOnly: 'chromium'
    },
    ghost: {
      actionId: 'openOptions',
      label: '设置',
      icon: 'ri-external-link-line'
    }
  },
  'final page should expose start, rating, and settings actions'
);

const fallback = onboarding.getOnboardingBlueprint('missing-locale');
assert.strictEqual(fallback.locale, 'en', 'unknown locales should fall back to English');
assert.strictEqual(
  fallback.slides[0].copy.title,
  'Search bookmarks instantly',
  'unknown locales should fall back to English onboarding copy'
);

const zh = onboarding.getOnboardingBlueprint('zh-CN');
assert.strictEqual(zh.locale, 'zh_CN', 'BCP-47 Chinese locale should normalize to extension locale key');

const en = onboarding.getOnboardingBlueprint('en-US');
assert.strictEqual(en.locale, 'en');
assert.strictEqual(en.htmlLang, 'en');
assert.strictEqual(en.slides[0].copy.title, 'Search bookmarks instantly');
assert.deepStrictEqual(en.slides[0].copy.titleLines, ['Search bookmarks', 'instantly']);
assert.deepStrictEqual(
  en.slides[0].copy.titleCycle,
  {
    prefix: 'Search ',
    items: [
      { id: 'bookmark', label: 'bookmarks', tone: 'bookmark' },
      { id: 'history', label: 'history', tone: 'history' },
      { id: 'top-sites', label: 'top sites', tone: 'top-sites' },
      { id: 'settings', label: 'settings', tone: 'settings' }
    ]
  },
  'English first slide should keep the rotating title layout compact'
);
assert.strictEqual(en.slides[0].copy.body, 'Open-source command bar + a cleaner new tab');
assert.deepStrictEqual(
  en.slides[0].left.interactionSlots.map((slot) => slot.label),
  [
    'Open source, private by design',
    'Works in major browsers',
    'Friendly with other new-tab extensions'
  ],
  'English intro rows should be translated and short enough for the existing layout'
);
assert.deepStrictEqual(
  en.slides[1].copy,
  {
    eyebrow: '',
    title: 'A command bar that feels native',
    titleLines: ['A command bar', 'that feels native'],
    body: 'Press {shortcut} to open Lumno anywhere.'
  },
  'English focus-search copy should preserve the shortcut placeholder'
);
assert.strictEqual(
  en.slides[1].left.interactionSlots[0].label,
  'Using Dia?',
  'English accordion labels should be localized'
);
assert.strictEqual(en.slides[1].actions.ghost.label, 'Change shortcut');
assert.deepStrictEqual(
  en.slides[2].copy,
  {
    eyebrow: '',
    title: 'A calmer new tab for where you go',
    titleLines: ['A calmer new tab', 'for where you go'],
    body: 'Make it yours. Bookmarks and history stay tidy.'
  },
  'English new-tab copy should force a two-line title that carries the Chinese meaning'
);
assert.deepStrictEqual(
  en.slides[3].copy,
  {
    eyebrow: '',
    title: 'AI / site search in one jump',
    titleLines: ['AI / site search', 'in one jump'],
    body: 'Type, hit Tab, and jump to the right search.'
  },
  'English site-search copy should force the second line from "in"'
);
assert.strictEqual(en.slides[3].actions.ghost.label, 'Supported sites');
assert.deepStrictEqual(
  en.slides[4].copy,
  {
    eyebrow: '',
    title: 'Tiny browser wins that add up',
    titleLines: ['Tiny browser wins', 'that add up'],
    body: 'Video popouts, new-tab polish, and useful extras.'
  },
  'English finish copy should stay compact and personable'
);
assert.strictEqual(en.slides[4].actions.primary.label, 'Start using Lumno');

en.slides.slice(1).forEach((slide) => {
  assert.strictEqual(slide.copy.titleLines.length, 2, `${slide.id} English title should render as two lines`);
  slide.copy.titleLines.forEach((line) => {
    assert.ok(line.length <= 20, `${slide.id} English title line should stay short: ${line}`);
  });
  assert.ok(slide.copy.body.length <= 56, `${slide.id} English subtitle should stay short enough to avoid orphan words`);
});

const zhTw = onboarding.getOnboardingBlueprint('zh-Hant-TW');
assert.strictEqual(zhTw.locale, 'zh_TW');
assert.strictEqual(zhTw.htmlLang, 'zh-TW');
assert.strictEqual(zhTw.slides[0].copy.title, '讓書籤一搜即達');
assert.strictEqual(zhTw.slides[1].left.interactionSlots[1].label, '在本機 PDF/HTML 分頁中使用聚焦搜尋');
assert.strictEqual(zhTw.slides[4].actions.secondary.label, '為我們評分');

const ja = onboarding.getOnboardingBlueprint('ja-JP');
assert.strictEqual(ja.locale, 'ja');
assert.strictEqual(ja.htmlLang, 'ja');
assert.strictEqual(ja.slides[0].copy.title, 'ブックマークをすぐ検索');
assert.strictEqual(ja.slides[1].copy.title, 'どこでも呼び出せる');
assert.strictEqual(ja.slides[3].copy.body, '検索語入力後に Tab。サイト内検索をすぐ開けます。');
assert.strictEqual(ja.slides[4].actions.secondary.label, '評価する');
assert.strictEqual(ja.slides[0].copy.titleCycle.items[0].label, 'ブックマーク');
assert.strictEqual(ja.slides[1].left.interactionSlots[1].label, 'ローカルの PDF/HTML で使う');
assert.strictEqual(ja.slides[2].copy.body, '見た目の調整と、ブックマークや履歴の整理をまとめて。');
assert.strictEqual(ja.runtimeCopy.misc.feedbackLabel, 'フィードバックを送る');
assert.strictEqual(ja.runtimeCopy.misc.bookmarkManagerLabel, 'ブックマークマネージャーを開く');
assert.strictEqual(ja.runtimeCopy.newtabPreview.sections.bookmarks, 'ブックマーク');
assert.strictEqual(ja.runtimeCopy.featureCards[0].title, '動画を自動でピクチャーインピクチャー表示');
assert.deepStrictEqual(
  ja.runtimeCopy.featureAwards.map((award) => award.lines),
  [
    ['中身を公開', '情報に配慮'],
    ['ずっと無料', '制限なし'],
    ['使いやすさ', '細部まで']
  ],
  'Japanese feature awards should use balanced two-line labels'
);

function collectStringValues(value, bucket) {
  if (typeof value === 'string') {
    bucket.push(value);
    return bucket;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringValues(item, bucket));
    return bucket;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStringValues(item, bucket));
  }
  return bucket;
}

const jaOnboardingStrings = collectStringValues(ja, []);
[
  'ネイティブ',
  'コマンドバー',
  'ショートカット',
  'オープンソース',
  'ミニマル',
  'プライバシー',
  'リポジトリ',
  'カスタマイズ',
  'オンボーディング',
  'ナビゲーション',
  'ワークスペース',
  'ドキュメント',
  'プレビュー'
].forEach((term) => {
  assert.strictEqual(
    jaOnboardingStrings.some((text) => text.includes(term)),
    false,
    `Japanese onboarding copy should avoid long katakana term: ${term}`
  );
});

const enRuntimeCopy = onboarding.getOnboardingRuntimeCopy('en');
assert.strictEqual(enRuntimeCopy.misc.openLabel, 'Open');
assert.strictEqual(enRuntimeCopy.newtabPreview.sections.bookmarks, 'Bookmarks');
assert.strictEqual(enRuntimeCopy.siteSearchDemo.tabHintTemplate, 'Search with {provider}');
assert.deepStrictEqual(
  enRuntimeCopy.siteSearchDemo.cases.map((item) => ({
    kind: item.kind,
    resultTitle: item.resultTitle,
    actionLabel: item.actionLabel
  })),
  [
    {
      kind: 'site',
      resultTitle: 'Search in GitHub "lumno extension"',
      actionLabel: 'Search'
    },
    {
      kind: 'ai',
      resultTitle: 'Ask ChatGPT "What should I watch for in this PR?"',
      actionLabel: 'Open ChatGPT web app'
    }
  ],
  'English site-search demo highlighted rows should mirror the real Lumno suggestion copy'
);
assert.strictEqual(enRuntimeCopy.featureCards[0].title, 'Auto Picture-in-Picture');
assert.strictEqual(enRuntimeCopy.featureCards[0].body, 'Pops out when you leave a video tab');
assert.deepStrictEqual(
  enRuntimeCopy.featureAwards.map((award) => award.lines),
  [
    ['Open source', 'Privacy first'],
    ['Free forever', 'No strings'],
    ['Feels native', 'stays light']
  ],
  'English feature awards should read naturally in compact two-line badges'
);

assert.deepStrictEqual(
  onboarding.getShortcutDisplayTokens('⌘T'),
  ['⌘', 'T'],
  'compact mac shortcuts should render as separate keycaps'
);
assert.deepStrictEqual(
  onboarding.getShortcutDisplayTokens('⌘⇧K'),
  ['⌘', '⇧', 'K'],
  'compact mac shortcuts with multiple modifiers should render as separate keycaps'
);
assert.deepStrictEqual(
  onboarding.getShortcutDisplayTokens('Command+T', { preferSymbols: true }),
  ['⌘', 'T'],
  'browser shortcut values should still split command and key into separate keycaps'
);
assert.deepStrictEqual(
  onboarding.getShortcutDisplayTokens('Ctrl+T'),
  ['CTRL', 'T'],
  'non-mac shortcuts should keep textual modifier keycaps by default'
);
assert.deepStrictEqual(
  onboarding.parseShortcutHotkey('Command+Shift+K'),
  {
    ctrl: false,
    alt: false,
    shift: true,
    meta: true,
    key: 'k'
  },
  'configured browser command shortcuts should parse into a keydown matcher spec'
);
assert.strictEqual(
  onboarding.shortcutHotkeyMatchesEvent('Command+Shift+K', {
    code: 'KeyK',
    key: 'K',
    ctrlKey: false,
    altKey: false,
    shiftKey: true,
    metaKey: true
  }),
  true,
  'onboarding should match the user-configured command shortcut from browser commands'
);
assert.strictEqual(
  onboarding.shortcutHotkeyMatchesEvent('Ctrl+Shift+Space', {
    code: 'Space',
    key: ' ',
    ctrlKey: true,
    altKey: false,
    shiftKey: true,
    metaKey: false
  }),
  true,
  'onboarding should match special keys returned by browser command shortcuts'
);
assert.strictEqual(
  onboarding.shortcutHotkeyMatchesEvent('Ctrl+Shift+K', {
    code: 'KeyK',
    key: 'K',
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    metaKey: false
  }),
  false,
  'onboarding should require all configured modifiers before opening the overlay'
);
assert.strictEqual(
  onboarding.formatShortcutForDisplay('⌘T'),
  '⌘T',
  'compact mac display labels should stay visually compact while tokens remain separate'
);

const initial = onboarding.createOnboardingState(blueprint.slides.length, 0);
assert.deepStrictEqual(initial, {
  index: 0,
  previousIndex: 0,
  direction: 'none',
  count: blueprint.slides.length
});

assert.deepStrictEqual(
  onboarding.reduceOnboardingState(initial, { type: 'NEXT' }),
  { index: 1, previousIndex: 0, direction: 'forward', count: blueprint.slides.length },
  'NEXT should advance one page'
);

assert.deepStrictEqual(
  onboarding.reduceOnboardingState(initial, { type: 'PREV' }),
  { index: 0, previousIndex: 0, direction: 'none', count: blueprint.slides.length },
  'PREV should clamp at the first page'
);

assert.deepStrictEqual(
  onboarding.reduceOnboardingState(initial, { type: 'GOTO', index: 99 }),
  {
    index: blueprint.slides.length - 1,
    previousIndex: 0,
    direction: 'forward',
    count: blueprint.slides.length
  },
  'GOTO should clamp to the final page'
);

console.log('onboarding content tests passed');
