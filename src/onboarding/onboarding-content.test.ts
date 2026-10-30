import { describe, expect, it } from 'vitest';
import {
  createOnboardingState,
  formatShortcutForDisplay,
  getOnboardingBlueprint,
  getShortcutDisplayTokens,
  parseShortcutHotkey,
  reduceOnboardingState,
  shortcutHotkeyMatchesEvent
} from './onboarding-content';

const GITHUB_HOMEPAGE_URL = 'https://github.com/kubai087/lumno-extension';
const COMPATIBILITY_TOOLTIP =
  '受浏览器限制，Lumno 无法提供单独关闭新标签页的入口，但它可以与其他新标签页插件同时使用。\n具体而言，安装 Lumno 后，再覆盖安装或重新启用你正在使用的新标签页插件，让它继续接管新标签页即可。';
const SHORTCUT_ACTION_TOOLTIP = '由于浏览器限制，请在浏览器的扩展快捷键页面修改 Lumno 的快捷键，点击前往。';
const DIA_BROWSER_DISCLOSURE_TEXT =
  'Dia 不支持扩展替换新标签页，但聚焦搜索可以正常使用。想用 ⌘T 唤起：Dia 自带快捷键优先，请先在 Dia 的 Settings → Shortcuts 中把“New Tab”的 ⌘T 改成其他按键，再进入浏览器的快捷键设置页面，将“Open command bar”设为 ⌘T。若快捷键没有反应，将其从“In Dia”改为“Global”。';
const LOCAL_FILE_ACCORDION_TEXT = '请前往扩展程序详情页，为 Lumno 开启“允许访问文件网址”，开启后刷新对应标签页。';
const NEXT = { actionId: 'next', label: '下一页', icon: 'ri-arrow-right-line' };

const blueprint = getOnboardingBlueprint('zh_CN');

function slide(id: string) {
  const found = blueprint.slides.find((each) => each.id === id);
  if (!found) {
    throw new Error(`No onboarding slide ${id}`);
  }
  return found;
}

