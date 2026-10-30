import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import zhCnMessages from '../../_locales/zh_CN/messages.json';
import { REPO_ROOT } from '../../tests/fakes/css';
import { missingMessages } from '../../tests/fakes/locale-messages';
import { buildModel, describePage, formatSyncTime, type PopupState, type PopupSyncStatus } from './model';
import type { PopupActionId, PopupActionModel, PopupModel, PopupSettingRowModel } from './react/popup-view';

const zh: Record<string, { message: string }> = zhCnMessages;
const t = (key: string, fallback: string) => (zh[key] ? zh[key].message : fallback);
const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);

function state(overrides: Partial<PopupState> = {}): PopupState {
  return {
    tab: { id: 7, url: 'https://www.bilibili.com/video/1', title: 'Kyoto walk', iconUrl: 'icon.png' },
    restricted: false,
    documentPipSupported: true,
    documentPipEnabled: false,
    shortcuts: { search: '⇧⌘K', copy: '⇧⌘C' },
    recentPin: null,
    settings: {
      selectionQuickActions: true,
      overlaySize: 'standard',
      overlayPageTheme: true,
      overlayOpenTabs: false,
      theme: 'system',
      autoPip: true
    },
    settingsExpanded: false,
    pip: { supported: true, hasVideo: false, active: false, menuExpanded: false },
    syncStatus: null,
    version: '1.1.3',
    lang: 'zh-CN',
    now: NOW,
    busyAction: '',
    notice: null,
    ...overrides
  };
}

function actions(model: PopupModel): Partial<Record<PopupActionId, PopupActionModel>> {
  return Object.fromEntries(model.actions.map((action) => [action.id, action]));
}

function action(model: PopupModel, id: PopupActionId): PopupActionModel {
  const found = model.actions.find((each) => each.id === id);
  if (!found) {
    throw new Error(`The popup shows no ${id} action`);
  }
  return found;
}

function rows(model: PopupModel): Record<string, PopupSettingRowModel> {
  return Object.fromEntries(model.settings.sections.flatMap((section) => section.rows).map((row) => [row.id, row]));
}

function optionValues(row: PopupSettingRowModel | undefined): string[] {
  return row && row.kind === 'segmented' ? row.options.map((option) => option.value) : [];
}

const PIP_WITH_VIDEO = { supported: true, hasVideo: true, active: false, menuExpanded: false };

describe('Popup model on a web page', () => {
  it('shows the page and every page action, web clip left out while it is off in Labs', () => {
    const model = buildModel(state(), t);
    expect(model.page).toEqual({ title: 'Kyoto walk', host: 'www.bilibili.com', iconUrl: 'icon.png', iconName: 'ri-global-line' });
    expect(model.actions.map((each) => each.id)).toEqual(['search', 'copy', 'shortcut', 'pin', 'pip']);
    // Only the video action, without a video, is off.
    expect(model.actions.filter((each) => each.disabled).map((each) => each.id)).toEqual(['pip']);
    expect(model.notice).toBeNull();
  });

  it('labels each action and says in its tooltip what it does or which keys run it', () => {
    const model = buildModel(state(), t);
    expect([action(model, 'search').label, action(model, 'search').tooltip]).toEqual(['打开命令栏', '⇧⌘K']);
    expect(action(model, 'copy').tooltip).toBe('⇧⌘C');
    expect([action(model, 'shortcut').label, action(model, 'shortcut').tooltip]).toEqual(['添加快捷方式', '添加到新标签页的快捷方式']);
    expect(action(model, 'pin')).toMatchObject({ label: '置顶到最近访问', tooltip: '在新标签页的最近访问里置顶', iconName: 'ri-pushpin-line' });
    expect(action(buildModel(state({ shortcuts: { search: '', copy: '' } }), t), 'copy').tooltip).toBe('');
  });

  it('folds the quick settings into a command bar and a general section', () => {
    const model = buildModel(state(), t);
    expect([model.settings.label, model.settings.expanded]).toEqual(['快速设置', false]);
    expect(buildModel(state({ settingsExpanded: true }), t).settings.expanded).toBe(true);
    expect(model.settings.sections.map((section) => [section.id, section.title])).toEqual([['command-bar', '命令栏'], ['general', '常规']]);
    const settingRows = rows(model);
    expect(optionValues(settingRows.overlaySize)).toEqual(['compact', 'standard', 'large']);
    expect(optionValues(settingRows.theme)).toEqual(['system', 'light', 'dark']);
    expect(settingRows).toMatchObject({
      overlaySize: { value: 'standard' },
      overlayPageTheme: { checked: true },
      overlayOpenTabs: { checked: false },
      selectionQuickActions: { checked: true },
      theme: { value: 'system' }
    });
  });

  it('ends with icon links and the version, without a sync status unless WebDAV is on', () => {
    const model = buildModel(state(), t);
    expect(model.links.map((link) => [link.id, link.label])).toEqual([
      ['release', '更新日志'], ['feedback', '反馈'], ['shortcuts', '设置快捷键'], ['settings', '设置']
    ]);
    model.links.forEach((link) => expect(link.iconName).toMatch(/^ri-/));
    expect(model.sync).toBeNull();
    expect(model.version).toBe('Lumno 1.1.3');
  });
});

