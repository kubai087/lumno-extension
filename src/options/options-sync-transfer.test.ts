import { describe, expect, it, vi } from 'vitest';
import * as settings from '../domain/settings';
import type { StorageAreaLike, StorageKeys } from '../domain/storage-port';
import { downloadJsonFile } from './options-download';
import { createSyncSection } from './options-sync-section';
import { createSyncTransfer } from './options-sync-transfer';
import { createShortcutStoragePlan, readShortcutState } from '../domain/shortcuts/storage-plan';

vi.mock('./options-download', () => ({ downloadJsonFile: vi.fn() }));

const transfer = createSyncTransfer({
  settings,
  deriveLegacyAutoGroupEnabled: () => true
});

describe('configuration file transfer', () => {
  it('imports long shortcuts into the active local store without depending on overflow', async () => {
    const values: Record<string, unknown> = {};
    const items = Array.from({ length: 150 }, (_, index) => ({ id: `local-${index}`, title: 'x'.repeat(120), url: `https://example.com/${index}`, groupId: 'g0' }));
    const area: StorageAreaLike = {
      get(keys, callback) { const names = Array.isArray(keys) ? keys : Object.keys(values); callback?.(Object.fromEntries(names.filter((key) => key in values).map((key) => [key, values[key]]))); },
      set(itemsToSave, callback) { Object.assign(values, itemsToSave); callback?.(); },
      remove(keys, callback) { (Array.isArray(keys) ? keys : [keys]).forEach((key) => { delete values[key]; }); callback?.(); }
    };
    const done = vi.fn();
    const section = createSyncSection({ beginToast: () => ({ cancel() {}, done, fail() {} }), browserName: 'Chrome',
      chromeApi: { runtime: { lastError: null }, storage: { sync: area } }, documentObj: document,
      formatTemplate: (value) => value, getActivePrimaryAreaName: () => 'local', getMessage: (_key, fallback) => fallback,
      localStorageArea: area, onRender() {}, refreshSyncNowTooltip() {}, settings, showToast() {}, storageArea: area, syncTransfer: transfer });
    section.handlers.onImport(new File([JSON.stringify({ data: { lumnoShortcutState: { groups: [{ id: 'g0', title: '' }], items } } })], 'settings.json'));
    await vi.waitFor(() => expect(done).toHaveBeenCalled());
    expect(readShortcutState(values).items.map((item) => item.id)).toEqual(items.map((item) => item.id));
  });

  it('exports current local shortcuts instead of stale authoritative overflow', () => {
    const current = createShortcutStoragePlan({ groups: [{ id: 'g0', title: '' }], items: [{ id: 'current', title: 'Current', url: 'https://example.com/', groupId: 'g0' }] });
    const values: Record<string, unknown> = { ...current.payload, [settings.newtabShortcutsLocalOverflow.key]: { authoritative: true, items: [{ id: 'old', title: 'Old', url: 'https://old.example/' }] } };
    const area: StorageAreaLike = { get(keys, callback) { const names = Array.isArray(keys) ? keys : Object.keys(values); callback?.(Object.fromEntries(names.filter((key) => key in values).map((key) => [key, values[key]]))); }, set(_items, callback) { callback?.(); } };
    const section = createSyncSection({ beginToast: () => ({ cancel() {}, done() {}, fail() {} }), browserName: 'Chrome',
      chromeApi: { runtime: { lastError: null }, storage: { sync: area } }, documentObj: document,
      formatTemplate: (value) => value, getActivePrimaryAreaName: () => 'local', getMessage: (_key, fallback) => fallback,
      localStorageArea: area, onRender() {}, refreshSyncNowTooltip() {}, settings, showToast() {}, storageArea: area, syncTransfer: transfer });
    section.handlers.onExport();
    const exported = vi.mocked(downloadJsonFile).mock.lastCall?.[2];
    expect(exported).toMatchObject({ data: { lumnoShortcutState: { items: [{ id: 'current' }] } } });
  });
  it('exports the authoritative local shortcuts and restores them without old overflow', () => {
    const state = { groups: [{ id: 'default', title: '' }], items: [{ id: 'a', type: 'link', title: 'A', url: 'https://example.com/', groupId: 'default' }], migratedAt: 1 };
    const file = transfer.buildExportFile({ [settings.newtabShortcutsLocalOverflow.key]: { ...state, authoritative: true } }, 'now');
    const plan = transfer.buildImportPlan(file.data, 1);
    if (!plan) throw new Error('missing import plan');
    const restored = readShortcutState(plan.payload, plan.devicePayload?.[settings.newtabShortcutsLocalOverflow.key]);
    expect(restored.items.map((item) => item.id)).toEqual(['a']);
    const old = transfer.buildImportPlan({ [settings.newtabShortcutsLegacy.key]: [] }, 1);
    if (!old) throw new Error('missing import plan');
    expect(old.deviceKeysToClear).toContain(settings.newtabShortcutsLocalOverflow.key);
  });

  it('round trips a long list across sync and overflow using the target budget', () => {
    const items = Array.from({ length: 100 }, (_, index) => ({
      id: `item-${index}`, title: `Item ${index}`, url: `https://example.com/${index}`, groupId: 'g0'
    }));
    const input = { groups: [{ id: 'g0', title: '' }], items, authoritative: true };
    const file = transfer.buildExportFile({ [settings.newtabShortcutsLocalOverflow.key]: input }, 'now');
    const plan = transfer.buildImportPlan(file.data, 1, 1500);
    if (!plan) throw new Error('missing import plan');
    const overflow: unknown = plan.devicePayload?.[settings.newtabShortcutsLocalOverflow.key];
    if (!overflow || typeof overflow !== 'object' || !('items' in overflow) || !Array.isArray(overflow.items)) throw new Error('missing overflow');
    expect(overflow.items.length).toBeGreaterThan(0);
    expect(readShortcutState(plan.payload, overflow).items.map((item) => item.id)).toEqual(items.map((item) => item.id));
  });
  it('exports the layout without device-specific materials or WebDAV status', () => {
    const key = settings.bookmarkTopbarSurfaceMode.key;
    const file = transfer.buildExportFile({
      [key]: 'clear',
      [settings.bookmarkTopbarLayout.key]: 'floating',
      [settings.webdavStatus.key]: { password: 'private' }
    }, '2026-01-01T00:00:00.000Z');
    expect(file.data).not.toHaveProperty(key);
    expect(file.data[settings.bookmarkTopbarLayout.key]).toBe('floating');
    expect(file.data).not.toHaveProperty(settings.webdavStatus.key);
    const plan = transfer.buildImportPlan(file.data, 1);
    expect(plan?.payload).toMatchObject({ [settings.bookmarkTopbarLayout.key]: 'floating' });
  });

  it('exports and imports browser settings and bookmark layout through the account controls', async () => {
    const modeKey = settings.bookmarkViewMode.key;
    const materialKey = settings.bookmarkTopbarSurfaceMode.key;
    const layoutKey = settings.bookmarkTopbarLayout.key;
    const colorsKey = settings.bookmarkFolderColorRefs.key;
    const colors = { 'Work / Notes': '#123456' };
    const syncValues: Record<string, unknown> = { [modeKey]: 'top', [colorsKey]: colors, [layoutKey]: 'floating' };
    const localValues: Record<string, unknown> = { [materialKey]: 'clear' };
    const area = (values: Record<string, unknown>): StorageAreaLike => ({
      get(keys: StorageKeys, callback) {
        const names = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(values);
        callback?.(Object.fromEntries(names.filter((key) => key in values).map((key) => [key, values[key]])));
      },
      set(items, callback) { Object.assign(values, items); callback?.(); },
      remove(keys, callback) {
        (Array.isArray(keys) ? keys : [keys]).forEach((key) => { delete values[key]; });
        callback?.();
      }
    });
    const syncArea = area(syncValues);
    const localArea = area(localValues);
    const section = createSyncSection({
      beginToast: () => ({ cancel() {}, done() {}, fail() {} }),
      browserName: 'Chrome',
      chromeApi: { runtime: { lastError: null }, storage: { sync: syncArea } },
      documentObj: document,
      formatTemplate: (value) => value,
      getActivePrimaryAreaName: () => 'sync',
      getMessage: (_key, fallback) => fallback,
      localStorageArea: localArea,
      onRender() {},
      refreshSyncNowTooltip() {},
      settings,
      showToast() {},
      storageArea: syncArea,
      syncTransfer: transfer
    });

    section.handlers.onExport();
    const exported = vi.mocked(downloadJsonFile).mock.lastCall?.[2];
    expect(exported).toMatchObject({
      data: { [modeKey]: 'top', [colorsKey]: colors, [layoutKey]: 'floating' }
    });
    expect(exported).not.toHaveProperty(`data.${materialKey}`);

    delete syncValues[modeKey];
    delete syncValues[colorsKey];
    delete localValues[materialKey];
    delete syncValues[layoutKey];
    section.handlers.onImport(new File([JSON.stringify(exported)], 'settings.json', { type: 'application/json' }));
    await vi.waitFor(() => expect(syncValues).toMatchObject({ [layoutKey]: 'floating' }));
    expect(localValues).not.toHaveProperty(materialKey);
    expect(syncValues[modeKey]).toBe('top');
    expect(syncValues[colorsKey]).toEqual(colors);
  });

  it('restores the first storage area when the second area fails', async () => {
    const syncValues: Record<string, unknown> = { [settings.bookmarkViewMode.key]: 'list' };
    const localValues: Record<string, unknown> = { [settings.newtabShortcutsLocalOverflow.key]: { authoritative: true, items: [] } };
    const chromeApi: { runtime: { lastError: { message: string } | null }; storage: { sync?: StorageAreaLike } } = { runtime: { lastError: null }, storage: {} };
    let failOnce = true;
    const area = (values: Record<string, unknown>, failing = false): StorageAreaLike => ({
      get(keys, callback) {
        const names = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(values);
        callback?.(Object.fromEntries(names.filter((key) => key in values).map((key) => [key, values[key]])));
      },
      set(items, callback) {
        if (failing && failOnce) { failOnce = false; chromeApi.runtime.lastError = { message: 'failed' }; }
        else Object.assign(values, items);
        callback?.();
        chromeApi.runtime.lastError = null;
      },
      remove(keys, callback) { (Array.isArray(keys) ? keys : [keys]).forEach((key) => { delete values[key]; }); callback?.(); }
    });
    const syncArea = area(syncValues);
    chromeApi.storage.sync = syncArea;
    const fail = vi.fn();
    const section = createSyncSection({
      beginToast: () => ({ cancel() {}, done() {}, fail }), browserName: 'Chrome', chromeApi,
      documentObj: document, formatTemplate: (value) => value, getActivePrimaryAreaName: () => 'sync',
      getMessage: (_key, fallback) => fallback, localStorageArea: area(localValues, true), onRender() {},
      refreshSyncNowTooltip() {}, settings, showToast() {}, storageArea: syncArea, syncTransfer: transfer
    });
    const data = { [settings.bookmarkViewMode.key]: 'top', lumnoShortcutState: { groups: [{ id: 'g0', title: '' }], items: [] } };
    section.handlers.onImport(new File([JSON.stringify({ data })], 'settings.json'));
    await vi.waitFor(() => expect(fail).toHaveBeenCalled());
    expect(syncValues).toEqual({ [settings.bookmarkViewMode.key]: 'list' });
    expect(localValues).toEqual({ [settings.newtabShortcutsLocalOverflow.key]: { authoritative: true, items: [] } });
  });

  it('does not overwrite another writer when a later import step fails', async () => {
    const key = settings.bookmarkViewMode.key;
    const syncValues: Record<string, unknown> = { [key]: 'list' };
    const chromeApi: { runtime: { lastError: { message: string } | null }; storage: { sync?: StorageAreaLike } } = { runtime: { lastError: null }, storage: {} };
    const syncArea: StorageAreaLike = {
      get(keys, callback) { const names = Array.isArray(keys) ? keys : Object.keys(syncValues); callback?.(Object.fromEntries(names.filter((name) => name in syncValues).map((name) => [name, syncValues[name]]))); },
      set(items, callback) { Object.assign(syncValues, items); callback?.(); },
      remove(keys, callback) { (Array.isArray(keys) ? keys : [keys]).forEach((name) => { delete syncValues[name]; }); callback?.(); }
    };
    let first = true;
    const localArea: StorageAreaLike = {
      get(_keys, callback) { callback?.({}); },
      set(_items, callback) { if (first) { first = false; syncValues[key] = 'concurrent'; chromeApi.runtime.lastError = { message: 'failed' }; } callback?.(); chromeApi.runtime.lastError = null; },
      remove(_keys, callback) { callback?.(); }
    };
    chromeApi.storage.sync = syncArea;
    const fail = vi.fn();
    const section = createSyncSection({ beginToast: () => ({ cancel() {}, done() {}, fail }), browserName: 'Chrome', chromeApi,
      documentObj: document, formatTemplate: (value) => value, getActivePrimaryAreaName: () => 'sync', getMessage: (_key, fallback) => fallback,
      localStorageArea: localArea, onRender() {}, refreshSyncNowTooltip() {}, settings, showToast() {}, storageArea: syncArea, syncTransfer: transfer });
    const data = { [key]: 'top', lumnoShortcutState: { groups: [{ id: 'g0', title: '' }], items: [] } };
    section.handlers.onImport(new File([JSON.stringify({ data })], 'settings.json'));
    await vi.waitFor(() => expect(fail).toHaveBeenCalled());
    expect(syncValues[key]).toBe('concurrent');
  });

});
