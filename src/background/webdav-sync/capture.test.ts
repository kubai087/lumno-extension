import { describe, expect, it } from 'vitest';
import * as settings from '../../domain/settings';
import { newtabShortcutsLegacy, shortcutFolderBindings } from '../../domain/settings/newtab-shortcuts';
import { createShortcutRecord } from '../../domain/shortcuts/normalize';
import { createShortcutStoragePlan } from '../../domain/shortcuts/storage-plan';
import { GROUPED_STATE_VERSION, OVERFLOW_KEY, readShortcutState } from '../../domain/webdav/state-base';
import { DAV_CONFIG, createDavServer, createDevice, field, storageSet } from '../../../tests/fakes/webdav';

const theme = settings.themeMode.key;
const quiet = { logger: { warn() {} } };
const unbounded = { maxItemBytes: Number.MAX_SAFE_INTEGER, maxTotalBytes: Number.MAX_SAFE_INTEGER };
const firstShortcut = createShortcutRecord({ id: 'first', title: 'First', url: 'https://example.com/' }, { now: 100 });
const longList = Array.from({ length: 60 }, (_, index) => createShortcutRecord({
  id: `long-${index}`, title: 'Long shortcut', url: `https://example.com/${'x'.repeat(1000)}?id=${index}`
}, { now: 100 }));

function shortcutsOf(device: ReturnType<typeof createDevice>) {
  return readShortcutState(device.chrome.storage.sync.values, device.chrome.storage.local.values[OVERFLOW_KEY]);
}

describe('portable bookmark folders', () => {
  const folderRef = { version: 1, root: 'bookmarks-bar', scope: 'account', path: ['Design'], fingerprint: '0123456789abcdef' };
  const portableFolder = createShortcutRecord({ id: 'folder-sync-entry', type: 'folder', title: 'Design', folderRef }, { now: 100 });

  it('sync by their portable locator in protocol version 2, never by local bookmark ids, and stay removed once removed', async () => {
    const server = createDavServer();
    const a = createDevice(server, { sync: createShortcutStoragePlan({ items: [firstShortcut, portableFolder] }).payload,
      local: { [shortcutFolderBindings.key]: { 'folder-sync-entry': { folderId: '42' } } } });
    await a.controller.handle({ operation: 'connect', config: DAV_CONFIG });

    expect(server.state().version).toBe(2);
    expect(server.state().shortcuts.map((item) => item.id)).toEqual(['first', 'folder-sync-entry']);
    expect(JSON.stringify(server.state().raw)).not.toContain('folderId');
    expect(JSON.stringify(server.state().raw)).not.toContain(shortcutFolderBindings.key);

    const b = createDevice(server, { local: { [shortcutFolderBindings.key]: { 'folder-sync-entry': { folderId: '117' } } } });
    await b.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'remote' });
    expect(shortcutsOf(b).items.map((item) => item.id)).toEqual(['first', 'folder-sync-entry']);
    expect(field(b.chrome.storage.local.values[shortcutFolderBindings.key], 'folder-sync-entry', 'folderId')).toBe('117');
    expect(readShortcutState(b.chrome.storage.sync.values, null).items[1]).toMatchObject({ folderRef: folderRef });
    await b.controller.handle({ operation: 'sync' });
    expect(server.state().version).toBe(2);

    await storageSet(b.chrome.storage.sync, createShortcutStoragePlan({ items: [firstShortcut] }).payload);
    await b.controller.handle({ operation: 'sync' });
    await a.controller.handle({ operation: 'sync' });
    expect(shortcutsOf(a).items.map((item) => item.id)).toEqual(['first']);
    expect(server.state().version).toBe(2);
  });
});

