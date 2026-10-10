(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoNewtabCrossSurfaceDrag = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const BOOKMARK_TREE_ROOT_ID = '0';

  // Nearest-row insertion slot for a wrapping grid. `layoutItems` are
  // [{ rect }] in DOM order; the returned index is a position in that list.
  function getRowInsertionSlot(layoutItems, pointerX, pointerY) {
    const items = Array.isArray(layoutItems) ? layoutItems : [];
    if (!items.length || !Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
      return { index: 0, anchorIndex: -1, markerPosition: 'before' };
    }
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    items.forEach((item, itemIndex) => {
      const rect = item.rect;
      const verticalDistance = pointerY < rect.top
        ? rect.top - pointerY
        : pointerY > rect.bottom
          ? pointerY - rect.bottom
          : 0;
      if (verticalDistance < nearestDistance) {
        nearestDistance = verticalDistance;
        nearestIndex = itemIndex;
      }
    });
    const nearestRect = items[nearestIndex].rect;
    const rowIndexes = items
      .map((item, itemIndex) => itemIndex)
      .filter((itemIndex) => {
        const rect = items[itemIndex].rect;
        return Math.abs(rect.centerY - nearestRect.centerY) <=
          Math.max(8, Math.min(rect.height, nearestRect.height) / 2);
      })
      .sort((first, second) => items[first].rect.left - items[second].rect.left);
    const anchorIndex = rowIndexes.find((itemIndex) => pointerX < items[itemIndex].rect.centerX);
    if (anchorIndex !== undefined) {
      return { index: anchorIndex, anchorIndex, markerPosition: 'before' };
    }
    const lastRowIndex = rowIndexes[rowIndexes.length - 1];
    return { index: lastRowIndex + 1, anchorIndex: lastRowIndex, markerPosition: 'after' };
  }

  // The two items on either side of an insertion point, in DOM order.
  // `isSameLine(item, anchor)` drops a neighbour that wrapped to another row.
  function getInsertionGapNeighbors(items, anchor, markerPosition, isSameLine) {
    const list = Array.isArray(items) ? items : [];
    const index = anchor ? list.indexOf(anchor) : -1;
    if (index < 0) {
      return { before: null, after: null };
    }
    const isAfter = markerPosition === 'after';
    const before = isAfter ? anchor : list[index - 1] || null;
    const after = isAfter ? list[index + 1] || null : anchor;
    const keep = (item) => Boolean(item) &&
      (item === anchor || typeof isSameLine !== 'function' || isSameLine(item, anchor));
    return {
      before: keep(before) ? before : null,
      after: keep(after) ? after : null
    };
  }

  const INSERTION_GAP_ATTRIBUTE = 'data-drag-gap';
  const INSERTION_GAP_REST_MS = 240;

  function releaseInsertionGapElement(element) {
    const side = element.getAttribute(INSERTION_GAP_ATTRIBUTE);
    if (!side || side === 'rest') {
      return;
    }
    // Keep the transition rule while the neighbour slides back.
    element.setAttribute(INSERTION_GAP_ATTRIBUTE, 'rest');
    element._xInsertionGapRestTimer = setTimeout(() => {
      element._xInsertionGapRestTimer = 0;
      if (element.getAttribute(INSERTION_GAP_ATTRIBUTE) === 'rest') {
        element.removeAttribute(INSERTION_GAP_ATTRIBUTE);
      }
    }, INSERTION_GAP_REST_MS);
  }

  // Leans the neighbours of an insertion point apart. `owner` remembers the
  // leaning pair so the next call releases whichever is no longer adjacent.
  function setInsertionGap(owner, before, after) {
    if (!owner) {
      return;
    }
    const next = new Map();
    if (before) next.set(before, 'before');
    if (after && after !== before) next.set(after, 'after');
    const previous = owner.insertionGapElements instanceof Map ? owner.insertionGapElements : new Map();
    previous.forEach((side, element) => {
      if (!next.has(element)) releaseInsertionGapElement(element);
    });
    next.forEach((side, element) => {
      if (element._xInsertionGapRestTimer) {
        clearTimeout(element._xInsertionGapRestTimer);
        element._xInsertionGapRestTimer = 0;
      }
      if (element.getAttribute(INSERTION_GAP_ATTRIBUTE) !== side) {
        element.setAttribute(INSERTION_GAP_ATTRIBUTE, side);
      }
    });
    owner.insertionGapElements = next;
  }

  function isBookmarkFolderDropTarget(folderId, nodeMap) {
    const id = String(folderId || '');
    const node = id && nodeMap && typeof nodeMap.get === 'function'
      ? nodeMap.get(id)
      : null;
    return Boolean(node && !node.url && id !== BOOKMARK_TREE_ROOT_ID);
  }

  // Inserts `record` at `index`, or moves the shortcut that already has its
  // URL there instead of duplicating it. Returns null when the list is full.
  function planBookmarkToShortcut(options) {
    const config = options && typeof options === 'object' ? options : {};
    const shortcuts = Array.isArray(config.shortcuts) ? config.shortcuts.filter(Boolean) : [];
    const record = config.record;
    const folderId = (item) => typeof config.getFolderId === 'function' ? config.getFolderId(item) : item.folderId;
    const index = Number(config.index);
    if (!record || !(record.url || (record.type === 'folder' && (record.folderId || record.folderRef))) || !Number.isFinite(index)) {
      return null;
    }
    const existingIndex = shortcuts.findIndex((item) => record.type === 'folder'
      ? item.type === 'folder' && (item.id === record.id || (folderId(record) && folderId(item) === folderId(record)))
      : item.type !== 'folder' && item.url === record.url);
    if (existingIndex < 0 && shortcuts.length >= Number(config.maxShortcuts)) {
      return null;
    }
    const nextShortcuts = shortcuts.slice();
    const shortcut = existingIndex < 0
      ? record
      : nextShortcuts.splice(existingIndex, 1)[0];
    const insertionIndex = existingIndex >= 0 && index > existingIndex ? index - 1 : index;
    nextShortcuts.splice(Math.max(0, Math.min(nextShortcuts.length, insertionIndex)), 0, shortcut);
    return {
      shortcuts: nextShortcuts,
      shortcutId: String(shortcut.id || '')
    };
  }

  function planTransferShortcuts(options) {
    const config = options || {};
    const next = Array.isArray(config.shortcuts) ? config.shortcuts.slice() : [];
    const source = config.source && config.source.snapshot;
    const destination = config.destination && config.destination.snapshot;
    if (source) {
      const index = next.findIndex((item) => item.id === source.id);
      if (index < 0 || next[index].type !== source.type ||
          (source.type !== 'folder' &&
            (next[index].url !== source.url || next[index].title !== source.title))) {
        return null;
      }
      next.splice(index, 1);
    }
    if (destination) {
      const duplicate = next.some((item) => item.id === destination.id ||
        (destination.type !== 'folder' && item.type !== 'folder' && item.url === destination.url) ||
        (destination.type === 'folder' && !destination.folderRef &&
          item.type === 'folder' && !item.folderRef && item.folderId === destination.folderId));
      if (duplicate || next.length >= Number(config.maxShortcuts)) {
        return null;
      }
      next.splice(Math.min(config.destination.index, next.length), 0, destination);
    }
    return next;
  }

  // Stacking drops the website `sources` and puts the folder entry where the
  // stack target was. Undo removes the entry and restores each source at its
  // recorded index. Returns null when the shortcuts no longer match.
  function planShortcutStack(options) {
    const config = options || {};
    const shortcuts = Array.isArray(config.shortcuts) ? config.shortcuts.filter(Boolean) : [];
    const sources = Array.isArray(config.sources) ? config.sources : [];
    const folder = config.folder && config.folder.snapshot;
    if (sources.length < 2 || !folder || !folder.id) {
      return null;
    }
    const folderIndex = shortcuts.findIndex((item) => item.id === folder.id);
    if (config.undo) {
      if (folderIndex < 0 || shortcuts[folderIndex].type !== 'folder') {
        return null;
      }
      const next = shortcuts.slice();
      next.splice(folderIndex, 1);
      const conflict = sources.some(({ snapshot }) => next.some((item) => item.id === snapshot.id ||
        (item.type !== 'folder' && item.url === snapshot.url)));
      if (conflict || next.length + sources.length > Number(config.maxShortcuts)) {
        return null;
      }
      sources.slice().sort((first, second) => first.index - second.index).forEach((entry) => {
        next.splice(Math.min(entry.index, next.length), 0, entry.snapshot);
      });
      return next;
    }
    const ids = new Set(sources.map(({ snapshot }) => snapshot.id));
    const available = sources.every(({ snapshot }) => shortcuts.some((item) => item.id === snapshot.id &&
      item.type !== 'folder' && item.url === snapshot.url));
    if (folderIndex >= 0 || ids.size !== sources.length || !available) {
      return null;
    }
    const next = shortcuts.filter((item) => !ids.has(item.id));
    next.splice(Math.max(0, Math.min(Number(config.folder.index) || 0, next.length)), 0, folder);
    return next;
  }

  function planShortcutReorder(options) {
    const config = options || {};
    const shortcuts = Array.isArray(config.shortcuts) ? config.shortcuts : [];
    const order = Array.isArray(config.order) ? config.order : [];
    const ids = new Set(order);
    const byId = new Map(shortcuts.map((item) => [item.id, item]));
    if (!order.length || ids.size !== order.length || order.some((id) => !byId.has(id))) {
      return null;
    }
    const currentOrder = shortcuts.filter((item) => ids.has(item.id)).map((item) => item.id);
    if (config.sourceOrder && (config.sourceOrder.length !== currentOrder.length ||
        currentOrder.some((id, index) => id !== config.sourceOrder[index]))) {
      return null;
    }
    let index = 0;
    // Reorder the recorded entries in their current slots, preserving newer
    // shortcuts and the latest titles, icons and folder bindings.
    return shortcuts.map((item) => ids.has(item.id) ? byId.get(order[index++]) : item);
  }

  return Object.freeze({
    getInsertionGapNeighbors,
    getRowInsertionSlot,
    isBookmarkFolderDropTarget,
    setInsertionGap,
    planBookmarkToShortcut,
    planTransferShortcuts,
    planShortcutStack,
    planShortcutReorder
  });
});