describe('Onboarding blueprint', () => {
  it('lays out a short paginated flow whose slides share one shape', () => {
    expect([blueprint.brand, blueprint.locale, blueprint.htmlLang, blueprint.mode])
      .toEqual(['Lumno', 'zh_CN', 'zh-CN', 'paginated']);
    expect(blueprint.slides.map((each) => each.id)).toEqual(['intro', 'setup', 'search', 'newtab', 'finish']);
    blueprint.slides.forEach((each, index) => {
      expect(each.sequence).toBe(index + 1);
      expect(Array.isArray(each.left.interactionSlots)).toBe(true);
      expect(each.visual.mountId).toBe('onboarding-visual-stage');
      expect(each.visual.kind).toMatch(/-surface$/);
      // Every page keeps its illustration and the animated cursor.
      expect(each.visual.visible).toBe(true);
      expect(each.cursor.enabled).toBe(true);
      expect(typeof each.actions).toBe('object');
    });
    expect(blueprint.slides.map((each) => each.visual.kind)).toEqual([
      'lumno-web-wordmark-surface',
      'bookmark-focus-surface',
      'newtab-preview-surface',
      'site-search-demo-surface',
      'feature-cards-surface'
    ]);
  });

  it('opens with the rotating title, the Lumno mark and three trust rows', () => {
    const intro = slide('intro');
    expect(intro.copy.title).toBe('让浏览器的书签一搜即达');
    expect(intro.copy.titleLines).toEqual(['让浏览器的书签', '一搜即达']);
    expect(intro.copy.titleLogo).toEqual({ label: 'Lumno', src: '../../assets/images/lumno.png' });
    expect(intro.copy.titleCycle).toEqual({
      prefix: '让浏览器的',
      items: [
        { id: 'bookmark', label: '书签', tone: 'bookmark' },
        { id: 'history', label: '历史', tone: 'history' },
        { id: 'top-sites', label: '常用网站', tone: 'top-sites' },
        { id: 'settings', label: '设置项', tone: 'settings' }
      ]
    });
    expect(intro.copy.body).toBe('开源浏览器聚焦搜索 & 极简新标签页');
    expect(intro.left.interactionSlots.map((row) => [row.label, row.icon])).toEqual([
      ['开源、隐私边界透明、注重用户体验', 'ri-shield-check-line'],
      ['支持主流浏览器', 'ri-chrome-line'],
      ['兼容其他新标签页插件', 'ri-puzzle-line']
    ]);
    expect(intro.actions).toEqual({
      primary: { actionId: 'next', label: '快速上手', icon: 'ri-arrow-right-line' },
      secondary: null,
      ghost: null
    });
  });

  it('links the trust row to the repository and explains browsers and compatibility in tooltips', () => {
    const rows = slide('intro').left.interactionSlots;
    const row = (kind: string) => rows.find((each) => each.kind === kind);
    expect(row('trust-row')?.linkButton).toEqual({
      icon: 'ri-github-fill',
      label: 'GitHub 仓库',
      tooltip: '以 GPL-3.0 许可证开源，点击访问 GitHub 仓库。',
      href: GITHUB_HOMEPAGE_URL
    });
    const logos = '../../assets/images/browser-logos';
    expect(row('browser-row')?.browserAvatars).toEqual({
      prefix: '支持',
      suffix: '主流浏览器',
      browsers: [
        { id: 'chrome', name: 'Chrome', src: `${logos}/google-chrome-2022.svg` },
        { id: 'edge', name: 'Edge', src: `${logos}/microsoft-edge-2019.svg` },
        { id: 'firefox', name: 'Firefox', src: `${logos}/firefox.svg` },
        { id: 'zen', name: 'Zen', src: `${logos}/zen.svg` },
        { id: 'dia', name: 'Dia', src: `${logos}/dia.jpg` },
        { id: 'comet', name: 'Comet', src: `${logos}/comet.jpg` }
      ]
    });
    expect(row('browser-row')?.infoTooltip).toEqual({
      icon: 'ri-information-line', label: '支持的浏览器', type: 'browser-avatars', text: ''
    });
    expect(row('compatibility-row')?.infoTooltip).toEqual({
      icon: 'ri-information-line', label: '兼容说明', type: '', text: COMPATIBILITY_TOOLTIP
    });
  });

  it('introduces the command bar with Chromium-only accordions and a shortcut change action', () => {
    const setup = slide('setup');
    expect(setup.copy).toEqual({
      eyebrow: '',
      title: '原生聚焦搜索体验',
      body: '在任意网站按下快捷键{shortcut}，唤起聚焦搜索悬浮窗。'
    });
    expect(setup.copy).not.toHaveProperty('note');
    expect(setup.left.interactionSlots).toEqual([
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
          links: [{ label: '快捷键设置页面', href: 'chrome://extensions/shortcuts', actionId: 'openShortcuts' }],
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
          links: [{
            label: '扩展程序详情页',
            href: 'chrome://extensions/?id=nkbkcafoocmnnconoijmhloecgamfcai',
            actionId: 'openExtensionDetails'
          }],
          expandedByDefault: false
        }
      }
    ]);
    expect(setup.actions).toEqual({
      primary: NEXT,
      secondary: { actionId: 'prev', label: '返回' },
      ghost: {
        actionId: 'openShortcuts',
        label: '更换快捷键',
        icon: 'ri-external-link-line',
        tooltip: SHORTCUT_ACTION_TOOLTIP,
        tooltipMaxWidth: 260
      }
    });
  });

  it('shows the New Tab page with the compatibility note written out inline', () => {
    const search = slide('search');
    expect(search.copy).toEqual({ eyebrow: '', title: '精美新标签页', body: '支持海量自定义样式，轻松管理你的书签、访问记录。' });
    expect(search.left.interactionSlots).toEqual([{
      id: 'search-interaction-1',
      kind: 'compatibility-row',
      actionId: '',
      accordionId: '',
      icon: 'ri-puzzle-line',
      label: '兼容其他新标签页插件',
      description: COMPATIBILITY_TOOLTIP
    }]);
    expect(search.actions).toEqual({ primary: NEXT, secondary: null, ghost: null });
  });

  it('demonstrates site search with no placeholder rows and a link to the supported list', () => {
    const siteSearch = slide('newtab');
    expect(siteSearch.copy).toEqual({ eyebrow: '', title: 'AI / 站内搜索一键直达', body: '输入关键词，按下 Tab，直接搜索站点内结果。' });
    expect(siteSearch.left.interactionSlots).toEqual([]);
    expect(siteSearch.actions).toEqual({
      primary: NEXT,
      secondary: null,
      ghost: { actionId: 'openSiteSearchOptions', label: '支持列表', icon: 'ri-external-link-line', tooltip: '支持自定义，点击前往设置。' }
    });
  });

  it('ends with the feature cards, a help center row and start, rating and settings actions', () => {
    const finish = slide('finish');
    expect(finish.copy).toEqual({ eyebrow: '', title: '更多实用功能', body: '围绕浏览器提效领域，做最关心用户体验的插件。' });
    expect(finish.left.interactionSlots).toEqual([{
      id: 'finish-interaction-1',
      kind: 'help-row',
      actionId: 'openHelpCenter',
      accordionId: '',
      icon: 'ri-book-open-line',
      label: '每个功能的用法，都写在帮助中心',
      description: '',
      trailingIcon: 'ri-external-link-line'
    }]);
    expect(finish.actions).toEqual({
      primary: { actionId: 'openNewtab', label: '开始体验', icon: 'ri-arrow-right-line' },
      secondary: { actionId: 'openChromeWebStore', label: '为我们评分' },
      ghost: { actionId: 'openOptions', label: '设置', icon: 'ri-external-link-line' }
    });
  });
});

