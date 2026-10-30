// A chrome.bookmarks that changes: a tree whose bookmarks bar ('1') and
// Other bookmarks ('2') hold what a test starts from, with create, move,
// update and remove that change it and fire the matching events, as Chrome
// does. Every call is recorded; a test can make the next calls of a method
// fail through runtime.lastError.
//
//   const bookmarks = createBookmarksFake({ bar: [{ id: '10', title: 'A', url: 'https://a.example/' }] });
//   const browser = { ...createBrowserFake(), bookmarks: bookmarks.api };
//   bookmarks.titles('1'); bookmarks.changes(); bookmarks.fail('remove');
type Listener = (...args: never[]) => unknown;

interface BookmarkInput {
  id?: string;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: BookmarkInput[];
}

interface FakeBookmarkNode {
  id: string;
  syncing: boolean;
  parentId?: string;
  index?: number;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: FakeBookmarkNode[];
}

interface BookmarkCall {
  name: string;
  args: unknown[];
}

interface CreateDetails {
  parentId?: string;
  index?: number;
  title?: string;
  url?: string;
}

interface Destination {
  parentId?: string;
  index?: number;
}

type MutationName = 'create' | 'move' | 'update' | 'remove';

interface BookmarksFakeOptions {
  bar?: BookmarkInput[];
  other?: BookmarkInput[];
  // Where failures report themselves; the page's chrome.runtime.
  runtime?: object;
}

function createEvent() {
  const listeners = new Set<Listener>();
  return {
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
    hasListener: (listener: Listener) => listeners.has(listener),
    fire: (...args: unknown[]) => Array.from(listeners).forEach((listener) => Reflect.apply(listener, undefined, args))
  };
}

function copy(node: FakeBookmarkNode): FakeBookmarkNode {
  return { ...node, ...(node.children ? { children: node.children.map(copy) } : {}) };
}

function withoutChildren(node: FakeBookmarkNode): FakeBookmarkNode {
  const { children: _children, ...rest } = node;
  return { ...rest };
}

