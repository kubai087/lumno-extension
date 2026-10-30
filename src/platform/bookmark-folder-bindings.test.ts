import { describe as describeTests, expect, it } from 'vitest';
import { buildNodeMap, describe } from '../domain/bookmark-folder-reference';
import type { BookmarkNode } from '../domain/bookmark-folder-reference';
import { NEWTAB_SHORTCUT_LIST_SETTINGS, newtabShortcutsLegacy, newtabShortcutsLocalOverflow, shortcutFolderBindings } from '../domain/settings/newtab-shortcuts';
import { createShortcutRecord } from '../domain/shortcuts/normalize';
import type { ShortcutItem } from '../domain/shortcuts/types';
import type { StorageChangeListener, StorageItems, StorageKeys } from '../domain/storage-port';
import { createRuntime, createSyncController } from './bookmark-folder-bindings';
import { createProviderStorageRuntime } from './provider-storage';
import { createSettingsStore } from './settings-store';
import { loadShortcuts, saveShortcuts } from './shortcut-storage';
import { barOf, folderOf, folderTree } from '../../tests/fakes/bookmark-folder-tree';
import { required } from '../../tests/fakes/dom';

type BookmarkEventName = 'onCreated' | 'onRemoved' | 'onChanged' | 'onMoved' | 'onChildrenReordered' | 'onImportEnded';
const EVENT_NAMES: BookmarkEventName[] = ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered', 'onImportEnded'];
const SETTINGS = [shortcutFolderBindings, newtabShortcutsLocalOverflow, ...NEWTAB_SHORTCUT_LIST_SETTINGS];

function createArea(name: string, initial: StorageItems, listeners: StorageChangeListener[]) {
  const values: StorageItems = structuredClone(initial);
  return {
    values,
    QUOTA_BYTES: 102400,
    get(keys: StorageKeys, callback?: (items: StorageItems | undefined) => void) {
      const list = keys === null ? Object.keys(values) : (Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys)));
      callback?.(structuredClone(Object.fromEntries(list.filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]]))));
    },
    set(payload: StorageItems, callback?: () => void) {
      const changes: Record<string, { newValue?: unknown }> = {};
      Object.entries(payload).forEach(([key, value]) => {
        if (JSON.stringify(value) !== JSON.stringify(values[key])) changes[key] = { newValue: structuredClone(value) };
        values[key] = structuredClone(value);
      });
      if (Object.keys(changes).length) listeners.forEach((listener) => listener(changes, name));
      callback?.();
    },
    remove(keys: string | string[], callback?: () => void) {
      (Array.isArray(keys) ? keys : [keys]).forEach((key) => { delete values[key]; });
      callback?.();
    }
  };
}

// A browser profile: its two storage areas and its bookmarks tree.
function createDevice(initial: { sync?: StorageItems; local?: StorageItems } = {}, startTree: BookmarkNode[] = folderTree()) {
  let nodes = startTree;
  const listeners: StorageChangeListener[] = [];
  const events = new Map<BookmarkEventName, Array<() => void>>(EVENT_NAMES.map((name) => [name, []]));
  const event = (name: BookmarkEventName) => ({ addListener: (listener: () => void) => { events.get(name)?.push(listener); } });
  const bookmarks = {
    getTree(callback: (tree: BookmarkNode[]) => void) {
      callback(structuredClone(nodes));
    },
    onCreated: event('onCreated'),
    onRemoved: event('onRemoved'),
    onChanged: event('onChanged'),
    onMoved: event('onMoved'),
    onChildrenReordered: event('onChildrenReordered'),
    onImportEnded: event('onImportEnded')
  };
  const sync = createArea('sync', initial.sync || {}, listeners);
  const local = createArea('local', initial.local || {}, listeners);
  const chrome = {
    runtime: { lastError: null },
    bookmarks,
    storage: {
      sync,
      local,
      onChanged: {
        addListener: (listener: StorageChangeListener) => { listeners.push(listener); },
        removeListener: (listener: StorageChangeListener) => { listeners.splice(listeners.indexOf(listener), 1); }
      }
    }
  };
  return {
    chrome,
    sync,
    local,
    setTree(tree: BookmarkNode[], name: BookmarkEventName = 'onChanged') {
      nodes = tree;
      events.get(name)?.forEach((listener) => listener());
    }
  };
}

function settingsOf(device: ReturnType<typeof createDevice>) {
  return createSettingsStore({ chromeApi: device.chrome, settings: SETTINGS });
}

function controllerOf(device: ReturnType<typeof createDevice>) {
  return createSyncController({ chrome: device.chrome, provider: createProviderStorageRuntime(device.chrome), settingsStore: settingsOf(device) });
}

const homeMap = buildNodeMap(folderTree());
const otherMap = buildNodeMap(folderTree('117', '900', 'Bookmarks bar'));

function folderEntry(id = 'entry-a'): ShortcutItem {
  return required(createShortcutRecord({ id, type: 'folder', title: '灵感', folderRef: describe('42', homeMap) }, { now: 1 }), 'the folder entry');
}

function site(id: string, url: string): ShortcutItem {
  return required(createShortcutRecord({ id, url }, { now: 1 }), id);
}

