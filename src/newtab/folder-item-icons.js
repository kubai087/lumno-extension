(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoNewtabFolderItemIcons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';

  // Icons chosen for websites inside shortcut folders. Bookmarks have no icon
  // of their own, so these stay on this device, keyed by local bookmark id,
  // and only show where the folder is opened from a shortcut.
  const DEFAULT_STORAGE_KEY = '_x_extension_shortcut_folder_item_icons_2026_unique_';
  const MAX_DATA_URL_LENGTH = 192 * 1024;
  const IMAGE_SOURCES = new Set(['service', 'favicon-is', 'cache', 'custom']);
  const DATA_URL_PATTERN = /^data:image\/(?:png|webp|avif|svg\+xml|x-icon|vnd\.microsoft\.icon|jpeg|jpg|gif);base64,[a-z0-9+/=]+$/i;

  // 'builtin' is resolved from the bookmark's URL when shown; every other
  // source keeps the image it produced. The automatic default has no entry.
  function normalizeEntry(value) {
    const iconSource = value && typeof value === 'object' ? String(value.iconSource || '') : '';
    if (iconSource === 'builtin') {
      return { iconSource };
    }
    const dataUrl = String(value && value.dataUrl || '').trim();
    if (!IMAGE_SOURCES.has(iconSource) || dataUrl.length > MAX_DATA_URL_LENGTH || !DATA_URL_PATTERN.test(dataUrl)) {
      return null;
    }
    return { iconSource, dataUrl };
  }

  function normalizeMap(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const normalized = {};
    Object.keys(source).forEach((rawId) => {
      const id = String(rawId || '').trim();
      const entry = id && id.length <= 128 ? normalizeEntry(source[rawId]) : null;
      if (entry) normalized[id] = entry;
    });
    return normalized;
  }

  function createStore(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const storageArea = opts.storageArea || null;
    const storageKey = String(opts.storageKey || DEFAULT_STORAGE_KEY);
    const getLastError = () => {
      const chromeApi = opts.chrome || root.chrome;
      return chromeApi && chromeApi.runtime ? chromeApi.runtime.lastError : null;
    };
    let icons = {};
    let chain = Promise.resolve();

    const ready = new Promise((resolve) => {
      if (!storageArea || typeof storageArea.get !== 'function') {
        resolve();
        return;
      }
      storageArea.get([storageKey], (result) => {
        icons = getLastError() ? {} : normalizeMap(result && result[storageKey]);
        resolve();
      });
    });

    function write(next) {
      return new Promise((resolve, reject) => {
        if (!storageArea || typeof storageArea.set !== 'function') {
          reject(new Error('Folder item icon storage is unavailable.'));
          return;
        }
        storageArea.set({ [storageKey]: next }, () => {
          const error = getLastError();
          if (error) reject(new Error(error.message)); else resolve();
        });
      });
    }

    function get(bookmarkId) {
      const id = String(bookmarkId || '');
      return id && icons[id] ? { ...icons[id] } : null;
    }

    // Applies { [bookmarkId]: entry | null } and drops icons whose bookmark
    // no longer exists (`exists` is optional).
    function update(changes, exists) {
      const operation = chain.catch(() => {}).then(() => ready).then(() => {
        const next = { ...icons };
        Object.keys(changes || {}).forEach((rawId) => {
          const id = String(rawId || '').trim();
          const entry = normalizeEntry(changes[rawId]);
          if (!id) return;
          if (entry) next[id] = entry; else delete next[id];
        });
        if (typeof exists === 'function') {
          Object.keys(next).forEach((id) => { if (!exists(id)) delete next[id]; });
        }
        const normalized = normalizeMap(next);
        if (JSON.stringify(normalized) === JSON.stringify(icons)) return icons;
        return write(normalized).then(() => {
          icons = normalized;
          return icons;
        });
      });
      chain = operation;
      return operation;
    }

    return { ready, get, update };
  }

  return Object.freeze({ DEFAULT_STORAGE_KEY, normalizeEntry, normalizeMap, createStore });
});
