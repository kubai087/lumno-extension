const assert = require('assert');
const fs = require('fs');
const settings = require('../src/shared/settings.js');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const optionsHtml = read('src/options/options.html');
const optionsSource = read('src/options/options.js');
const newtabSource = read('src/newtab/newtab.js');
const overlaySource = read('src/overlay/search-panel.js');
const overlayRuntimeSource = read('src/overlay/runtime.js');
const overlaySuggestionsStyles = read('src/overlay/suggestions-view.css');
const suggestionNavigation = require('../src/shared/suggestion-navigation.js');

const sourcesIndex = optionsHtml.indexOf('data-i18n="settings_search_result_sources_title"');
const displayLimitIndex = optionsHtml.indexOf('data-i18n="settings_search_result_display_limit_title"');
const openTabsIndex = optionsHtml.indexOf('data-i18n="settings_overlay_open_tabs_default_visible_title"');
assert(sourcesIndex >= 0 && displayLimitIndex > sourcesIndex && openTabsIndex > displayLimitIndex,
  'result display limit should sit between result types and default open tabs');

assert.match(optionsSource,
  /kind: 'search-result-display-limit'[\s\S]*?min: 5,[\s\S]*?max: 10,[\s\S]*?step: 1,/,
  'Options should reuse the range-slider controller with a 5-10 integer range');
assert.match(optionsSource,
  /ticks: \[\s*\{ align: 'start', label: '5' \},\s*\{ align: 'end', label: '10' \}\s*\]/,
  'the minimum and maximum tick labels should align to the two slider endpoints');
assert.match(optionsHtml,
  /#_x_extension_bookmark_rows_control_2026_unique_,[\s\S]*?#_x_extension_search_result_display_limit_control_2026_unique_ \{[\s\S]*?width: 210px;/,
  'the result limit should reuse the existing slider width pattern');

assert.strictEqual(
  settings.SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY,
  '_x_extension_search_result_display_limit_2026_unique_'
);
assert(settings.CHROME_SYNC_STORAGE_KEYS.includes(settings.SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY));
assert.match(overlayRuntimeSource,
  /searchResultDisplayLimit: '_x_extension_search_result_display_limit_2026_unique_'/,
  'overlay runtime should expose the synced display-limit key');

[newtabSource, overlaySource].forEach((source) => {
  assert.match(source,
    /limitSearchSuggestionsForDisplay\(list, \{\s*limit: (?:searchResultDisplayLimit|overlaySearchResultDisplayLimit)\s*\}\)/,
    'each search surface should pass the configurable limit to shared display limiting');
  assert.match(source,
    /uncapped: slashCommandModeActive/,
    'slash-command discovery should stay uncapped');
});
assert.match(newtabSource,
  /changes\[SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY\][\s\S]*?renderSuggestions\(lastSuggestionResponse, latestQuery\)/,
  'New Tab should re-render current results when the limit changes');
assert.match(overlaySource,
  /changes\[SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY\][\s\S]*?refreshOverlaySuggestionsFromLastResponse\(\)/,
  'overlay should re-render current results when the limit changes');
assert.doesNotMatch(overlaySource,
  /function limitOverlayTabsForDisplay\(list\)[\s\S]*?slice\(0, normalizeSearchResultDisplayLimit\(overlaySearchResultDisplayLimit\)\)/,
  'overlay should not truncate opened-tab results before rendering');
