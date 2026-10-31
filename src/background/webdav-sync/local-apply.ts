// Applying a merged state to this device, and mirroring it into Chrome sync.
import type { StorageItems } from '../../domain/storage-port';
import type { WallpaperRecordInput } from '../../shared/wallpaper-records';
import { capture } from './capture';
import { getAsset } from './media';
import { isRecord, isRecorded, readSession } from './records';
import { fail, report, setStatus, storage } from './runtime';
import type { Captured, ChromePreparation, MirrorResult, Session } from './types';
import type { Connection } from './connection';
import type { WebDavClient } from '../webdav-client/types';
import type { WebDavState } from '../../domain/webdav/types';
import { planChromeBackup } from '../../domain/webdav/chrome-backup';
import { insertLocalFolders, pickLocalPreferences } from '../../domain/webdav/device-state';
import { toDataUrl } from '../../domain/webdav/images';
import { ICONS_KEY, LOCAL_PREFERENCE_KEYS, MAX_SHORTCUTS, OVERFLOW_KEY, byteLength, canonical, equal } from '../../domain/webdav/state-base';
import { validateState } from '../../domain/webdav/validation';
import { error } from '../webdav-client/errors';
import { LEGACY_SHORTCUTS_CHUNK_KEYS } from '../../domain/shortcuts/constants';
import { createShortcutStoragePlan, getShortcutSyncBudget, measureShortcutSyncUsage } from '../../domain/shortcuts/storage-plan';
import * as LumnoSettings from '../../domain/settings';

// This device's local-only folder shortcuts go back where they were; the
// rest of the list beyond the browser sync budget goes to the overflow record.
function preferencePayload(conn: Connection, state: WebDavState, captured: Captured, maxTotalBytes: number): StorageItems {
  const list = insertLocalFolders(state.shortcuts, captured.folders, captured.shortcutOrder || []);
  if (list.length > MAX_SHORTCUTS) fail(conn, 'shortcut-capacity');
  if (new Set(list.map((item) => item.id)).size !== list.length) fail(conn, 'shortcut-id-conflict');
  const plan = createShortcutStoragePlan({ groups: state.groups, items: list,
    migratedAt: captured.shortcutMigratedAt }, { maxTotalBytes });
  return { ...state.data, ...plan.payload, [OVERFLOW_KEY]: plan.overflowRecord };
}

async function prepareChrome(conn: Connection, state: WebDavState, captured: Captured): Promise<ChromePreparation> {
  const existing = await storage(conn, conn.ports.syncArea || conn.ports.localArea, 'get', null);
  const maxTotalBytes = conn.ports.syncArea ? getShortcutSyncBudget({
    ...measureShortcutSyncUsage(existing), quotaBytes: conn.ports.syncArea.QUOTA_BYTES
  }) : Number.MAX_SAFE_INTEGER;
  const payload = preferencePayload(conn, state, captured, maxTotalBytes);
  const synced: StorageItems = Object.fromEntries(LumnoSettings.BROWSER_SYNC_KEYS.filter((key) =>
    Object.prototype.hasOwnProperty.call(payload, key)).map((key) => [key, payload[key]]));
  // The legacy shortcut keys stay for devices that still read them.
  const remove = LumnoSettings.BROWSER_SYNC_KEYS.filter((key) => !LEGACY_SHORTCUTS_CHUNK_KEYS.includes(key) &&
    Object.prototype.hasOwnProperty.call(existing, key) && !Object.prototype.hasOwnProperty.call(synced, key));
  const projected: StorageItems = { ...existing, ...synced };
  remove.forEach((key) => delete projected[key]);
  const entries = Object.entries(projected);
  const size = (key: string, value: unknown): number => byteLength(key) + byteLength(JSON.stringify(value));
  const area = conn.ports.syncArea;
  if (area && (entries.length > (area.MAX_ITEMS || 512) ||
      entries.some(([key, value]) => size(key, value) > (area.QUOTA_BYTES_PER_ITEM || 8192)) ||
      entries.reduce((sum, [key, value]) => sum + size(key, value), 0) > (area.QUOTA_BYTES || 102400))) fail(conn, 'chrome-capacity');
  return { payload, synced, remove };
}

