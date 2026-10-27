import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import optionsHtml from '../options.html?raw';
import * as settingsModule from '../../domain/settings';
import { runPageBundle } from '../../../tests/react/page-bundles';
import siteSearchCatalog from '../../../assets/data/site-search.json';
import enMessages from '../../../_locales/en/messages.json';
import jaMessages from '../../../_locales/ja/messages.json';
import zhCnMessages from '../../../_locales/zh_CN/messages.json';
import zhTwMessages from '../../../_locales/zh_TW/messages.json';
import { expectElement, expectTag, getElement, getTag, getTags } from '../../../tests/react/dom';
import { queryHtmlElement, queryHtmlTag } from '../../shared/dom-lookup';

// Boots the real Options page (markup, its preload bundle, React islands and
// page bundle) against an in-memory chrome.storage, so the page's storage
// wiring can be checked by what it shows and writes.

type StorageValues = Record<string, unknown>;
type Messages = Record<string, { message: string }>;
const LOCALE_MESSAGES: Record<string, Messages> = {
  en: enMessages,
  ja: jaMessages,
  zh_CN: zhCnMessages,
  zh_TW: zhTwMessages
};
type ChangeListener = (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => void;



const addedListeners: Array<[EventTarget, string, EventListenerOrEventListenerObject, AddEventListenerOptions | boolean | undefined]> = [];

const SETTINGS = settingsModule;

function trackListeners(target: EventTarget): void {
  // A test that boots the page twice finds the spy in place, and spying again
  // would hand back that spy as the method to forward to.
  if (vi.isMockFunction(target.addEventListener)) {
    return;
  }
  const addEventListener = target.addEventListener.bind(target);
  vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
    if (listener) {
      addedListeners.push([target, type, listener, options]);
      addEventListener(type, listener, options);
    }
  });
}

function createArea(name: string, values: StorageValues, listeners: Set<ChangeListener>) {
  const writes: StorageValues[] = [];
  const pick = (keys: unknown) => {
    if (keys === null || keys === undefined) return { ...values };
    const list = typeof keys === 'string'
      ? [keys]
      : Array.isArray(keys)
        ? keys.filter((key): key is string => typeof key === 'string')
        : typeof keys === 'object' ? Object.keys(keys) : [];
    return Object.fromEntries(list.filter((key) => key in values).map((key) => [key, values[key]]));
  };
  const emit = (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>) => {
    if (Object.keys(changes).length) {
      listeners.forEach((listener) => listener(changes, name));
    }
  };
  return {
    values,
    writes,
    get(keys: unknown, callback?: (result: StorageValues) => void) {
      const result = pick(keys);
      if (callback) {
        queueMicrotask(() => callback(result));
        return undefined;
      }
      return Promise.resolve(result);
    },
    set(payload: StorageValues, callback?: () => void) {
      writes.push({ ...payload });
      const changes: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
      Object.entries(payload).forEach(([key, value]) => {
        changes[key] = { newValue: value, oldValue: values[key] };
        values[key] = value;
      });
      queueMicrotask(() => {
        if (callback) callback();
        emit(changes);
      });
      return callback ? undefined : Promise.resolve();
    },
    remove(keys: string | string[], callback?: () => void) {
      const changes: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => {
        if (key in values) {
          changes[key] = { oldValue: values[key] };
          delete values[key];
        }
      });
      queueMicrotask(() => {
        if (callback) callback();
        emit(changes);
      });
      return callback ? undefined : Promise.resolve();
    },
    // A change made by another page.
    externalSet(payload: StorageValues) {
      const changes: Record<string, { newValue?: unknown; oldValue?: unknown }> = {};
      Object.entries(payload).forEach(([key, value]) => {
        changes[key] = { newValue: value, oldValue: values[key] };
        values[key] = value;
      });
      emit(changes);
    }
  };
}

// The stored search source order's site list and group order.
function readStoredOrder(value: unknown): { site: unknown[]; groups: unknown } {
  if (typeof value !== 'object' || value === null || !('lists' in value) || !('groups' in value)) {
    throw new Error('Expected a stored search source order.');
  }
  const lists = value.lists;
  const site = typeof lists === 'object' && lists !== null && 'site' in lists ? lists.site : null;
  return { site: Array.isArray(site) ? site : [], groups: value.groups };
}

