const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const sectionPanelSettings = require('../../src/newtab/section-panel-settings.ts');
const { readStylesheetSource } = require('../helpers/css-tokens');
const { parseCss } = require('../helpers/css-rules');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const dom = new JSDOM('<body></body>', { url: 'https://lumno.test/' });
  // Page state the runtime reads through getters and changes through setters.
  const page = {
    viewMode: 'folder',
    bookmarkCount: 8,
    bookmarkColumns: 6,
    folderIconsVisible: true,
    topbarLayout: 'docked',
    surfaceMode: 'adaptive',
    recentMode: 'most',
    recentCount: 0
  };
  const calls = [];
  let messages = {};
  let storageListener = null;
  const runtime = sectionPanelSettings.createRuntime({
    windowObj: dom.window,
    chromeObj: {
      storage: {
        onChanged: {
          addListener(listener) { storageListener = listener; },
          removeListener() { storageListener = null; }
        }
      }
    },
    t: (key, fallback) => messages[key] || fallback,
    watchedKeys: ['bookmark_count', 'recent_count'],
    getBookmarkViewMode: () => page.viewMode,
    setBookmarkViewMode: (mode) => { calls.push(['viewMode', mode]); page.viewMode = mode; },
    getBookmarkCount: () => page.bookmarkCount,
    setBookmarkCount: (value, options) => {
      calls.push(['bookmarkCount', value, options.persist]);
      page.bookmarkCount = value;
    },
    getBookmarkColumns: () => page.bookmarkColumns,
    setBookmarkColumns: (value, options) => {
      calls.push(['bookmarkColumns', value, options.persist]);
      page.bookmarkColumns = value;
    },
    getBookmarkFolderIconsVisible: () => page.folderIconsVisible,
    setBookmarkFolderIconsVisible: (value, options) => {
      calls.push(['folderIcons', value, options.persist]);
      page.folderIconsVisible = value;
    },
    getBookmarkTopbarLayout: () => page.topbarLayout,
    setBookmarkTopbarLayout: (layout) => { calls.push(['layout', layout]); page.topbarLayout = layout; },
    getBookmarkTopbarSurfaceMode: () => page.surfaceMode,
    setBookmarkTopbarSurfaceMode: (mode) => { calls.push(['surface', mode]); page.surfaceMode = mode; },
    pickBookmarkTopbarSurfaceColor: () => calls.push(['pickColor']),
    getRecentMode: () => page.recentMode,
    setRecentMode: (mode) => { calls.push(['recentMode', mode]); page.recentMode = mode; },
    getRecentCount: () => page.recentCount,
    setRecentCount: (value, options) => {
      calls.push(['recentCount', value, options.persist]);
      page.recentCount = value;
    }
  });

  // Stands in for the panel view: keeps the last model the runtime set.
  let model = null;
  runtime.settingsState.subscribe(() => {
    model = runtime.settingsState.getSnapshot().model;
  });
  const drag = { dragging: true, final: false };
  const settle = { dragging: false, final: true };
  runtime.bindSettings();

  // First render mirrors the page: bookmarks on (two rows), site cards off.
  assert.equal(model.bookmark.title, 'Bookmarks');
  assert.equal(model.bookmark.enabled, true);
  assert.equal(model.bookmark.expanded, false, 'Sections start collapsed like the shortcuts section');
  assert.equal(model.bookmark.rows.value, 2, 'Rows are the stored count in groups of four');
  assert.equal(model.bookmark.columns.value, 6);
  assert.equal(model.bookmark.rows.label, 'Bookmark rows');
  assert.equal(model.bookmark.folderIcons.checked, true);
  assert.equal(model.bookmark.topbarMode, false, 'Bar shape and background only apply to the top bar');
  assert.equal(model.bookmark.viewModeSelect.value, 'folder');
  assert.deepEqual(model.bookmark.viewModeSelect.options.map((option) => option.value), ['folder', 'list', 'top']);
  assert.equal(model.recent.enabled, false, 'A section that is off cannot be expanded');

  model.actions.toggleRecentExpanded();
  assert.equal(model.recent.expanded, false);
  model.actions.toggleBookmarkExpanded();
  assert.equal(model.bookmark.expanded, true);

  // Dragging previews every step; only the settled value is saved.
  model.actions.setBookmarkRows(3, drag);
  assert.deepEqual(calls.pop(), ['bookmarkCount', 12, false]);
  // A storage change for the old value lands mid-drag; the thumb stays where it is.
  page.bookmarkCount = 8;
  storageListener({ bookmark_count: { newValue: 8 } }, 'sync');
  await wait(5);
  assert.equal(model.bookmark.rows.value, 3);
  model.actions.setBookmarkRows(3, settle);
  assert.deepEqual(calls.pop(), ['bookmarkCount', 12, true]);
  assert.equal(page.bookmarkCount, 12);
  model.actions.setBookmarkRows(4, drag);
  assert.deepEqual(calls.pop(), ['bookmarkCount', 16, false]);
  await wait(200);
  assert.deepEqual(calls.pop(), ['bookmarkCount', 16, true], 'A pause in the drag saves the value');

  model.actions.setBookmarkColumns(8, drag);
  model.actions.setBookmarkColumns(8, settle);
  assert.deepEqual(calls.slice(-2), [['bookmarkColumns', 8, false], ['bookmarkColumns', 8, true]]);
  model.actions.setBookmarkFolderIconsVisible(false);
  assert.deepEqual(calls.pop(), ['folderIcons', false, true]);

  // The switch hides the section by saving zero rows, and brings back the last row count.
  model.actions.setBookmarkVisible(false);
  assert.deepEqual(calls.pop(), ['bookmarkCount', 0, true]);
  assert.equal(model.bookmark.enabled, false);
  assert.equal(model.bookmark.rows.value, 4, 'The rows slider keeps the count it will restore');
  model.actions.setBookmarkVisible(true);
  assert.deepEqual(calls.pop(), ['bookmarkCount', 16, true]);
  assert.equal(model.bookmark.expanded, true, 'Turning it back on keeps it expanded');

  // The top bar swaps rows and columns for its shape and background.
  model.bookmark.viewModeSelect.onChange('top');
  assert.deepEqual(calls.pop(), ['viewMode', 'top']);
  assert.equal(model.bookmark.topbarMode, true);
  assert.equal(model.bookmark.viewModeSelect.value, 'top');
  model.actions.setBookmarkTopbarLayout('floating');
  assert.deepEqual(calls.pop(), ['layout', 'floating']);
  assert.equal(model.bookmark.topbarLayout.active, 'floating');
  // Liquid glass moved to the page-wide Style setting; the bar's background offers match style,
  // transparent and a custom color.
  const surface = () => model.bookmark.topbarSurfaceSelect;
  assert.deepEqual(surface().options.map((option) => option.value), ['adaptive', 'transparent', 'custom']);
  assert.equal(surface().onChange('clear'), false);
  assert.equal(surface().onChange('transparent'), undefined);
  assert.deepEqual(calls.pop(), ['surface', 'transparent']);
  assert.equal(surface().value, 'transparent');
  assert.equal(surface().options.find((option) => option.value === 'transparent').checked, true);
  assert.equal(surface().onChange('custom'), false, 'Custom color stays unselected until the color picker returns a color');
  assert.deepEqual(calls.pop(), ['pickColor']);
  assert.equal(surface().options.find((option) => option.value === 'custom').trailingIconName, 'ri-dropper-line');

  // Site cards: on restores one row and opens its settings; rows and mode save at once.
  model.actions.setRecentVisible(true);
  assert.deepEqual(calls.pop(), ['recentCount', 4, true]);
  assert.equal(model.recent.enabled, true);
  assert.equal(model.recent.expanded, true);
  assert.equal(model.recent.rows.active, '1');
  model.actions.setRecentRows('2');
  assert.deepEqual(calls.pop(), ['recentCount', 8, true]);
  assert.equal(model.recent.rows.active, '2');
  assert.equal(model.recent.mode.active, 'most');
  model.actions.setRecentMode('latest');
  assert.deepEqual(calls.pop(), ['recentMode', 'latest']);

  // Changes made elsewhere (Options page, the section menus) show up in the panel.
  page.recentCount = 0;
  page.viewMode = 'list';
  storageListener({ unrelated_key: { newValue: 1 } }, 'local');
  await wait(5);
  assert.equal(model.recent.enabled, true, 'Unrelated keys do not re-render the panel');
  storageListener({ recent_count: { newValue: 0 } }, 'sync');
  await wait(5);
  assert.equal(model.recent.enabled, false);
  assert.equal(model.bookmark.viewModeSelect.value, 'list');
  assert.equal(model.bookmark.topbarMode, false);
  assert.equal(model.recent.rows.active, '2', 'An off section still shows the rows it will restore');

  messages = { bookmarks_heading: '书签', settings_recent_sites_title: '站点卡片', newtab_recent_rows_title: '站点卡片行数' };
  runtime.updateLanguage();
  assert.equal(model.bookmark.title, '书签');
  assert.equal(model.recent.title, '站点卡片');
  assert.equal(model.recent.rowsLabel, '站点卡片行数');

  runtime.destroy();
  assert.equal(storageListener, null, 'Destroy stops listening for storage changes');

  // Collapsible bodies animate their height; their rows must not shrink with it, or they
  // squeeze together and spread apart while a section opens.
  const css = parseCss(readStylesheetSource('src/newtab/newtab.css'));
  ['.x-nt-panel-section-body', '.x-nt-quote-body', '.x-nt-panel-field-group'].forEach((body) => {
    const rows = css.rule(`${body} > *`);
    assert.strictEqual(rows && rows.get('flex-shrink'), '0', `${body} rows keep their height while it animates`);
  });
  console.log('newtab section panel settings tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