describeTests('shortcut folder bindings', () => {
  it('keeps the folder a drag chose bound after a restart', async () => {
    const device = createDevice();
    const item = folderEntry();
    const runtime = createRuntime({ settingsStore: settingsOf(device) });
    await runtime.ready;
    runtime.bind(item.id, '42');
    await runtime.flush();

    const restarted = createRuntime({ settingsStore: settingsOf(device) });
    await restarted.ready;
    expect(restarted.getNode(item, homeMap)?.id).toBe('42');
  });

  it('hides an entry this device cannot open, in place, and binds it on this device only once it can', async () => {
    const device = createDevice();
    const runtime = createRuntime({ settingsStore: settingsOf(device) });
    await runtime.ready;
    const item = folderEntry();
    const complete = [site('before', 'https://before.example/'), item, site('after', 'https://after.example/')];

    expect(runtime.visibleItems(complete, new Map()).map((row) => row.id)).toEqual(['before', 'after']);
    expect(complete.map((row) => row.id)).toEqual(['before', item.id, 'after']);
    expect(runtime.visibleItems(complete, otherMap).map((row) => row.id)).toEqual(['before', item.id, 'after']);
    await runtime.flush();
    expect(device.local.values[shortcutFolderBindings.key]).toEqual({ [item.id]: { folderId: '117' } });
    expect(Object.keys(device.sync.values)).not.toContain(shortcutFolderBindings.key);
  });

  it('follows edits of the bound folder without a new choice, and never attaches to a replacement folder', async () => {
    const runtime = createRuntime({ settingsStore: settingsOf(createDevice()) });
    await runtime.ready;
    const item = folderEntry();
    const complete = [site('before', 'https://before.example/'), item, site('after', 'https://after.example/')];
    runtime.visibleItems(complete, otherMap);

    const moved = folderTree('117', '900');
    const folder = folderOf(moved);
    folder.title = '新名字';
    required(folder.children?.[0], 'the bookmark').url = 'https://updated.example/';
    const movedMap = buildNodeMap(moved);
    const refreshed = runtime.reconcile(complete, movedMap);
    expect(refreshed[1]).toMatchObject({ folderRef: { path: ['新名字'] } });
    expect(runtime.visibleItems(refreshed, movedMap)[1]).toMatchObject({ folderId: '117' });
    expect(runtime.getNode(item, buildNodeMap(folderTree('118', '900')))).toBeNull();
  });

  it('gives an old entry with a bookmark id a reference, but not when the id comes from another profile', async () => {
    const runtime = createRuntime({ settingsStore: settingsOf(createDevice()) });
    await runtime.ready;
    const legacy = required(createShortcutRecord({ type: 'folder', folderId: '42', title: '灵感' }, { now: 1 }), 'the old entry');

    expect(runtime.reconcile([legacy], homeMap)[0]).toMatchObject({ folderRef: { path: ['灵感'] } });
    const untrusted = required(createShortcutRecord({ id: 'untrusted', type: 'folder', folderId: '117', title: '灵感' }, { now: 1 }), 'the entry from another profile');
    expect(runtime.reconcile([untrusted], homeMap)[0]).not.toHaveProperty('folderRef');
  });

  it('keeps the other folders when one portable entry is saved again', async () => {
    const device = createDevice();
    const item = folderEntry();
    const other = folderEntry('entry-other');
    await saveShortcuts(device.sync, [item, other]);
    await saveShortcuts(device.sync, [{ ...item, title: 'Updated' }, other]);
    expect(await loadShortcuts(device.sync)).toHaveLength(2);
  });
});

describeTests('the background folder controller', () => {
  it('moves old entries to portable references and follows renames and moves without an open New Tab', async () => {
    const legacy = required(createShortcutRecord({ type: 'folder', folderId: '42', title: '灵感' }, { now: 1 }), 'the old entry');
    const device = createDevice({ sync: { [newtabShortcutsLegacy.key]: [legacy] } });
    const controller = controllerOf(device);
    controller.start();
    await controller.refresh();
    await controller.refresh();
    const [migrated] = await loadShortcuts(device.sync);
    expect(migrated).toHaveProperty('folderRef');
    expect(migrated).not.toHaveProperty('folderId');

    const renamed = folderTree();
    const folder = folderOf(renamed);
    folder.title = 'Moved';
    device.setTree(renamed);
    await controller.refresh();
    expect((await loadShortcuts(device.sync))[0]).toMatchObject({ folderRef: { path: ['Moved'] } });

    folder.parentId = '88';
    barOf(renamed).children = [{ id: '88', parentId: '1', title: 'Design', children: [folder] }];
    device.setTree(renamed, 'onMoved');
    await controller.refresh();
    expect((await loadShortcuts(device.sync))[0]).toMatchObject({ folderRef: { path: ['Design', 'Moved'] } });
    expect(device.sync.values[shortcutFolderBindings.key]).toBeUndefined();
  });

  it('keeps a save New Tab makes while it updates a folder reference, and still updates the reference', async () => {
    // New Tab saves a site dragged out of a shortcut folder, then removes its
    // bookmark; writing the older list over that save would lose the site.
    const device = createDevice({ local: { [shortcutFolderBindings.key]: { 'entry-a': { folderId: '42' } } } });
    const dragged = required(createShortcutRecord({ url: 'https://example.com/site', title: 'Site' }, { now: 2 }), 'the site');
    await saveShortcuts(device.sync, [folderEntry()]);
    const emptied = folderTree();
    folderOf(emptied).children = [];
    device.setTree(emptied);
    const readTree = device.chrome.bookmarks.getTree;
    let newTabSaved = false;
    device.chrome.bookmarks.getTree = (callback) => readTree((nodes) => {
      if (newTabSaved) {
        callback(nodes);
        return;
      }
      newTabSaved = true;
      void saveShortcuts(device.sync, [folderEntry(), dragged]).then(() => callback(nodes));
    });

    await controllerOf(device).refresh();

    const fingerprint = describe('42', buildNodeMap(emptied))?.fingerprint;
    await expect.poll(async () => (await loadShortcuts(device.sync))[0]).toMatchObject({ folderRef: { fingerprint } });
    expect((await loadShortcuts(device.sync)).map((row) => row.title)).toEqual(['灵感', 'Site']);
  });
});