// chrome.runtime.lastError between failures; a test sets it for one callback.
function noLastError(): { message: string } | null {
  return null;
}

function createChromeStub(sync: StorageValues, local: StorageValues) {
  const listeners = new Set<ChangeListener>();
  const messages: Messages = enMessages;
  return {
    commands: { getAll: (callback: (commands: object[]) => void) => callback([]) },
    i18n: {
      getMessage: (key: string) => (messages[key] ? messages[key].message : ''),
      getUILanguage: () => 'en'
    },
    runtime: {
      getManifest: () => ({ version: '1.0.0' }),
      getURL: (path: string) => `chrome-extension://lumno/${path}`,
      id: 'lumno',
      lastError: noLastError(),
      onMessage: { addListener() {} },
      sendMessage: vi.fn((_message: unknown, callback?: (response: unknown) => void) => {
        if (callback) callback({ ok: true });
      })
    },
    storage: {
      local: createArea('local', local, listeners),
      onChanged: {
        addListener: (listener: ChangeListener) => listeners.add(listener),
        removeListener: (listener: ChangeListener) => listeners.delete(listener)
      },
      sync: createArea('sync', sync, listeners)
    }
  };
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let pass = 0; pass < 6; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

async function bootOptionsPage(
  sync: StorageValues = {},
  local: StorageValues = {},
  chromeStub?: ReturnType<typeof createChromeStub>
) {
  const parsed = new DOMParser().parseFromString(optionsHtml, 'text/html');
  Array.from(parsed.body.children)
    .filter((node) => node.tagName !== 'SCRIPT')
    .forEach((node) => document.body.appendChild(document.importNode(node, true)));
  const chrome = chromeStub || createChromeStub(sync, local);
  vi.stubGlobal('chrome', chrome);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {}
  }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const locale = /_locales\/([^/]+)\/messages\.json/.exec(String(url));
    const body = locale ? LOCALE_MESSAGES[locale[1]] || enMessages : siteSearchCatalog;
    return { ok: true, json: async () => body };
  }));
  vi.resetModules();
  await runPageBundle('options-preload');
  trackListeners(document);
  trackListeners(window);
  await act(async () => {
    await runPageBundle('options');
  });
  await settle();
  return chrome;
}

function toggle(id: string): HTMLInputElement {
  return expectTag(document.getElementById(id), 'input');
}

afterEach(() => {
  addedListeners.splice(0).forEach(([target, type, listener, options]) => {
    target.removeEventListener(type, listener, options);
  });
  vi.unstubAllGlobals();
});

