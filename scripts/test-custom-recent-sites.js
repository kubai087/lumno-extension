const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const custom = require('../src/newtab/custom-recent-sites.js');
require('../src/newtab/section-loaders.js');

const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
  assert.equal(custom.normalizeUrl('example.com/path'), 'https://example.com/path');
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'https://user:password@example.com']) {
    assert.equal(custom.normalizeUrl(url), '');
  }
  assert.deepEqual(custom.normalizeSites([{ url: 'https://a.test', title: 'First' }, { url: 'https://a.test/', title: 'Duplicate' }]).map((item) => item.title), ['First']);
  const data = {};
  const listeners = new Set();
  let storageError = null;
  const chromeObj = {
    runtime: { lastError: null },
    storage: { onChanged: { addListener: (fn) => listeners.add(fn), removeListener: (fn) => listeners.delete(fn) } }
  };
  const storage = {
    get(keys, callback) { queueMicrotask(() => callback(structuredClone(data))); },
    set(values, callback) {
      queueMicrotask(() => {
        chromeObj.runtime.lastError = storageError;
        if (!storageError) {
          Object.assign(data, structuredClone(values));
          for (const listener of listeners) listener({ [custom.STORAGE_KEY]: { newValue: data[custom.STORAGE_KEY] } }, 'local');
        }
        callback();
        chromeObj.runtime.lastError = null;
      });
    }
  };
  function create() {
    const dom = new JSDOM('<body><div id="header"></div><div id="grid"></div></body>');
    let mode = 'custom';
    let count = 4;
    const document = dom.window.document;
    const controller = custom.createController({
      documentObj: document, chromeObj, storage,
      header: document.querySelector('#header'), grid: document.querySelector('#grid'),
      t: (_, fallback) => fallback, getMode: () => mode, getLimit: () => count,
      onChange: () => controller.update()
    });
    return { controller, document, dom, setMode: (value) => { mode = value; controller.update(); }, setCount: (value) => { count = value; controller.update(); } };
  }
  const first = create();
  await first.controller.load();
  first.controller.update();
  const doc = first.document;
  assert.equal(doc.querySelector('.x-nt-custom-recent-empty').hidden, false);
  doc.querySelector('.x-nt-custom-recent-tools button:last-child').click();
  const name = doc.querySelector('[name="site-title"]');
  const url = doc.querySelector('[name="site-url"]');
  const submit = async (title, address) => {
    name.value = title; url.value = address;
    doc.querySelector('form').dispatchEvent(new first.dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
  };
  await submit('First', 'a.test');
  assert.equal(data[custom.STORAGE_KEY][0].url, 'https://a.test/');
  assert.equal(doc.querySelector('[role="status"]').textContent, 'Saved');
  assert.equal(name.value, '');
  await submit('Duplicate', 'https://a.test/');
  assert.match(doc.querySelector('[role="alert"]').textContent, /already/);
  assert.equal(data[custom.STORAGE_KEY].length, 1);
  await submit('Unsafe', 'javascript:alert(1)');
  assert.equal(url.getAttribute('aria-invalid'), 'true');
  assert.equal(data[custom.STORAGE_KEY].length, 1);
  await submit('Second', 'b.test');
  assert.equal(data[custom.STORAGE_KEY].length, 2);
  doc.querySelector('[aria-label="Move up: Second"]').focus();
  doc.querySelector('[aria-label="Move up: Second"]').click();
  await tick();
  assert.deepEqual(data[custom.STORAGE_KEY].map((item) => item.title), ['Second', 'First']);
  assert.equal(doc.activeElement.getAttribute('aria-label'), 'Move down: Second');
  assert.equal(doc.activeElement.disabled, false);
  first.controller.update();
  assert.equal(doc.activeElement.getAttribute('aria-label'), 'Move down: Second');
  doc.querySelector('[aria-label="Edit: First"]').click();
  await submit('Renamed', 'a.test/new');
  assert.equal(data[custom.STORAGE_KEY][1].title, 'Renamed');
  assert.equal(data[custom.STORAGE_KEY][1].url, 'https://a.test/new');
  const second = create();
  await second.controller.load();
  assert.deepEqual((await second.controller.load()).map((item) => item.title), ['Second', 'Renamed']);
  doc.querySelector('[aria-label="Remove: Second"]').click();
  await tick();
  assert.deepEqual((await second.controller.load()).map((item) => item.title), ['Renamed']);
  storageError = { message: 'Quota exceeded' };
  await submit('Cannot save', 'quota.test');
  assert.match(doc.querySelector('[role="alert"]').textContent, /Could not save/);
  assert.equal(data[custom.STORAGE_KEY].length, 1);
  storageError = null;
  for (let i = 0; i < 5; i += 1) await submit(`Site ${i}`, `https://site${i}.test`);
  const toolsButtons = doc.querySelectorAll('.x-nt-custom-recent-tools button');
  toolsButtons[0].click();
  assert.equal(first.controller.pageItems(await first.controller.load(), 4).length, 4);
  toolsButtons[1].click();
  assert.equal(first.controller.pageItems(await first.controller.load(), 4).length, 2);
  assert.equal(doc.querySelector('.x-nt-custom-recent-page').textContent, '2 / 2');
  first.setCount(8);
  assert.equal(first.controller.pageItems(await first.controller.load(), 8).length, 6);
  first.setMode('most');
  assert.equal(doc.querySelector('.x-nt-custom-recent-tools').hidden, true);
  assert.equal(doc.querySelector('.x-nt-custom-recent-editor').hidden, true);
  first.setMode('custom');
  name.dispatchEvent(new first.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(doc.querySelector('.x-nt-custom-recent-editor').hidden, true);
  assert.equal(doc.activeElement, toolsButtons[2]);

  // Custom rendering must bypass history, hidden entries and the three-item pin limit.
  let historyCalls = 0;
  let rendered = [];
  let sourceMode = 'custom';
  let revision = 0;
  const state = {
    initialThemeApplied: true, recentLoadedOnce: false, sectionDataRevision: 0,
    recentRenderSignature: '', recentSourceItems: [],
    get currentRecentMode() { return sourceMode; },
    recentSitesView: { render(items) { rendered = items; return { signature: String(++revision) }; } }
  };
  const loaders = globalThis.LumnoNewtabSectionLoaders.createSectionLoaders({
    pageState: state,
    areFaviconRenderCachesReady: () => true,
    getRecentSourceLimit: () => 4, getRecentLimit: () => 4,
    getCustomRecentSites: () => first.controller.load(),
    getCustomRecentPageItems: (items, limit) => first.controller.pageItems(items, limit),
    syncCustomRecentSitesUi: () => first.controller.update(),
    getRecentSites: () => { historyCalls += 1; return Promise.resolve([]); },
    setContentSectionVisible: () => {}, updateBookmarkSectionPosition: () => {}
  });
  await loaders.loadRecentSites();
  assert.equal(historyCalls, 0);
  assert.equal(rendered.length, 4);
  assert.ok(rendered.every((item) => item._xCustom));
  // Simulate a different tab writing before its change event reaches this one.
  data[custom.STORAGE_KEY].push({ title: 'Remote edit', url: 'https://remote.test/' });
  await submit('Local edit', 'https://local.test/');
  assert.match(doc.querySelector('[role="alert"]').textContent, /another tab/);
  assert.ok(data[custom.STORAGE_KEY].some((item) => item.title === 'Remote edit'));
  assert.ok(!data[custom.STORAGE_KEY].some((item) => item.title === 'Local edit'));
  assert.equal(name.value, 'Local edit');
  await submit('Local edit', 'https://local.test/');
  assert.ok(data[custom.STORAGE_KEY].some((item) => item.title === 'Remote edit'));
  assert.ok(data[custom.STORAGE_KEY].some((item) => item.title === 'Local edit'));
  assert.deepEqual(custom.normalizeSites([]), []);
  const tooMany = Array.from({ length: 30 }, (_, index) => ({ url: `https://limit${index}.test` }));
  assert.equal(custom.normalizeSites(tooMany).length, custom.MAX_SITES);
  first.controller.destroy(); second.controller.destroy();
  assert.equal(listeners.size, 0);
  console.log('Custom recent sites: CRUD, ordering, paging, URL validation, persistence, cross-tab updates, failed writes and source isolation passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
