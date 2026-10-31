// The browser sync card on the Account tab: its status line and last-sync
// tooltip, the note on how many New Tab shortcuts browser sync carries, what
// its "sync now", export and import buttons do, and moving settings that
// older versions kept only in chrome.storage.local into browser sync. The
// card itself is drawn from the model this hands to onRender.
import type * as Settings from '../domain/settings';
import type { StorageAreaLike } from '../domain/storage-port';
import { downloadJsonFile } from './options-download';
import type { createSyncTransfer, SettingsImportPlan } from './options-sync-transfer';
import type { FormatTemplate, GetMessage, ToastTask } from './options-types';
import type { BrowserSyncCardHandlers, BrowserSyncCardModel, BrowserSyncTone } from './react/account-tab';
import * as NewtabShortcutSettings from '../domain/settings/newtab-shortcuts';
import { SHORTCUT_STORAGE_KEYS } from '../domain/shortcuts/constants';
import { getShortcutSyncBudget, measureShortcutSyncUsage, summarizeShortcutSync } from '../domain/shortcuts/storage-plan';
import { callStorage } from '../platform/storage-call';

interface SyncSectionChromeApi {
  runtime: { lastError?: { message?: string } | null };
  storage: { sync?: StorageAreaLike };
}

interface SyncSectionOptions {
  chromeApi: SyncSectionChromeApi;
  settings: Pick<typeof Settings, 'BROWSER_SYNC_KEYS' | 'syncMeta' |
    'NEWTAB_SHORTCUTS_GROUP_KEYS' | 'webdavStatus'>;
  syncTransfer: ReturnType<typeof createSyncTransfer> | null;
  // The provider area.
  storageArea: StorageAreaLike | null;
  localStorageArea: StorageAreaLike | null;
  getActivePrimaryAreaName(): string;
  getMessage: GetMessage;
  formatTemplate: FormatTemplate;
  showToast(message: string, isError?: boolean): void;
  beginToast(message: string): ToastTask;
  // The browser the page runs in, as the card's title names it.
  browserName: string;
  // Draws the card; called whenever its state changes.
  onRender(model: BrowserSyncCardModel): void;
  // Refreshes the sync-now tooltip if it is showing.
  refreshSyncNowTooltip(): void;
  documentObj: Document;
}

// The status line: a message key, its fallback and template values.
interface SyncStatus {
  key: string;
  fallback: string;
  params?: Record<string, string | number>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function createSyncSection(options: SyncSectionOptions) {
  const {
    beginToast,
    browserName,
    formatTemplate,
    getActivePrimaryAreaName,
    getMessage,
    localStorageArea,
    onRender,
    refreshSyncNowTooltip,
    showToast,
    storageArea,
    syncTransfer
  } = options;
  const chrome = options.chromeApi;
  const SETTINGS = options.settings;
  const documentObj = options.documentObj;

  // Until the first refresh (null) the card shows sync as on, with no tone.
  let status: SyncStatus | null = null;
  let statusTone: BrowserSyncTone = '';
  let available = true;
  let syncing = false;
  let lastSyncText = '';
  let shortcutSummary = '';

  function getModel(): BrowserSyncCardModel {
    const templateValues = { name: 'Lumno', browser: browserName };
    const statusTemplate = status
      ? getMessage(status.key, status.fallback)
      : getMessage('sync_status_ready', '同步已开启');
    const tooltip = statusTone === 'danger'
      ? getMessage('sync_status_unavailable_hint', '同步不可用：请检查当前浏览器是否支持并已开启内置同步。')
      : getMessage('sync_status_hint', '同步信息说明');
    return {
      sectionTitle: getMessage('settings_sync_section_title', '浏览器内置同步'),
      title: formatTemplate(getMessage('settings_sync_title', '{browser} 内置同步'), templateValues),
      status: {
        text: status && status.params ? formatTemplate(statusTemplate, status.params) : statusTemplate,
        tone: statusTone,
        tooltip: formatTemplate(tooltip, templateValues)
      },
      summary: shortcutSummary,
      available,
      syncing,
      syncNowTooltip: lastSyncText
        ? formatTemplate(getMessage('sync_tooltip_last_manual', '最近导入/手动同步 {time}'), { time: lastSyncText })
        : getMessage('sync_tooltip_default', '手动同步'),
      exportLabel: getMessage('sync_action_export', '导出配置'),
      importLabel: getMessage('sync_action_import', '导入配置'),
      syncNowLabel: getMessage('sync_action_now', '手动同步')
    };
  }

  function render(): void {
    onRender(getModel());
  }

  function formatSyncTime(timestamp: number | string): string {
    if (!timestamp) {
      return '';
    }
    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return '';
    }
  }