// Only values that really change fire an event; an expectation for an
// unchanged one would swallow a later identical edit by the person.
async function expectOwnWrites(conn: Connection, area: chrome.storage.StorageArea, areaName: 'sync' | 'local', values: StorageItems): Promise<void> {
  conn.ownWrites.hold();
  const current = await storage(conn, area, 'get', Object.keys(values));
  Object.entries(values).forEach(([key, value]) => {
    if (canonical(value) !== canonical(current[key])) conn.ownWrites.expect(areaName, key, value);
  });
}

async function apply(
  conn: Connection,
  state: WebDavState,
  captured: Captured,
  client: WebDavClient | null,
  activate: boolean,
  nextSession: Session
): Promise<void> {
  const { payload, synced, remove } = await prepareChrome(conn, state, captured);
  const icons: Record<string, unknown> = {};
  const folderIds = new Set(captured.folders.map((item) => item.id));
  const localIcons = captured.local[ICONS_KEY];
  Object.entries(isRecord(localIcons) ? localIcons : {}).forEach(([id, data]) => { if (folderIds.has(id)) icons[id] = data; });
  for (const [id, digest] of Object.entries(state.icons)) icons[id] = toDataUrl(await getAsset(conn, digest, state.assets[digest], client), 'image/png');
  const wallpapers: WallpaperRecordInput[] = [];
  for (const wallpaper of state.wallpapers) {
    const image = await getAsset(conn, wallpaper.image, state.assets[wallpaper.image], client);
    const thumbnail = await getAsset(conn, wallpaper.thumbnail, state.assets[wallpaper.thumbnail], client);
    wallpapers.push({ id: wallpaper.id, key: wallpaper.id, name: wallpaper.name, width: wallpaper.width,
      height: wallpaper.height, updatedAt: wallpaper.updatedAt, imageDataUrl: toDataUrl(image, 'image/webp'),
      thumbnailDataUrl: toDataUrl(thumbnail, 'image/webp') });
  }
  return conn.ports.withLocalWrite(async () => {
    if (captured.generation !== conn.edits.generation) fail(conn, 'local-changed');
    const removed = LOCAL_PREFERENCE_KEYS.filter((key) =>
      Object.prototype.hasOwnProperty.call(captured.local, key) && !Object.prototype.hasOwnProperty.call(state.data, key));
    const localValues: StorageItems = {
      ...pickLocalPreferences(payload),
      [OVERFLOW_KEY]: payload[OVERFLOW_KEY], [ICONS_KEY]: icons,
      [LumnoSettings.assetRevision.key]: conn.ports.crypto.randomUUID(),
      ...(conn.ports.runtime.isActiveAreaName('local') && conn.ports.syncArea ? { [LumnoSettings.localPrimary.key]: false } : {}) };
    let wrote = false;
    try {
      await expectOwnWrites(conn, conn.ports.syncArea || conn.ports.localArea, conn.ports.syncArea ? 'sync' : 'local',
        { ...Object.fromEntries(remove.map((key) => [key, undefined])), ...synced });
      await expectOwnWrites(conn, conn.ports.localArea, 'local', { ...Object.fromEntries(removed.map((key) => [key, undefined])), ...localValues });
      if (captured.generation !== conn.edits.generation) fail(conn, 'local-changed');
      // Stage the complete operation before changing either local store. Chrome
      // may terminate the worker between the media transaction and preferences.
      await conn.ports.privateStore.put('pendingApply', { state, captured, activate, nextSession });
      await conn.ports.wallpaperStore.replaceAll(wallpapers);
      if (captured.generation !== conn.edits.generation) fail(conn, 'local-changed');
      wrote = true;
      if (remove.length) await storage(conn, conn.ports.syncArea || conn.ports.localArea, 'remove', remove);
      await storage(conn, conn.ports.syncArea || conn.ports.localArea, 'set', synced);
      if (removed.length) await storage(conn, conn.ports.localArea, 'remove', removed);
      await storage(conn, conn.ports.localArea, 'set', localValues);
    } finally { conn.ownWrites.expire(wrote); }
    // Credentials and the merge baseline belong to the same server and must
    // commit atomically; separate records could pair a new server with an old base.
    await conn.ports.privateStore.put('session', nextSession);
    await conn.ports.privateStore.put('pendingApply', null);
    await conn.ports.privateStore.put('recoveryBlocked', false);
  });
}

