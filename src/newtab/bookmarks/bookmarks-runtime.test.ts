import { describe, expect, it } from 'vitest';
import * as bookmarkStore from './bookmarks-store';
import type { BookmarkNode } from './bookmarks-store';
import { BOOKMARK_EVENT_NAMES, createBookmarksRuntime, type BookmarkChange } from './bookmarks-runtime';
import { required } from '../../../tests/fakes/dom';

type Listener = (...args: unknown[]) => void;

function createChromeEvent() {
  const listeners = new Set<Listener>();
  return {
    addListener: (listener: Listener) => {
      listeners.add(listener);
    },
    removeListener: (listener: Listener) => {
      listeners.delete(listener);
    },
    emit: (...args: unknown[]) => Array.from(listeners).forEach((listener) => listener(...args)),
    count: () => listeners.size
  };
}

function createTree(): BookmarkNode[] {
  return [{
    id: '0',
    title: '',
    syncing: false,
    children: [{
      id: '10',
      title: 'Bookmarks bar',
      syncing: false,
      children: [
        { id: '11', title: 'OpenAI', url: 'https://openai.com/', syncing: false },
        { id: '13', title: 'Design', syncing: false, children: [{ id: '14', title: 'Figma', url: 'https://figma.com/files', syncing: false }] }
      ]
    }]
  }];
}

// A chrome.bookmarks that answers at once and fires each change's event.
function createApi() {
  const events = {
    onCreated: createChromeEvent(),
    onRemoved: createChromeEvent(),
    onChanged: createChromeEvent(),
    onMoved: createChromeEvent(),
    onChildrenReordered: createChromeEvent(),
    onImportEnded: createChromeEvent()
  };
  const calls: {
    getTree: number;
    move: Array<{ id: string; destination: chrome.bookmarks.MoveDestination }>;
    update: Array<{ id: string; changes: chrome.bookmarks.UpdateChanges }>;
    remove: string[];
    removeTree: string[];
    create: BookmarkNode[];
  } = { getTree: 0, move: [], update: [], remove: [], removeTree: [], create: [] };
  let createdId = 100;
  const chromeApi = {
    runtime: { lastError: null },
    bookmarks: {
      ...events,
      getTree(callback: (nodes: BookmarkNode[]) => void) {
        calls.getTree += 1;
        callback(createTree());
      },
      move(id: string, destination: chrome.bookmarks.MoveDestination, callback: (node: BookmarkNode) => void) {
        calls.move.push({ id, destination });
        events.onMoved.emit(id, { parentId: destination.parentId });
        callback({ id, title: '', syncing: false, ...destination });
      },
      update(id: string, changes: chrome.bookmarks.UpdateChanges, callback: (node: BookmarkNode) => void) {
        calls.update.push({ id, changes });
        events.onChanged.emit(id, changes);
        callback({ id, title: '', syncing: false, ...changes });
      },
      remove(id: string, callback: () => void) {
        calls.remove.push(id);
        events.onRemoved.emit(id, {});
        callback();
      },
      removeTree(id: string, callback: () => void) {
        calls.removeTree.push(id);
        events.onRemoved.emit(id, {});
        callback();
      },
      create(details: chrome.bookmarks.CreateDetails, callback: (node: BookmarkNode) => void) {
        const node: BookmarkNode = { title: '', syncing: false, ...details, id: String(createdId) };
        createdId += 1;
        calls.create.push(node);
        events.onCreated.emit(node.id, node);
        callback(node);
      }
    }
  };
  return { chromeApi, events, calls };
}

function createRuntime() {
  const api = createApi();
  const runtime = createBookmarksRuntime({
    chromeApi: api.chromeApi,
    store: bookmarkStore,
    normalizeHost: (host) => String(host || '').toLowerCase()
  });
  return { ...api, runtime };
}

// A runtime whose tree reads wait until the test answers them.
function createPendingRuntime() {
  const pending: Array<(nodes: BookmarkNode[]) => void> = [];
  const runtime = createBookmarksRuntime({
    store: bookmarkStore,
    chromeApi: {
      runtime: { lastError: null },
      bookmarks: {
        getTree(callback) {
          pending.push(callback);
        }
      }
    }
  });
  return { runtime, pending };
}

