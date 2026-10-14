const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const sectionPanelSettings = require('../src/newtab/section-panel-settings.js');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const dom = new JSDOM('<body></body>', { url: 'https://lumno.test/' });
  const { document } = dom.window;
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

  // Stands in for the panel view: the refs it marks and the dropdowns it renders.
  const element = (tag, attributes = {}) => {
    const node = document.createElement(tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    document.body.appendChild(node);
    return node;
  };
  const tabs = (attribute, values) => {
    const group = element('div');
    group.appendChild(document.createElement('span')).className = 'x-nt-segmented-tabs-indicator';
    values.forEach((value) => group.appendChild(document.createElement('button')).setAttribute(attribute, value));
    return group;
  };
  const slider = (min, max) => element('input', { type: 'range', min, max, step: '1' });
  const refs = {
    bookmarkSettingsSection: element('div'),
    bookmarkSettingsTitle: element('span'),
    bookmarkSettingsTrigger: element('button'),
    bookmarkSettingsToggle: element('input', { type: 'checkbox' }),
    bookmarkSettingsBody: element('div', { hidden: '' }),
    bookmarkViewModeLabel: element('span'),
    bookmarkGridSettings: element('div'),
    bookmarkRowsLabel: element('span'),
    bookmarkRowsSlider: slider('1', '8'),
    bookmarkColumnsLabel: element('span'),
    bookmarkColumnsSlider: slider('4', '8'),
    bookmarkFolderIconsTitle: element('span'),
    bookmarkFolderIconsToggle: element('input', { type: 'checkbox' }),
    bookmarkTopbarSettings: element('div', { hidden: '' }),
    bookmarkTopbarLayoutLabel: element('span'),
    bookmarkTopbarLayoutTabs: tabs('data-bookmark-topbar-layout', ['docked', 'floating']),
    bookmarkTopbarSurfaceLabel: element('span'),
    recentSettingsSection: element('div'),
    recentSettingsTitle: element('span'),
    recentSettingsTrigger: element('button'),
    recentSettingsToggle: element('input', { type: 'checkbox' }),
    recentSettingsBody: element('div', { hidden: '' }),
    recentModeLabel: element('span'),
    recentModeTabs: tabs('data-recent-mode', ['latest', 'most', 'custom']),
    recentRowsLabel: element('span'),
    recentRowsTabs: tabs('data-recent-rows', ['1', '2'])
  };
  const selects = {};
  const view = {
    renderBookmarkViewModeSelect(model) { selects.viewMode = model; },
    renderBookmarkTopbarSurfaceSelect(model) { selects.surface = model; }
  };
  const syncedSliders = [];
  runtime.bindSettings(refs, view, {
    bindSliderValueInput() {},
    syncSliderValueInput(input) { syncedSliders.push(input); }
  });

  // First render mirrors the page: bookmarks on (two rows), site cards off.
  assert.equal(refs.bookmarkSettingsTitle.textContent, 'Bookmarks');
  assert.equal(refs.bookmarkSettingsToggle.checked, true);
  assert.equal(refs.bookmarkSettingsTrigger.disabled, false);
  assert.equal(refs.bookmarkSettingsBody.hidden, true, 'Sections start collapsed like the shortcuts section');
  assert.equal(refs.bookmarkRowsSlider.value, '2', 'Rows are the stored count in groups of four');
  assert.equal(refs.bookmarkColumnsSlider.value, '6');
  assert.equal(refs.bookmarkRowsSlider.getAttribute('aria-label'), 'Bookmark rows');
  assert(syncedSliders.includes(refs.bookmarkRowsSlider), 'The value input beside each slider is kept in step');
  assert.equal(refs.bookmarkFolderIconsToggle.checked, true);
  assert.equal(refs.bookmarkGridSettings.hidden, false);
  assert.equal(refs.bookmarkTopbarSettings.hidden, true, 'Bar shape and background only apply to the top bar');
  assert.equal(selects.viewMode.value, 'folder');
  assert.deepEqual(selects.viewMode.options.map((option) => option.value), ['folder', 'list', 'top']);
  assert.equal(refs.recentSettingsToggle.checked, false);
  assert.equal(refs.recentSettingsTrigger.disabled, true, 'A section that is off cannot be expanded');
  assert.equal(refs.recentSettingsBody.hidden, true);

  refs.recentSettingsTrigger.click();
  assert.equal(refs.recentSettingsBody.hidden, true);
  refs.bookmarkSettingsTrigger.click();
  assert.equal(refs.bookmarkSettingsBody.hidden, false);
  assert.equal(refs.bookmarkSettingsTrigger.getAttribute('aria-expanded'), 'true');

  // Dragging previews every step; only the settled value is saved.
  refs.bookmarkRowsSlider.value = '3';
  refs.bookmarkRowsSlider.dispatchEvent(new dom.window.Event('input'));
  assert.deepEqual(calls.pop(), ['bookmarkCount', 12, false]);
  // A storage change for the old value lands mid-drag; the thumb stays where it is.
  page.bookmarkCount = 8;
  storageListener({ bookmark_count: { newValue: 8 } }, 'sync');
  await wait(5);
  assert.equal(refs.bookmarkRowsSlider.value, '3');
  refs.bookmarkRowsSlider.dispatchEvent(new dom.window.Event('change'));
  assert.deepEqual(calls.pop(), ['bookmarkCount', 12, true]);
  assert.equal(page.bookmarkCount, 12);
  refs.bookmarkRowsSlider.value = '4';
  refs.bookmarkRowsSlider.dispatchEvent(new dom.window.Event('input'));
  assert.deepEqual(calls.pop(), ['bookmarkCount', 16, false]);
  await wait(200);
  assert.deepEqual(calls.pop(), ['bookmarkCount', 16, true], 'A pause in the drag saves the value');

  refs.bookmarkColumnsSlider.value = '8';
  refs.bookmarkColumnsSlider.dispatchEvent(new dom.window.Event('input'));
  refs.bookmarkColumnsSlider.dispatchEvent(new dom.window.Event('change'));
  assert.deepEqual(calls.slice(-2), [['bookmarkColumns', 8, false], ['bookmarkColumns', 8, true]]);
  refs.bookmarkFolderIconsToggle.click();
  assert.deepEqual(calls.pop(), ['folderIcons', false, true]);

  // The switch hides the section by saving zero rows, and brings back the last row count.
  refs.bookmarkSettingsToggle.click();
  assert.deepEqual(calls.pop(), ['bookmarkCount', 0, true]);
  assert.equal(refs.bookmarkSettingsBody.hidden, true);
  assert.equal(refs.bookmarkSettingsTrigger.disabled, true);
  assert.equal(refs.bookmarkRowsSlider.value, '4', 'The rows slider keeps the count it will restore');
  refs.bookmarkSettingsToggle.click();
  assert.deepEqual(calls.pop(), ['bookmarkCount', 16, true]);
  assert.equal(refs.bookmarkSettingsBody.hidden, false, 'Turning it back on keeps it expanded');

  // The top bar swaps rows and columns for its shape and background.
  selects.viewMode.onChange('top');
  assert.deepEqual(calls.pop(), ['viewMode', 'top']);
  assert.equal(refs.bookmarkGridSettings.hidden, true);
  assert.equal(refs.bookmarkTopbarSettings.hidden, false);
  assert.equal(selects.viewMode.value, 'top');
  refs.bookmarkTopbarLayoutTabs.querySelector('[data-bookmark-topbar-layout="floating"]').click();
  assert.deepEqual(calls.pop(), ['layout', 'floating']);
  assert.equal(
    refs.bookmarkTopbarLayoutTabs.querySelector('[data-active="true"]').getAttribute('data-bookmark-topbar-layout'),
    'floating'
  );
  assert.equal(selects.surface.onChange('clear'), undefined);
  assert.deepEqual(calls.pop(), ['surface', 'clear']);
  assert.equal(selects.surface.value, 'clear');
  assert.equal(selects.surface.options.find((option) => option.value === 'clear').checked, true);
  assert.equal(
    selects.surface.onChange('custom'),
    false,
    'Custom color stays unselected until the color picker returns a color'
  );
  assert.deepEqual(calls.pop(), ['pickColor']);
  assert.equal(selects.surface.options.find((option) => option.value === 'custom').trailingIconClass, 'ri-dropper-line');

  // Site cards: on restores one row, and rows and mode save at once.
  refs.recentSettingsToggle.click();
  assert.deepEqual(calls.pop(), ['recentCount', 4, true]);
  assert.equal(refs.recentSettingsTrigger.disabled, false);
  refs.recentSettingsTrigger.click();
  assert.equal(refs.recentSettingsBody.hidden, false);
  assert.equal(refs.recentRowsTabs.querySelector('[data-active="true"]').getAttribute('data-recent-rows'), '1');
  refs.recentRowsTabs.querySelector('[data-recent-rows="2"]').click();
  assert.deepEqual(calls.pop(), ['recentCount', 8, true]);
  assert.equal(refs.recentRowsTabs.querySelector('[data-recent-rows="2"]').getAttribute('aria-pressed'), 'true');
  assert.equal(refs.recentModeTabs.querySelector('[data-active="true"]').getAttribute('data-recent-mode'), 'most');
  refs.recentModeTabs.querySelector('[data-recent-mode="latest"]').click();
  assert.deepEqual(calls.pop(), ['recentMode', 'latest']);

  // Changes made elsewhere (Options page, the section menus) show up in the panel.
  page.recentCount = 0;
  page.viewMode = 'list';
  storageListener({ unrelated_key: { newValue: 1 } }, 'local');
  await wait(5);
  assert.equal(refs.recentSettingsToggle.checked, true, 'Unrelated keys do not re-render the panel');
  storageListener({ recent_count: { newValue: 0 } }, 'sync');
  await wait(5);
  assert.equal(refs.recentSettingsToggle.checked, false);
  assert.equal(refs.recentSettingsBody.hidden, true);
  assert.equal(selects.viewMode.value, 'list');
  assert.equal(refs.bookmarkGridSettings.hidden, false);
  assert.equal(
    refs.recentRowsTabs.querySelector('[data-active="true"]').getAttribute('data-recent-rows'),
    '2',
    'An off section still shows the rows it will restore'
  );

  messages = { bookmarks_heading: '书签', settings_recent_sites_title: '站点卡片', newtab_recent_rows_title: '站点卡片行数' };
  runtime.updateLanguage();
  assert.equal(refs.bookmarkSettingsTitle.textContent, '书签');
  assert.equal(refs.bookmarkSettingsToggle.getAttribute('aria-label'), '书签');
  assert.equal(refs.recentSettingsTitle.textContent, '站点卡片');
  assert.equal(refs.recentRowsLabel.textContent, '站点卡片行数');

  runtime.destroy();
  assert.equal(storageListener, null, 'Destroy stops listening for storage changes');

  // Collapsible bodies animate their height; their rows must not shrink with it, or they
  // squeeze together and spread apart while a section opens.
  const css = fs.readFileSync(path.join(__dirname, '../src/newtab/newtab.css'), 'utf8');
  const noShrinkRule = css.match(/((?:\.[\w-]+ > \*,\s*)*\.[\w-]+ > \*)\s*\{\s*flex-shrink:\s*0;\s*\}/);
  assert(noShrinkRule, 'Panel section rows keep their height while the body animates');
  ['.x-nt-panel-section-body', '.x-nt-quote-body', '.x-nt-panel-field-group'].forEach((body) => {
    assert(noShrinkRule[1].includes(`${body} > *`), `${body} rows keep their height while it animates`);
  });
  console.log('newtab section panel settings tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
