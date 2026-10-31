import { describe, expect, it, vi } from 'vitest';
import * as Settings from '../domain/settings';
import type { StorageAreaLike, StorageItems, StorageKeys } from '../domain/storage-port';
import type { DeviceSnapshots } from '../platform/device-snapshot';
import { downloadJsonFile } from './options-download';
import { createSettingsFile } from './options-settings-file';
import { createSyncTransfer } from './options-sync-transfer';

vi.mock('./options-download', () => ({ downloadJsonFile: vi.fn() }));

const THEME = Settings.themeMode.key;
const transfer = createSyncTransfer({ deriveLegacyAutoGroupEnabled: () => true, settings: Settings });

function area(values: StorageItems): StorageAreaLike {
  return {
    get(keys: StorageKeys, callback) {
      const names = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(values);
      callback?.(Object.fromEntries(names.filter((key) => key in values).map((key) => [key, values[key]])));
    },
    set(items, callback) { Object.assign(values, items); callback?.(); },
    remove(keys, callback) { (Array.isArray(keys) ? keys : [keys]).forEach((key) => { delete values[key]; }); callback?.(); }
  };
}

function setUp(values: StorageItems, snapshots: Partial<DeviceSnapshots>) {
  const toast = { cancel: vi.fn(), done: vi.fn(), fail: vi.fn() };
  const showToast = vi.fn();
  const file = createSettingsFile({
    chromeApi: { runtime: { lastError: null } },
    settings: Settings,
    syncTransfer: transfer,
    storageArea: area(values),
    loadDeviceSnapshots: async () => ({ capture: vi.fn(), parse: vi.fn(), preferences: vi.fn(), apply: vi.fn(), ...snapshots }),
    getMessage: (_key, fallback) => fallback,
    formatTemplate: (template, params) => template.replace('{reason}', String(params.reason)),
    showToast,
    beginToast: () => toast,
    documentObj: document,
    onImported: vi.fn()
  });
  return { file, toast, showToast };
}

const textFile = (value: unknown) => new File([JSON.stringify(value)], 'settings.json', { type: 'application/json' });

describe('Options settings file', () => {
  it('exports browser sync settings beside the snapshot with the reader\'s choice of images', async () => {
    const snapshot = { state: {}, includes: { wallpapers: false, icons: true }, files: {} };
    const capture = vi.fn().mockResolvedValue(snapshot);
    const { file, showToast } = setUp({ [THEME]: 'dark' }, { capture });
    await file.exportFile({ wallpapers: false, icons: true });
    expect(capture).toHaveBeenCalledWith({ wallpapers: false, icons: true });
    expect(vi.mocked(downloadJsonFile).mock.lastCall?.[2]).toMatchObject({ version: 2, data: { [THEME]: 'dark' }, snapshot });
    expect(showToast).toHaveBeenCalledWith('已导出配置', false);
  });

  it('asks to leave the images out when one of them cannot be exported', async () => {
    const capture = vi.fn().mockRejectedValue(Object.assign(new Error('asset-too-large'), { code: 'asset-too-large' }));
    const { file, showToast } = setUp({}, { capture });
    await file.exportFile({ wallpapers: true, icons: true });
    expect(showToast).toHaveBeenCalledWith('有壁纸或快捷方式图标无法导出，取消勾选后再试。', true);
  });

  it('still imports a version 1 file into the provider area', async () => {
    const values: StorageItems = {};
    const { file, toast } = setUp(values, {});
    await file.importFile(textFile({ version: 1, data: { [THEME]: 'light' } }));
    expect(values[THEME]).toBe('light');
    expect(toast.done).toHaveBeenCalledWith('导入完成');
  });

  it('imports a version 2 file through the snapshot, not its data', async () => {
    const values: StorageItems = {};
    const parsed = { state: {}, includes: { wallpapers: true, icons: true }, images: new Map() };
    const parse = vi.fn().mockResolvedValue(parsed);
    const apply = vi.fn().mockResolvedValue(undefined);
    const { file, toast } = setUp(values, { parse, apply, preferences: () => ({ [THEME]: 'dark' }) });
    const snapshot = { state: { version: 3 } };
    await file.importFile(textFile({ version: 2, data: { [THEME]: 'light' }, snapshot }));
    expect(parse).toHaveBeenCalledWith(snapshot);
    expect(apply).toHaveBeenCalledWith(parsed, expect.objectContaining({ payload: expect.objectContaining({ [THEME]: 'dark' }) }));
    expect(values).toEqual({});
    expect(toast.done).toHaveBeenCalled();
  });

  it('calls a version 2 file with a broken snapshot invalid and writes nothing', async () => {
    const values: StorageItems = {};
    const apply = vi.fn();
    const { file, toast } = setUp(values, { parse: vi.fn().mockRejectedValue(new Error('invalid-asset')), apply });
    await file.importFile(textFile({ version: 2, data: { [THEME]: 'light' }, snapshot: {} }));
    expect(toast.fail).toHaveBeenCalledWith('配置文件无效');
    expect(apply).not.toHaveBeenCalled();
    expect(values).toEqual({});
  });
});
