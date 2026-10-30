import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readLocaleMessages } from '../domain/locale-messages';
import { localPrimary } from '../domain/settings';
import { themeMode } from '../domain/settings/appearance';
import { language } from '../domain/settings/locale';
import { DEFAULT_MAX_SHORTCUTS, SHORTCUTS_SYNC_KEYS } from '../domain/shortcuts/constants';
import { createProviderStorageRuntime } from '../platform/provider-storage';
import { createSettingsStore } from '../platform/settings-store';
import { loadShortcutState, saveShortcutState } from '../platform/shortcut-storage';
import { MENU_ITEM_ID, createController } from './page-shortcut-menu';
import { WORKER_SETTINGS } from './worker-settings';
import type { WorkerFakeOptions } from '../../tests/fakes/worker';
import { bootWorker, browserTab, injectedCommand, injectedModules, installWorkerFake, settleWorker } from '../../tests/fakes/worker';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function readMessages(locale: string) {
  return readLocaleMessages(JSON.parse(readFileSync(resolve(REPO_ROOT, `_locales/${locale}/messages.json`), 'utf8')));
}

// The menu over a fresh worker fake, built the way the worker builds it.
function createMenu(options: WorkerFakeOptions & { scriptingFails?: boolean } = {}) {
  const fake = installWorkerFake({ uiLanguage: 'en-US', ...options });
  fake.chrome.scripting.executeScript.mockImplementation(() => (options.scriptingFails
    ? Promise.reject(new Error('Cannot access contents of the page'))
    : Promise.resolve([{ result: true }])));
  const controller = createController({
    chrome,
    provider: createProviderStorageRuntime(chrome),
    settingsStore: createSettingsStore({ chromeApi: chrome, settings: WORKER_SETTINGS }),
    loadLocaleMessages: async (locale) => readMessages(locale)
  });
  const menuItem = () => fake.chrome.contextMenus.items.get(MENU_ITEM_ID);
  const click = (pageUrl: string, tab: chrome.tabs.Tab) =>
    controller.handleClick({ menuItemId: MENU_ITEM_ID, pageUrl, editable: false }, tab);
  // The message and options of each toast the worker showed.
  const toasts = () => fake.chrome.scripting.executeScript.mock.calls.map(([injection]) => injectedCommand(injection));
  return { fake, controller, menuItem, click, toasts };
}

function readManifestPermissions(): unknown {
  const manifest: unknown = JSON.parse(readFileSync(resolve(REPO_ROOT, 'manifest.json'), 'utf8'));
  return manifest && typeof manifest === 'object' ? Reflect.get(manifest, 'permissions') : undefined;
}