  function updateSyncStatusText(statusKey: string, fallback: string, params?: Record<string, string | number>): void {
    status = { key: statusKey, fallback, params };
    if (statusKey === 'sync_status_ready' || statusKey === 'sync_status_done') {
      statusTone = 'success';
    } else if (statusKey === 'sync_status_failed' || statusKey === 'sync_status_failed_reason' || statusKey === 'sync_status_unavailable') {
      statusTone = 'danger';
    } else {
      statusTone = '';
    }
    render();
  }

  function updateSyncNowTooltip(timeText: string): void {
    lastSyncText = timeText;
    render();
    refreshSyncNowTooltip();
  }

  // Says how many New Tab shortcuts browser sync carries and where the
  // rest are kept, since what does not fit stays on this device or goes
  // through WebDAV.
  let shortcutSyncSummaryRevision = 0;
  function refreshShortcutSyncSummary(): void {
    if (!storageArea || getActivePrimaryAreaName() !== 'sync' || !localStorageArea) {
      if (shortcutSummary) {
        shortcutSummary = '';
        render();
      }
      return;
    }
    const revision = ++shortcutSyncSummaryRevision;
    storageArea.get(SHORTCUT_STORAGE_KEYS.slice(), (values) => {
      localStorageArea.get([NewtabShortcutSettings.newtabShortcutsLocalOverflow.key, SETTINGS.webdavStatus.key], (local) => {
        if (revision !== shortcutSyncSummaryRevision) return;
        const summary = summarizeShortcutSync(values || {}, local && local[NewtabShortcutSettings.newtabShortcutsLocalOverflow.key]);
        const webdavStatus = local ? local[SETTINGS.webdavStatus.key] : undefined;
        const webdav = isRecord(webdavStatus) && webdavStatus.enabled === true;
        let text = '';
        if (summary.total <= 0) {
          text = '';
        } else if (summary.syncFailed) {
          text = formatTemplate(webdav
            ? getMessage('options_shortcut_sync_failed_webdav', 'Shortcuts couldn’t be saved to browser sync; all {count} sync through WebDAV for now.')
            : getMessage('options_shortcut_sync_failed_local', 'Shortcuts couldn’t be saved to browser sync; all {count} stay on this device for now.'),
          { count: summary.total });
        } else if (!summary.synced) {
          text = formatTemplate(webdav
            ? getMessage('options_shortcut_sync_none_webdav', 'Shortcuts: browser sync is full, so all {count} sync through WebDAV.')
            : getMessage('options_shortcut_sync_none_local', 'Shortcuts: browser sync is full, so all {count} stay on this device. Turn on WebDAV to sync them.'),
          { count: summary.total });
        } else if (!summary.localOnly) {
          text = formatTemplate(getMessage('options_shortcut_sync_all', 'Shortcuts: all {count} sync with the browser.'),
            { count: summary.total });
        } else {
          text = formatTemplate(webdav
            ? getMessage('options_shortcut_sync_split_webdav', 'Shortcuts: {synced} sync with the browser; the other {local} sync through WebDAV.')
            : getMessage('options_shortcut_sync_split_local', 'Shortcuts: {synced} sync with the browser; {local} exceed its sync space and stay on this device. Turn on WebDAV to sync them too.'),
          { synced: summary.synced, local: summary.localOnly });
        }
        shortcutSummary = text;
        render();
      });
    });
  }

