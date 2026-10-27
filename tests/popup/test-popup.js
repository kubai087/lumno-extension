const assert = require('assert');
const fs = require('fs');
const path = require('path');
const popup = require('../../src/popup/model.ts');
const { JSDOM } = require('jsdom');
const { loadBackground, wait } = require('../helpers/background-harness');
const { getBundleFiles, getPageScripts } = require('../helpers/runtime-scripts');

const repoRoot = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');
const locales = ['en', 'ja', 'zh_CN', 'zh_TW'];
const zh = JSON.parse(read('_locales/zh_CN/messages.json'));
const t = (key, fallback) => (zh[key] ? zh[key].message : fallback);

function state(overrides = {}) {
  return {
    tab: { id: 7, url: 'https://www.bilibili.com/video/1', title: 'Kyoto walk', iconUrl: 'icon.png' },
    restricted: false,
    documentPipSupported: true,
    documentPipEnabled: false,
    shortcuts: { search: '⇧⌘K', copy: '⇧⌘C' },
    settings: {
      selectionQuickActions: true,
      overlaySize: 'standard',
      overlayPageTheme: true,
      overlayOpenTabs: false,
      theme: 'system',
      autoPip: true
    },
    syncStatus: null,
    version: '1.1.3',
    lang: 'zh-CN',
    now: Date.UTC(2026, 9, 20, 12, 0, 0),
    busyAction: '',
    notice: null,
    pip: { supported: true, hasVideo: false, active: false, menuExpanded: false },
    ...overrides
  };
}

const byId = (model) => Object.fromEntries(model.actions.map((action) => [action.id, action]));
const rows = (model) => Object.fromEntries(model.settings.sections.flatMap((section) => section.rows).map((row) => [row.id, row]));

// A web page with web clip off: the clip button is not there at all.
{
  const model = popup.buildModel(state(), t);
  assert.deepStrictEqual(model.page, {
    title: 'Kyoto walk', host: 'www.bilibili.com', iconUrl: 'icon.png', iconName: 'ri-global-line'
  });
  assert.deepStrictEqual(model.actions.map((action) => action.id), ['search', 'copy', 'shortcut', 'pin', 'pip']);
  const actions = byId(model);
  assert(model.actions.filter((action) => action.id !== 'pip').every((action) => !action.disabled),
    'nothing but a video action without a video is disabled on a web page');
  assert.strictEqual(actions.search.label, '打开命令栏');
  assert.strictEqual(actions.search.tooltip, '⇧⌘K', 'the command bar shortcut is its tooltip');
  assert.strictEqual(actions.copy.tooltip, '⇧⌘C', 'the copy shortcut is the tooltip');
  assert.strictEqual(actions.shortcut.label, '添加快捷方式');
  assert.strictEqual(actions.shortcut.tooltip, '添加到新标签页的快捷方式', 'the tooltip says where the shortcut goes');
  assert.strictEqual(actions.pin.label, '置顶到最近访问');
  assert.strictEqual(actions.pin.tooltip, '在新标签页的最近访问里置顶', 'the tooltip says where the pin goes');
  assert.strictEqual(actions.pin.iconName, 'ri-pushpin-line');
  assert.strictEqual(model.notice, null);
  assert.strictEqual(model.settings.label, '快速设置');
  assert.strictEqual(model.settings.expanded, false, 'the settings start folded');
  assert.deepStrictEqual(model.settings.sections.map((section) => [section.id, section.title]),
    [['command-bar', '命令栏'], ['general', '常规']]);
  const settingRows = rows(model);
  assert.deepStrictEqual(settingRows.overlaySize.options.map((option) => option.value), ['compact', 'standard', 'large']);
  assert.strictEqual(settingRows.overlaySize.value, 'standard');
  assert.strictEqual(settingRows.overlayPageTheme.checked, true);
  assert.strictEqual(settingRows.overlayOpenTabs.checked, false);
  assert.strictEqual(settingRows.selectionQuickActions.checked, true);
  assert.deepStrictEqual(settingRows.theme.options.map((option) => option.value), ['system', 'light', 'dark']);
  assert.strictEqual(settingRows.theme.value, 'system');
  assert.deepStrictEqual(model.links.map((link) => [link.id, link.label]),
    [['release', '更新日志'], ['feedback', '反馈'], ['shortcuts', '设置快捷键'], ['settings', '设置']]);
  assert(model.links.every((link) => link.iconName.startsWith('ri-')), 'every link has an icon');
  assert.strictEqual(model.sync, null, 'no sync status without WebDAV');
  assert.strictEqual(model.version, 'Lumno 1.1.3');
  assert.strictEqual(popup.buildModel(state({ settingsExpanded: true }), t).settings.expanded, true);
}

