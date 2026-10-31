// Shortcut icons and wallpapers: hashing them and moving them to and from
// the server.
import type { StorageItems } from '../../domain/storage-port';
import type { WallpaperRecord } from '../../shared/wallpaper-records';
import { isArrayBufferBytes } from './records';
import { fail } from './runtime';
import type { Connection } from './connection';
import type { WebDavClient } from '../webdav-client/types';
import type { WebDavAsset, WebDavAssetMime, WebDavState } from '../../domain/webdav/types';
import { addDeviceMedia } from '../../domain/webdav/device-state';
import { checkImage } from '../../domain/webdav/images';
import { ICONS_KEY, equal } from '../../domain/webdav/state-base';

async function hash(conn: Connection, bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await conn.ports.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function assetPath(conn: Connection, hashValue: string, mime: WebDavAssetMime): string { return `assets/${hashValue}.${mime === 'image/png' ? 'png' : 'webp'}`; }


async function collectMedia(
  conn: Connection,
  state: WebDavState,
  local: StorageItems,
  ids: ReadonlySet<string>
): Promise<{ validated: WebDavState; records: WallpaperRecord[] }> {
  const records = await conn.ports.wallpaperStore.readAll();
  const validated = await addDeviceMedia(state, local[ICONS_KEY], ids, records, {
    digest: (bytes) => hash(conn, bytes),
    // Binary cache and credentials live in extension-origin IndexedDB,
    // never in content-script-accessible chrome.storage.local.
    async keep(digest, bytes) {
      if (!await conn.ports.privateStore.get(`asset:${digest}`)) await conn.ports.privateStore.put(`asset:${digest}`, bytes);
    }
  });
  return { validated, records };
}

async function getAsset(conn: Connection, digest: string, asset: WebDavAsset | undefined, client: WebDavClient | null): Promise<Uint8Array<ArrayBuffer>> {
  if (!asset) fail(conn, 'asset-missing');
  const cached = await conn.ports.privateStore.get(`asset:${digest}`);
  let bytes: Uint8Array<ArrayBuffer>;
  if (isArrayBufferBytes(cached)) {
    bytes = cached;
  } else {
    if (!client) fail(conn, 'asset-missing');
    const response = await client.request(assetPath(conn, digest, asset.mime), 'GET', undefined, {}, asset.size);
    if (response.status !== 200) fail(conn, 'asset-missing');
    bytes = response.bytes;
  }
  if (bytes.byteLength !== asset.size || await hash(conn, bytes) !== digest) fail(conn, 'asset-integrity');
  checkImage(bytes, asset.mime);
  await conn.ports.privateStore.put(`asset:${digest}`, bytes);
  return bytes;
}

// Fails unless the server's copy of an asset has the expected content.
async function verifyRemoteAsset(conn: Connection, client: WebDavClient, digest: string, asset: WebDavAsset): Promise<void> {
  const downloaded = await client.request(assetPath(conn, digest, asset.mime), 'GET', undefined, {}, asset.size);
  if (downloaded.status !== 200 || downloaded.bytes.byteLength !== asset.size || await hash(conn, downloaded.bytes) !== digest) fail(conn, 'asset-integrity');
}

async function uploadAsset(conn: Connection, client: WebDavClient, digest: string, asset: WebDavAsset): Promise<void> {
  const bytes = await getAsset(conn, digest, asset, client);
  const existing = await client.request(assetPath(conn, digest, asset.mime), 'HEAD', undefined, {}, 65536);
  // Asset files are named by the SHA-256 of their content and only ever
  // written whole, so a file of the expected size needs no download.
  // Without a size, or with another one, its content is checked.
  if (existing.status === 200 && existing.size === asset.size) return;
  if (existing.status === 200) {
    await verifyRemoteAsset(conn, client, digest, asset);
    return;
  }
  if (existing.status !== 404) fail(conn, 'asset-missing');
  const written = await client.request(assetPath(conn, digest, asset.mime), 'PUT', bytes,
    { 'If-None-Match': '*', 'Content-Type': asset.mime }, 65536);
  if (![200, 201, 204, 412].includes(written.status)) fail(conn, 'write-failed');
  if (written.status === 412) await verifyRemoteAsset(conn, client, digest, asset);
}

async function uploadAssets(conn: Connection, state: WebDavState, client: WebDavClient, knownAssets: Record<string, WebDavAsset> | null | undefined): Promise<void> {
  for (const [digest, asset] of Object.entries(state.assets)) {
    if (knownAssets && equal(knownAssets[digest], asset)) continue;
    await uploadAsset(conn, client, digest, asset);
  }
}

export {
  assetPath,
  collectMedia,
  getAsset,
  hash,
  uploadAssets
};
