const assert = require('assert');
const fs = require('fs');
const settings = require('../../src/domain/settings/index.ts');
const aggregateStore = require('../../src/domain/search/aggregate-search-store.ts');
const { getInjectedScripts, getPageScripts, runsBefore } = require('../helpers/runtime-scripts');
const { createOptionsPage } = require('../helpers/options-page');
const { SURFACES, openSearchSurface } = require('../helpers/search-surfaces');
const { aggregateSearches } = require('../../src/domain/settings/search.ts');

// Aggregate searches run one query on several sources at once. They are
// defined in Settings and offered as scopes on both search surfaces; the
// worker side is covered by test-background-aggregate-search.js.

const AGGREGATES = settings.aggregateSearches.key;
const DISABLED = '_x_extension_site_search_disabled_2024_unique_';
const DEFINITIONS = aggregateStore.serializeAggregateSearches([
  { id: 'research', key: 'rs', name: 'Research', sourceRefs: ['builtin:gg', 'builtin:bi'] },
  { id: 'broken', key: 'br2', name: 'Broken', sourceRefs: ['builtin:gg', 'custom:missing'] }
]);

function testPackaging() {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  assert.ok(manifest.permissions.includes('tabs') && manifest.permissions.includes('tabGroups'),
    'aggregate searches require the existing tabs and tabGroups permissions');
  assert.strictEqual(settings.aggregateSearches.key, aggregateSearches.key);
  assert.ok(runsBefore(getPageScripts('newtab.html'), 'src/domain/search/aggregate-search-store.ts', 'src/newtab/app/main.ts'));
  assert.ok(runsBefore(getInjectedScripts('overlay'), 'src/domain/search/aggregate-search-store.ts', 'src/overlay/app/main.ts'));
  assert.ok(runsBefore(getPageScripts('src/options/options.html'), 'src/domain/search/aggregate-search-store.ts', 'src/options/app/main.ts'));
  ['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
    const messages = JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'));
    [
      'aggregate_search_clear', 'confirm_clear_aggregate_search', 'aggregate_search_key_placeholder',
      'aggregate_search_source_summary_unavailable', 'aggregate_search_sources_unavailable_error',
      'aggregate_search_in_progress', 'aggregate_search_partial_failure', 'aggregate_search_degraded_success',
      'aggregate_search_storage_unavailable_error', 'aggregate_search_source_selection_unavailable_error'
    ].forEach((key) => assert.ok(messages[key] && messages[key].message, `${locale} should localize ${key}`));
  });
}

function stored(name, values) {
  return name === 'overlay' ? { settings: values } : { sync: values, local: values };
}

function changeStored(surface, key, value) {
  if (surface.name === 'overlay') {
    surface.page.changeSetting(key, value);
  } else {
    surface.page.storage.local.data[key] = value;
    surface.page.changeStorage('sync', key, value);
  }
}

async function open(name, extra) {
  const surface = await openSearchSurface(name, Object.assign({
    respond: (message) => (message.action === 'runAggregateSearchQuery' ? { ok: true } : undefined)
  }, stored(name, Object.assign({ [AGGREGATES]: DEFINITIONS }, extra || {}))));
  await surface.settle(80);
  return surface;
}

function menuIds(surface) {
  return Array.from(surface.root.querySelectorAll('.x-lumno-search-input-mode__menu-item')).map((item) => item.getAttribute('data-mode-id'));
}

async function testScopeMenuOffersUsableAggregates(name) {
  const surface = await open(name);
  await surface.openScopeMenu();
  const ids = menuIds(surface);
  assert.ok(ids.includes('aggregate:research'), `${name}: an aggregate search should be offered as a scope`);
  assert.ok(!ids.includes('aggregate:broken'), `${name}: one whose sources no longer resolve should be hidden`);
  surface.close();
}

async function testTriggerRunsTheAggregate(name) {
  const surface = await open(name);
  await surface.type('rs');
  assert.strictEqual(surface.root.querySelector('.x-lumno-search-input-mode__tab-hint').textContent.trim(), 'TabSearch Research',
    `${name}: an aggregate's trigger should offer it like any site search`);
  surface.press('Tab');
  await surface.settle(80);
  assert.strictEqual(surface.scopeLabel(), 'Research');
  assert.ok(surface.root.querySelector('[data-search-input-mode-prefix] .ri-stack-line'), `${name}: the active aggregate tag should show the aggregate icon`);
  await surface.type('hello');
  const before = surface.page.messages.length;
  surface.press('Enter');
  await surface.settle(150);
  const sent = surface.page.messages.slice(before);
  const run = sent.find((message) => message.action === 'runAggregateSearchQuery');
  assert.deepStrictEqual(run && [run.aggregateId, run.query], ['research', 'hello'], `${name}: Enter should run the aggregate search`);
  assert.ok(!sent.some((message) => message.action === 'createTab' || message.action === 'searchOrNavigate'),
    `${name}: and not fall back to a normal search`);
  assert.strictEqual(surface.navigation(), null);
  surface.close();
}