// Web clip turned on in Labs joins as the third button.
{
  const model = popup.buildModel(state({ documentPipEnabled: true }), t);
  assert.deepStrictEqual(model.actions.map((action) => action.id), ['search', 'copy', 'shortcut', 'pin', 'clip', 'pip']);
  assert.strictEqual(byId(model).clip.label, '网页剪裁');
  assert.strictEqual(byId(model).clip.tooltip, '剪下网页局部，放进置顶小窗', 'the tooltip says what makes web clip useful');
}

// Tooltips stay short enough for one or two lines in the popup.
{
  const model = popup.buildModel(state({ documentPipEnabled: true }), t);
  model.actions.forEach((action) => assert(action.tooltip.length <= 16, `${action.id} tooltip is short`));
  assert(!byId(popup.buildModel(state({ tab: { id: 3, url: 'chrome://version/', title: 'Version' }, restricted: true }), t)).pip,
    'browser pages have no picture-in-picture');
  const noShortcut = popup.buildModel(state({ shortcuts: { search: '', copy: '' } }), t);
  assert.strictEqual(byId(noShortcut).copy.tooltip, '', 'no copy shortcut, no tooltip');
}

// Pinning among the New Tab's recent sites: a pinned page offers to unpin; a
// full list turns the pin off and says why.
{
  const pinned = byId(popup.buildModel(state({ recentPin: { pinned: true, full: true } }), t)).pin;
  assert.strictEqual(pinned.label, '取消置顶');
  assert.strictEqual(pinned.tooltip, '从新标签页的最近访问取消置顶');
  assert.strictEqual(pinned.iconName, 'ri-unpin-line');
  assert.strictEqual(pinned.disabled, false, 'a full list still lets this page go');
  const full = byId(popup.buildModel(state({ recentPin: { pinned: false, full: true } }), t)).pin;
  assert.strictEqual(full.disabled, true);
  assert.strictEqual(full.tooltip, '最多置顶 3 个');
}

// Picture-in-picture: off without a video, but its options stay reachable;
// the chevron opens the auto picture-in-picture switch.
{
  const noVideo = byId(popup.buildModel(state(), t)).pip;
  assert.strictEqual(noVideo.disabled, true);
  assert.strictEqual(noVideo.label, '画中画');
  assert.strictEqual(noVideo.tooltip, '', 'no tooltip without a video');
  assert.deepStrictEqual(noVideo.menu, { label: '自动画中画', expanded: false });
  const withVideo = byId(popup.buildModel(state({ pip: { supported: true, hasVideo: true, active: false } }), t)).pip;
  assert.strictEqual(withVideo.disabled, false);
  assert.strictEqual(withVideo.tooltip, '让网页视频悬浮播放');
  const floating = byId(popup.buildModel(state({ pip: { supported: true, hasVideo: true, active: true } }), t)).pip;
  assert.strictEqual(floating.label, '退出画中画', 'a floating video can be brought back');
  assert.strictEqual(popup.buildModel(state(), t).actionPanel.expanded, false, 'the options stay mounted, folded');
  const opened = popup.buildModel(state({ pip: { supported: true, hasVideo: true, active: false, menuExpanded: true } }), t);
  assert.strictEqual(byId(opened).pip.menu.expanded, true);
  assert.deepStrictEqual(opened.actionPanel, {
    actionId: 'pip',
    expanded: true,
    rows: [{ kind: 'switch', id: 'autoPip', label: '自动画中画', hint: '切到其他标签页时，视频自动悬浮', checked: true }]
  });
  const firefox = popup.buildModel(state({ pip: { supported: false, hasVideo: true, active: false } }), t);
  assert(!firefox.actions.some((action) => action.id === 'pip'), 'no video picture-in-picture in Firefox');
}

// Firefox has no Document Picture-in-Picture, whatever the stored switch says.
{
  const model = popup.buildModel(state({ documentPipEnabled: true, documentPipSupported: false }), t);
  assert(!model.actions.some((action) => action.id === 'clip'));
}