describe('Popup actions by state', () => {
  it('adds web clip as its own action once Labs turns it on and the browser has it', () => {
    const model = buildModel(state({ documentPipEnabled: true }), t);
    expect(model.actions.map((each) => each.id)).toEqual(['search', 'copy', 'shortcut', 'pin', 'clip', 'pip']);
    expect([action(model, 'clip').label, action(model, 'clip').tooltip]).toEqual(['网页剪裁', '剪下网页局部，放进置顶小窗']);
    // Tooltips fit one or two lines of the popup.
    model.actions.forEach((each) => expect(each.tooltip.length, each.id).toBeLessThanOrEqual(16));
    expect(actions(buildModel(state({ documentPipEnabled: true, documentPipSupported: false }), t)).clip).toBeUndefined();
  });

  it('offers to unpin a pinned page, and turns the pin off with a reason once the list is full', () => {
    const pinned = action(buildModel(state({ recentPin: { pinned: true, full: true } }), t), 'pin');
    expect(pinned).toMatchObject({ label: '取消置顶', tooltip: '从新标签页的最近访问取消置顶', iconName: 'ri-unpin-line', disabled: false });
    const full = action(buildModel(state({ recentPin: { pinned: false, full: true } }), t), 'pin');
    expect([full.disabled, full.tooltip]).toEqual([true, '最多置顶 3 个']);
  });

  it('keeps picture-in-picture off without a video, its auto switch still reachable from the chevron', () => {
    const noVideo = action(buildModel(state(), t), 'pip');
    expect(noVideo).toMatchObject({ disabled: true, label: '画中画', tooltip: '', menu: { label: '自动画中画', expanded: false } });
    expect(action(buildModel(state({ pip: PIP_WITH_VIDEO }), t), 'pip')).toMatchObject({ disabled: false, tooltip: '让网页视频悬浮播放' });
    expect(action(buildModel(state({ pip: { ...PIP_WITH_VIDEO, active: true } }), t), 'pip').label).toBe('退出画中画');
    // The options stay mounted, folded.
    expect(buildModel(state(), t).actionPanel?.expanded).toBe(false);
    const opened = buildModel(state({ pip: { ...PIP_WITH_VIDEO, menuExpanded: true } }), t);
    expect(action(opened, 'pip').menu?.expanded).toBe(true);
    expect(opened.actionPanel).toEqual({
      actionId: 'pip',
      expanded: true,
      rows: [{ kind: 'switch', id: 'autoPip', label: '自动画中画', hint: '切到其他标签页时，视频自动悬浮', checked: true }]
    });
    // Firefox has no video picture-in-picture.
    expect(actions(buildModel(state({ pip: { ...PIP_WITH_VIDEO, supported: false } }), t)).pip).toBeUndefined();
  });

  it('turns off what a browser page cannot take and says why, keeping copy and the command bar', () => {
    const tab = { id: 3, url: 'chrome://extensions/', title: 'Extensions', iconUrl: 'logo.svg', iconName: null, host: 'chrome://extensions/' };
    const model = buildModel(state({ tab, restricted: true, documentPipEnabled: true }), t);
    const unavailable = { disabled: true, tooltip: '这个网页不支持' };
    expect(action(model, 'clip')).toMatchObject(unavailable);
    expect(action(model, 'shortcut')).toMatchObject(unavailable);
    expect(action(model, 'pin')).toMatchObject(unavailable);
    expect(action(model, 'copy').disabled).toBe(false);
    // The command bar falls back to a New Tab there.
    expect(action(model, 'search').disabled).toBe(false);
    expect(actions(model).pip).toBeUndefined();
    expect([model.page.iconUrl, model.page.host]).toEqual(['logo.svg', 'chrome://extensions/']);
    expect(model.notice).toBeNull();
  });

  it('still saves a store page\'s address while clip is off there', () => {
    const tab = { id: 4, url: 'https://chrome.google.com/webstore/devconsole/abc', title: 'Developer Dashboard', iconUrl: 'icon.png' };
    const model = buildModel(state({ tab, restricted: true, documentPipEnabled: true }), t);
    expect([action(model, 'shortcut').disabled, action(model, 'pin').disabled, action(model, 'clip').disabled]).toEqual([false, false, true]);
  });

  it('turns every action off without a tab, and the busy one while it runs', () => {
    const noTab = buildModel(state({ tab: null }), t);
    expect(noTab.actions.every((each) => each.disabled)).toBe(true);
    expect(noTab.page.title).toBe('Lumno');
    const busy = buildModel(state({ busyAction: 'shortcut' }), t);
    expect([action(busy, 'shortcut').disabled, action(busy, 'copy').disabled]).toEqual([true, false]);
  });
});