describe('Options page storage wiring', () => {
  it('restores switches from storage, leaves missing values unwritten and becomes ready', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage({
      [settings.motionEffectsEnabled.key]: false,
      [settings.tabSwitcherEnabled.key]: true
    });
    expect(toggle('_x_extension_motion_effects_toggle_2026_unique_').checked).toBe(false);
    expect(toggle('_x_extension_tab_switcher_toggle_2026_unique_').checked).toBe(true);
    expect(toggle('_x_extension_update_notice_toggle_2026_unique_').checked).toBe(true);
    const synced = chrome.storage.sync.values;
    expect(synced[settings.updateNoticeEnabled.key]).toBeUndefined();
    expect(synced[settings.simpleModeEnabled.key]).toBeUndefined();
    expect(synced[settings.motionEffectsEnabled.key]).toBe(false);
    // An install without the auto-group choice saves the one derived from
    // its aggregate searches.
    await vi.waitFor(() => {
      expect(synced[settings.aggregateSearchAutoGroupEnabled.key]).toBe(true);
    });
    expect(document.getElementById('_x_extension_feedback_support_2026_unique_')?.textContent)
      .toContain(enMessages.settings_help_center_title.message);
    // The WebDAV controller is created in the page's own declaration order.
    expect(document.getElementById('lumno-webdav-list')?.childElementCount).toBeGreaterThan(0);
    // Ready once the startup values have been painted.
    await vi.waitFor(() => {
      expect(document.documentElement.getAttribute('data-lumno-options-ready')).toBe('true');
    });
  });

  it('persists switch changes and follows changes made elsewhere', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage();
    const simpleMode = toggle('_x_extension_simple_mode_toggle_2026_unique_');
    await act(async () => {
      // A click on the switch the user sees.
      simpleMode.click();
    });
    await settle();
    expect(chrome.storage.sync.values[settings.simpleModeEnabled.key]).toBe(true);

    await act(async () => {
      chrome.storage.sync.externalSet({ [settings.simpleModeEnabled.key]: false });
    });
    await settle();
    expect(simpleMode.checked).toBe(false);

    await act(async () => {
      chrome.storage.local.externalSet({ [settings.simpleModeEnabled.key]: true });
    });
    await settle();
    expect(simpleMode.checked).toBe(false);
  });

  it('applies theme, language and aggregate search changes from other pages', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage();
    await act(async () => {
      chrome.storage.sync.externalSet({ [settings.themeMode.key]: 'dark' });
    });
    await settle();
    expect(document.body.getAttribute('data-theme')).toBe('dark');

    await act(async () => {
      chrome.storage.sync.externalSet({ [settings.language.key]: 'ja' });
    });
    await settle();
    expect(document.documentElement.lang).toBe('ja');

    const list = expectElement(document.getElementById('_x_extension_aggregate_search_list_2026_unique_'));
    expect(list.textContent).not.toContain('Synced tech');
    await act(async () => {
      chrome.storage.sync.externalSet({
        [settings.aggregateSearches.key]: {
          version: 1,
          items: [{ id: 'agg-1', key: 'tech', name: 'Synced tech', sourceRefs: ['builtin:yt', 'builtin:gh'] }]
        }
      });
    });
    await settle();
    expect(list.textContent).toContain('Synced tech');
  });

  it('renders the stored search source order and stores moves', async () => {
    const settings = SETTINGS;
    const key = settings.searchSourceOrder.key;
    const chrome = await bootOptionsPage({
      [key]: { version: 1, groups: ['local', 'ai'], lists: { site: ['gh', 'yt'] }, local: ['history'] }
    });
    const chips = () => Array.from(document.querySelectorAll(
      '#_x_extension_search_source_group_order_2026_unique_ [data-group]'
    )).map((chip) => chip.getAttribute('data-group'));
    const siteKeys = () => Array.from(document.querySelectorAll(
      '#_x_extension_site_search_builtin_list_2024_unique_ > [data-key]'
    )).map((row) => row.getAttribute('data-key'));
    const types = () => Array.from(document.querySelectorAll(
      '#_x_extension_search_result_source_types_2026_unique_ label'
    )).map((label) => label.getAttribute('data-value'));

    await vi.waitFor(() => expect(siteKeys().slice(0, 3)).toEqual(['gh', 'yt', 'bb']));
    expect(chips()).toEqual(['local', 'ai', 'aggregate', 'engine', 'site']);
    expect(types()).toEqual(['history', 'topSite', 'bookmark']);

    const firstDown = queryHtmlTag(document, '#_x_extension_site_search_builtin_list_2024_unique_ > [data-key] [data-move="down"]', 'button');
    await act(async () => {
      firstDown?.click();
    });
    await settle();
    expect(siteKeys().slice(0, 3)).toEqual(['yt', 'gh', 'bb']);
    const stored = readStoredOrder(chrome.storage.sync.values[key]);
    expect(stored.site.slice(0, 3)).toEqual(['yt', 'gh', 'bb']);
    expect(stored.groups).toEqual(['local', 'ai', 'aggregate', 'engine', 'site']);

    // A second move, then consecutive undos and redos from the keyboard.
    const secondDown = getTags(document, '#_x_extension_site_search_builtin_list_2024_unique_ > [data-key] [data-move="down"]', 'button')[1];
    await act(async () => {
      secondDown?.click();
    });
    await settle();
    expect(siteKeys().slice(0, 3)).toEqual(['yt', 'bb', 'gh']);
    const press = async (init: KeyboardEventInit) => {
      await act(async () => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
      });
      await settle();
    };
    await press({ ctrlKey: true, key: 'z' });
    expect(siteKeys().slice(0, 3)).toEqual(['yt', 'gh', 'bb']);
    await press({ ctrlKey: true, key: 'z' });
    expect(siteKeys().slice(0, 3)).toEqual(['gh', 'yt', 'bb']);
    expect(readStoredOrder(chrome.storage.sync.values[key]).site.slice(0, 2))
      .toEqual(['gh', 'yt']);
    // Nothing older to undo.
    await press({ ctrlKey: true, key: 'z' });
    expect(siteKeys().slice(0, 3)).toEqual(['gh', 'yt', 'bb']);
    await press({ ctrlKey: true, key: 'z', shiftKey: true });
    await press({ ctrlKey: true, key: 'y' });
    expect(siteKeys().slice(0, 3)).toEqual(['yt', 'bb', 'gh']);
    // Text fields keep their own undo.
    const field = document.createElement('input');
    document.body.appendChild(field);
    await act(async () => {
      field.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ctrlKey: true, key: 'z' }));
    });
    await settle();
    expect(siteKeys().slice(0, 3)).toEqual(['yt', 'bb', 'gh']);
    field.remove();

    await act(async () => {
      chrome.storage.sync.externalSet({ [key]: { version: 1, groups: ['site'] } });
    });
    await settle();
    expect(chips()).toEqual(['site', 'aggregate', 'engine', 'ai', 'local']);
    expect(siteKeys().slice(0, 3)).toEqual(['yt', 'bb', 'gh']);
    // The order changed elsewhere, so this page's history no longer applies.
    await press({ ctrlKey: true, key: 'z' });
    expect(chips()).toEqual(['site', 'aggregate', 'engine', 'ai', 'local']);
    expect(types()).toEqual(['topSite', 'bookmark', 'history']);
  });

  it('removes site searches, follows ones added elsewhere and stores what changed', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage();
    const listKeys = (id: string) => Array.from(document.querySelectorAll(`#${id} > [data-key]`))
      .map((row) => row.getAttribute('data-key'));
    const builtinKeys = () => listKeys('_x_extension_site_search_builtin_list_2024_unique_');
    const customKeys = () => listKeys('_x_extension_site_search_custom_list_2024_unique_');
    const removeRow = async (listId: string, key: string) => {
      const row = document.querySelector(`#${listId} > [data-key="${key}"]`);
      const trigger = row ? queryHtmlTag(row, '._x_extension_popconfirm_wrap_2024_unique_ > button', 'button') : null;
      await act(async () => {
        trigger?.click();
      });
      const confirm = row
        ? getTags(row, '._x_extension_popconfirm_2024_unique_[data-open="true"] button', 'button').pop()
        : null;
      await act(async () => {
        confirm?.click();
      });
      await settle();
    };

    await vi.waitFor(() => expect(builtinKeys()).toContain('yt'));
    await removeRow('_x_extension_site_search_builtin_list_2024_unique_', 'yt');
    expect(chrome.storage.sync.values[settings.siteSearchDisabled.key]).toEqual(['yt']);
    expect(builtinKeys()).not.toContain('yt');

    // A provider added on another page shows once storage says so.
    await act(async () => {
      chrome.storage.sync.externalSet({
        [settings.siteSearchCustom.key]: [{ id: 'source-1', key: 'mdn', name: 'MDN', template: 'https://developer.mozilla.org/search?q={query}' }]
      });
    });
    await vi.waitFor(() => expect(customKeys()).toEqual(['mdn']));

    await removeRow('_x_extension_site_search_custom_list_2024_unique_', 'mdn');
    expect(chrome.storage.sync.values[settings.siteSearchCustom.key]).toEqual([]);
    await vi.waitFor(() => expect(customKeys()).toEqual([]));
    expect(chrome.storage.sync.values[settings.siteSearchDisabled.key]).toEqual(['yt']);
  });

  it('binds the New Tab switches of the Appearance tab to their storage keys', async () => {
    const chrome = await bootOptionsPage();
    const switches: Array<[name: string, key: string, normalize: (value: unknown) => boolean]> = [
      ['newtab_time_seconds', SETTINGS.newtabTimeSecondsVisible.key, SETTINGS.newtabTimeSecondsVisible.parse],
      ['newtab_time_12_hour', SETTINGS.newtabTime12Hour.key, SETTINGS.newtabTime12Hour.parse],
      ['newtab_input_auto_focus', SETTINGS.newtabInputAutoFocusEnabled.key, SETTINGS.newtabInputAutoFocusEnabled.parse],
      ['newtab_shortcuts', SETTINGS.newtabShortcutsVisible.key, SETTINGS.newtabShortcutsVisible.parse],
      ['newtab_shortcut_add', SETTINGS.newtabShortcutAddVisible.key, SETTINGS.newtabShortcutAddVisible.parse],
      ['newtab_shortcut_dock_magnification', SETTINGS.newtabShortcutDockMagnificationEnabled.key,
        SETTINGS.newtabShortcutDockMagnificationEnabled.parse],
      ['bookmark_folder_icons_visible', SETTINGS.bookmarkFolderIconsVisible.key, SETTINGS.bookmarkFolderIconsVisible.parse],
      ['newtab_feedback_button_visible', SETTINGS.newtabFeedbackButtonVisible.key, SETTINGS.newtabFeedbackButtonVisible.parse],
      ['newtab_appearance_button_visible', SETTINGS.newtabAppearanceButtonVisible.key,
        SETTINGS.newtabAppearanceButtonVisible.parse]
    ];
    const entries = switches.map(([name, key, normalize]) => ({ inputId: `_x_extension_${name}_toggle_2026_unique_`, key, normalize }));
    // Sub-options stay disabled while their parent switch is off.
    const parents = [SETTINGS.newtabShortcutsVisible.key];
    for (const entry of entries) {
      if (!parents.includes(entry.key)) {
        await act(async () => {
          chrome.storage.sync.externalSet(Object.fromEntries(parents.map((key) => [key, true])));
        });
        await settle();
      }
      const control = expectTag(document.getElementById(entry.inputId), 'input', entry.inputId);
      const next = !control.checked;
      await act(async () => {
        control.click();
      });
      await settle();
      const written = entry.normalize(next);
      // A value the page does not allow is repaired once its own write lands.
      expect(chrome.storage.sync.values[entry.key], `${entry.key} persists`).toBe(entry.normalize(written));
      await act(async () => {
        chrome.storage.sync.externalSet({ [entry.key]: !written });
      });
      await settle();
      expect(control.checked, `${entry.key} follows storage`).toBe(Boolean(entry.normalize(!written)));
    }
  });

  it('runs each switch\'s follow-up, such as locking the selection provider while it is off', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage({ [settings.selectionQuickActionsEnabled.key]: true });
    const provider = expectTag(document.getElementById('_x_extension_selection_quick_actions_provider_select_2026_unique_'), 'select');
    expect(provider.disabled).toBe(false);
    await act(async () => {
      chrome.storage.sync.externalSet({ [settings.selectionQuickActionsEnabled.key]: false });
    });
    await settle();
    expect(provider.disabled).toBe(true);
  });

  it('migrates the aggregate tab-group switch from older per-search values', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage({
      [settings.aggregateSearches.key]: {
        version: 1,
        items: [{ id: 'agg-1', key: 'tech', name: 'Tech', sourceRefs: ['builtin:yt', 'builtin:gh'], autoCreateTabGroup: false }]
      }
    });
    expect(toggle('_x_extension_aggregate_search_auto_group_toggle_2026_unique_').checked).toBe(false);
    expect(chrome.storage.sync.values[settings.aggregateSearchAutoGroupEnabled.key]).toBe(false);
  });

  it('tells a failed aggregate search read apart from an empty list', async () => {
    const settings = SETTINGS;
    const toastText = () => document.getElementById('_x_extension_toast_2024_unique_')?.textContent || '';
    await bootOptionsPage();
    expect(toastText()).not.toContain('Action failed');
    addedListeners.splice(0).forEach(([target, type, listener, options]) => {
      target.removeEventListener(type, listener, options);
    });
    vi.unstubAllGlobals();
    document.body.replaceChildren();

    const failing = createChromeStub({}, {});
    const get = failing.storage.sync.get.bind(failing.storage.sync);
    failing.storage.sync.get = (keys: unknown, callback?: (result: StorageValues) => void) => {
      const list = Array.isArray(keys) ? keys : [keys];
      // Settings are read together, so the read that holds the aggregate searches fails.
      if (callback && list.includes(settings.aggregateSearches.key)) {
        queueMicrotask(() => {
          failing.runtime.lastError = { message: 'read failed' };
          callback({});
          failing.runtime.lastError = null;
        });
        return undefined;
      }
      return get(keys, callback);
    };
    await bootOptionsPage({}, {}, failing);
    await vi.waitFor(() => {
      expect(toastText()).toContain('Action failed');
    });
  });

  it('shows, persists and follows the overlay opening animation', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage({ [settings.overlayEnterAnimation.key]: 'bounce' });
    const key = settings.overlayEnterAnimation.key;
    const button = (value: string) => getTag(document, `#_x_extension_overlay_enter_animation_tabs_wrap_2026_unique_ button[data-overlay-enter-animation="${value}"]`, 'button');
    // An unknown animation shows as the default and is left as stored.
    expect(chrome.storage.sync.values[key]).toBe('bounce');
    expect(button('elastic').getAttribute('aria-checked')).toBe('true');
    await act(async () => {
      button('fade').click();
    });
    await settle();
    expect(chrome.storage.sync.values[key]).toBe('fade');
    await act(async () => {
      chrome.storage.sync.externalSet({ [key]: 'elastic' });
    });
    await settle();
    expect(button('elastic').getAttribute('aria-checked')).toBe('true');
  });

  it('refreshes the sync status when any synced preference changes', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage();
    const reads = vi.spyOn(chrome.storage.sync, 'get');
    await act(async () => {
      chrome.storage.sync.externalSet({ [settings.bookmarkCount.key]: 2 });
    });
    await settle();
    expect(reads.mock.calls.some(([keys]) => Array.isArray(keys) && keys.includes(settings.syncMeta.key))).toBe(true);
  });

  it.each(['zh_CN', 'zh_TW', 'en', 'ja'])(
    'saves and restores the %s tab-position choice through its content-sized select',
    async (locale) => {
      const settings = SETTINGS;
      const messages = LOCALE_MESSAGES[locale];
      const chrome = await bootOptionsPage({ [settings.language.key]: locale.replace('_', '-') });
      const select = expectTag(document.getElementById('_x_extension_search_result_tab_position_select_2026_unique_'), 'select');
      const host = expectElement(select.closest('._x_extension_custom_select_2024_unique_'));
      const label = () => host.querySelector('._x_extension_select_label_2024_unique_')?.textContent;
      await vi.waitFor(() => {
        expect(label()).toBe(messages.search_result_tab_position_end.message);
      });
      expect(host.dataset.select).toBe('_x_extension_search_result_tab_position_select_2026_unique_');
      await act(async () => {
        queryHtmlTag(host, 'button', 'button')?.click();
      });
      const menu = getElement(host, '[role="listbox"]');
      // The auto-width wrapper must not pin longer localized options to the trigger width.
      expect(menu.dataset.menuSurfaceWidth).toBe('content');
      expect(menu.style.getPropertyValue('--x-extension-menu-surface-min-width')).toBe('100%');
      // React owns the labels: no data-i18n hooks for the page's i18n pass to overwrite.
      expect(menu.querySelector('[data-i18n]')).toBeNull();
      expect(Array.from(menu.querySelectorAll('._x_extension_select_option_label_2026_unique_'), (option) => option.textContent))
        .toEqual([
          messages.search_result_tab_position_end.message,
          messages.search_result_tab_position_after_current.message,
          messages.search_result_tab_position_before_current.message
        ]);
      await act(async () => {
        queryHtmlElement(host, '[data-value="beforeCurrent"]')?.click();
      });
      await settle();
      await vi.waitFor(() => {
        expect(chrome.storage.sync.values[settings.searchResultTabPosition.key]).toBe('beforeCurrent');
        expect(label()).toBe(messages.search_result_tab_position_before_current.message);
      });

      await act(async () => {
        chrome.storage.sync.externalSet({ [settings.searchResultTabPosition.key]: 'afterCurrent' });
      });
      await vi.waitFor(() => {
        expect(label()).toBe(messages.search_result_tab_position_after_current.message);
      });
    }
  );

  it('imports a settings file into storage and stamps it as an import', async () => {
    const settings = SETTINGS;
    const chrome = await bootOptionsPage();
    const input = expectTag(document.getElementById('_x_extension_sync_import_input_2024_unique_'), 'input');
    const file = new File([JSON.stringify({
      version: 1,
      data: {
        [settings.themeMode.key]: 'light',
        [settings.newtabShortcutsLegacy.key]: [{ url: 'https://example.com' }]
      }
    })], 'settings.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await vi.waitFor(() => {
      expect(chrome.storage.sync.values[settings.syncMeta.key]).toMatchObject({ source: 'import' });
    });
    const synced = chrome.storage.sync.values;
    expect(synced[settings.themeMode.key]).toBe('light');
    expect(synced[settings.newtabShortcutsLegacyChunk2.key]).toEqual([]);
    expect(input.value).toBe('');
  });
});