// A browser page: clip and add are off and say why; copy and the command bar
// still work. There is no separate notice.
{
  const tab = { id: 3, url: 'chrome://extensions/', title: 'Extensions', iconUrl: 'logo.svg', iconName: null, host: 'chrome://extensions/' };
  const model = popup.buildModel(state({ tab, restricted: true, documentPipEnabled: true }), t);
  const actions = byId(model);
  assert.strictEqual(actions.clip.disabled, true);
  assert.strictEqual(actions.shortcut.disabled, true);
  assert.strictEqual(actions.shortcut.tooltip, '这个网页不支持');
  assert.strictEqual(actions.pin.disabled, true);
  assert.strictEqual(actions.pin.tooltip, '这个网页不支持');
  assert.strictEqual(actions.clip.tooltip, '这个网页不支持');
  assert.strictEqual(actions.copy.disabled, false);
  assert.strictEqual(actions.search.disabled, false, 'the command bar falls back to a New Tab there');
  assert.strictEqual(model.page.iconUrl, 'logo.svg');
  assert.strictEqual(model.page.host, 'chrome://extensions/');
  assert.strictEqual(model.notice, null);
}

// A store page takes no scripts, but its address can still be saved: add and
// pin stay on while clip is off.
{
  const tab = { id: 4, url: 'https://chrome.google.com/webstore/devconsole/abc', title: 'Developer Dashboard', iconUrl: 'icon.png' };
  const actions = byId(popup.buildModel(state({ tab, restricted: true, documentPipEnabled: true }), t));
  assert.strictEqual(actions.shortcut.disabled, false);
  assert.strictEqual(actions.pin.disabled, false);
  assert.strictEqual(actions.clip.disabled, true);
}

// Page icons: Lumno's own pages, browser pages by browser, other extensions, files, the web.
{
  const context = (browserName) => ({
    ownBase: 'chrome-extension://lumno/',
    browserName,
    isBrowserInternalUrl: (url) => /^(?:chrome|edge|about):/.test(url)
  });
  assert.deepStrictEqual(popup.describePage('chrome-extension://lumno/newtab.html', context('Chrome')),
    { kind: 'lumno', iconPath: 'assets/images/lumno.png', iconName: null, host: 'Lumno' });
  assert.strictEqual(popup.describePage('chrome://settings/', context('Google Chrome')).iconPath,
    'assets/images/browser-logos/google-chrome-2022.svg');
  assert.strictEqual(popup.describePage('edge://settings/', context('Microsoft Edge')).iconPath,
    'assets/images/browser-logos/microsoft-edge-2019.svg');
  assert.strictEqual(popup.describePage('about:preferences', context('Firefox')).iconPath,
    'assets/images/browser-logos/firefox.svg');
  assert.strictEqual(popup.describePage('chrome://settings/', context('Dia')).iconPath, 'assets/images/browser-logos/dia.jpg');
  assert.deepStrictEqual(popup.describePage('chrome://settings/', context('Brave')),
    { kind: 'browser', iconPath: '', iconName: 'ri-window-line', host: 'chrome://settings/' }, 'no logo, a window icon');
  assert.strictEqual(popup.describePage('chrome-extension://other/page.html', context('Chrome')).iconName, 'ri-puzzle-line');
  assert.strictEqual(popup.describePage('file:///Users/me/a.pdf', context('Chrome')).iconName, 'ri-file-line');
  assert.deepStrictEqual(popup.describePage('https://www.bilibili.com/video/1', context('Chrome')),
    { kind: 'web', iconPath: '', iconName: 'ri-global-line', host: 'www.bilibili.com' });
  const logoDir = path.join(repoRoot, 'assets/images/browser-logos');
  ['google-chrome-2022.svg', 'microsoft-edge-2019.svg', 'firefox.svg', 'zen.svg', 'dia.jpg', 'comet.jpg']
    .forEach((file) => assert(fs.existsSync(path.join(logoDir, file)), `${file} ships with the extension`));
}

// No tab at all (a DevTools window): every page action is off.
{
  const model = popup.buildModel(state({ tab: null }), t);
  assert(model.actions.every((action) => action.disabled));
  assert.strictEqual(model.page.title, 'Lumno');
}

// A busy action waits for its answer.
{
  const actions = byId(popup.buildModel(state({ busyAction: 'shortcut' }), t));
  assert.strictEqual(actions.shortcut.disabled, true);
  assert.strictEqual(actions.copy.disabled, false);
}