  function refreshSyncStatus(): void {
    refreshShortcutSyncSummary();
    available = Boolean(storageArea);
    if (!storageArea) {
      updateSyncStatusText('sync_status_unavailable', '同步不可用');
      return;
    }
    updateSyncStatusText('sync_status_ready', '同步已开启');
    // The last-sync time describes the browser's own sync service.
    (chrome.storage.sync || storageArea).get([SETTINGS.syncMeta.key], (result) => {
      const meta = result ? result[SETTINGS.syncMeta.key] : null;
      const lastSyncAt = isRecord(meta) && (typeof meta.lastSyncAt === 'number' || typeof meta.lastSyncAt === 'string')
        ? meta.lastSyncAt
        : '';
      updateSyncNowTooltip(lastSyncAt ? formatSyncTime(lastSyncAt) : '');
    });
  }

  function migrateStorageIfNeeded(keys: string[]): void {
    if (!storageArea || !localStorageArea || getActivePrimaryAreaName() === 'local') {
      return;
    }
    localStorageArea.get(keys, (localItems) => {
      const localResult = localItems || {};
      const hasLocal = keys.some((key) => typeof localResult[key] !== 'undefined');
      if (!hasLocal) {
        return;
      }
      storageArea.get(keys, (syncItems) => {
        const syncResult = syncItems || {};
        const missingSyncValues: Record<string, unknown> = {};
        keys.forEach((key) => {
          if (typeof localResult[key] !== 'undefined' && typeof syncResult[key] === 'undefined') {
            missingSyncValues[key] = localResult[key];
          }
        });
        // Grouped shortcuts move only as a whole save, never chunk by chunk.
        const [shortcutsHeadKey] = SETTINGS.NEWTAB_SHORTCUTS_GROUP_KEYS;
        SETTINGS.NEWTAB_SHORTCUTS_GROUP_KEYS.forEach((key) => {
          if (!Object.prototype.hasOwnProperty.call(missingSyncValues, shortcutsHeadKey)) {
            delete missingSyncValues[key];
          } else if (typeof localResult[key] !== 'undefined') {
            missingSyncValues[key] = localResult[key];
          }
        });
        const missingKeys = Object.keys(missingSyncValues);
        if (missingKeys.length === 0) {
          return;
        }
        storageArea.get(missingKeys, (latestSyncItems) => {
          const latestSyncResult = latestSyncItems || {};
          const groupedKeys = SETTINGS.NEWTAB_SHORTCUTS_GROUP_KEYS;
          // The grouped save still moves whole while sync lacks its head,
          // replacing any stray chunk there; once sync has a head, none of it moves.
          const groupStillMissing = typeof latestSyncResult[shortcutsHeadKey] === 'undefined';
          const stillMissingSyncValues: Record<string, unknown> = {};
          missingKeys.forEach((key) => {
            const missing = groupedKeys.includes(key)
              ? groupStillMissing
              : typeof latestSyncResult[key] === 'undefined';
            if (missing) {
              stillMissingSyncValues[key] = missingSyncValues[key];
            }
          });
          if (Object.keys(stillMissingSyncValues).length > 0) {
            storageArea.set(stillMissingSyncValues);
          }
        });
      });
    });
  }

  function getSyncFailureMessage(): string {
    const reason = chrome.runtime.lastError
      ? chrome.runtime.lastError.message
      : '';
    return formatTemplate(getMessage('sync_status_failed_reason', '同步失败：{reason}'), {
      reason: reason || getMessage('sync_status_failed', '同步失败')
    });
  }