assert.match(overlaySource,
  /function setOpenTabsResultsViewport\(active, itemCount\)[\s\S]*?getComputedStyle\(suggestionsContainer\)[\s\S]*?getVisibleRowsViewportHeight\([\s\S]*?--x-ov-suggestion-row-height[\s\S]*?--x-ov-suggestion-row-gap/,
  'overlay should derive the opened-tab viewport from the rendered CSS row tokens');
assert.match(overlaySuggestionsStyles,
  /\.x-ov-suggestions-container\[data-open-tabs-visible-row-limit\] \{[\s\S]*?scrollbar-width:\s*thin;[\s\S]*?scrollbar-color:/,
  'the scrollable opened-tab viewport should restore its visible scrollbar');
assert.match(overlaySuggestionsStyles,
  /\.x-ov-suggestions-container\[data-open-tabs-visible-row-limit\] \{[\s\S]*?--x-ov-open-tabs-scrollbar-gutter:\s*10px;[\s\S]*?scrollbar-gutter:\s*stable;[\s\S]*?padding-inline-end:\s*max\([\s\S]*?var\(--x-ov-results-inset,\s*12px\)[\s\S]*?var\(--x-ov-open-tabs-scrollbar-gutter,\s*10px\)/,
  'opened-tab rows should give the measured scrollbar gutter back to the right inset instead of shrinking their text column');
assert.match(overlaySource,
  /function syncOpenTabsScrollbarGutter\(computedStyle\)[\s\S]*?offsetWidth[\s\S]*?clientWidth[\s\S]*?--x-ov-open-tabs-scrollbar-gutter/,
  'overlay should measure the browser scrollbar gutter instead of assuming an OS-specific width');
assert.match(overlaySource,
  /function setOpenTabsResultsViewport\(active, itemCount\)[\s\S]*?removeProperty\('--x-ov-open-tabs-scrollbar-gutter'\)[\s\S]*?syncOpenTabsScrollbarGutter\(computedStyle\)[\s\S]*?requestAnimationFrame\([\s\S]*?syncOpenTabsScrollbarGutter\(\)/,
  'opened-tab viewport changes should refresh gutter compensation and clear it for ordinary results');
assert.match(overlaySource,
  /const revealOverlay = \(options\) => \{[\s\S]*?overlayRevealGate\.release\(\);[\s\S]*?syncOpenTabsScrollbarGutter\(\);/,
  'the style-gated overlay reveal should measure the native gutter once more before rows become visible');
assert.match(overlaySuggestionsStyles,
  /\.x-ov-suggestions-container\[data-open-tabs-visible-row-limit\]::\-webkit-scrollbar-thumb \{[\s\S]*?border-radius:\s*999px;[\s\S]*?background-color:/,
  'Chromium should render the opened-tab scrollbar thumb');
assert.match(overlaySource,
  /changes\[SEARCH_RESULT_DISPLAY_LIMIT_STORAGE_KEY\][\s\S]*?openTabsSearchModeActive[\s\S]*?shouldShowOpenTabsForEmptyQuery\(\)[\s\S]*?renderTabSuggestions\(filterTabsForOverlay\(tabs, latestOverlayQuery\)\)/,
  'overlay should immediately re-render visible opened tabs when the limit changes');
assert.match(overlaySource,
  /function renderTabSuggestions\(tabList\)[\s\S]*?const list = Array\.isArray\(tabList\) \? tabList\.slice\(\) : \[\];[\s\S]*?setOpenTabsResultsViewport\(true, list\.length\);[\s\S]*?reactView\.renderTabs\(list\);/,
  'both default and searched opened-tab lists should render in full inside the capped viewport');
assert.match(overlaySource,
  /allSuggestions = limitOverlaySuggestionsForDisplay\(allSuggestions,[\s\S]*?setOpenTabsResultsViewport\(false\);[\s\S]*?reactView\.render\(\{/,
  'ordinary search results should clear the opened-tab viewport override and remain data-limited');
assert.match(overlaySource,
  /function filterTabsForOverlay\(tabList, queryText\) \{\s*const list = Array\.isArray\(tabList\) \? tabList : \[\];/,
  'opened-tab matching should search the complete tab list before display limiting');

assert.strictEqual(
  suggestionNavigation.getVisibleRowsViewportHeight({
    visibleRowLimit: 5,
    itemCount: 10,
    rowHeight: 52,
    rowGap: 4,
    paddingTop: 12,
    paddingBottom: 12
  }),
  304,
  'a scrollable viewport should include the gap after the last visible row'
);
assert.strictEqual(
  suggestionNavigation.getVisibleRowsViewportHeight({
    visibleRowLimit: 5,
    itemCount: 5,
    rowHeight: 52,
    rowGap: 4,
    paddingTop: 12,
    paddingBottom: 12
  }),
  300,
  'a complete five-row list should not reserve a trailing row gap'
);
assert.strictEqual(
  suggestionNavigation.getVisibleRowsViewportHeight({
    visibleRowLimit: 5,
    itemCount: 0,
    rowHeight: 52,
    rowGap: 4,
    paddingTop: 12,
    paddingBottom: 12
  }),
  0,
  'an empty list should not force a viewport height'
);

['en', 'ja', 'zh_CN', 'zh_TW'].forEach((locale) => {
  const messages = JSON.parse(read(`_locales/${locale}/messages.json`));
  assert(messages.settings_search_result_display_limit_title?.message,
    `${locale} should localize the result display limit label`);
});

console.log('search result display limit setting tests passed');