// WebDAV status: last sync time, busy, and states that need the person.
{
  const now = Date.UTC(2026, 9, 20, 12, 0, 0);
  const sync = (status) => popup.buildModel(state({ syncStatus: status, now }), t).sync;
  assert.strictEqual(sync({ enabled: false, state: 'ready', lastSyncAt: now }), null);
  assert.deepStrictEqual(sync({ enabled: true, state: 'ready', lastSyncAt: now - 2 * 60 * 1000 }), {
    label: 'WebDAV 已同步 · 2分钟前', tone: 'ok'
  });
  assert.strictEqual(sync({ enabled: true, state: 'syncing' }).tone, 'busy');
  assert.strictEqual(sync({ enabled: true, state: 'pending' }).tone, 'busy');
  // A rate-limited connection waits minutes to hours before its next try.
  ['http-429', 'http-503'].forEach((error) => {
    assert.deepStrictEqual(sync({ enabled: true, state: 'pending', error, retryAt: now + 600000 }), {
      label: 'WebDAV 等待重试', tone: 'waiting'
    });
  });
  assert.strictEqual(sync({ enabled: true, state: 'error' }).label, 'WebDAV 同步失败');
  assert.strictEqual(sync({ enabled: true, state: 'conflict' }).tone, 'error');
  assert.strictEqual(popup.formatSyncTime(now - 3 * 3600 * 1000, now, 'en'), '3 hours ago');
}

// Every string the popup asks for exists in every language.
{
  const source = ['src/popup/model.ts', 'src/popup/actions.ts'].map(read).join('\n');
  const keys = [...new Set([...source.matchAll(/\bt\('([a-z0-9_]+)'/g)].map((match) => match[1]))];
  assert(keys.length > 20, 'the popup reads its strings through t()');
  locales.forEach((locale) => {
    const messages = JSON.parse(read(`_locales/${locale}/messages.json`));
    keys.forEach((key) => {
      assert(messages[key] && String(messages[key].message || '').trim(), `${locale} needs ${key}`);
    });
  });
}

// The toolbar button opens the popup; its actions are extension-page only.
{
  const manifest = JSON.parse(read('manifest.json'));
  assert.strictEqual(manifest.action.default_popup, 'src/popup/popup.html');
  const html = read('src/popup/popup.html');
  const scripts = getPageScripts('src/popup/popup.html');
  ['src/domain/settings/appearance.ts', 'src/domain/settings/features.ts', 'src/popup/popup-theme-preload.ts', 'src/platform/url-guards.ts', 'src/domain/shortcut-display.ts',
    'src/shared/ui/tooltip.ts', 'src/shared/ui/cursor-tooltip.ts', 'src/shared/ui/toast.ts', 'src/shared/pip-main-world/site-enter.main-world.ts',
    'src/platform/browser-profile.ts']
    .forEach((script) => assert(scripts.includes(script), `the popup loads ${script}`));
  const popupDocument = new JSDOM(html).window.document;
  assert((popupDocument.querySelector('script[src*="build/popup-preload.js"]').compareDocumentPosition(popupDocument.getElementById('x-lumno-popup-root')) & 4) &&
      getBundleFiles('popup-preload').includes('src/popup/popup-theme-preload.ts'),
    'the theme is painted before the popup renders');
}

// The worker answers the popup's actions from the popup only, and the
// toolbar button opens the popup instead of a click handler.
async function testPopupActionsInTheWorker() {
  const worker = loadBackground({ tabs: [{ id: 1, windowId: 1, url: 'https://x.example/', active: true }] });
  await wait(50);
  assert.strictEqual(worker.chrome.action.onClicked.listeners.length, 0, 'a popup replaces the toolbar click handler');
  const popup = { url: worker.chrome.runtime.getURL('src/popup/popup.html') };
  const webPage = { tab: { id: 1 }, url: 'https://x.example/' };
  for (const action of ['popupOpenDocumentPipPicker', 'popupShowSearch', 'popupAddPageShortcut', 'popupShowPageToast',
    'popupGetRecentPin', 'popupToggleRecentPin']) {
    const answer = await worker.sendMessage({ action, tabId: 1 }, popup, 300);
    assert.ok(answer && answer.reason !== 'sender-not-allowed', `background handles ${action}`);
    const fromWeb = await worker.sendMessage({ action, tabId: 1 }, webPage, 300);
    assert.ok(fromWeb && fromWeb.ok === false && fromWeb.reason === 'sender-not-allowed',
      `${action} is not accepted from web pages: ${JSON.stringify(fromWeb)}`);
  }
}

testPopupActionsInTheWorker().then(() => {
  console.log('Popup tests passed: page actions, restricted pages, web clip states, sync status, strings and wiring.');
  process.exit(0);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
