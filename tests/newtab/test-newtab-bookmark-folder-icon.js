const assert = require('assert');
const path = require('path');
const { JSDOM } = require('jsdom');
const folderIcon = require('../../src/newtab/bookmarks/bookmark-folder-icon.ts');
const folderIconMotion = require('../../src/newtab/dom/folder-icon.ts');
const { createSvgElement } = require('../../src/shared/ui/svg-tree.ts');
const { createNewtabPage } = require('../helpers/newtab-page');
const { getPageScripts, runsBefore } = require('../helpers/runtime-scripts');

path.resolve(__dirname, '..', '..');
assert.deepStrictEqual(folderIcon.normalizeFolderColorMap(JSON.parse('{"1":"#aabbcc", "2":"#FF0000", "3":"bad-value", "__proto__":"#ffffff", "invalid id":"#ffffff"}')), { '1': '#AABBCC', '2': '#FF0000' });

{
  // Two devices share folders through bookmark sync but not bookmark ids.
  const tree = (ids, options = {}) => {
    const work = { id: ids.work, parentId: '1', title: options.workTitle || 'Work', dateAdded: 1000, children: [
      { id: ids.dev, parentId: ids.work, title: 'Dev', dateAdded: 2000, children: [] }
    ] };
    const twins = [
      { id: ids.twinA, parentId: '1', title: 'Twin', dateAdded: 3000, children: [] },
      { id: ids.twinB, parentId: '1', title: 'Twin', dateAdded: 4000, children: [] }
    ];
    const bar = { id: '1', parentId: '0', title: 'Bookmarks bar', folderType: 'bookmarks-bar',
      children: options.moved ? twins : [work, ...twins] };
    const other = { id: '2', parentId: '0', title: 'Other', folderType: 'other',
      children: options.moved ? [{ ...work, parentId: '2' }] : [] };
    const top = { id: '0', title: '', children: [bar, other] };
    const map = new Map();
    const visit = (node) => { map.set(node.id, node); (node.children || []).forEach(visit); };
    visit(top);
    return map;
  };
  const deviceA = tree({ work: '10', dev: '11', twinA: '12', twinB: '13' });
  const deviceB = tree({ work: '90', dev: '91', twinA: '92', twinB: '93' });
  let refs = folderIcon.setFolderColorRef({}, '11', '#22c55e', deviceA);
  refs = folderIcon.setFolderColorRef(refs, '13', '#EF4444', deviceA);
  assert.deepStrictEqual(Object.values(refs), [{ color: '#22C55E', dateAdded: 2000 }, { color: '#EF4444', dateAdded: 4000 }]);
  assert(Object.keys(refs).every((ref) => /^[a-f0-9]{16}$/.test(ref)), 'synced keys never carry device bookmark ids');
  assert.deepStrictEqual(folderIcon.resolveFolderColors(refs, deviceB).colors, { '91': '#22C55E', '93': '#EF4444' },
    'another device resolves colors to its own ids, telling same-name siblings apart');
  assert.strictEqual(folderIcon.resolveFolderColors(refs, deviceB).changed, false);
  assert.strictEqual(folderIcon.setFolderColorRef(refs, 'missing', '#000000', deviceA), null);
  assert.deepStrictEqual(folderIcon.resolveFolderColors(folderIcon.setFolderColorRef(refs, '11', null, deviceA), deviceA).colors,
    { '13': '#EF4444' }, 'clearing a color removes the synced entry');

  const renamed = tree({ work: '90', dev: '91', twinA: '92', twinB: '93' }, { workTitle: 'Jobs', moved: true });
  const healed = folderIcon.resolveFolderColors(refs, renamed);
  assert.strictEqual(healed.changed, true, 'a renamed and moved folder is found again by its creation time');
  assert.deepStrictEqual(healed.colors, { '91': '#22C55E', '93': '#EF4444' });
  assert.deepStrictEqual(folderIcon.resolveFolderColors(healed.refs, renamed),
    { colors: healed.colors, refs: healed.refs, changed: false }, 'resolving again is stable, so it never loops writes');

  // Deleting the first of two same-name folders shifts the second into its path.
  const bothTwins = folderIcon.setFolderColorRef(refs, '12', '#8B5CF6', deviceA);
  const shifted = tree({ work: '90', dev: '91', twinA: '92', twinB: '93' });
  shifted.get('1').children = shifted.get('1').children.filter((node) => node.id !== '92');
  shifted.delete('92');
  const afterDelete = folderIcon.resolveFolderColors(bothTwins, shifted);
  assert.deepStrictEqual(afterDelete.colors, { '91': '#22C55E', '93': '#EF4444' },
    'the remaining twin keeps its own color instead of the deleted twin\'s');
  assert.strictEqual(Object.keys(afterDelete.refs).length, 2, 'the deleted twin\'s entry is dropped');

  // Without matching creation times the path still finds the folder.
  const undated = tree({ work: '90', dev: '91', twinA: '92', twinB: '93' });
  undated.forEach((node) => { node.dateAdded = 7; });
  const byPath = folderIcon.resolveFolderColors(refs, undated);
  assert.deepStrictEqual(byPath, { colors: { '91': '#22C55E', '93': '#EF4444' }, refs, changed: false });

  const legacy = folderIcon.importFolderColorMap({ '10': '#aabbcc', '11': '#000000', gone: '#FFFFFF' }, refs, deviceA);
  assert.deepStrictEqual(folderIcon.resolveFolderColors(legacy, deviceB).colors, { '90': '#AABBCC', '91': '#22C55E', '93': '#EF4444' },
    'legacy id-keyed colors migrate without replacing colors that already synced');

  const many = Object.fromEntries(Array.from({ length: folderIcon.MAX_FOLDER_COLOR_REFS + 5 }, (_, index) =>
    [index.toString(16).padStart(16, '0'), { color: '#123456', dateAdded: index + 1 }]));
  const capped = folderIcon.normalizeFolderColorRefs(many);
  assert.strictEqual(Object.keys(capped).length, folderIcon.MAX_FOLDER_COLOR_REFS, 'the newest entries are kept under the cap');
  assert(Buffer.byteLength(JSON.stringify(capped)) < 7680, 'a full map stays within the browser sync item quota');
  assert.deepStrictEqual(folderIcon.normalizeFolderColorRefs({ bad: { color: '#FFFFFF' }, ['a'.repeat(16)]: { color: 'nope' } }), {});
}