function createBookmarksFake(options: BookmarksFakeOptions = {}) {
  const calls: BookmarkCall[] = [];
  const failing = new Map<MutationName, number>();
  const runtime = options.runtime || { lastError: null };
  let nextId = 1000;
  const adopt = (node: BookmarkInput, parentId: string | undefined, index: number): FakeBookmarkNode => {
    const id = node.id || String(nextId += 1);
    const adopted: FakeBookmarkNode = { id, parentId, index, title: node.title, syncing: false, dateAdded: node.dateAdded || 1 };
    if (node.url) adopted.url = node.url;
    if (node.children) adopted.children = node.children.map((child, childIndex) => adopt(child, id, childIndex));
    return adopted;
  };
  const root = adopt({
    id: '0',
    title: '',
    children: [
      { id: '1', title: 'Bookmarks bar', children: options.bar || [] },
      { id: '2', title: 'Other bookmarks', children: options.other || [] }
    ]
  }, undefined, 0);
  const find = (id: string, node: FakeBookmarkNode = root): FakeBookmarkNode | null => {
    if (node.id === String(id)) return node;
    for (const child of node.children || []) {
      const found = find(id, child);
      if (found) return found;
    }
    return null;
  };
  const reindex = (parent: FakeBookmarkNode) => (parent.children || []).forEach((child, index) => {
    child.index = index;
  });
  const events = {
    onCreated: createEvent(),
    onRemoved: createEvent(),
    onChanged: createEvent(),
    onMoved: createEvent(),
    onChildrenReordered: createEvent(),
    onImportBegan: createEvent(),
    onImportEnded: createEvent()
  };
  const answer = <T>(value: T, callback?: (value: T) => void): Promise<T> | undefined => {
    if (callback) {
      setTimeout(() => callback(value), 0);
      return undefined;
    }
    return Promise.resolve(value);
  };
  // A failing call answers with runtime.lastError set, then clears it.
  const failed = <T>(name: MutationName, callback?: (value: T) => void): Promise<T> | undefined => {
    failing.set(name, (failing.get(name) || 1) - 1);
    if (!callback) return Promise.reject(new Error(`${name} failed`));
    setTimeout(() => {
      Reflect.set(runtime, 'lastError', { message: `${name} failed` });
      try {
        Reflect.apply(callback, undefined, []);
      } finally {
        Reflect.set(runtime, 'lastError', null);
      }
    }, 0);
    return undefined;
  };
  const fails = (name: MutationName) => (failing.get(name) || 0) > 0;
  const record = (name: string, args: unknown[]) => calls.push({ name, args: structuredClone(args) });
  const remove = (name: 'remove' | 'removeTree') => (id: string, callback?: () => void) => {
    record(name, [id]);
    if (fails('remove')) return failed('remove', callback);
    const node = find(id);
    const parent = node && node.parentId ? find(node.parentId) : null;
    if (node && parent && parent.children) {
      const index = parent.children.indexOf(node);
      parent.children.splice(index, 1);
      reindex(parent);
      events.onRemoved.fire(node.id, { parentId: parent.id, index, node: copy(node) });
    }
    return answer(undefined, callback);
  };

  const api = {
    ...events,
    getTree: (callback?: (tree: FakeBookmarkNode[]) => void) => {
      record('getTree', []);
      return answer([copy(root)], callback);
    },
    getSubTree: (id: string, callback?: (tree: FakeBookmarkNode[]) => void) => {
      record('getSubTree', [id]);
      const node = find(id);
      return answer(node ? [copy(node)] : [], callback);
    },
    getChildren: (id: string, callback?: (children: FakeBookmarkNode[]) => void) => {
      record('getChildren', [id]);
      return answer((find(id)?.children || []).map(withoutChildren), callback);
    },
    get: (id: string | string[], callback?: (nodes: FakeBookmarkNode[]) => void) => {
      record('get', [id]);
      const nodes = (Array.isArray(id) ? id : [id]).map((each) => find(each))
        .filter((node): node is FakeBookmarkNode => node !== null).map(withoutChildren);
      return answer(nodes, callback);
    },
    search: (query: unknown, callback?: (nodes: FakeBookmarkNode[]) => void) => {
      record('search', [query]);
      const text = typeof query === 'string' ? query
        : typeof query === 'object' && query !== null && 'url' in query && typeof query.url === 'string' ? query.url : '';
      const matches: FakeBookmarkNode[] = [];
      const walk = (node: FakeBookmarkNode) => {
        if (node.url && text && (node.url.includes(text) || node.title.includes(text))) matches.push(withoutChildren(node));
        (node.children || []).forEach(walk);
      };
      walk(root);
      return answer(matches, callback);
    },
    create: (details: CreateDetails, callback?: (node: FakeBookmarkNode) => void) => {
      record('create', [details]);
      if (fails('create')) return failed('create', callback);
      const parent = find(details.parentId || '2') || root;
      const node: FakeBookmarkNode = { id: String(nextId += 1), parentId: parent.id, title: details.title || '', syncing: false, dateAdded: Date.now() };
      if (details.url) node.url = details.url;
      else node.children = [];
      parent.children = parent.children || [];
      parent.children.splice(Number.isInteger(details.index) ? Number(details.index) : parent.children.length, 0, node);
      reindex(parent);
      events.onCreated.fire(node.id, copy(node));
      return answer(copy(node), callback);
    },
    update: (id: string, changes: { title?: string; url?: string }, callback?: (node: FakeBookmarkNode) => void) => {
      record('update', [id, changes]);
      if (fails('update')) return failed('update', callback);
      const node = find(id);
      if (!node) return answer({ id, title: '', syncing: false }, callback);
      Object.assign(node, changes);
      events.onChanged.fire(node.id, { ...changes });
      return answer(withoutChildren(node), callback);
    },
    move: (id: string, destination: Destination, callback?: (node: FakeBookmarkNode) => void) => {
      record('move', [id, destination]);
      if (fails('move')) return failed('move', callback);
      const node = find(id);
      const oldParent = node && node.parentId ? find(node.parentId) : null;
      const parent = node ? find(destination.parentId || node.parentId || '') : null;
      if (!node || !oldParent || !oldParent.children || !parent) return answer({ id, title: '', syncing: false }, callback);
      const oldIndex = oldParent.children.indexOf(node);
      oldParent.children.splice(oldIndex, 1);
      parent.children = parent.children || [];
      const index = Number.isInteger(destination.index)
        ? Math.min(Number(destination.index), parent.children.length)
        : parent.children.length;
      parent.children.splice(index, 0, node);
      node.parentId = parent.id;
      reindex(oldParent);
      reindex(parent);
      events.onMoved.fire(node.id, { parentId: parent.id, index: node.index, oldParentId: oldParent.id, oldIndex });
      return answer(withoutChildren(node), callback);
    },
    remove: remove('remove'),
    removeTree: remove('removeTree')
  };

  return {
    api,
    calls,
    find,
    // The titles in a folder, in order.
    titles: (id: string) => (find(id)?.children || []).map((node) => node.title),
    // The names of the calls that changed the tree.
    changes: () => calls.map((call) => call.name).filter((name) => ['create', 'move', 'update', 'remove', 'removeTree'].includes(name)),
    // Makes the next `times` calls of a method fail (remove covers removeTree).
    fail(name: MutationName, times = 1) {
      failing.set(name, times);
    }
  };
}

type BookmarksFake = ReturnType<typeof createBookmarksFake>;

export { createBookmarksFake };
export type { BookmarkCall, BookmarkInput, BookmarksFake, FakeBookmarkNode };