describe('bookmarks runtime', () => {
  it('reads the bookmarks bar without building the folders not yet opened', async () => {
    const { runtime, calls } = createRuntime();
    const root = await runtime.readFolder('', { rootTitle: '书签' });
    expect([root.ready, root.rootFolderId, root.folderId]).toEqual([true, '10', '10']);
    expect(root.items.map((item) => item.id)).toEqual(['11', '13']);
    expect(calls.getTree).toBe(1);
    expect(runtime.getSnapshot().folderItemsCache.has('13')).toBe(false);
  });

  it('reads a nested folder with its path and keeps its items for later reads', async () => {
    const { runtime } = createRuntime();
    await runtime.readFolder('', { rootTitle: '书签' });
    const nested = await runtime.readFolder('13', { rootTitle: '书签' });
    expect(nested.path.map((item) => item.title)).toEqual(['书签', 'Design']);
    expect(nested.items.map((item) => item.id)).toEqual(['14']);
    expect(required(runtime.getNode('14')).title).toBe('Figma');
    expect(runtime.getFolderItems('13')[0].parentId).toBe('13');
    expect(runtime.getSnapshot().folderItemsCache.has('13')).toBe(true);
  });

  it('falls back to the bookmarks bar for a missing folder, up to the limit', async () => {
    const { runtime } = createRuntime();
    const fallback = await runtime.readFolder('missing', { rootTitle: '书签', limit: 1 });
    expect(fallback.folderId).toBe('10');
    expect(fallback.items.map((item) => item.id)).toEqual(['11']);
  });

  it('tells its subscribers of changes made elsewhere and reads the tree again', async () => {
    const { runtime, events, calls } = createRuntime();
    await runtime.readFolder('');
    const changes: BookmarkChange[] = [];
    const unsubscribe = runtime.subscribe((change) => changes.push(change));
    expect(Object.values(events).map((event) => event.count())).toEqual(BOOKMARK_EVENT_NAMES.map(() => 1));

    events.onChanged.emit('11', { title: 'Updated' });
    expect(changes.map((change) => [change.eventName, change.invalidatesHistory])).toEqual([['onChanged', false]]);
    expect(runtime.getSnapshot().dirty).toBe(true);
    await runtime.ensureReady(false);
    expect(calls.getTree).toBe(2);

    unsubscribe();
    expect(Object.values(events).map((event) => event.count())).toEqual(BOOKMARK_EVENT_NAMES.map(() => 0));
  });

  it('marks the change of its own edit as controlled, refreshing the menus', async () => {
    const { runtime, calls } = createRuntime();
    await runtime.readFolder('');
    const changes: BookmarkChange[] = [];
    runtime.subscribe((change) => changes.push(change));
    const updated = await runtime.runControlledMutation(() => runtime.update('11', { title: 'OpenAI Docs', url: 'https://openai.com/docs' }));
    expect(updated).toEqual({ id: '11', title: 'OpenAI Docs', url: 'https://openai.com/docs', syncing: false });
    expect(calls.update).toEqual([{ id: '11', changes: { title: 'OpenAI Docs', url: 'https://openai.com/docs' } }]);
    expect(changes.map((change) => [change.eventName, change.isControlled, change.shouldRefreshCascade])).toEqual([['onChanged', true, true]]);
  });

  it('coalesces the burst of events of one controlled move, rounding its index', async () => {
    const { runtime, events, calls } = createRuntime();
    await runtime.readFolder('');
    const changes: BookmarkChange[] = [];
    runtime.subscribe((change) => changes.push(change));
    const moved = await runtime.runControlledMutation(async () => {
      const result = await runtime.move('11', { parentId: '13', index: 2.4 });
      events.onChildrenReordered.emit('13', {});
      return result;
    });
    expect(moved.parentId).toBe('13');
    expect(calls.move).toEqual([{ id: '11', destination: { parentId: '13', index: 2 } }]);
    expect(changes.map((change) => change.isControlled)).toEqual([true]);
  });

  it('removes a bookmark, or a folder with what is in it', async () => {
    const { runtime, calls } = createRuntime();
    await runtime.runControlledMutation(() => runtime.remove('11'));
    await runtime.runControlledMutation(() => runtime.remove('13', { recursive: true }));
    expect([calls.remove, calls.removeTree]).toEqual([['11'], ['13']]);
  });

  it('restores a deleted folder with everything in it, where it was', async () => {
    const { runtime, calls } = createRuntime();
    const restored = await runtime.runControlledMutation(() => runtime.restore({
      title: 'Restored',
      url: '',
      children: [
        { title: 'Child link', url: 'https://example.com/', children: [] },
        { title: 'Nested', url: '', children: [{ title: 'Deep link', url: 'https://example.com/deep', children: [] }] }
      ]
    }, { parentId: '10', index: 1 }));
    expect(required(restored).title).toBe('Restored');
    expect(calls.create.map((node) => ({ parentId: node.parentId, index: node.index, title: node.title, url: node.url || '' }))).toEqual([
      { parentId: '10', index: 1, title: 'Restored', url: '' },
      { parentId: '100', index: 0, title: 'Child link', url: 'https://example.com/' },
      { parentId: '100', index: 1, title: 'Nested', url: '' },
      { parentId: '102', index: 0, title: 'Deep link', url: 'https://example.com/deep' }
    ]);
  });

  it('drops a tree read that an invalidation made stale', async () => {
    const { runtime, pending } = createPendingRuntime();
    const load = runtime.ensureReady(false);
    runtime.invalidate();
    required(pending.shift())(createTree());
    expect(await load).toBe(false);
    expect(runtime.getSnapshot().ready).toBe(false);
  });

  it('shares one tree read between the cards and the menus', async () => {
    const { runtime, pending } = createPendingRuntime();
    const cards = runtime.readFolder('10');
    const menus = runtime.ensureReady(false);
    expect(pending).toHaveLength(1);
    required(pending.shift())(createTree());
    expect(await menus).toBe(true);
    expect((await cards).items.map((item) => item.id)).toEqual(['11', '13']);
  });
});
