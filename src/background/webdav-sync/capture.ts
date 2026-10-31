// Reading this device's preferences, shortcuts and wallpapers into a state
// to merge.
import { LOCAL_DATA_CODES } from './constants';
import { collectMedia } from './media';
import { errorCode, readStateVersion } from './records';
import { fail, session, storage } from './runtime';
import type { Captured } from './types';
import type { Connection } from './connection';
import { chooseStateVersion, createDeviceState, splitDeviceShortcuts } from '../../domain/webdav/device-state';
import { OVERFLOW_KEY, readShortcutState } from '../../domain/webdav/state-base';
import * as LumnoSettings from '../../domain/settings';

function capture(conn: Connection, recovering = false): Promise<Captured> {
  return conn.ports.withLocalWrite(async () => {
    if (!recovering && conn.ports.hasPendingApply && await conn.ports.hasPendingApply()) fail(conn, 'interrupted-apply');
    return captureInternal(conn);
  });
}

async function captureInternal(conn: Connection): Promise<Captured> {
  await conn.ports.runtime.ready;
  // Unknown mode means the settings could be read from the wrong area;
  // uploading that copy would replace the real ones on other devices.
  if (conn.ports.runtime.isModeKnown && !conn.ports.runtime.isModeKnown()) fail(conn, 'local-storage-failed');
  const capturedGeneration = conn.edits.generation;
  const local = await storage(conn, conn.ports.localArea, 'get', conn.ports.watchedKeys);
  const values = conn.ports.runtime.isActiveAreaName('local') ? local : await storage(conn, conn.ports.syncArea, 'get', [...LumnoSettings.BROWSER_SYNC_KEYS]);
  const shortcutState = readShortcutState(values, conn.ports.runtime.isActiveAreaName('sync') ? local[OVERFLOW_KEY] : null);
  // Another device's browser sync save has only partly arrived.
  if (shortcutState.torn) fail(conn, 'local-changed');
  const { regular, folders, order } = splitDeviceShortcuts(shortcutState.items);
  const version = chooseStateVersion(shortcutState.groups, regular, readStateVersion((await session(conn)).base));
  const state = createDeviceState(values, local, shortcutState.groups, regular, version);
  // This device's own data failing the contract must not read as a bad
  // remote copy, so its codes carry a local- prefix.
  try {
    const { validated, records } = await collectMedia(conn, state, local, new Set(regular.map((item) => item.id)));
    if (capturedGeneration !== conn.edits.generation) fail(conn, 'local-changed');
    return { state: validated, values, local, records, folders, shortcutOrder: order,
      shortcutMigratedAt: shortcutState.migratedAt || 0, generation: capturedGeneration };
  } catch (cause) {
    const code = errorCode(cause);
    if (LOCAL_DATA_CODES.includes(code)) fail(conn, `local-${code}`);
    throw cause;
  }
}

export {
  capture,
  captureInternal
};