async function testEnterWhileARunIsPendingDoesNothingElse(name) {
  const surface = await openSearchSurface(name, Object.assign({
    respond: (message) => (message.action === 'runAggregateSearchQuery' ? new Promise(() => {}) : undefined)
  }, stored(name, { [AGGREGATES]: DEFINITIONS })));
  await surface.settle(80);
  await surface.type('rs');
  surface.press('Tab');
  await surface.settle(80);
  await surface.type('hello');
  const before = surface.page.messages.length;
  surface.press('Enter');
  await surface.settle(60);
  surface.press('Enter');
  await surface.settle(100);
  const sent = surface.page.messages.slice(before);
  assert.strictEqual(sent.filter((message) => message.action === 'runAggregateSearchQuery').length, 1,
    `${name}: a second Enter should not start the run again`);
  assert.ok(!sent.some((message) => message.action === 'createTab' || message.action === 'searchOrNavigate'),
    `${name}: nor fall back to a normal search while the run is pending`);
  assert.strictEqual(surface.navigation(), null);
  surface.close();
}

async function testDisablingASourceClearsTheActiveAggregate(name) {
  const surface = await open(name);
  await surface.type('rs');
  surface.press('Tab');
  await surface.settle(80);
  assert.strictEqual(surface.scopeLabel(), 'Research');
  changeStored(surface, DISABLED, ['bi']);
  await surface.settle(150);
  assert.strictEqual(surface.scopeLabel(), '', `${name}: disabling one of its sources should clear the active aggregate`);
  surface.close();
}

async function testNewAggregatesAppearWithoutReload(name) {
  const surface = await open(name);
  changeStored(surface, AGGREGATES, aggregateStore.serializeAggregateSearches([
    { id: 'research', key: 'rs', name: 'Research', sourceRefs: ['builtin:gg', 'builtin:bi'] },
    { id: 'video', key: 'vd', name: 'Video', sourceRefs: ['builtin:yt', 'builtin:bb'] }
  ]));
  await surface.settle(120);
  await surface.openScopeMenu();
  assert.ok(menuIds(surface).includes('aggregate:video'), `${name}: an aggregate added in Settings should show up`);
  surface.close();
}

async function testSettings() {
  const page = await createOptionsPage({ sync: { [AGGREGATES]: DEFINITIONS } });
  await page.settle(150);
  const doc = page.document;
  const order = [
    '#_x_extension_site_search_custom_list_2024_unique_',
    '[data-content="shortcuts"] ._x_extension_shortcuts_section_2024_unique_ > ._x_extension_shortcut_form_2024_unique_',
    '#_x_extension_aggregate_search_group_2026_unique_',
    '#_x_extension_site_search_builtin_list_2024_unique_'
  ].map((selector) => doc.querySelector(selector));
  assert.ok(order.every(Boolean), 'the search scope sections should exist');
  order.slice(1).forEach((element, index) => {
    assert.ok(order[index].compareDocumentPosition(element) & 4, 'custom search, then aggregate search, then built-in scopes');
  });
  const clear = doc.querySelector('#_x_extension_aggregate_search_group_2026_unique_ #_x_extension_aggregate_search_clear_2026_unique_');
  assert.ok(clear && clear.classList.contains('_x_extension_shortcut_group_action_2024_unique_'),
    'aggregate search should have the same header clear action as custom search');
  assert.ok(doc.getElementById('_x_extension_aggregate_search_list_2026_unique_'), 'Settings should mount the aggregate editor');

  await page.click(page.byId('_x_extension_aggregate_search_clear_2026_unique_'));
  await page.settle(60);
  assert.ok(!page.storage.sync.writes.some((write) => Object.hasOwn(write, AGGREGATES)), 'clearing should ask for confirmation first');
  const popconfirm = page.byId('_x_extension_aggregate_search_clear_2026_unique__popconfirm');
  assert.strictEqual(popconfirm && popconfirm.getAttribute('data-open'), 'true', 'a confirmation should appear');
  const buttons = Array.from(popconfirm.querySelectorAll('button'));
  const confirmButton = buttons.find((button) => !/取消|Cancel/.test(button.textContent));
  assert.ok(buttons.length === 2 && confirmButton, 'the confirmation should offer cancel and confirm');
  await page.click(confirmButton);
  await page.settle(100);
  const cleared = page.storage.sync.writes.filter((write) => Object.hasOwn(write, AGGREGATES)).pop();
  assert.ok(cleared, 'confirming should save the cleared list');
  assert.deepStrictEqual(cleared[AGGREGATES], aggregateStore.serializeAggregateSearches([]), 'the saved list should be empty');
  page.close();
}

(async () => {
  testPackaging();
  for (const name of SURFACES) {
    await testScopeMenuOffersUsableAggregates(name);
    await testTriggerRunsTheAggregate(name);
    await testEnterWhileARunIsPendingDoesNothingElse(name);
    await testDisablingASourceClearsTheActiveAggregate(name);
    await testNewAggregatesAppearWithoutReload(name);
  }
  await testSettings();
  console.log('aggregate search integration tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