  // Pushes the values browser sync already holds, stamped as a manual sync.
  function syncNow(): void {
    const transfer = syncTransfer;
    const browserSyncArea = chrome.storage.sync;
    if (!transfer) {
      return;
    }
    if (!browserSyncArea) {
      updateSyncStatusText('sync_status_unavailable', '同步不可用');
      return;
    }
    if (syncing) {
      return;
    }
    syncing = true;
    render();
    browserSyncArea.get(SETTINGS.BROWSER_SYNC_KEYS.slice(), (result) => {
      browserSyncArea.set(transfer.buildManualSyncPayload(result, Date.now()), () => {
        syncing = false;
        render();
        if (chrome.runtime.lastError) {
          showToast(getSyncFailureMessage(), true);
          return;
        }
        showToast(getMessage('sync_status_done', '同步完成'), false);
        updateSyncNowTooltip(formatSyncTime(Date.now()));
      });
    });
  }

  function exportSettings(): void {
    const transfer = syncTransfer;
    if (!transfer || !storageArea || !localStorageArea) {
      return;
    }
    storageArea.get(SETTINGS.BROWSER_SYNC_KEYS.slice(), (result) => {
      if (chrome.runtime.lastError) {
        showToast(getSyncFailureMessage(), true);
        return;
      }
      localStorageArea.get([NewtabShortcutSettings.newtabShortcutsLocalOverflow.key], (deviceResult) => {
        if (chrome.runtime.lastError) {
          showToast(getSyncFailureMessage(), true);
          return;
        }
        try {
          downloadJsonFile(documentObj, `lumno-settings-${Date.now()}.json`,
            transfer.buildExportFile({ ...result, ...(getActivePrimaryAreaName() === 'sync' ? deviceResult : {}) }, new Date().toISOString()));
          showToast(getMessage('sync_export_done', '已导出配置'), false);
        } catch (_error) {
          showToast(getSyncFailureMessage(), true);
        }
      });
    });
  }