describe('large shortcut lists', () => {
  it('keep every item through the Chrome chunks and the local overflow record', async () => {
    const server = createDavServer();
    server.replaceState({ version: 1, data: { [theme]: 'dark' }, shortcuts: longList, icons: {}, wallpapers: [], assets: {} });
    const device = createDevice(server, { sync: { [theme]: 'light' } });
    await device.controller.handle({ operation: 'save', config: DAV_CONFIG });
    await device.controller.handle({ operation: 'enable', decision: 'remote' });

    expect(field(device.chrome.storage.local.values[OVERFLOW_KEY], 'items')).toEqual(expect.arrayContaining([expect.anything()]));
    expect(shortcutsOf(device).items).toHaveLength(60);
    expect((await device.controller.status()).localPrimary).toBe(false);
    await device.controller.handle({ operation: 'pause' });
  });

  it('sync while the full-copy browser backup cannot hold them', async () => {
    const server = createDavServer();
    const device = createDevice(server, { sync: { [theme]: 'light' } }, { extra: quiet });
    await device.controller.handle({ operation: 'connect', config: DAV_CONFIG });
    await storageSet(device.chrome.storage.local, { [settings.localPrimary.key]: true, ...createShortcutStoragePlan({ items: longList }, unbounded).payload });

    expect(await device.controller.handle({ operation: 'sync' })).toEqual({ ok: true });
    expect(await device.controller.handle({ operation: 'status' })).toMatchObject({ state: 'ready', chromeBackup: 'incomplete', localPrimary: true });
    expect(server.state().shortcuts).toHaveLength(60);
  });
});

describe('shortcut groups', () => {
  const groups = [{ id: 'g0', title: '' }, { id: 'work', title: '工作' }];
  const link = (id: string, groupId?: string) => createShortcutRecord({ id, title: id, url: `https://${id}.example/`, groupId });

  it('travel in the grouped protocol and reach a joining device, which keeps the legacy list older devices read', async () => {
    const legacyList = [link('stale', 'g0')];
    const server = createDavServer();
    const a = createDevice(server, { sync: { ...createShortcutStoragePlan({ groups, items: [link('home', 'g0'), link('docs', 'work')] }).payload,
      [newtabShortcutsLegacy.key]: legacyList } });
    await a.controller.handle({ operation: 'connect', config: DAV_CONFIG });
    const published = server.state();

    expect(published.version).toBe(GROUPED_STATE_VERSION);
    expect(published.groups).toEqual(groups);
    expect(published.shortcuts.map((item) => [item.id, item.groupId])).toEqual([['home', 'g0'], ['docs', 'work']]);
    expect(JSON.stringify(published.raw)).not.toContain('stale');

    const b = createDevice(server, { sync: { [newtabShortcutsLegacy.key]: legacyList } });
    await b.controller.handle({ operation: 'connect', config: DAV_CONFIG, decision: 'remote' });
    const received = shortcutsOf(b);
    expect(received.groups).toEqual(groups);
    expect(received.items.map((item) => item.id)).toEqual(['home', 'docs']);
    expect(b.chrome.storage.sync.values[newtabShortcutsLegacy.key]).toEqual(legacyList);

    await storageSet(b.chrome.storage.sync, createShortcutStoragePlan({ groups: [groups[0], { id: 'work', title: '工作台' }], items: received.items }).payload);
    await b.controller.handle({ operation: 'sync' });
    await a.controller.handle({ operation: 'sync' });
    expect(readShortcutState(a.chrome.storage.sync.values, null).groups[1].title).toBe('工作台');
  });

  it('keep a state without real groups readable by older versions, unless it has more shortcuts than they take', async () => {
    const flat = createDavServer();
    await createDevice(flat, { sync: createShortcutStoragePlan({ items: [link('one')] }).payload }).controller.handle({ operation: 'connect', config: DAV_CONFIG });
    const large = createDavServer();
    const many = Array.from({ length: 120 }, (_, index) => link(`site${index}`));
    await createDevice(large, { sync: createShortcutStoragePlan({ items: many }).payload }).controller.handle({ operation: 'connect', config: DAV_CONFIG });

    expect(flat.state().version).toBe(1);
    expect(large.state().version).toBe(GROUPED_STATE_VERSION);
    expect(large.state().shortcuts).toHaveLength(120);
  });
});