const drawFolderIcon = (documentObj, suffix, folderId) =>
  createSvgElement(documentObj, folderIcon.describeFolderIcon(suffix, folderId));
const idsOf = (svg) => Array.from(svg.querySelectorAll('[id]'), (element) => element.id);
const probeDocument = new JSDOM('<!doctype html><body></body>').window.document;
const firstIds = idsOf(drawFolderIcon(probeDocument, 'folder one'));
assert.ok(firstIds.includes('x-nt-folder-filter-lower-base-folder_one'));
assert.ok(idsOf(drawFolderIcon(probeDocument, 'folder/two')).includes('x-nt-folder-filter-lower-base-folder_two'));
assert.ok(firstIds.every((id) => !id.includes(' ')), 'SVG ids should sanitize caller-provided suffixes');
assert.strictEqual(
  folderIconMotion.FOLDER_PATH_MORPH_DURATION_MS,
  460,
  'the shared component should expose its animation duration contract'
);

const dom = new JSDOM('<!doctype html><body><span id="folder"></span></body>');
const iconElement = dom.window.document.getElementById('folder');
iconElement.replaceChildren(drawFolderIcon(dom.window.document, 'folder one'));
folderIconMotion.initFolderPathMorph(iconElement);
assert.ok(Array.isArray(folderIconMotion.getFolderMorphParts(iconElement)));
assert.ok(folderIconMotion.getFolderMorphParts(iconElement).length >= 6);
assert.strictEqual(folderIconMotion.getFolderMorphState(iconElement), 'base');

folderIconMotion.playFolderPathMorph(iconElement, true, { instant: true });
assert.strictEqual(folderIconMotion.getFolderMorphState(iconElement), 'hover');
const upperBody = folderIconMotion.getFolderMorphParts(iconElement).find((part) => part.partName === 'upper-body');
assert.ok(upperBody);
assert.strictEqual(upperBody.pathEl.getAttribute('d'), upperBody.hoverD);

folderIconMotion.setFolderPathMorphState(iconElement, false);
assert.strictEqual(folderIconMotion.getFolderMorphState(iconElement), 'base');
assert.strictEqual(upperBody.pathEl.getAttribute('d'), upperBody.baseD);

folderIconMotion.applyFolderColor(iconElement, '#EF4444');
const originalPath = upperBody.pathEl;
assert.strictEqual(iconElement.querySelector('svg').getAttribute('data-folder-color'), '#EF4444');
assert.strictEqual(iconElement.querySelector('[data-folder-part="upper-outline"]').getAttribute('stroke'), '#EF4444');
const closedStops = Array.from(iconElement.querySelectorAll('[data-folder-gradient-morph="upper-main"] stop')).map((stop) => stop.getAttribute('stop-color'));
assert.ok(closedStops.every((color) => color !== '#CCDFFF'), 'all gradient stops should use the selected palette');
folderIconMotion.playFolderPathMorph(iconElement, true, { instant: true });
assert.strictEqual(upperBody.pathEl, originalPath, 'recoloring must retain animated path nodes');
assert.notDeepStrictEqual(Array.from(iconElement.querySelectorAll('[data-folder-gradient-morph="upper-main"] stop')).map((stop) => stop.getAttribute('stop-color')), closedStops, 'expanded folders should keep their shaded gradient animation');
folderIconMotion.applyFolderColor(iconElement, '#22C55E');
assert.strictEqual(folderIconMotion.getFolderMorphState(iconElement), 'hover', 'recoloring an open folder must preserve its expanded shape');
folderIconMotion.setFolderPathMorphState(iconElement, false);
folderIconMotion.applyFolderColor(iconElement, null);
assert.deepStrictEqual(Array.from(iconElement.querySelectorAll('[data-folder-gradient-morph="upper-main"] stop')).map((stop) => stop.getAttribute('stop-color')), ['#CCDFFF', '#B2CEFF', '#89B5FF', '#97BEFF'], 'reset must exactly restore the original blue palette');