  function readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('file-read-failed'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsText(file);
    });
  }

  function applySyncImport(area: StorageAreaLike, plan: SettingsImportPlan, toastTask: ToastTask): void {
    if ((plan.devicePayload || plan.deviceKeysToClear?.length) && !localStorageArea) {
      toastTask.fail(getSyncFailureMessage());
      return;
    }
    const primaryKeys = [...new Set([...Object.keys(plan.payload), ...plan.keysToClear])];
    const localKeys = [...new Set([...Object.keys(plan.devicePayload || {}), ...(plan.deviceKeysToClear || [])])];
    const invoke = (start: (done: (result?: unknown) => void) => unknown) => callStorage(chrome, start);
    const restore = async (target: StorageAreaLike, attempted: Record<string, unknown>, snapshot: Record<string, unknown>) => {
      const keys = Object.keys(attempted);
      if (!keys.length) return;
      const result = await invoke((done) => target.get(keys, done));
      if (!isRecord(result)) throw new Error('rollback-read-failed');
      const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
      const safe = keys.filter((key) => same(result[key], attempted[key]));
      const conflict = keys.some((key) => !same(result[key], attempted[key]) && !same(result[key], snapshot[key]));
      const missing = safe.filter((key) => !Object.hasOwn(snapshot, key));
      if (missing.length) {
        const remove = target.remove;
        if (!remove) throw new Error('remove-unavailable');
        await invoke((done) => remove.call(target, missing, done));
      }
      const previous = Object.fromEntries(safe.filter((key) => Object.hasOwn(snapshot, key)).map((key) => [key, snapshot[key]]));
      if (Object.keys(previous).length) await invoke((done) => target.set(previous, done));
      if (conflict) throw new Error('rollback-conflict');
    };
    void (async () => {
      if ((plan.keysToClear.length && !area.remove) || (plan.deviceKeysToClear?.length && !localStorageArea?.remove)) throw new Error('remove-unavailable');
      const primaryResult = await invoke((done) => area.get(primaryKeys, done));
      const primaryBefore = isRecord(primaryResult) ? primaryResult : {};
      const localResult = localKeys.length && localStorageArea ? await invoke((done) => localStorageArea.get(localKeys, done)) : {};
      const localBefore = isRecord(localResult) ? localResult : {};
      const primaryAttempted: Record<string, unknown> = {};
      const localAttempted: Record<string, unknown> = {};
      try {
        Object.assign(primaryAttempted, plan.payload);
        await invoke((done) => area.set(plan.payload, done));
        const devicePayload = plan.devicePayload;
        if (localStorageArea && devicePayload) {
          Object.assign(localAttempted, devicePayload);
          await invoke((done) => localStorageArea.set(devicePayload, done));
        }
        const deviceKeysToClear = plan.deviceKeysToClear;
        const localRemove = localStorageArea?.remove;
        if (localStorageArea && localRemove && deviceKeysToClear?.length) {
          deviceKeysToClear.forEach((key) => { localAttempted[key] = undefined; });
          await invoke((done) => localRemove.call(localStorageArea, deviceKeysToClear, done));
        }
        const primaryRemove = area.remove;
        if (primaryRemove && plan.keysToClear.length) {
          plan.keysToClear.forEach((key) => { primaryAttempted[key] = undefined; });
          await invoke((done) => primaryRemove.call(area, plan.keysToClear, done));
        }
      } catch (error) {
        const results = await Promise.allSettled([
          restore(area, primaryAttempted, primaryBefore),
          ...(localKeys.length && localStorageArea ? [restore(localStorageArea, localAttempted, localBefore)] : [])
        ]);
        if (results.some((result) => result.status === 'rejected')) throw new Error('rollback-failed', { cause: error });
        throw error;
      }
      toastTask.done(getMessage('sync_import_done', '导入完成'));
      refreshSyncStatus();
    })().catch((error: unknown) => {
      toastTask.fail(error instanceof Error && error.message === 'rollback-failed'
        ? getMessage('sync_import_rollback_failed', '导入失败，部分设置可能已更改，请重新检查。')
        : getMessage('sync_status_failed', '同步失败'));
    });
  }

  function importSettings(file: File): void {
    const transfer = syncTransfer;
    if (!transfer) {
      return;
    }
    const toastTask = beginToast(getMessage('sync_importing', '正在导入配置…'));
    const failInvalid = () => toastTask.fail(getMessage('sync_import_invalid', '配置文件无效'));
    readTextFile(file).then((text) => {
      const data = transfer.parseImportFile(text);
      const plan = data ? transfer.buildImportPlan(data, Date.now()) : null;
      if (!plan) {
        failInvalid();
      } else if (storageArea && data) {
        const target = storageArea;
        void callStorage(chrome, (done) => target.get(null, done)).then((existing) => {
          const projected = { ...(isRecord(existing) ? existing : {}), ...plan.payload };
          const budget = getActivePrimaryAreaName() === 'sync'
            ? getShortcutSyncBudget(measureShortcutSyncUsage(projected)) : undefined;
          const finalPlan = transfer.buildImportPlan(data, Date.now(), budget, getActivePrimaryAreaName() === 'local');
          if (finalPlan) applySyncImport(target, finalPlan, toastTask); else failInvalid();
        }).catch(() => toastTask.fail(getMessage('sync_status_failed', '同步失败')));
      } else {
        toastTask.cancel();
      }
    }, failInvalid);
  }

  const handlers: BrowserSyncCardHandlers = {
    onSyncNow: syncNow,
    onExport: exportSettings,
    onImport: importSettings
  };

  render();

  return Object.freeze({
    handlers,
    migrateStorageIfNeeded,
    refreshShortcutSyncSummary,
    refreshSyncStatus,
    render,
    updateSyncStatusText
  });
}

export { createSyncSection };
export type { SyncSectionChromeApi, SyncSectionOptions };
