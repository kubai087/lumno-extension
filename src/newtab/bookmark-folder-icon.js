(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.LumnoNewtabBookmarkFolderIcon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const DEFAULT_FOLDER_COLOR = '#5393FF';
  // Legacy device-only map keyed by bookmark id. Ids differ on every device,
  // so it is migrated into the synced reference map below.
  const FOLDER_COLORS_STORAGE_KEY = '_x_extension_bookmark_folder_colors_2026_unique_';
  // Synced map keyed by a hash of the folder's root and title path. The
  // creation time travels with browser bookmark sync and re-finds a folder
  // after it is renamed or moved.
  const FOLDER_COLOR_REFS_STORAGE_KEY = '_x_extension_bookmark_folder_color_refs_2026_unique_';
  // Keeps the synced value well under the 8 KB browser sync item quota.
  const MAX_FOLDER_COLOR_REFS = 100;
  // Chrome numbers its roots; Firefox uses fixed GUIDs. Both map onto the same
  // types so folder colors follow a folder between the browsers.
  const ROOT_TYPES_BY_ID = {
    '1': 'bookmarks-bar', '2': 'other', '3': 'mobile',
    'toolbar_____': 'bookmarks-bar', 'unfiled_____': 'other', 'mobile______': 'mobile', 'menu________': 'menu'
  };
  const TREE_ROOT_IDS = new Set(['0', 'root________']);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  function normalizeFolderColorMap(value) {
    const result = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    Object.entries(value).forEach(([id, color]) => {
      if (/^[a-zA-Z0-9_-]+$/.test(id) && !['__proto__', 'constructor', 'prototype'].includes(id) && typeof color === 'string' && hexToRgb(color)) {
        result[id] = rgbToHex(hexToRgb(color)).toUpperCase();
      }
    });
    return result;
  }
  function hashFolderPath(path) {
    const text = JSON.stringify(path);
    let first = 2166136261;
    let second = 0x9e3779b9;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619);
      second = Math.imul(second ^ code, 2246822519);
    }
    return [first, second].map((value) => (value >>> 0).toString(16).padStart(8, '0')).join('');
  }
  // Maps every folder id to its portable reference. Same-name siblings are
  // told apart by their order among themselves.
  function collectFolderColorRefs(nodeMap) {
    const refs = new Map();
    if (!(nodeMap instanceof Map)) return refs;
    const top = nodeMap.get('0') || nodeMap.get('root________');
    const roots = top && Array.isArray(top.children)
      ? top.children
      : [...nodeMap.values()].filter((node) => TREE_ROOT_IDS.has(String(node.parentId)));
    function visit(node, path) {
      refs.set(String(node.id), hashFolderPath(path));
      if (path.length > 64) return;
      const seen = new Map();
      (node.children || []).forEach((child) => {
        if (!child || child.url || !child.id) return;
        const title = String(child.title || '');
        const ordinal = seen.get(title) || 0;
        seen.set(title, ordinal + 1);
        visit(child, [...path, ordinal ? [title, ordinal] : title]);
      });
    }
    roots.forEach((node) => {
      const rootType = node && !node.url && (node.folderType || ROOT_TYPES_BY_ID[String(node.id)]);
      if (rootType) visit(node, [rootType]);
    });
    return refs;
  }
  function normalizeFolderColorRefs(value) {
    const result = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    Object.entries(value).forEach(([ref, entry]) => {
      const rgb = entry && typeof entry === 'object' ? hexToRgb(entry.color) : null;
      if (!/^[a-f0-9]{16}$/.test(ref) || !rgb) return;
      const dateAdded = Number(entry.dateAdded);
      result[ref] = {
        color: rgbToHex(rgb).toUpperCase(),
        ...(Number.isFinite(dateAdded) && dateAdded > 0 ? { dateAdded } : {})
      };
    });
    const refs = Object.keys(result);
    refs.slice(0, Math.max(0, refs.length - MAX_FOLDER_COLOR_REFS)).forEach((ref) => { delete result[ref]; });
    return result;
  }
  function createFolderColorRef(nodeMap, folderId, color) {
    const node = nodeMap.get(String(folderId));
    const dateAdded = Number(node && node.dateAdded);
    return { color, ...(Number.isFinite(dateAdded) && dateAdded > 0 ? { dateAdded } : {}) };
  }
  // Returns the colors for this device's folder ids. A unique creation time
  // finds a folder through renames, moves and same-name sibling shifts; the
  // path decides otherwise. Entries for folders missing here are kept for
  // other devices. The caller writes `refs` back when `changed` is true.
  function resolveFolderColors(value, nodeMap) {
    const refs = normalizeFolderColorRefs(value);
    const folderRefs = collectFolderColorRefs(nodeMap);
    const idsByRef = new Map();
    const refsByDate = new Map();
    folderRefs.forEach((ref, id) => {
      idsByRef.set(ref, [...(idsByRef.get(ref) || []), id]);
      const dateAdded = Number(nodeMap.get(id).dateAdded) || 0;
      if (dateAdded > 0) refsByDate.set(dateAdded, new Set([...(refsByDate.get(dateAdded) || []), ref]));
    });
    const targets = new Map();
    const claimed = new Set();
    Object.entries(refs).forEach(([ref, entry]) => {
      const matches = entry.dateAdded ? [...(refsByDate.get(entry.dateAdded) || [])] : [];
      if (matches.length === 1 && !claimed.has(matches[0])) {
        targets.set(ref, matches[0]);
        claimed.add(matches[0]);
      }
    });
    // An entry whose path another folder took over has no folder here.
    Object.keys(refs).forEach((ref) => {
      if (targets.has(ref) || claimed.has(ref)) return;
      targets.set(ref, ref);
      claimed.add(ref);
    });
    const next = {};
    Object.entries(refs).forEach(([ref, entry]) => {
      if (targets.has(ref)) next[targets.get(ref)] = entry;
    });
    const colors = {};
    Object.entries(next).forEach(([ref, entry]) => {
      (idsByRef.get(ref) || []).forEach((id) => { colors[id] = entry.color; });
    });
    return { colors, refs: next, changed: Object.keys(refs).some((ref) => targets.get(ref) !== ref) };
  }
  // Returns the next synced map, or null when the folder cannot be referenced.
  function setFolderColorRef(value, folderId, color, nodeMap) {
    const refs = normalizeFolderColorRefs(value);
    const ref = collectFolderColorRefs(nodeMap).get(String(folderId));
    if (!ref) return null;
    delete refs[ref];
    const rgb = color ? hexToRgb(color) : null;
    if (rgb) refs[ref] = createFolderColorRef(nodeMap, folderId, rgbToHex(rgb).toUpperCase());
    return normalizeFolderColorRefs(refs);
  }
  // Adds legacy id-keyed colors without replacing colors already synced.
  function importFolderColorMap(colorMap, value, nodeMap) {
    const refs = normalizeFolderColorRefs(value);
    const folderRefs = collectFolderColorRefs(nodeMap);
    Object.entries(normalizeFolderColorMap(colorMap)).forEach(([id, color]) => {
      const ref = folderRefs.get(id);
      if (ref && !own(refs, ref)) refs[ref] = createFolderColorRef(nodeMap, id, color);
    });
    return normalizeFolderColorRefs(refs);
  }
  function getFigmaFolderSvg(idSuffix, folderId) {
    const suffix = String(idSuffix || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const colorId = String(folderId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const baseLowerFilterId = `x-nt-folder-filter-lower-base-${suffix}`;
    const baseUpperFilterId = `x-nt-folder-filter-upper-base-${suffix}`;
    const hoverLowerFilterId = `x-nt-folder-filter-lower-hover-${suffix}`;
    const hoverUpperFilterId = `x-nt-folder-filter-upper-hover-${suffix}`;
    const baseLowerGradientId = `x-nt-folder-gradient-lower-base-${suffix}`;
    const baseUpperGradientId = `x-nt-folder-gradient-upper-base-${suffix}`;
    const hoverLowerGradientId = `x-nt-folder-gradient-lower-hover-${suffix}`;
    const hoverUpperGradientId = `x-nt-folder-gradient-upper-hover-${suffix}`;
    const hoverUpperOverlayGradientId = `x-nt-folder-gradient-upper-overlay-hover-${suffix}`;
    const morphUpperGradientId = `x-nt-folder-gradient-upper-morph-${suffix}`;
    const morphUpperOverlayGradientId = `x-nt-folder-gradient-upper-overlay-morph-${suffix}`;
    // The closed shape spans y=2..23; center its geometry while leaving shadows visible.
    return `
      <svg data-folder-color-id="${colorId}" viewBox="0 -2 31 29" overflow="visible" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <g data-folder-layer="lower">
          <g class="x-nt-folder-shape x-nt-folder-shape--base" filter="url(#${baseLowerFilterId})">
            <path data-folder-part="lower-body" data-folder-fill-base="url(#${baseLowerGradientId})" data-folder-fill-hover="url(#${hoverLowerGradientId})" d="M7.24 2C6.08213 2 5.5032 2 5.06414 2.23247C4.70983 2.42007 4.42007 2.70983 4.23247 3.06414C4 3.5032 4 4.08213 4 5.24V19.76C4 20.9179 4 21.4968 4.23247 21.9359C4.42007 22.2902 4.70983 22.5799 5.06414 22.7675C5.5032 23 6.08213 23 7.24 23H23.76C24.9179 23 25.4968 23 25.9359 22.7675C26.2902 22.5799 26.5799 22.2902 26.7675 21.9359C27 21.4968 27 20.9179 27 19.76V8.24C27 7.08213 27 6.5032 26.7675 6.06414C26.5799 5.70983 26.2902 5.42007 25.9359 5.23247C25.4968 5 24.9179 5 23.76 5H16.2872C15.7668 5 15.5067 5 15.2631 4.93779C15.0647 4.88712 14.8753 4.80628 14.7014 4.69811C14.488 4.56531 14.308 4.37746 13.948 4.00178L12.9862 2.99822C12.6262 2.62254 12.4462 2.43469 12.2327 2.30189C12.0589 2.19372 11.8694 2.11288 11.6711 2.06221C11.4275 2 11.1673 2 10.647 2H7.24Z" fill="url(#${baseLowerGradientId})"/>
            <path data-folder-part="lower-outline" d="M7.24023 2.5H10.6465C11.1918 2.5 11.3785 2.50393 11.5469 2.54688C11.6957 2.58488 11.8384 2.64543 11.9688 2.72656C12.1163 2.8184 12.2478 2.95016 12.625 3.34375L13.5869 4.34766C13.9294 4.70501 14.1583 4.94931 14.4375 5.12305C14.6547 5.25816 14.8918 5.35857 15.1396 5.42188C15.4582 5.50321 15.7923 5.5 16.2871 5.5H23.7598C24.3471 5.5 24.7568 5.50049 25.0752 5.52734C25.3875 5.5537 25.5669 5.60319 25.7021 5.6748C25.9676 5.81544 26.1846 6.03242 26.3252 6.29785C26.3968 6.4331 26.4463 6.61249 26.4727 6.9248C26.4995 7.24322 26.5 7.65291 26.5 8.24023V19.7598C26.5 20.3471 26.4995 20.7568 26.4727 21.0752C26.4463 21.3875 26.3968 21.5669 26.3252 21.7021C26.1846 21.9676 25.9676 22.1846 25.7021 22.3252C25.5669 22.3968 25.3875 22.4463 25.0752 22.4727C24.7568 22.4995 24.3471 22.5 23.7598 22.5H7.24023C6.65291 22.5 6.24322 22.4995 5.9248 22.4727C5.61249 22.4463 5.4331 22.3968 5.29785 22.3252C5.03242 22.1846 4.81544 21.9676 4.6748 21.7021C4.60319 21.5669 4.5537 21.3875 4.52734 21.0752C4.50049 20.7568 4.5 20.3471 4.5 19.7598V5.24023C4.5 4.65291 4.50049 4.24322 4.52734 3.9248C4.5537 3.61249 4.60319 3.4331 4.6748 3.29785C4.81544 3.03242 5.03242 2.81544 5.29785 2.6748C5.4331 2.60319 5.61249 2.5537 5.9248 2.52734C6.24322 2.50049 6.65291 2.5 7.24023 2.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
          <g class="x-nt-folder-shape x-nt-folder-shape--hover" filter="url(#${hoverLowerFilterId})">
            <path data-folder-part-hover="lower-body" d="M7.27966 3C6.06845 3 5.46284 3 5.01299 3.24717C4.65028 3.44648 4.35832 3.75339 4.17738 4.12561C3.95298 4.58724 3.98322 5.19209 4.04371 6.4018L4.71971 19.9218C4.77497 21.027 4.8026 21.5797 5.04189 21.9962C5.23514 22.3326 5.52208 22.6056 5.86774 22.7818C6.29572 23 6.84904 23 7.95566 23H24.4374C25.6583 23 26.2687 23 26.7204 22.7502C27.0846 22.5488 27.3769 22.2388 27.5565 21.8635C27.7794 21.3979 27.7435 20.7885 27.6718 19.5697L27.053 9.04974C26.9885 7.95383 26.9563 7.40587 26.716 6.99327C26.5218 6.65999 26.2354 6.38996 25.8913 6.21572C25.4653 6 24.9164 6 23.8186 6H16.1608C15.6405 6 15.3803 6 15.1367 5.93779C14.9383 5.88712 14.7489 5.80628 14.5751 5.69811C14.3616 5.56531 14.1816 5.37746 13.8216 5.00178L12.8598 3.99822C12.4998 3.62254 12.3198 3.43469 12.1063 3.30189C11.9325 3.19372 11.7431 3.11288 11.5447 3.06221C11.3011 3 11.0409 3 10.5206 3H7.27966Z" fill="url(#${hoverLowerGradientId})"/>
            <path data-folder-part-hover="lower-outline" d="M7.27987 3.5H10.5201C11.0655 3.5 11.2521 3.50393 11.4205 3.54688C11.5693 3.58488 11.712 3.64543 11.8424 3.72656C11.9899 3.8184 12.1214 3.95016 12.4986 4.34375L13.4605 5.34766C13.803 5.70501 14.0319 5.94931 14.3111 6.12305C14.5283 6.25816 14.7654 6.35857 15.0133 6.42188C15.3318 6.50321 15.6659 6.5 16.1607 6.5H23.8189C24.3759 6.5 24.7636 6.50051 25.066 6.52539C25.362 6.54976 25.5338 6.59535 25.6656 6.66211C25.9236 6.7928 26.1382 6.99524 26.2838 7.24512C26.3581 7.37281 26.4139 7.54183 26.4556 7.83594C26.4982 8.13633 26.5216 8.5232 26.5543 9.0791L27.1724 19.5986C27.2088 20.2168 27.2344 20.6491 27.2252 20.9854C27.2161 21.3158 27.1734 21.5048 27.1051 21.6475C26.9703 21.929 26.7512 22.1615 26.4781 22.3125C26.3398 22.389 26.1537 22.4423 25.8248 22.4707C25.4896 22.4996 25.0563 22.5 24.4371 22.5H7.95565C7.3943 22.5 7.00355 22.4998 6.69881 22.4746C6.40048 22.45 6.22764 22.4034 6.09529 22.3359C5.83605 22.2038 5.62012 21.9994 5.47518 21.7471C5.40123 21.6183 5.34672 21.4481 5.30721 21.1514C5.26684 20.8482 5.24736 20.4574 5.21932 19.8965L4.54354 6.37695C4.51286 5.76336 4.49152 5.33461 4.5035 5.00098C4.51527 4.67332 4.5587 4.48532 4.62752 4.34375C4.7632 4.06493 4.98177 3.83493 5.2535 3.68555C5.39147 3.60973 5.57715 3.55741 5.90389 3.5293C6.23648 3.50069 6.66562 3.5 7.27987 3.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
        </g>
        <g data-folder-layer="file">
          <g class="x-nt-folder-shape x-nt-folder-shape--base">
            <path data-folder-part="file-body" d="M7 10C7 9.44772 7.44772 9 8 9H23C23.5523 9 24 9.44772 24 10V17C24 17.5523 23.5523 18 23 18H8C7.44772 18 7 17.5523 7 17V10Z" fill="var(--fill-0, white)"/>
            <path data-folder-part="file-line" d="M13 11L18 11" stroke="var(--stroke-0, #DDE8FB)" stroke-linecap="round"/>
          </g>
          <g class="x-nt-folder-shape x-nt-folder-shape--hover">
            <path data-folder-part-hover="file-body" d="M7.87362 10C7.87362 9.44772 8.32133 9 8.87362 9H23.8736C24.4259 9 24.8736 9.44772 24.8736 10V17C24.8736 17.5523 24.4259 18 23.8736 18H8.87362C8.32133 18 7.87362 17.5523 7.87362 17V10Z" fill="var(--fill-0, white)"/>
            <path data-folder-part-hover="file-line" d="M13.8736 11L18.8736 11" stroke="var(--stroke-0, #DDE8FB)" stroke-linecap="round"/>
          </g>
        </g>
        <g data-folder-layer="upper">
          <g class="x-nt-folder-shape x-nt-folder-shape--base">
            <g filter="url(#${baseUpperFilterId})">
              <path data-folder-part="upper-body" data-folder-fill-base="url(#${morphUpperGradientId})" data-folder-fill-hover="url(#${morphUpperGradientId})" d="M7.24 5C6.08213 5 5.5032 5 5.06414 5.23247C4.70983 5.42007 4.42007 5.70983 4.23247 6.06414C4 6.5032 4 7.08213 4 8.24V19.76C4 20.9179 4 21.4968 4.23247 21.9359C4.42007 22.2902 4.70983 22.5799 5.06414 22.7675C5.5032 23 6.08213 23 7.24 23H23.76C24.9179 23 25.4968 23 25.9359 22.7675C26.2902 22.5799 26.5799 22.2902 26.7675 21.9359C27 21.4968 27 20.9179 27 19.76V8.24C27 7.08213 27 6.5032 26.7675 6.06414C26.5799 5.70983 26.2902 5.42007 25.9359 5.23247C25.4968 5 24.9179 5 23.76 5H14.9046H7.24Z" fill="url(#${morphUpperGradientId})"/>
              <path data-folder-part="upper-overlay" data-folder-fill-base="url(#${morphUpperOverlayGradientId})" data-folder-fill-hover="url(#${morphUpperOverlayGradientId})" data-folder-opacity-base="0" data-folder-opacity-hover="1" d="M7.24 5C6.08213 5 5.5032 5 5.06414 5.23247C4.70983 5.42007 4.42007 5.70983 4.23247 6.06414C4 6.5032 4 7.08213 4 8.24V19.76C4 20.9179 4 21.4968 4.23247 21.9359C4.42007 22.2902 4.70983 22.5799 5.06414 22.7675C5.5032 23 6.08213 23 7.24 23H23.76C24.9179 23 25.4968 23 25.9359 22.7675C26.2902 22.5799 26.5799 22.2902 26.7675 21.9359C27 21.4968 27 20.9179 27 19.76V8.24C27 7.08213 27 6.5032 26.7675 6.06414C26.5799 5.70983 26.2902 5.42007 25.9359 5.23247C25.4968 5 24.9179 5 23.76 5H14.9046H7.24Z" fill="url(#${morphUpperOverlayGradientId})" opacity="0"/>
            </g>
            <path data-folder-part="upper-outline" d="M7.24023 5.5H23.7598C24.3471 5.5 24.7568 5.50049 25.0752 5.52734C25.3875 5.5537 25.5669 5.60319 25.7021 5.6748C25.9676 5.81544 26.1846 6.03242 26.3252 6.29785C26.3968 6.4331 26.4463 6.61249 26.4727 6.9248C26.4995 7.24322 26.5 7.65291 26.5 8.24023V19.7598C26.5 20.3471 26.4995 20.7568 26.4727 21.0752C26.4463 21.3875 26.3968 21.5669 26.3252 21.7021C26.1846 21.9676 25.9676 22.1846 25.7021 22.3252C25.5669 22.3968 25.3875 22.4463 25.0752 22.4727C24.7568 22.4995 24.3471 22.5 23.7598 22.5H7.24023C6.65291 22.5 6.24322 22.4995 5.9248 22.4727C5.61249 22.4463 5.4331 22.3968 5.29785 22.3252C5.03242 22.1846 4.81544 21.9676 4.6748 21.7021C4.60319 21.5669 4.5537 21.3875 4.52734 21.0752C4.50049 20.7568 4.5 20.3471 4.5 19.7598V8.24023C4.5 7.65291 4.50049 7.24322 4.52734 6.9248C4.5537 6.61249 4.60319 6.4331 4.6748 6.29785C4.81544 6.03242 5.03242 5.81544 5.29785 5.6748C5.4331 5.60319 5.61249 5.5537 5.9248 5.52734C6.24322 5.50049 6.65291 5.5 7.24023 5.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
          <g class="x-nt-folder-shape x-nt-folder-shape--hover">
            <g filter="url(#${hoverUpperFilterId})">
              <path data-folder-part-hover="upper-body" d="M9.52978 13C8.56387 13 8.08092 13 7.68721 13.1785C7.36853 13.3231 7.09334 13.5487 6.88913 13.8328C6.63684 14.1839 6.54213 14.6574 6.3527 15.6046L5.6487 19.1246C5.37742 20.481 5.24179 21.1591 5.43499 21.6872C5.59036 22.1119 5.88507 22.4713 6.27102 22.707C6.75093 23 7.44255 23 8.82578 23H25.2175C26.1834 23 26.6663 23 27.06 22.8215C27.3787 22.6769 27.6539 22.4513 27.8581 22.1672C28.1104 21.8161 28.2051 21.3426 28.3945 20.3954L29.0985 16.8754C29.3698 15.519 29.5054 14.8409 29.3122 14.3128C29.1569 13.8881 28.8622 13.5287 28.4762 13.293C27.9963 13 27.3047 13 25.9215 13H17.7782H9.52978Z" fill="url(#${hoverUpperGradientId})"/>
              <path data-folder-part-hover="upper-overlay" d="M9.52978 13C8.56387 13 8.08092 13 7.68721 13.1785C7.36853 13.3231 7.09334 13.5487 6.88913 13.8328C6.63684 14.1839 6.54213 14.6574 6.3527 15.6046L5.6487 19.1246C5.37742 20.481 5.24179 21.1591 5.43499 21.6872C5.59036 22.1119 5.88507 22.4713 6.27102 22.707C6.75093 23 7.44255 23 8.82578 23H25.2175C26.1834 23 26.6663 23 27.06 22.8215C27.3787 22.6769 27.6539 22.4513 27.8581 22.1672C28.1104 21.8161 28.2051 21.3426 28.3945 20.3954L29.0985 16.8754C29.3698 15.519 29.5054 14.8409 29.3122 14.3128C29.1569 13.8881 28.8622 13.5287 28.4762 13.293C27.9963 13 27.3047 13 25.9215 13H17.7782H9.52978Z" fill="url(#${hoverUpperOverlayGradientId})"/>
            </g>
            <path data-folder-part-hover="upper-outline" d="M9.52987 13.5H25.9215C26.6224 13.5 27.1147 13.5001 27.4928 13.5342C27.866 13.5679 28.0704 13.6312 28.2154 13.7197C28.5048 13.8964 28.7258 14.166 28.8424 14.4844C28.9007 14.6439 28.9225 14.8569 28.8824 15.2295C28.8417 15.6069 28.7455 16.09 28.608 16.7773L27.9039 20.2969C27.8077 20.7777 27.741 21.1113 27.6685 21.3691C27.5978 21.6206 27.5306 21.7653 27.4517 21.875C27.2986 22.0881 27.0921 22.2578 26.8531 22.3662C26.7301 22.4219 26.5753 22.4595 26.315 22.4795C26.0479 22.5 25.7079 22.5 25.2174 22.5H8.82576C8.12483 22.5 7.63254 22.4999 7.25447 22.4658C6.88123 22.4321 6.67684 22.3688 6.53182 22.2803C6.24245 22.1036 6.02143 21.834 5.90487 21.5156C5.84649 21.3561 5.8247 21.1431 5.86483 20.7705C5.90551 20.3931 6.00177 19.91 6.13924 19.2227L6.84334 15.7031C6.93951 15.2223 7.00623 14.8887 7.07869 14.6309C7.14939 14.3794 7.21668 14.2347 7.29549 14.125C7.44865 13.9119 7.65511 13.7422 7.89412 13.6338C8.0171 13.5781 8.17191 13.5405 8.43221 13.5205C8.69934 13.5 9.03932 13.5 9.52987 13.5Z" stroke="var(--stroke-0, #5393FF)"/>
          </g>
        </g>
        <defs>
          <filter id="${baseLowerFilterId}" x="0" y="0" width="31" height="29" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="2"/>
            <feGaussianBlur stdDeviation="2"/>
            <feComposite in2="hardAlpha" operator="out"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0.541176 0 0 0 0 0.713726 0 0 0 0 1 0 0 0 0.21 0"/>
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
          </filter>
          <filter id="${hoverLowerFilterId}" x="0" y="1" width="31.7267" height="28" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="2"/>
            <feGaussianBlur stdDeviation="2"/>
            <feComposite in2="hardAlpha" operator="out"/>
            <feColorMatrix type="matrix" values="0 0 0 0 0.541176 0 0 0 0 0.713726 0 0 0 0 1 0 0 0 0.21 0"/>
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
          </filter>
          <filter id="${baseUpperFilterId}" x="3.5" y="5" width="26" height="18.8" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="0.8"/>
            <feGaussianBlur stdDeviation="0.7"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.72 0"/>
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow"/>
          </filter>
          <filter id="${hoverUpperFilterId}" x="5.34419" y="13" width="24.0589" height="10.8" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
            <feFlood flood-opacity="0" result="BackgroundImageFix"/>
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
            <feOffset dy="0.8"/>
            <feGaussianBlur stdDeviation="0.7"/>
            <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
            <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.72 0"/>
            <feBlend mode="normal" in2="shape" result="effect1_innerShadow"/>
          </filter>
          <linearGradient id="${baseLowerGradientId}" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#93BBFF"/>
            <stop offset="0.884515" stop-color="#81B0FF"/>
            <stop offset="0.884615" stop-color="#4389FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${baseUpperGradientId}" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#CCDFFF"/>
            <stop offset="0.884515" stop-color="#B2CEFF"/>
            <stop offset="0.884615" stop-color="#89B5FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${hoverLowerGradientId}" x1="16.3736" y1="2" x2="16.3736" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#93BBFF"/>
            <stop offset="0.884515" stop-color="#81B0FF"/>
            <stop offset="0.884615" stop-color="#4389FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${hoverUpperGradientId}" x1="16.3736" y1="2" x2="16.3736" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#93BBFF"/>
            <stop offset="0.884515" stop-color="#81B0FF"/>
            <stop offset="0.884615" stop-color="#4389FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${hoverUpperOverlayGradientId}" x1="17.3736" y1="11.3333" x2="17.3736" y2="23" gradientUnits="userSpaceOnUse">
            <stop stop-color="#CCDFFF"/>
            <stop offset="0.884515" stop-color="#B2CEFF"/>
            <stop offset="0.884615" stop-color="#89B5FF"/>
            <stop offset="1" stop-color="#97BEFF"/>
          </linearGradient>
          <linearGradient id="${morphUpperGradientId}" data-folder-gradient-morph="upper-main" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#CCDFFF"></stop>
            <stop offset="0.884515" stop-color="#B2CEFF"></stop>
            <stop offset="0.884615" stop-color="#89B5FF"></stop>
            <stop offset="1" stop-color="#97BEFF"></stop>
          </linearGradient>
          <linearGradient id="${morphUpperOverlayGradientId}" data-folder-gradient-morph="upper-overlay" x1="15.5" y1="2" x2="15.5" y2="23" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#CCDFFF"></stop>
            <stop offset="0.884515" stop-color="#B2CEFF"></stop>
            <stop offset="0.884615" stop-color="#89B5FF"></stop>
            <stop offset="1" stop-color="#97BEFF"></stop>
          </linearGradient>
        </defs>
      </svg>
    `;
  }

  const FOLDER_PATH_MORPH_DURATION_MS = 460;
  const FOLDER_PATH_MORPH_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const FOLDER_PATH_MORPH_POINT_SAMPLE_COUNT = 140;
  const FOLDER_PATH_MORPH_BEZIER = {
    x1: 0.22,
    y1: 1,
    x2: 0.36,
    y2: 1
  };

  function cubicBezierSampleCurveX(t, x1, x2) {
    const inv = 1 - t;
    return 3 * inv * inv * t * x1 + 3 * inv * t * t * x2 + t * t * t;
  }

  function cubicBezierSampleCurveY(t, y1, y2) {
    const inv = 1 - t;
    return 3 * inv * inv * t * y1 + 3 * inv * t * t * y2 + t * t * t;
  }

  function cubicBezierSampleCurveDerivativeX(t, x1, x2) {
    const inv = 1 - t;
    return 3 * inv * inv * x1 + 6 * inv * t * (x2 - x1) + 3 * t * t * (1 - x2);
  }

  function cubicBezierEase(progress, bezier) {
    const clamped = Math.max(0, Math.min(1, progress));
    if (clamped === 0 || clamped === 1) {
      return clamped;
    }
    let t = clamped;
    for (let i = 0; i < 8; i += 1) {
      const x = cubicBezierSampleCurveX(t, bezier.x1, bezier.x2) - clamped;
      const dx = cubicBezierSampleCurveDerivativeX(t, bezier.x1, bezier.x2);
      if (Math.abs(x) < 1e-6 || Math.abs(dx) < 1e-6) {
        break;
      }
      t -= x / dx;
    }
    t = Math.max(0, Math.min(1, t));
    return cubicBezierSampleCurveY(t, bezier.y1, bezier.y2);
  }

  function buildPathMorphTemplate(fromD, toD) {
    const numberPattern = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
    const fromNumbers = (String(fromD || '').match(numberPattern) || []).map((value) => Number(value));
    const toNumbers = (String(toD || '').match(numberPattern) || []).map((value) => Number(value));
    if (!fromNumbers.length || fromNumbers.length !== toNumbers.length) {
      return null;
    }
    const fromMask = String(fromD).replace(numberPattern, '#');
    const toMask = String(toD).replace(numberPattern, '#');
    if (fromMask !== toMask) {
      return null;
    }
    const segments = String(fromD).split(numberPattern);
    return { type: 'number', segments, fromNumbers, toNumbers };
  }

  function composeNumberPathD(segments, numbers) {
    let output = '';
    for (let i = 0; i < numbers.length; i += 1) {
      output += `${segments[i]}${Number(numbers[i].toFixed(6))}`;
    }
    output += segments[numbers.length] || '';
    return output;
  }

  function isClosedPathData(d) {
    return /[zZ]\s*$/.test(String(d || '').trim());
  }

  function samplePathPoints(svgEl, d, sampleCount) {
    if (!svgEl || !d) {
      return null;
    }
    const count = Math.max(8, sampleCount | 0);
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', d);
    tempPath.setAttribute('fill', 'none');
    tempPath.setAttribute('stroke', 'none');
    tempPath.style.opacity = '0';
    tempPath.style.pointerEvents = 'none';
    svgEl.appendChild(tempPath);
    try {
      const total = tempPath.getTotalLength();
      if (!Number.isFinite(total) || total <= 0) {
        return null;
      }
      const closed = isClosedPathData(d);
      const points = [];
      const divisor = closed ? count : Math.max(1, count - 1);
      for (let i = 0; i < count; i += 1) {
        const ratio = i / divisor;
        const len = Math.max(0, Math.min(total, total * ratio));
        const point = tempPath.getPointAtLength(len);
        points.push({ x: point.x, y: point.y });
      }
      return { points, closed };
    } catch (error) {
      return null;
    } finally {
      svgEl.removeChild(tempPath);
    }
  }

  function buildPointMorphTemplate(pathEl, fromD, toD) {
    if (!pathEl) {
      return null;
    }
    const svgEl = pathEl.closest('svg');
    if (!svgEl) {
      return null;
    }
    const sampleCount = FOLDER_PATH_MORPH_POINT_SAMPLE_COUNT;
    const fromData = samplePathPoints(svgEl, fromD, sampleCount);
    const toData = samplePathPoints(svgEl, toD, sampleCount);
    if (!fromData || !toData || fromData.points.length !== toData.points.length) {
      return null;
    }
    const closed = fromData.closed && toData.closed;
    let fromPoints = fromData.points;
    let toPoints = toData.points;
    if (closed && fromPoints.length > 4) {
      const alignClosedPoints = (sourcePoints, targetPoints) => {
        const rotatePoints = (points, shift) => {
          const len = points.length;
          const normalizedShift = ((shift % len) + len) % len;
          if (!normalizedShift) {
            return points.slice();
          }
          return points.slice(normalizedShift).concat(points.slice(0, normalizedShift));
        };
        const reversePoints = (points) => points.slice().reverse();
        const calcScore = (aPoints, bPoints) => {
          let total = 0;
          for (let i = 0; i < aPoints.length; i += 1) {
            const dx = aPoints[i].x - bPoints[i].x;
            const dy = aPoints[i].y - bPoints[i].y;
            total += dx * dx + dy * dy;
          }
          return total;
        };
        let best = targetPoints.slice();
        let bestScore = Number.POSITIVE_INFINITY;
        const directions = [targetPoints, reversePoints(targetPoints)];
        for (let dirIndex = 0; dirIndex < directions.length; dirIndex += 1) {
          const dirPoints = directions[dirIndex];
          for (let shift = 0; shift < dirPoints.length; shift += 1) {
            const candidate = rotatePoints(dirPoints, shift);
            const score = calcScore(sourcePoints, candidate);
            if (score < bestScore) {
              bestScore = score;
              best = candidate;
            }
          }
        }
        return best;
      };
      toPoints = alignClosedPoints(fromPoints, toPoints);
    }
    return {
      type: 'point',
      fromPoints,
      toPoints,
      closed
    };
  }

  function composePointPathD(points, closed) {
    if (!Array.isArray(points) || !points.length) {
      return '';
    }
    let d = `M ${Number(points[0].x.toFixed(6))} ${Number(points[0].y.toFixed(6))}`;
    for (let i = 1; i < points.length; i += 1) {
      d += ` L ${Number(points[i].x.toFixed(6))} ${Number(points[i].y.toFixed(6))}`;
    }
    if (closed) {
      d += ' Z';
    }
    return d;
  }

  function cancelFolderPathMorph(part) {
    if (!part) {
      return;
    }
    if (part.animationFrameId) {
      cancelAnimationFrame(part.animationFrameId);
      part.animationFrameId = 0;
    }
  }

  function hexToRgb(hex) {
    const raw = String(hex || '').trim();
    const normalized = raw.startsWith('#') ? raw.slice(1) : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
      return null;
    }
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16)
    };
  }

  function rgbToHex(rgb) {
    const toHex = (value) => {
      const v = Math.max(0, Math.min(255, Math.round(value)));
      return v.toString(16).padStart(2, '0');
    };
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  function tintFolderColor(source, color) {
    if (color.toUpperCase() === '#5393FF') return source;
    const sourceRgb = hexToRgb(source);
    const selected = hexToRgb(color);
    if (!sourceRgb || !selected) return source;
    const reference = { r: 83, g: 147, b: 255 };
    const tinted = {};
    // Preserve the original highlights and shaded edges relative to the outline.
    ['r', 'g', 'b'].forEach((channel) => {
      const amount = channel === 'b'
        ? (sourceRgb.r - reference.r) / (255 - reference.r)
        : (sourceRgb[channel] - reference[channel]) / (255 - reference[channel]);
      tinted[channel] = amount >= 0
        ? selected[channel] + (255 - selected[channel]) * amount
        : selected[channel] * (1 + amount);
    });
    return rgbToHex(tinted);
  }

  function applyFolderColor(folderIcon, value) {
    const svg = folderIcon && folderIcon.querySelector('svg');
    if (!svg) return;
    const selected = hexToRgb(value);
    const color = selected ? rgbToHex(selected).toUpperCase() : DEFAULT_FOLDER_COLOR;
    if (folderIcon._xFolderColor === color && svg.getAttribute('data-folder-color') === color) return;
    folderIcon._xFolderColor = color;
    svg.setAttribute('data-folder-color', color);
    svg.querySelectorAll('[data-folder-part$="-outline"], [data-folder-part-hover$="-outline"]').forEach((path) => {
      path.setAttribute('stroke', color);
    });
    svg.querySelectorAll('linearGradient:not([data-folder-gradient-morph]) stop').forEach((stop) => {
      const source = stop.getAttribute('data-folder-base-color') || stop.getAttribute('stop-color');
      stop.setAttribute('data-folder-base-color', source);
      stop.setAttribute('stop-color', tintFolderColor(source, color));
    });
    svg.querySelectorAll('feColorMatrix').forEach((matrix) => {
      const original = matrix.getAttribute('data-folder-base-shadow') || matrix.getAttribute('values');
      if (!original || !original.includes('0.541176')) return;
      matrix.setAttribute('data-folder-base-shadow', original);
      if (color === DEFAULT_FOLDER_COLOR) { matrix.setAttribute('values', original); return; }
      const shadow = hexToRgb(tintFolderColor('#8AB6FF', color));
      matrix.setAttribute('values', `0 0 0 0 ${shadow.r / 255} 0 0 0 0 ${shadow.g / 255} 0 0 0 0 ${shadow.b / 255} 0 0 0 0.21 0`);
    });
    initFolderUpperGradientMorph(folderIcon);
    const morph = folderIcon._xUpperGradientMorph;
    if (morph) {
      if (morph.rafId) { cancelAnimationFrame(morph.rafId); morph.rafId = 0; }
      ['baseMain', 'hoverMain', 'baseOverlay', 'hoverOverlay'].forEach((key) => {
        morph[key].stops.forEach((stop) => {
          stop.baseColor = stop.baseColor || stop.color;
          stop.color = tintFolderColor(stop.baseColor, color);
        });
      });
      const isOpen = folderIcon._xFolderMorphState === 'hover';
      morph.state = isOpen ? 'hover' : 'base';
      applyGradientMorphConfig(morph.mainGradientEl, isOpen ? morph.hoverMain : morph.baseMain);
      applyGradientMorphConfig(morph.overlayGradientEl, isOpen ? morph.hoverOverlay : morph.baseOverlay);
    }
  }

  function lerpNumber(fromValue, toValue, t) {
    return fromValue + (toValue - fromValue) * t;
  }

  function applyGradientMorphConfig(gradientEl, config) {
    if (!gradientEl || !config) {
      return;
    }
    gradientEl.setAttribute('x1', String(config.x1));
    gradientEl.setAttribute('y1', String(config.y1));
    gradientEl.setAttribute('x2', String(config.x2));
    gradientEl.setAttribute('y2', String(config.y2));
    const stops = gradientEl.querySelectorAll('stop');
    config.stops.forEach((stopConfig, index) => {
      const stopEl = stops[index];
      if (!stopEl) {
        return;
      }
      stopEl.setAttribute('offset', String(stopConfig.offset));
      stopEl.setAttribute('stop-color', stopConfig.color);
    });
  }

  function interpolateGradientConfig(fromConfig, toConfig, t) {
    const progress = Math.max(0, Math.min(1, t));
    const next = {
      x1: Number(lerpNumber(fromConfig.x1, toConfig.x1, progress).toFixed(6)),
      y1: Number(lerpNumber(fromConfig.y1, toConfig.y1, progress).toFixed(6)),
      x2: Number(lerpNumber(fromConfig.x2, toConfig.x2, progress).toFixed(6)),
      y2: Number(lerpNumber(fromConfig.y2, toConfig.y2, progress).toFixed(6)),
      stops: []
    };
    for (let i = 0; i < fromConfig.stops.length; i += 1) {
      const fromStop = fromConfig.stops[i];
      const toStop = toConfig.stops[i];
      if (!fromStop || !toStop) {
        continue;
      }
      const fromRgb = hexToRgb(fromStop.color);
      const toRgb = hexToRgb(toStop.color);
      const color = (fromRgb && toRgb)
        ? rgbToHex({
          r: lerpNumber(fromRgb.r, toRgb.r, progress),
          g: lerpNumber(fromRgb.g, toRgb.g, progress),
          b: lerpNumber(fromRgb.b, toRgb.b, progress)
        })
        : (progress < 0.5 ? fromStop.color : toStop.color);
      next.stops.push({
        offset: Number(lerpNumber(fromStop.offset, toStop.offset, progress).toFixed(6)),
        color
      });
    }
    return next;
  }

  function initFolderUpperGradientMorph(folderIcon) {
    if (!folderIcon || folderIcon._xUpperGradientMorph) {
      return;
    }
    const svg = folderIcon.querySelector('svg');
    if (!svg) {
      return;
    }
    const mainGradientEl = svg.querySelector('[data-folder-gradient-morph="upper-main"]');
    const overlayGradientEl = svg.querySelector('[data-folder-gradient-morph="upper-overlay"]');
    if (!mainGradientEl || !overlayGradientEl) {
      return;
    }
    const baseMain = {
      x1: 15.5, y1: 2, x2: 15.5, y2: 23,
      stops: [
        { offset: 0, color: '#CCDFFF' },
        { offset: 0.884515, color: '#B2CEFF' },
        { offset: 0.884615, color: '#89B5FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    const hoverMain = {
      x1: 16.3736, y1: 2, x2: 16.3736, y2: 23,
      stops: [
        { offset: 0, color: '#93BBFF' },
        { offset: 0.884515, color: '#81B0FF' },
        { offset: 0.884615, color: '#4389FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    const baseOverlay = {
      x1: 15.5, y1: 2, x2: 15.5, y2: 23,
      stops: [
        { offset: 0, color: '#CCDFFF' },
        { offset: 0.884515, color: '#B2CEFF' },
        { offset: 0.884615, color: '#89B5FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    const hoverOverlay = {
      x1: 17.3736, y1: 11.3333, x2: 17.3736, y2: 23,
      stops: [
        { offset: 0, color: '#CCDFFF' },
        { offset: 0.827284, color: '#B2CEFF' },
        { offset: 0.85339, color: '#89B5FF' },
        { offset: 1, color: '#97BEFF' }
      ]
    };
    folderIcon._xUpperGradientMorph = {
      mainGradientEl,
      overlayGradientEl,
      baseMain,
      hoverMain,
      baseOverlay,
      hoverOverlay,
      state: 'base',
      rafId: 0
    };
    applyGradientMorphConfig(mainGradientEl, baseMain);
    applyGradientMorphConfig(overlayGradientEl, baseOverlay);
  }

  function playFolderUpperGradientMorph(folderIcon, toHover) {
    if (!folderIcon) {
      return;
    }
    if (!folderIcon._xUpperGradientMorph) {
      initFolderUpperGradientMorph(folderIcon);
    }
    const morphState = folderIcon._xUpperGradientMorph;
    if (!morphState) {
      return;
    }
    const targetState = toHover ? 'hover' : 'base';
    if (morphState.state === targetState) {
      return;
    }
    morphState.state = targetState;
    if (morphState.rafId) {
      cancelAnimationFrame(morphState.rafId);
      morphState.rafId = 0;
    }
    const fromMain = toHover ? morphState.baseMain : morphState.hoverMain;
    const toMain = toHover ? morphState.hoverMain : morphState.baseMain;
    const fromOverlay = toHover ? morphState.baseOverlay : morphState.hoverOverlay;
    const toOverlay = toHover ? morphState.hoverOverlay : morphState.baseOverlay;
    const startTime = performance.now();
    const tick = (now) => {
      const rawProgress = Math.max(0, Math.min(1, (now - startTime) / FOLDER_PATH_MORPH_DURATION_MS));
      const eased = cubicBezierEase(rawProgress, FOLDER_PATH_MORPH_BEZIER);
      applyGradientMorphConfig(morphState.mainGradientEl, interpolateGradientConfig(fromMain, toMain, eased));
      applyGradientMorphConfig(morphState.overlayGradientEl, interpolateGradientConfig(fromOverlay, toOverlay, eased));
      if (rawProgress < 1) {
        morphState.rafId = requestAnimationFrame(tick);
        return;
      }
      morphState.rafId = 0;
      applyGradientMorphConfig(morphState.mainGradientEl, toMain);
      applyGradientMorphConfig(morphState.overlayGradientEl, toOverlay);
    };
    morphState.rafId = requestAnimationFrame(tick);
  }

  function setFolderUpperFilterSuspended(folderIcon, suspended) {
    if (!folderIcon) {
      return;
    }
    const svg = folderIcon.querySelector('svg');
    if (!svg) {
      return;
    }
    const upperFilterGroup = svg.querySelector('g[data-folder-layer="upper"] .x-nt-folder-shape--base > g[filter]');
    if (!upperFilterGroup) {
      return;
    }
    if (suspended) {
      if (typeof upperFilterGroup._xOriginalFilterAttr === 'undefined') {
        upperFilterGroup._xOriginalFilterAttr = upperFilterGroup.getAttribute('filter');
      }
      upperFilterGroup.setAttribute('filter', 'none');
      return;
    }
    const original = upperFilterGroup._xOriginalFilterAttr;
    if (typeof original === 'string' && original) {
      upperFilterGroup.setAttribute('filter', original);
    } else {
      upperFilterGroup.removeAttribute('filter');
    }
  }

  function animatePathDWithCurve(part, fromD, toD) {
    let template = buildPathMorphTemplate(fromD, toD);
    if (!template) {
      template = buildPointMorphTemplate(part.pathEl, fromD, toD);
    }
    if (!template) {
      part.pathEl.setAttribute('d', toD);
      return false;
    }
    cancelFolderPathMorph(part);
    const startTime = performance.now();
    const syncFollowers = (dValue) => {
      if (!part || !Array.isArray(part.linkedFollowers) || !part.linkedFollowers.length) {
        return;
      }
      part.linkedFollowers.forEach((el) => {
        if (el && typeof el.setAttribute === 'function') {
          el.setAttribute('d', dValue);
        }
      });
    };
    const tick = (now) => {
      const elapsed = now - startTime;
      const rawProgress = Math.max(0, Math.min(1, elapsed / FOLDER_PATH_MORPH_DURATION_MS));
      const eased = cubicBezierEase(rawProgress, FOLDER_PATH_MORPH_BEZIER);
      if (template.type === 'number') {
        const values = template.fromNumbers.map((fromValue, index) => {
          const toValue = template.toNumbers[index];
          return fromValue + (toValue - fromValue) * eased;
        });
        const nextD = composeNumberPathD(template.segments, values);
        part.pathEl.setAttribute('d', nextD);
        syncFollowers(nextD);
      } else {
        const points = template.fromPoints.map((fromPoint, index) => {
          const toPoint = template.toPoints[index];
          return {
            x: fromPoint.x + (toPoint.x - fromPoint.x) * eased,
            y: fromPoint.y + (toPoint.y - fromPoint.y) * eased
          };
        });
        const nextD = composePointPathD(points, template.closed);
        part.pathEl.setAttribute('d', nextD);
        syncFollowers(nextD);
      }
      if (rawProgress < 1) {
        part.animationFrameId = requestAnimationFrame(tick);
        return;
      }
      part.pathEl.setAttribute('d', toD);
      syncFollowers(toD);
      part.animationFrameId = 0;
    };
    part.animationFrameId = requestAnimationFrame(tick);
    return true;
  }

  function initFolderPathMorph(folderIcon) {
    if (!folderIcon) return;
    const svg = folderIcon.querySelector('svg');
    if (folderIcon._xFolderMorphParts && folderIcon._xFolderMorphSvg === svg) return;
    if (folderIcon._xFolderMorphParts) {
      folderIcon._xFolderMorphParts.forEach(cancelFolderPathMorph);
      const previous = folderIcon._xUpperGradientMorph;
      if (previous && previous.rafId) cancelAnimationFrame(previous.rafId);
      delete folderIcon._xUpperGradientMorph;
    }
    folderIcon._xFolderMorphSvg = svg;
    if (!svg) {
      folderIcon._xFolderMorphParts = [];
      return;
    }
    const hoverPathMap = new Map();
    svg.querySelectorAll('[data-folder-part-hover]').forEach((pathEl) => {
      const partName = pathEl.getAttribute('data-folder-part-hover');
      const partD = pathEl.getAttribute('d');
      if (!partName || !partD) {
        return;
      }
      hoverPathMap.set(partName, partD);
    });
    const parts = [];
    svg.querySelectorAll('[data-folder-part]').forEach((pathEl) => {
      const partName = pathEl.getAttribute('data-folder-part');
      const baseD = pathEl.getAttribute('d');
      const hoverD = hoverPathMap.get(partName);
      if (!partName || !baseD || !hoverD) {
        return;
      }
      parts.push({
        partName,
        pathEl,
        baseD,
        hoverD,
        fillBase: pathEl.getAttribute('data-folder-fill-base') || '',
        fillHover: pathEl.getAttribute('data-folder-fill-hover') || '',
        opacityBase: Number.parseFloat(pathEl.getAttribute('data-folder-opacity-base')),
        opacityHover: Number.parseFloat(pathEl.getAttribute('data-folder-opacity-hover')),
        linkedFollowers: [],
        animationFrameId: 0
      });
    });
    const partMap = new Map();
    parts.forEach((part) => {
      partMap.set(part.partName, part);
    });
    const upperBodyPart = partMap.get('upper-body');
    const upperOverlayPart = partMap.get('upper-overlay');
    if (upperBodyPart && upperOverlayPart) {
      upperBodyPart.linkedFollowers.push(upperOverlayPart.pathEl);
    }
    parts.forEach((part) => {
      if (part.fillBase) {
        part.pathEl.setAttribute('fill', part.fillBase);
      }
      if (Number.isFinite(part.opacityBase)) {
        part.pathEl.style.opacity = String(part.opacityBase);
      }
    });
    folderIcon._xFolderMorphParts = parts;
    folderIcon._xFolderMorphState = 'base';
  }

  function setFolderPathMorphState(folderIcon, toHover) {
    if (!folderIcon) {
      return;
    }
    if (!folderIcon._xFolderMorphParts) {
      initFolderPathMorph(folderIcon);
    }
    const parts = Array.isArray(folderIcon._xFolderMorphParts) ? folderIcon._xFolderMorphParts : [];
    if (!parts.length) {
      return;
    }
    const targetState = toHover ? 'hover' : 'base';
    if (folderIcon._xUpperFilterRestoreTimerId) {
      clearTimeout(folderIcon._xUpperFilterRestoreTimerId);
      folderIcon._xUpperFilterRestoreTimerId = 0;
    }
    setFolderUpperFilterSuspended(folderIcon, false);
    if (!folderIcon._xUpperGradientMorph) {
      initFolderUpperGradientMorph(folderIcon);
    }
    const gradientMorph = folderIcon._xUpperGradientMorph;
    if (gradientMorph) {
      if (gradientMorph.rafId) {
        cancelAnimationFrame(gradientMorph.rafId);
        gradientMorph.rafId = 0;
      }
      gradientMorph.state = targetState;
      applyGradientMorphConfig(
        gradientMorph.mainGradientEl,
        toHover ? gradientMorph.hoverMain : gradientMorph.baseMain
      );
      applyGradientMorphConfig(
        gradientMorph.overlayGradientEl,
        toHover ? gradientMorph.hoverOverlay : gradientMorph.baseOverlay
      );
    }
    const targetPaths = new Map(parts.map((part) => [
      part.partName,
      toHover ? part.hoverD : part.baseD
    ]));
    folderIcon._xFolderMorphState = targetState;
    parts.forEach((part) => {
      if (!part || !part.pathEl) {
        return;
      }
      cancelFolderPathMorph(part);
      const targetFill = toHover ? part.fillHover : part.fillBase;
      if (targetFill) {
        part.pathEl.setAttribute('fill', targetFill);
      }
      if (part.pathEl.style) {
        part.pathEl.style.removeProperty('transition');
        if (Number.isFinite(part.opacityBase) && Number.isFinite(part.opacityHover)) {
          part.pathEl.style.opacity = String(toHover ? part.opacityHover : part.opacityBase);
        }
      }
      const targetD = part.partName === 'upper-overlay'
        ? (targetPaths.get('upper-body') || targetPaths.get(part.partName))
        : targetPaths.get(part.partName);
      if (!targetD) {
        return;
      }
      part.pathEl.setAttribute('d', targetD);
      (part.linkedFollowers || []).forEach((follower) => {
        if (follower && typeof follower.setAttribute === 'function') {
          follower.setAttribute('d', targetD);
        }
      });
    });
  }

  function playFolderPathMorph(folderIcon, toHover, morphOptions) {
    if (!folderIcon) {
      return;
    }
    if (morphOptions && morphOptions.instant === true) {
      setFolderPathMorphState(folderIcon, toHover);
      return;
    }
    if (!folderIcon._xFolderMorphParts) {
      initFolderPathMorph(folderIcon);
    }
    const parts = Array.isArray(folderIcon._xFolderMorphParts) ? folderIcon._xFolderMorphParts : [];
    if (!parts.length) {
      return;
    }
    const targetState = toHover ? 'hover' : 'base';
    if (folderIcon._xFolderMorphState === targetState) {
      return;
    }
    setFolderUpperFilterSuspended(folderIcon, true);
    playFolderUpperGradientMorph(folderIcon, toHover);
    if (folderIcon._xUpperFilterRestoreTimerId) {
      clearTimeout(folderIcon._xUpperFilterRestoreTimerId);
      folderIcon._xUpperFilterRestoreTimerId = 0;
    }
    folderIcon._xUpperFilterRestoreTimerId = window.setTimeout(() => {
      folderIcon._xUpperFilterRestoreTimerId = 0;
      setFolderUpperFilterSuspended(folderIcon, false);
    }, FOLDER_PATH_MORPH_DURATION_MS + 48);
    folderIcon._xFolderMorphState = targetState;
    parts.forEach((part) => {
      const currentD = part.pathEl && typeof part.pathEl.getAttribute === 'function'
        ? (part.pathEl.getAttribute('d') || '')
        : '';
      const fromD = currentD || (toHover ? part.baseD : part.hoverD);
      const toD = toHover ? part.hoverD : part.baseD;
      if (!part.pathEl || !fromD || !toD) {
        return;
      }
      const targetFill = toHover ? part.fillHover : part.fillBase;
      if (targetFill) {
        part.pathEl.setAttribute('fill', targetFill);
      }
      if (Number.isFinite(part.opacityBase) && Number.isFinite(part.opacityHover)) {
        part.pathEl.style.transition = `opacity ${FOLDER_PATH_MORPH_DURATION_MS}ms ${FOLDER_PATH_MORPH_EASING}`;
        part.pathEl.style.opacity = String(toHover ? part.opacityHover : part.opacityBase);
      }
      if (part.partName === 'upper-overlay') {
        const upperBodyPart = parts.find((item) => item.partName === 'upper-body');
        if (upperBodyPart && upperBodyPart.pathEl) {
          part.pathEl.setAttribute('d', upperBodyPart.pathEl.getAttribute('d') || toD);
          return;
        }
      }
      const animated = animatePathDWithCurve(part, fromD, toD);
      if (!animated) {
        part.pathEl.setAttribute('d', toD);
        part.animationFrameId = 0;
      }
    });
  }

  return Object.freeze({
    DEFAULT_FOLDER_COLOR,
    FOLDER_COLORS_STORAGE_KEY,
    FOLDER_COLOR_REFS_STORAGE_KEY,
    MAX_FOLDER_COLOR_REFS,
    normalizeFolderColorMap,
    normalizeFolderColorRefs,
    resolveFolderColors,
    setFolderColorRef,
    importFolderColorMap,
    FOLDER_PATH_MORPH_DURATION_MS,
    getFigmaFolderSvg,
    applyFolderColor,
    initFolderPathMorph,
    playFolderPathMorph,
    setFolderPathMorphState
  });
});
