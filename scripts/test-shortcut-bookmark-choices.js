const assert = require('node:assert/strict');
const { collectChoices } = require('../src/newtab/shortcut-bookmark-choices.js');
const { normalizeShortcutUrl } = require('../src/newtab/shortcuts-store.js');

const nodes = new Map([
  ['0', { id: '0', children: [] }],
  ['1', { id: '1', parentId: '0', title: 'Bookmarks bar' }],
  ['2', { id: '2', parentId: '0', title: 'Other bookmarks' }],
  ['3', { id: '3', parentId: '1', title: '设计' }],
  ['4', { id: '4', parentId: '3', title: 'Figma', url: 'https://figma.com' }],
  ['5', { id: '5', parentId: '2', title: 'GitHub', url: 'https://github.com/' }],
  ['6', { id: '6', parentId: '3', title: 'Figma 工作区', url: 'https://figma.com/workspace' }],
  ['7', { id: '7', parentId: '2', title: 'Unsafe', url: 'javascript:alert(1)' }],
  ['8', { id: '8', parentId: '2', title: 'Private', url: 'https://user:password@example.com/' }],
  ['9', { id: '9', parentId: '2', title: 'Local', url: 'file:///private.html' }],
  ['10', { id: '10', parentId: '2', title: 'Settings', url: 'edge://settings/' }]
]);
const result = collectChoices(nodes, normalizeShortcutUrl, [{ id: 'existing', url: 'https://github.com/' }]);
assert.deepEqual(result.map((item) => item.id), ['4', '5', '6', '10']);
assert.equal(result[0].path, 'Bookmarks bar / 设计');
assert.equal(result[1].path, 'Other bookmarks');
assert.equal(result[1].added, true);
assert.equal(result[0].added, false);
assert.equal(result[0].url, 'https://figma.com/');
assert.equal(nodes.get('4').url, 'https://figma.com', 'Selecting does not mutate the bookmark source');
assert.deepEqual(collectChoices(new Map(), normalizeShortcutUrl, []), []);
nodes.set('cycle', { id: 'cycle', parentId: 'cycle', title: 'Cycle', url: 'https://cycle.test/' });
assert.ok(collectChoices(nodes, normalizeShortcutUrl, []).some((item) => item.id === 'cycle'));
console.log('Bookmark choices: all folders, nested paths, supported URLs, unsafe URL exclusions, already-added state and immutable source passed.');