iconElement.replaceChildren(drawFolderIcon(dom.window.document, 'after-reorder', '123'));
folderIconMotion.initFolderPathMorph(iconElement);
folderIconMotion.applyFolderColor(iconElement, '#EF4444');
folderIconMotion.playFolderPathMorph(iconElement, true, { instant: true });
assert.strictEqual(folderIconMotion.getFolderMorphParts(iconElement).find((part) => part.partName === 'upper-body').pathEl, iconElement.querySelector('[data-folder-part="upper-body"]'), 'reordered folders must animate the current SVG');
assert.strictEqual(iconElement.querySelector('svg').getAttribute('data-folder-color-id'), '123');

{
  // Hovering a folder must not sample its shapes again: every icon draws the
  // same ones, and turning back mid-morph starts from the points on screen.
  const dom = new JSDOM('<!doctype html><body></body>');
  const frames = [];
  let now = 0;
  let samples = 0;
  const saved = {};
  const globals = {
    document: dom.window.document,
    window: dom.window,
    performance: { now: () => now },
    requestAnimationFrame: (callback) => frames.push(callback),
    cancelAnimationFrame: () => {}
  };
  Object.keys(globals).forEach((key) => { saved[key] = globalThis[key]; globalThis[key] = globals[key]; });
  // jsdom has no path geometry; a closed square is enough to sample.
  dom.window.SVGElement.prototype.getTotalLength = function() { return 4; };
  dom.window.SVGElement.prototype.getPointAtLength = function(length) {
    samples += 1;
    const t = Number(length) % 4;
    return t < 1 ? { x: t, y: 0 } : t < 2 ? { x: 1, y: t - 1 } : t < 3 ? { x: 3 - t, y: 1 } : { x: 0, y: 4 - t };
  };
  const runFrames = (ms) => {
    now += ms;
    const pending = frames.splice(0);
    pending.forEach((callback) => callback(now));
  };
  try {
    const makeIcon = (suffix) => {
      const icon = dom.window.document.createElement('span');
      icon.appendChild(drawFolderIcon(dom.window.document, suffix));
      dom.window.document.body.appendChild(icon);
      folderIconMotion.initFolderPathMorph(icon);
      return icon;
    };
    const first = makeIcon('a');
    folderIconMotion.playFolderPathMorph(first, true);
    const firstSamples = samples;
    assert.ok(firstSamples > 0, 'the first hover samples the folder shapes it cannot morph by number');
    runFrames(16);
    runFrames(16);
    folderIconMotion.playFolderPathMorph(first, false);
    runFrames(16);
    assert.strictEqual(samples, firstSamples, 'turning back mid-morph reuses the points on screen');
    runFrames(1000);
    runFrames(16);
    const second = makeIcon('b');
    folderIconMotion.playFolderPathMorph(second, true);
    runFrames(1000);
    runFrames(16);
    folderIconMotion.playFolderPathMorph(second, false);
    runFrames(1000);
    runFrames(16);
    assert.strictEqual(samples, firstSamples, 'another folder icon reuses the shapes already sampled');
    const settled = Array.from(second.querySelectorAll('[data-folder-part]')).map((part) => part.getAttribute('d'));
    const fresh = makeIcon('c');
    assert.deepStrictEqual(settled, Array.from(fresh.querySelectorAll('[data-folder-part]')).map((part) => part.getAttribute('d')),
      'a morph back ends on the original folder shapes');
  } finally {
    Object.keys(saved).forEach((key) => { globalThis[key] = saved[key]; });
  }
}

assert.ok(
  runsBefore(getPageScripts('newtab.html'), 'src/newtab/bookmarks/bookmark-folder-icon.ts', 'src/newtab/app/main.ts'),
  'the folder icon component should load before the newtab runtime'
);
// New Tab draws its folder shortcuts with this component's icon.
(async () => {
  const page = await createNewtabPage({
    shortcuts: [{ type: 'folder', folderId: '10', title: 'Docs' }],
    bookmarks: [{ id: '10', title: 'Docs', children: [] }]
  });
  await page.settle(300);
  const tile = page.document.querySelector('.x-nt-shortcut-tile--folder');
  const parts = Array.from(tile.querySelectorAll('svg path[data-folder-part]')).map((part) => part.getAttribute('data-folder-part'));
  const expected = Array.from(drawFolderIcon(probeDocument, 'probe', '10').querySelectorAll('path[data-folder-part]'))
    .map((part) => part.getAttribute('data-folder-part'));
  assert.ok(parts.length > 0, 'a folder shortcut should show the folder icon');
  assert.deepStrictEqual(parts, expected, 'drawn by the shared folder icon component');
  page.close();
  console.log('newtab bookmark folder icon tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