describe('the page menu item that adds a page to the shortcuts', () => {
  it('has its permission and its copy in every language it ships', () => {
    expect(readManifestPermissions()).toContain('contextMenus');
    ['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
      const messages = readMessages(locale);
      expect(messages.context_menu_add_page_shortcut.message).toBeTruthy();
      expect(messages.page_shortcut_added.message).toBeTruthy();
    });
  });

  it('is put in the page menu once as the worker starts', async () => {
    const fake = await bootWorker();
    await settleWorker(50);

    expect(fake.chrome.contextMenus.create.mock.calls.map(([properties]) => properties.id)).toEqual([MENU_ITEM_ID]);
    expect(fake.chrome.contextMenus.onClicked.listeners).toHaveLength(1);
  });

  it("follows the language picked in Lumno, not only the browser's", async () => {
    const menu = createMenu({ sync: { [language.key]: 'zh_CN' } });
    menu.controller.start();
    await settleWorker();

    expect(menu.fake.chrome.contextMenus.onClicked.listeners).toHaveLength(1);
    expect(menu.menuItem()).toEqual({
      id: MENU_ITEM_ID,
      title: '添加到 Lumno 新标签页的快捷方式',
      contexts: ['page'],
      documentUrlPatterns: ['http://*/*', 'https://*/*']
    });
    await menu.fake.chrome.storage.sync.set({ [language.key]: 'en' });
    await settleWorker();
    expect(menu.menuItem()).toMatchObject({ title: 'Add to Lumno New Tab shortcuts' });
  });

  it('saves the page at the end of the last group under its site name and says so in the page', async () => {
    const menu = createMenu({ sync: { [language.key]: 'zh_CN', [themeMode.key]: 'dark' } });
    const area = menu.fake.chrome.storage.sync;
    await saveShortcutState(area, {
      groups: [{ id: 'g0', title: '' }, { id: 'gwork', title: 'Work' }],
      items: [
        { id: 'a', groupId: 'g0', title: 'Lumno', url: 'https://lumno.kubai.design/' },
        { id: 'b', groupId: 'gwork', title: 'Docs', url: 'https://docs.example.com/' }
      ]
    });
    const pageUrl = 'https://github.com/kubai087/lumno-extension';

    expect(await menu.click(pageUrl, browserTab({ id: 7, url: pageUrl, title: 'kubai087/lumno-extension: Lumno' })))
      .toMatchObject({ status: 'added' });
    let state = await loadShortcutState(area);
    expect(state.items[state.items.length - 1]).toMatchObject({ url: pageUrl, title: 'GitHub', groupId: 'gwork' });
    expect(state.groups.map((group) => group.id)).toEqual(['g0', 'gwork']);
    const injections = menu.fake.chrome.scripting.executeScript.mock.calls.map(([injection]) => injection);
    expect(injections).toHaveLength(1);
    expect(injectedModules(injections[0])).toEqual(['build/injected/page-shortcut-toast.js']);
    expect(injections[0].target.tabId).toBe(7);
    expect(menu.toasts()[0]).toMatchObject({ message: '已添加到 Lumno 新标签页的快捷方式', error: false, themeMode: 'dark' });

    expect(await menu.click(pageUrl, browserTab({ id: 7, title: 'x' }))).toMatchObject({ status: 'exists' });
    state = await loadShortcutState(area);
    expect(state.items).toHaveLength(3);
    expect(menu.toasts()[1]).toMatchObject({ message: '已在快捷方式中' });
  });

  it('lands two quick clicks on different pages, and ignores other menu items', async () => {
    const menu = createMenu();
    await Promise.all([
      menu.click('https://example.com/one', browserTab({ id: 7, title: 'One' })),
      menu.click('https://example.org/two', browserTab({ id: 8, title: 'Two' }))
    ]);
    const state = await loadShortcutState(menu.fake.chrome.storage.sync);

    expect(state.items.slice(-2).map((item) => ('url' in item ? item.url : ''))).toEqual(['https://example.com/one', 'https://example.org/two']);
    expect(await menu.controller.handleClick({ menuItemId: 'other', editable: false, pageUrl: '' }, browserTab({ id: 7 }))).toBeNull();
  });

  it('keeps the shortcut on this device in local mode, also on a page that takes no scripts', async () => {
    const menu = createMenu({ local: { [localPrimary.key]: true }, uiLanguage: 'ja', scriptingFails: true });
    menu.controller.start();
    await settleWorker();

    expect(menu.menuItem()).toMatchObject({ title: 'Lumno の新しいタブのショートカットに追加' });
    expect(await menu.click('https://example.com/', browserTab({ id: 3, title: 'Example Domain' }))).toMatchObject({ status: 'added' });
    const state = await loadShortcutState(menu.fake.chrome.storage.local);
    expect(state.items.map((item) => ('url' in item ? item.url : ''))).toContain('https://example.com/');
    expect(menu.fake.storage.sync.values[SHORTCUTS_SYNC_KEYS[0]]).toBeUndefined();
  });

  it('refuses a page when the list is full', async () => {
    const menu = createMenu({ uiLanguage: 'en' });
    await saveShortcutState(menu.fake.chrome.storage.sync, {
      items: Array.from({ length: DEFAULT_MAX_SHORTCUTS }, (_, index) => ({ id: `s${index}`, title: `S${index}`, url: `https://site${index}.example/` }))
    }, { allowOverflow: true, maxItemBytes: Number.MAX_SAFE_INTEGER, maxTotalBytes: Number.MAX_SAFE_INTEGER });

    expect(await menu.click('https://new.example/', browserTab({ id: 1, title: 'New' }))).toMatchObject({ status: 'limit' });
    expect(menu.toasts()[0]).toMatchObject({ message: `You can add up to ${DEFAULT_MAX_SHORTCUTS} shortcuts.`, error: true });
  });

  it("adds the popup's tab page and shows Lumno's toast in it", async () => {
    const menu = createMenu({ uiLanguage: 'en' });
    const tab = browserTab({ id: 4, url: 'https://example.net/page', title: 'Example' });

    expect(await menu.controller.addTabPage(tab)).toEqual({
      status: 'added', message: 'Added to Lumno New Tab shortcuts', error: false, toastShown: true
    });
    expect(menu.toasts()[0]).toMatchObject({ message: 'Added to Lumno New Tab shortcuts' });
    expect(await menu.controller.addTabPage(tab)).toMatchObject({ status: 'exists', message: 'Already in shortcuts' });
    expect(menu.toasts()[1]).toMatchObject({ message: 'Already in shortcuts' });
    expect((await menu.controller.addTabPage(browserTab({ id: 5, url: 'chrome://extensions/', title: 'Extensions' }))).status).toBe('invalid');
    expect((await menu.controller.addTabPage(null)).status).toBe('invalid');
    expect(await menu.controller.showToast(4, { message: 'Current page URL copied' })).toBe(true);
    expect(menu.toasts()[2]).toMatchObject({ message: 'Current page URL copied' });
  });

  it('leaves the toast to the popup on a page that takes no scripts', async () => {
    const menu = createMenu({ uiLanguage: 'en', scriptingFails: true });

    expect((await menu.controller.addTabPage(browserTab({ id: 6, url: 'https://example.org/', title: 'Org' }))).toastShown).toBe(false);
  });
});
