(function(root, factory) {
  const api = factory();
  root.LumnoShortcutBookmarkChoices = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function collectChoices(nodeMap, normalizeUrl, shortcuts) {
    const map = nodeMap instanceof Map ? nodeMap : new Map();
    const existing = new Set((Array.isArray(shortcuts) ? shortcuts : [])
      .filter((item) => item && item.type !== 'folder')
      .map((item) => normalizeUrl(item.url)).filter(Boolean));
    const choices = [];
    map.forEach((node) => {
      if (!node || !node.url) return;
      const url = normalizeUrl(node.url);
      if (!url) return;
      try { const parsed = new URL(url); if (parsed.username || parsed.password) return; }
      catch (_) { return; }
      const folders = [];
      const seen = new Set([String(node.id || '')]);
      let parent = map.get(String(node.parentId || ''));
      while (parent && !seen.has(String(parent.id || '')) && seen.size < 64) {
        seen.add(String(parent.id || ''));
        if (parent.title) folders.unshift(String(parent.title));
        parent = map.get(String(parent.parentId || ''));
      }
      choices.push({ id: String(node.id), title: String(node.title || url), url,
        path: folders.join(' / '), added: existing.has(url) });
    });
    return choices;
  }

  return { collectChoices };
});