describe('Onboarding shortcut display and matching', () => {
  it('splits a shortcut into one keycap per key', () => {
    expect(getShortcutDisplayTokens('⌘T')).toEqual(['⌘', 'T']);
    expect(getShortcutDisplayTokens('⌘⇧K')).toEqual(['⌘', '⇧', 'K']);
    expect(getShortcutDisplayTokens('Command+T', { preferSymbols: true })).toEqual(['⌘', 'T']);
    expect(getShortcutDisplayTokens('Ctrl+T')).toEqual(['CTRL', 'T']);
    expect(formatShortcutForDisplay('⌘T')).toBe('⌘T');
  });

  it('matches the browser command shortcut only with all of its modifiers', () => {
    expect(parseShortcutHotkey('Command+Shift+K')).toEqual({ ctrl: false, alt: false, shift: true, meta: true, key: 'k' });
    const press = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);
    expect(shortcutHotkeyMatchesEvent('Command+Shift+K', press({ code: 'KeyK', key: 'K', shiftKey: true, metaKey: true }))).toBe(true);
    expect(shortcutHotkeyMatchesEvent('Ctrl+Shift+Space', press({ code: 'Space', key: ' ', ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(shortcutHotkeyMatchesEvent('Ctrl+Shift+K', press({ code: 'KeyK', key: 'K', ctrlKey: true }))).toBe(false);
  });
});

describe('Onboarding page state', () => {
  const count = blueprint.slides.length;
  const initial = createOnboardingState(count, 0);

  it('starts on the first page without a direction', () => {
    expect(initial).toEqual({ index: 0, previousIndex: 0, direction: 'none', count });
  });

  it('moves one page forward, clamps at the first page and clamps a jump to the last', () => {
    expect(reduceOnboardingState(initial, { type: 'NEXT' })).toEqual({ index: 1, previousIndex: 0, direction: 'forward', count });
    expect(reduceOnboardingState(initial, { type: 'PREV' })).toEqual({ index: 0, previousIndex: 0, direction: 'none', count });
    expect(reduceOnboardingState(initial, { type: 'GOTO', index: 99 }))
      .toEqual({ index: count - 1, previousIndex: 0, direction: 'forward', count });
  });
});