describe('Popup page icons', () => {
  const origins = (browserName: string) => ({
    ownBase: 'chrome-extension://lumno/',
    browserName,
    isBrowserInternalUrl: (url: string) => /^(?:chrome|edge|about):/.test(url)
  });

  it('marks Lumno\'s own pages, browser pages by browser, other extensions, files and the web', () => {
    expect(describePage('chrome-extension://lumno/newtab.html', origins('Chrome')))
      .toEqual({ kind: 'lumno', iconPath: 'assets/images/lumno.png', iconName: null, host: 'Lumno' });
    const logo = (url: string, browser: string) => describePage(url, origins(browser)).iconPath;
    expect(logo('chrome://settings/', 'Google Chrome')).toBe('assets/images/browser-logos/google-chrome-2022.svg');
    expect(logo('edge://settings/', 'Microsoft Edge')).toBe('assets/images/browser-logos/microsoft-edge-2019.svg');
    expect(logo('about:preferences', 'Firefox')).toBe('assets/images/browser-logos/firefox.svg');
    expect(logo('chrome://settings/', 'Dia')).toBe('assets/images/browser-logos/dia.jpg');
    expect(describePage('chrome://settings/', origins('Brave')))
      .toEqual({ kind: 'browser', iconPath: '', iconName: 'ri-window-line', host: 'chrome://settings/' });
    expect(describePage('chrome-extension://other/page.html', origins('Chrome')).iconName).toBe('ri-puzzle-line');
    expect(describePage('file:///Users/me/a.pdf', origins('Chrome')).iconName).toBe('ri-file-line');
    expect(describePage('https://www.bilibili.com/video/1', origins('Chrome')))
      .toEqual({ kind: 'web', iconPath: '', iconName: 'ri-global-line', host: 'www.bilibili.com' });
  });

  it('ships every browser logo it names', () => {
    ['google-chrome-2022.svg', 'microsoft-edge-2019.svg', 'firefox.svg', 'zen.svg', 'dia.jpg', 'comet.jpg'].forEach((file) => {
      expect(existsSync(join(REPO_ROOT, 'assets/images/browser-logos', file)), file).toBe(true);
    });
  });
});

describe('Popup WebDAV status', () => {
  const sync = (status: Partial<PopupSyncStatus>) =>
    buildModel(state({ syncStatus: { enabled: true, state: 'ready', error: '', lastSyncAt: null, ...status } }), t).sync;

  it('tells the last sync time, a sync in progress and states that need the person', () => {
    expect(sync({ enabled: false, lastSyncAt: NOW })).toBeNull();
    expect(sync({ lastSyncAt: NOW - 2 * 60 * 1000 })).toEqual({ label: 'WebDAV 已同步 · 2分钟前', tone: 'ok' });
    expect(sync({ state: 'syncing' })?.tone).toBe('busy');
    expect(sync({ state: 'pending' })?.tone).toBe('busy');
    expect(sync({ state: 'error' })?.label).toBe('WebDAV 同步失败');
    expect(sync({ state: 'conflict' })?.tone).toBe('error');
    expect(formatSyncTime(NOW - 3 * 3600 * 1000, NOW, 'en')).toBe('3 hours ago');
  });

  it('shows a rate-limited connection as waiting, not syncing', () => {
    ['http-429', 'http-503'].forEach((error) => {
      expect(sync({ state: 'pending', error }), error).toEqual({ label: 'WebDAV 等待重试', tone: 'waiting' });
    });
  });
});

describe('Popup strings', () => {
  it('finds every string the model asks for in every language', () => {
    const keys = new Set<string>();
    const record = (key: string, fallback: string) => {
      keys.add(key);
      return fallback;
    };
    const browserPage = { id: 3, url: 'chrome://extensions/', title: 'Extensions' };
    [
      state(),
      state({ documentPipEnabled: true, settingsExpanded: true }),
      state({ recentPin: { pinned: true, full: true } }),
      state({ recentPin: { pinned: false, full: true } }),
      state({ pip: { ...PIP_WITH_VIDEO, menuExpanded: true } }),
      state({ pip: { ...PIP_WITH_VIDEO, active: true } }),
      state({ tab: browserPage, restricted: true, documentPipEnabled: true }),
      state({ tab: null }),
      ...['ready', 'syncing', 'error', 'conflict'].map((syncState) =>
        state({ syncStatus: { enabled: true, state: syncState, error: '', lastSyncAt: NOW } })),
      state({ syncStatus: { enabled: true, state: 'pending', error: 'http-429', lastSyncAt: NOW } })
    ].forEach((each) => buildModel(each, record));
    expect(keys.size).toBeGreaterThan(20);
    expect(missingMessages(keys)).toEqual([]);
  });
});
