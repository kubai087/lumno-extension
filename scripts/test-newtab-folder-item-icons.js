const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const icons = require('../src/newtab/folder-item-icons');
const store = require('../src/newtab/shortcuts-store');
const favicon = require('../src/shared/shortcut-favicon');
const { readNewtabRuntimeSource } = require('./helpers/newtab-source');

const source = readNewtabRuntimeSource();
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  const body = source.indexOf('{', start);
  let depth = 0;
  for (let index = body; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unterminated ${name}`);
}
const png = (text) => `data:image/png;base64,${Buffer.from(text).toString('base64')}`;

(async () => {
  // Entries: built-in resolves from the URL; other sources keep their image.
  assert.deepStrictEqual(icons.normalizeEntry({ iconSource: 'builtin', dataUrl: png('x') }), { iconSource: 'builtin' });
  assert.deepStrictEqual(icons.normalizeEntry({ iconSource: 'custom', dataUrl: png('x') }), { iconSource: 'custom', dataUrl: png('x') });
  assert.strictEqual(icons.normalizeEntry({ iconSource: 'service' }), null, 'online sources need their image');
  assert.strictEqual(icons.normalizeEntry({ iconSource: 'custom', dataUrl: 'https://x.example/a.png' }), null);
  assert.strictEqual(icons.normalizeEntry({ iconSource: 'other', dataUrl: png('x') }), null);

  const area = {
    data: {}, writes: 0,
    get(keys, callback) { callback({ [keys[0]]: this.data[keys[0]] }); },
    set(values, callback) { this.writes += 1; Object.assign(this.data, JSON.parse(JSON.stringify(values))); callback(); }
  };
  area.data[icons.DEFAULT_STORAGE_KEY] = { a: { iconSource: 'custom', dataUrl: png('a') }, bad: { iconSource: 'service' } };
  const runtime = icons.createStore({ storageArea: area, chrome: {} });
  await runtime.ready;
  assert.deepStrictEqual(runtime.get('a'), { iconSource: 'custom', dataUrl: png('a') });
  assert.strictEqual(runtime.get('bad'), null);
  await runtime.update({ b: { iconSource: 'builtin' }, a: null });
  assert.deepStrictEqual(area.data[icons.DEFAULT_STORAGE_KEY], { b: { iconSource: 'builtin' } });
  await runtime.update({ c: { iconSource: 'favicon-is', dataUrl: png('c') } }, (id) => id !== 'b');
  assert.deepStrictEqual(Object.keys(area.data[icons.DEFAULT_STORAGE_KEY]), ['c'], 'removed bookmarks lose their icons');
  const writes = area.writes;
  await runtime.update({ c: { iconSource: 'favicon-is', dataUrl: png('c') } });
  assert.strictEqual(area.writes, writes, 'unchanged icons are not rewritten');

  // Saving the dialog's choice.
  const saved = new Map([['1', { iconSource: 'service', dataUrl: png('old') }]]);
  const nodes = new Map([['1', { id: '1', url: 'https://docs.example/' }], ['2', { id: '2', url: 'https://two.example/' }]]);
  const context = vm.createContext({
    SHORTCUT_FAVICON: favicon,
    NEWTAB_SHORTCUTS_STORE: store,
    folderItemIconStore: { get: (id) => saved.get(String(id)) || null },
    bookmarksRuntime: { getNode: (id) => nodes.get(String(id)) || null },
    getShortcutDialogBuiltinIconUrl: (url) => url.includes('github') ? 'chrome-extension://lumno/glyph-gh.svg' : ''
  });
  vm.runInContext(['getNextFolderItemIcon', 'getFolderItemIconUrl'].map(extractFunction).join('\n'), context);
  const next = (id, url, state) => JSON.parse(JSON.stringify(context.getNextFolderItemIcon(id, url, state)));
  assert.deepStrictEqual(next('1', 'https://docs.example/', { source: 'service' }), { iconSource: 'service', dataUrl: png('old') },
    'an unchanged choice keeps its image');
  assert.strictEqual(next('1', 'https://moved.example/', { source: 'service' }), null, 'a new URL drops a stale image');
  assert.strictEqual(next('1', 'https://docs.example/', { source: 'cache' }), null, 'browser cache without a fetch is automatic');
  assert.deepStrictEqual(next('2', 'https://two.example/', {
    source: 'favicon-is', onlineIcon: { dataUrl: png('fresh'), pageUrl: 'https://two.example/' }
  }), { iconSource: 'favicon-is', dataUrl: png('fresh') });
  assert.deepStrictEqual(next('2', 'https://two.example/', { source: 'custom', action: 'replace', dataUrl: png('mine') }),
    { iconSource: 'custom', dataUrl: png('mine') });
  assert.strictEqual(next('2', 'https://two.example/', { source: 'custom', action: 'keep' }), null);
  assert.deepStrictEqual(next('2', 'https://two.example/', { source: 'builtin' }), { iconSource: 'builtin' });
  saved.set('3', { iconSource: 'builtin' });
  assert.strictEqual(context.getFolderItemIconUrl('3', 'https://github.com/'), 'chrome-extension://lumno/glyph-gh.svg');
  assert.strictEqual(context.getFolderItemIconUrl('1', 'https://docs.example/'), png('old'));
  assert.strictEqual(context.getFolderItemIconUrl('2', 'https://two.example/'), '');

  // Only websites in a folder opened from a shortcut get the icon editor.
  const opened = [];
  const editor = vm.createContext({
    opened,
    bookmarksRuntime: { getNode: () => ({ title: 'Docs', url: 'https://docs.example/' }) },
    bookmarkCascadeRuntime: { getAnchor: () => editor.anchor },
    getFolderItemIcon: () => ({ iconSource: 'custom', dataUrl: png('mine') }),
    getFolderItemIconUrl: () => png('mine'),
    getBrowserPageFaviconUrl: () => 'chrome-extension://lumno/_favicon/',
    openShortcutDialog: (options) => opened.push(options),
    SHORTCUT_DIALOG_MODE_EDIT: 'edit', SHORTCUT_DIALOG_ITEM_FOLDER: 'folder', SHORTCUT_DIALOG_ITEM_BOOKMARK: 'bookmark'
  });
  vm.runInContext(['isShortcutFolderAnchor', 'openBookmarkEditor'].map(extractFunction).join('\n'), editor);
  editor.anchor = { classList: { contains: (name) => name === 'x-nt-shortcut-tile' } };
  editor.openBookmarkEditor({ bookmarkId: '1', sourceKind: 'cascade' });
  editor.openBookmarkEditor({ bookmarkId: '1', sourceKind: 'card' });
  editor.openBookmarkEditor({ bookmarkId: '1', sourceKind: 'cascade', isFolder: true });
  editor.anchor = { classList: { contains: () => false } };
  editor.openBookmarkEditor({ bookmarkId: '1', sourceKind: 'cascade' });
  assert.deepStrictEqual(opened.map((options) => options.iconEditable), [true, false, false, false]);
  assert.strictEqual(opened[0].shortcut.iconDataUrl, png('mine'));
  assert.strictEqual(opened[0].iconPreviewUrl, png('mine'));
  assert.strictEqual(opened[1].shortcut.iconSource, undefined);

  // The cascade shows the chosen icon instead of resolving a favicon.
  const cascade = fs.readFileSync(path.join(__dirname, '../src/newtab/bookmark-cascade-menu.js'), 'utf8');
  const iconChoice = cascade.indexOf('getItemIconUrl(item, bookmarkCascadeAnchor)');
  assert.ok(iconChoice > 0 && iconChoice < cascade.indexOf('attachFaviconWithFallbacks(icon, item.url'));

  console.log('Shortcut folder item icons passed: storage, pruning, saving choices, editor scope and cascade display.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
