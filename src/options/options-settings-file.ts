// The settings file behind the browser sync card's export and import
// buttons. Export writes browser sync's settings for older versions and
// this device's snapshot (the whole shortcut list, the settings WebDAV
// carries, and the wallpapers and shortcut icons when the reader includes
// them); import reads files of either version.
import type * as Settings from '../domain/settings';
import type { StorageAreaLike } from '../domain/storage-port';
import type { DeviceSnapshots, SnapshotIncludes } from '../platform/device-snapshot';
import { callStorage, isRecord } from '../platform/storage-call';
import { downloadJsonFile } from './options-download';
import type { createSyncTransfer, SettingsImportPlan } from './options-sync-transfer';
import type { FormatTemplate, GetMessage, ToastTask } from './options-types';

interface SettingsFileOptions {
  chromeApi: { runtime: { lastError?: { message?: string } | null } };
  settings: Pick<typeof Settings, 'BROWSER_SYNC_KEYS'>;
  syncTransfer: ReturnType<typeof createSyncTransfer>;
  // The provider area.
  storageArea: StorageAreaLike;
  // Loaded on first use: it brings the image checks and the wallpaper store.
  loadDeviceSnapshots(): Promise<DeviceSnapshots>;
  getMessage: GetMessage;
  formatTemplate: FormatTemplate;
  showToast(message: string, isError?: boolean): void;
  beginToast(message: string): ToastTask;
  documentObj: Document;
  // Runs once an import has written everything.
  onImported(): void;
}

// Codes a snapshot raises when an image of this device fails its checks.
const IMAGE_CODES = ['invalid-asset', 'asset-too-large', 'invalid-icon', 'invalid-wallpaper'];

function errorCode(error: unknown): string {
  if (isRecord(error) && typeof error.code === 'string') return error.code;
  return error instanceof Error ? error.message : '';
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('file-read-failed'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsText(file);
  });
}

function createSettingsFile(options: SettingsFileOptions) {
  const { chromeApi, getMessage, formatTemplate, storageArea, syncTransfer: transfer } = options;

  function failureMessage(error: unknown): string {
    return formatTemplate(getMessage('sync_status_failed_reason', '同步失败：{reason}'), {
      reason: errorCode(error) || getMessage('sync_status_failed', '同步失败')
    });
  }

  function exportFailureMessage(error: unknown): string {
    const code = errorCode(error);
    if (IMAGE_CODES.includes(code)) {
      return getMessage('sync_export_media_failed', '有壁纸或快捷方式图标无法导出，取消勾选后再试。');
    }
    if (code === 'incomplete-shortcuts') {
      return getMessage('sync_export_shortcuts_pending', '快捷方式还在从其他设备同步，请稍后再导出。');
    }
    return failureMessage(error);
  }

  async function exportFile(includes: SnapshotIncludes): Promise<void> {
    try {
      const values = await callStorage(chromeApi, (done) => storageArea.get(options.settings.BROWSER_SYNC_KEYS.slice(), done));
      const snapshot = await (await options.loadDeviceSnapshots()).capture(includes);
      downloadJsonFile(options.documentObj, `lumno-settings-${Date.now()}.json`,
        transfer.buildExportFile(isRecord(values) ? values : {}, new Date().toISOString(), snapshot));
      options.showToast(getMessage('sync_export_done', '已导出配置'), false);
    } catch (error) {
      options.showToast(exportFailureMessage(error), true);
    }
  }

  async function writePlan(plan: SettingsImportPlan): Promise<void> {
    await callStorage(chromeApi, (done) => storageArea.set(plan.payload, done));
    if (plan.keysToClear.length && storageArea.remove) {
      const remove = storageArea.remove.bind(storageArea);
      await callStorage(chromeApi, (done) => remove(plan.keysToClear, done));
    }
  }

  // A version 2 file: the snapshot and the browser sync settings it holds.
  // False when the snapshot fails its checks, which reads as an invalid file.
  async function importSnapshot(value: unknown): Promise<boolean> {
    const snapshots = await options.loadDeviceSnapshots();
    const parsed = await snapshots.parse(value).catch(() => null);
    const plan = parsed && transfer.buildImportPlan(snapshots.preferences(parsed), Date.now(), true);
    if (!parsed || !plan) return false;
    await snapshots.apply(parsed, plan);
    return true;
  }

  async function importFile(file: File): Promise<void> {
    const toastTask = options.beginToast(getMessage('sync_importing', '正在导入配置…'));
    const failInvalid = () => toastTask.fail(getMessage('sync_import_invalid', '配置文件无效'));
    const contents = transfer.parseImportFile(await readTextFile(file).catch(() => ''));
    const plan = contents && !contents.snapshot ? transfer.buildImportPlan(contents.data, Date.now()) : null;
    if (!contents || (!contents.snapshot && !plan)) {
      failInvalid();
      return;
    }
    try {
      if (contents.snapshot && !await importSnapshot(contents.snapshot)) {
        failInvalid();
        return;
      }
      if (plan) await writePlan(plan);
    } catch (error) {
      toastTask.fail(failureMessage(error));
      return;
    }
    toastTask.done(getMessage('sync_import_done', '导入完成'));
    options.onImported();
  }

  return Object.freeze({ exportFile, importFile });
}

export { createSettingsFile };
export type { SettingsFileOptions };