// A pending apply staged by an older version holds fields this one drops.
function samePendingState(conn: Connection, state: WebDavState, pendingState: unknown): boolean {
  try { return equal(state, validateState(pendingState)); } catch (_cause) { return false; }
}

async function recoverPendingApply(conn: Connection): Promise<void> {
  const pending = await conn.ports.privateStore.get('pendingApply');
  if (!isRecord(pending)) return;
  const nextSession = readSession(pending.nextSession);
  const captured = await capture(conn, true);
  if (samePendingState(conn, captured.state, pending.state) && (!conn.ports.syncArea || conn.ports.runtime.isActiveAreaName('sync'))) {
    await conn.ports.privateStore.put('session', nextSession);
    await conn.ports.privateStore.put('recoveryBlocked', false);
    await setStatus(conn, { state: nextSession.config && nextSession.config.enabled ? 'ready' : 'paused', error: null });
  } else {
    // Preserve edits made after the interruption. A partial application is
    // never uploaded automatically; its complete previous copy is recoverable.
    await conn.ports.privateStore.put('replacementBackup', { captured: pending.captured, savedAt: Date.now() });
    await conn.ports.privateStore.put('replacementBackupMeta', { savedAt: Date.now() });
    await conn.ports.privateStore.put('session', { config: nextSession.config ? { ...nextSession.config, enabled: false } : null, base: null });
    await conn.ports.privateStore.put('recoveryBlocked', true);
    await setStatus(conn, { state: 'error', enabled: false, error: 'interrupted-apply' });
  }
  await conn.ports.privateStore.put('pendingApply', null);
}

function mirrorChrome(conn: Connection): Promise<MirrorResult> { return conn.ports.withLocalWrite(() => mirrorChromeInternal(conn)); }

async function mirrorChromeInternal(conn: Connection): Promise<MirrorResult> {
  if (!conn.ports.syncArea || !conn.ports.runtime.isActiveAreaName('local')) return { complete: false, skipped: [] };
  const values = await storage(conn, conn.ports.localArea, 'get', [...LumnoSettings.BROWSER_SYNC_KEYS]);
  const existing = await storage(conn, conn.ports.syncArea, 'get', null);
  const plan = planChromeBackup(values, existing, { quota: conn.ports.syncArea.QUOTA_BYTES,
    itemQuota: conn.ports.syncArea.QUOTA_BYTES_PER_ITEM, maxItems: conn.ports.syncArea.MAX_ITEMS });
  // Only migrate an older local-primary installation when its full
  // preferences fit. Never replace Chrome with a partial WebDAV backup.
  // The card names the condition; it persists until the settings shrink.
  if (!plan.complete) {
    await setStatus(conn, { chromeBackup: 'incomplete', chromeSkipped: plan.skipped.length });
    throw Object.assign(error('chrome-capacity'), { recorded: true });
  }
  try {
    if (plan.remove.length) await storage(conn, conn.ports.syncArea, 'remove', plan.remove);
    if (Object.keys(plan.payload).length) await storage(conn, conn.ports.syncArea, 'set', plan.payload);
    await storage(conn, conn.ports.localArea, 'set', { [LumnoSettings.localPrimary.key]: false });
    await setStatus(conn, { chromeBackup: 'complete', chromeSkipped: 0 });
  } catch (cause) {
    report(conn, 'Could not write the browser sync backup.', cause);
    await setStatus(conn, { chromeBackup: 'failed' });
    throw Object.assign(error('chrome-capacity'), { recorded: true });
  }
  return plan;
}

// The browser-sync backup of an older local-primary installation is a
// standing condition of this device, not part of a WebDAV round: its
// failure is recorded for the card and never stops the round itself.
async function mirrorReporting(conn: Connection): Promise<void> {
  try { await mirrorChrome(conn); }
  catch (cause) { if (!isRecorded(cause)) report(conn, 'Could not back up settings to browser sync.', cause); }
}

export {
  apply,
  expectOwnWrites,
  mirrorChrome,
  mirrorChromeInternal,
  mirrorReporting,
  preferencePayload,
  prepareChrome,
  recoverPendingApply,
  samePendingState
};
