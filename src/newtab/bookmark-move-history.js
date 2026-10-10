(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoNewtabBookmarkMoveHistory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function normalizeLocation(location) {
    if (!location || !location.parentId) {
      return null;
    }
    return {
      parentId: String(location.parentId),
      index: Math.max(0, Math.round(Number(location.index) || 0))
    };
  }

  function isFolderInsideBookmark(nodeMap, bookmarkId, targetFolderId) {
    if (!(nodeMap instanceof Map)) {
      return false;
    }
    const sourceId = String(bookmarkId || '');
    let cursorId = String(targetFolderId || '');
    let guard = 0;
    while (cursorId && guard < 128) {
      if (cursorId === sourceId) {
        return true;
      }
      const node = nodeMap.get(cursorId);
      cursorId = node && node.parentId ? String(node.parentId) : '';
      guard += 1;
    }
    return false;
  }

  function canMoveBookmarkToFolder(options) {
    const config = options && typeof options === 'object' ? options : {};
    const bookmarkId = String(config.bookmarkId || '');
    const sourceParentId = String(config.sourceParentId || '');
    const targetFolderId = String(config.targetFolderId || '');
    if (!bookmarkId || !sourceParentId || !targetFolderId) {
      return false;
    }
    if (bookmarkId === targetFolderId || sourceParentId === targetFolderId) {
      return false;
    }
    return !isFolderInsideBookmark(config.nodeMap, bookmarkId, targetFolderId);
  }

  function normalizeMoveDestinationIndex(options) {
    const config = options && typeof options === 'object' ? options : {};
    const sourceParentId = String(config.sourceParentId || '');
    const targetParentId = String(config.targetParentId || '');
    const sourceIndex = Math.max(0, Math.round(Number(config.sourceIndex) || 0));
    let targetIndex = Math.max(0, Math.round(Number(config.targetIndex) || 0));
    if (sourceParentId && sourceParentId === targetParentId && sourceIndex < targetIndex) {
      targetIndex -= 1;
    }
    return targetIndex;
  }

  function getMoveApiDestinationIndex(options) {
    const config = options && typeof options === 'object' ? options : {};
    const sourceParentId = String(config.sourceParentId || '');
    const targetParentId = String(config.targetParentId || '');
    const sourceIndex = Math.max(0, Math.round(Number(config.sourceIndex) || 0));
    let targetIndex = Math.max(0, Math.round(Number(config.targetIndex) || 0));
    if (sourceParentId && sourceParentId === targetParentId && sourceIndex < targetIndex) {
      targetIndex += 1;
    }
    return targetIndex;
  }

  function canMoveBookmarkToLocation(options) {
    const config = options && typeof options === 'object' ? options : {};
    const bookmarkId = String(config.bookmarkId || '');
    const sourceParentId = String(config.sourceParentId || '');
    const targetParentId = String(config.targetParentId || '');
    const sourceIndex = Math.max(0, Math.round(Number(config.sourceIndex) || 0));
    if (!bookmarkId || !sourceParentId || !targetParentId ||
        bookmarkId === targetParentId ||
        isFolderInsideBookmark(config.nodeMap, bookmarkId, targetParentId)) {
      return false;
    }
    const destinationIndex = normalizeMoveDestinationIndex({
      sourceParentId,
      sourceIndex,
      targetParentId,
      targetIndex: config.targetIndex
    });
    return sourceParentId !== targetParentId || destinationIndex !== sourceIndex;
  }

  function createMoveRecord(options) {
    const config = options && typeof options === 'object' ? options : {};
    const bookmarkId = String(config.bookmarkId || '');
    const from = normalizeLocation(config.from);
    const to = normalizeLocation(config.to);
    if (!bookmarkId || !from || !to) {
      return null;
    }
    return Object.freeze({
      bookmarkId,
      title: String(config.title || ''),
      from: Object.freeze(from),
      to: Object.freeze(to)
    });
  }

  function cloneBookmarkSnapshot(node) {
    if (!node || typeof node !== 'object') {
      return null;
    }
    const title = String(node.title || '');
    const url = node.url ? String(node.url) : '';
    const children = Array.isArray(node.children)
      ? node.children.map(cloneBookmarkSnapshot).filter(Boolean)
      : [];
    return Object.freeze({
      title,
      url,
      children: Object.freeze(children)
    });
  }

  function createDeleteRecord(options) {
    const config = options && typeof options === 'object' ? options : {};
    const bookmarkId = String(config.bookmarkId || '');
    const parentId = String(config.parentId || '');
    const index = Math.max(0, Math.round(Number(config.index) || 0));
    const snapshot = cloneBookmarkSnapshot(config.snapshot);
    if (!bookmarkId || !parentId || !snapshot) {
      return null;
    }
    return Object.freeze({
      kind: 'delete',
      bookmarkId,
      title: String(config.title || snapshot.title || ''),
      parentId,
      index,
      snapshot,
      runtime: {
        currentBookmarkId: ''
      }
    });
  }

  function normalizeHistoryRecord(record) {
    if (record && record.kind === 'shortcut-reorder') {
      return createShortcutReorderRecord(record);
    }
    if (record && record.kind === 'transfer') {
      return createTransferRecord(record);
    }
    if (record && record.kind === 'shortcut-delete') {
      return createShortcutDeleteRecord(record);
    }
    if (record && record.kind === 'shortcut-stack') {
      return createShortcutStackRecord(record);
    }
    if (record && record.kind === 'delete') {
      return createDeleteRecord(record);
    }
    return createMoveRecord(record);
  }

  function createShortcutDeleteRecord(options) {
    const config = options && typeof options === 'object' ? options : {};
    const snapshot = config.snapshot;
    if (!snapshot || !snapshot.id || !(snapshot.url || snapshot.folderId || snapshot.folderRef)) {
      return null;
    }
    return Object.freeze({
      kind: 'shortcut-delete',
      snapshot: Object.freeze(JSON.parse(JSON.stringify(snapshot))),
      index: Math.max(0, Math.round(Number(config.index) || 0)),
      iconDataUrl: String(config.iconDataUrl || '')
    });
  }

  function createTransferRecord(options) {
    const config = options && typeof options === 'object' ? options : {};
    const from = normalizeLocation(config.from);
    const to = normalizeLocation(config.to);
    const snapshot = cloneBookmarkSnapshot(config.snapshot);
    const beforeShortcut = config.beforeShortcut && createShortcutDeleteRecord(config.beforeShortcut);
    const afterShortcut = config.afterShortcut && createShortcutDeleteRecord(config.afterShortcut);
    if ((!from && !to) || !snapshot || (!beforeShortcut && !afterShortcut) ||
        (!snapshot.url && (!from || !to || !config.bookmarkId))) {
      return null;
    }
    return Object.freeze({
      kind: 'transfer',
      bookmarkId: String(config.bookmarkId || ''),
      snapshot,
      from: from && Object.freeze(from),
      to: to && Object.freeze(to),
      beforeShortcut: beforeShortcut || null,
      afterShortcut: afterShortcut || null,
      runtime: {
        currentBookmarkId: String(config.runtime && config.runtime.currentBookmarkId || config.bookmarkId || '')
      }
    });
  }

  // Stacking two website shortcuts creates a bookmark folder holding both
  // sites. `runtime` follows the folder through undo and redo: its current id,
  // and the location and name it had when last removed.
  function createShortcutStackRecord(options) {
    const config = options && typeof options === 'object' ? options : {};
    const snapshot = cloneBookmarkSnapshot(config.snapshot);
    const sources = (Array.isArray(config.sources) ? config.sources : [])
      .map((source) => source && createShortcutDeleteRecord(source));
    const folderShortcutId = String(config.folderShortcut && config.folderShortcut.id || '');
    if (!snapshot || snapshot.url || !snapshot.children.length || snapshot.children.some((child) => !child.url) ||
        sources.length !== 2 || sources.some((source) => !source || source.snapshot.type === 'folder') ||
        !folderShortcutId) {
      return null;
    }
    const runtime = config.runtime || {};
    return Object.freeze({
      kind: 'shortcut-stack',
      bookmarkId: String(config.bookmarkId || runtime.currentBookmarkId || ''),
      snapshot,
      sources: Object.freeze(sources),
      folderShortcut: Object.freeze({
        id: folderShortcutId,
        index: Math.max(0, Math.round(Number(config.folderShortcut.index) || 0))
      }),
      // The icon each stacked site keeps inside the folder, in child order.
      itemIcons: Object.freeze(snapshot.children.map((_child, index) => {
        const icon = Array.isArray(config.itemIcons) ? config.itemIcons[index] : null;
        return icon && typeof icon === 'object' ? Object.freeze({ ...icon }) : null;
      })),
      runtime: {
        currentBookmarkId: String(runtime.currentBookmarkId || config.bookmarkId || ''),
        location: normalizeLocation(runtime.location),
        title: String(runtime.title || snapshot.title)
      }
    });
  }

  // Undo removes a stacked folder only while it still holds exactly the
  // stacked sites, so it never deletes bookmarks added to the folder later.
  function isShortcutStackFolderIntact(node, snapshot) {
    const children = node && !node.url && Array.isArray(node.children) ? node.children : null;
    const expected = snapshot && Array.isArray(snapshot.children) ? snapshot.children : [];
    if (!children || children.length !== expected.length || children.some((child) => !child.url)) {
      return false;
    }
    const urls = (items) => items.map((item) => String(item.url)).sort();
    const actual = urls(children);
    return urls(expected).every((url, index) => url === actual[index]);
  }

  function createShortcutReorderRecord(options) {
    const config = options || {};
    const fromOrder = Array.isArray(config.fromOrder) ? config.fromOrder.map(String) : [];
    const toOrder = Array.isArray(config.toOrder) ? config.toOrder.map(String) : [];
    const fromIds = new Set(fromOrder);
    if (fromOrder.length < 2 || fromOrder.length !== toOrder.length ||
        fromIds.size !== fromOrder.length || new Set(toOrder).size !== toOrder.length ||
        fromOrder.some((id) => !id) || toOrder.some((id) => !fromIds.has(id)) ||
        fromOrder.every((id, index) => id === toOrder[index])) {
      return null;
    }
    return Object.freeze({
      kind: 'shortcut-reorder',
      fromOrder: Object.freeze(fromOrder),
      toOrder: Object.freeze(toOrder)
    });
  }

  function createBookmarkMoveHistory(options) {
    const config = options && typeof options === 'object' ? options : {};
    const maxEntries = Math.max(1, Math.round(Number(config.maxEntries) || 30));
    const undoStack = [];
    const redoStack = [];
    const bookmarkIds = new Map();

    function resolveBookmarkId(bookmarkId) {
      let id = String(bookmarkId || '');
      const seen = new Set();
      while (bookmarkIds.has(id) && !seen.has(id)) {
        seen.add(id);
        id = bookmarkIds.get(id);
      }
      return id;
    }

    function remapBookmarkId(previousId, nextId) {
      const resolvedId = resolveBookmarkId(previousId);
      const id = String(nextId || '');
      if (resolvedId && id && resolvedId !== id) {
        for (const key of bookmarkIds.keys()) {
          if (resolveBookmarkId(key) === resolvedId) bookmarkIds.set(key, id);
        }
        bookmarkIds.set(String(previousId), id);
      }
    }

    function push(record) {
      const normalized = normalizeHistoryRecord(record);
      if (!normalized) {
        return false;
      }
      undoStack.push(normalized);
      if (undoStack.length > maxEntries) {
        undoStack.splice(0, undoStack.length - maxEntries);
      }
      redoStack.length = 0;
      // Retain mappings only for the bounded history, rather than accumulating
      // an id for every bookmark recreated by repeated undo/redo cycles.
      const retainedIds = new Set(undoStack.map((item) => item.bookmarkId).filter(Boolean));
      const retainedMappings = [...bookmarkIds.keys()]
        .filter((id) => retainedIds.has(id))
        .map((id) => [id, resolveBookmarkId(id)]);
      bookmarkIds.clear();
      retainedMappings.forEach(([id, currentId]) => bookmarkIds.set(id, currentId));
      return true;
    }

    function peekUndo() {
      return undoStack[undoStack.length - 1] || null;
    }

    function peekRedo() {
      return redoStack[redoStack.length - 1] || null;
    }

    function commitUndo() {
      const record = undoStack.pop() || null;
      if (record) {
        redoStack.push(record);
      }
      return record;
    }

    function commitRedo() {
      const record = redoStack.pop() || null;
      if (record) {
        undoStack.push(record);
      }
      return record;
    }

    function clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      bookmarkIds.clear();
    }

    return Object.freeze({
      push,
      peekUndo,
      peekRedo,
      commitUndo,
      commitRedo,
      resolveBookmarkId,
      remapBookmarkId,
      clear,
      canUndo: () => undoStack.length > 0,
      canRedo: () => redoStack.length > 0
    });
  }

  return Object.freeze({
    canMoveBookmarkToLocation,
    canMoveBookmarkToFolder,
    cloneBookmarkSnapshot,
    createDeleteRecord,
    createShortcutDeleteRecord,
    createShortcutStackRecord,
    createTransferRecord,
    createShortcutReorderRecord,
    createBookmarkMoveHistory,
    createMoveRecord,
    getMoveApiDestinationIndex,
    isFolderInsideBookmark,
    isShortcutStackFolderIntact,
    normalizeMoveDestinationIndex,
    normalizeLocation
  });
});
