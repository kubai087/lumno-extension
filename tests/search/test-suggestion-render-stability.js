const assert = require('assert');
const suggestionModel = require('../../src/domain/search/suggestion-action-model.ts');
const { openSearchSurface } = require('../helpers/search-surfaces');
const { getPageScripts, runsBefore } = require('../helpers/runtime-scripts');

function verifyClassification() {
  const runtime = suggestionModel;
  const directBefore = {
    type: 'directUrl',
    title: '打开 https://code.0h',
    url: 'https://code.0h'
  };
  const directAfter = {
    type: 'directUrl',
    title: '打开 https://code.0htt',
    url: 'https://code.0htt'
  };
  const history = {
    type: 'history',
    title: 'Code',
    url: 'https://code.example/'
  };
  const bookmark = {
    type: 'bookmark',
    title: 'Docs',
    url: 'https://docs.example/'
  };
  const baseState = {
    actionContextKey: '0|navigation|mixed',
    lastRenderedActionContextKey: '0|navigation|mixed'
  };

  assert.strictEqual(
    runtime.getSuggestionStructureIdentity(directBefore),
    runtime.getSuggestionStructureIdentity(directAfter),
    'a growing direct URL should keep one semantic row identity'
  );
  assert.strictEqual(
    runtime.getSuggestionUpdateKind({
      ...baseState,
      currentSuggestions: [directBefore, history],
      allSuggestions: [directAfter, history]
    }),
    'content',
    'a direct URL text change should be local content work'
  );
  assert.strictEqual(
    runtime.getSuggestionUpdateKind({
      ...baseState,
      currentSuggestions: [history],
      allSuggestions: [{ ...history }]
    }),
    'highlight',
    'identical ordered results should only update highlights'
  );
  assert.strictEqual(
    runtime.getSuggestionUpdateKind({
      ...baseState,
      currentSuggestions: [{
        ...history,
        score: 120,
        visitCount: 4,
        typedCount: 2,
        lastVisitTime: 100,
        reasons: ['标题前缀']
      }],
      allSuggestions: [{
        ...history,
        score: 260,
        visitCount: 9,
        typedCount: 5,
        lastVisitTime: 200,
        reasons: ['URL 前缀']
      }]
    }),
    'highlight',
    'ranking metadata must not invalidate a visible row'
  );
  assert.strictEqual(
    runtime.getSuggestionUpdateKind({
      ...baseState,
      currentSuggestions: [history],
      allSuggestions: [{ ...history, title: 'Code Home' }]
    }),
    'content',
    'visible row text changes still require content work'
  );
  assert.strictEqual(
    runtime.getSuggestionUpdateKind({
      ...baseState,
      currentSuggestions: [history],
      allSuggestions: [history, bookmark]
    }),
    'append',
    'a stable prefix plus new rows should be an append'
  );
  assert.strictEqual(
    runtime.getSuggestionUpdateKind({
      ...baseState,
      currentSuggestions: [history, bookmark],
      allSuggestions: [bookmark, history]
    }),
    'structure',
    'reordered semantic rows require a structure update'
  );
  assert.strictEqual(
    runtime.getSuggestionUpdateKind({
      ...baseState,
      currentSuggestions: [directBefore],
      allSuggestions: [{ ...directAfter, _xMatchedTabId: 42 }]
    }),
    'structure',
    'changing from open to switch-tab is a semantic change'
  );
}

verifyClassification();
assert.ok(
  runsBefore(getPageScripts('newtab.html'), 'src/newtab/search/direct-navigation-settle.ts', 'src/newtab/app/main.ts'),
  'New Tab should load the direct-navigation settle controller before its page runtime'
);

// What the New Tab result list shows over time while answers come in: each
// distinct list of rows, as types (with #tabId for a row that switches).
const PRIORITY_KEY = '_x_extension_search_result_priority_2026_unique_';
const TABS = [{ id: 7, windowId: 1, title: 'Dev app', url: 'http://localhost:3000/app' }];
const later = (value, ms) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function framesWhileTyping(query, { localMs, priority }) {
  const surface = await openSearchSurface('newtab', {
    sync: priority ? { [PRIORITY_KEY]: priority } : {},
    respond(message) {
      if (message.action === 'getTabsForOverlay') return { tabs: TABS };
      if (message.action === 'getSearchSuggestions') {
        return later({ suggestions: [{ type: 'history', title: `Local ${message.query}`, url: 'https://local.test/' }] }, localMs);
      }
      if (message.action === 'getSearchEngineSuggestions') {
        return later({
          suggestions: (message.localSuggestions || []).concat([{ type: 'googleSuggest', title: `${message.query} x`, url: 'https://www.google.com/search?q=x' }]),
          hasRemoteSuggestions: true
        }, 200);
      }
      return undefined;
    }
  });
  await surface.settle(150);
  const tabsAskedBeforeTyping = surface.page.messages.some((message) => message.action === 'getTabsForOverlay');
  const frames = [];
  const snapshot = () => {
    const rows = surface.suggestions().map((row) => {
      const suggestion = row._xSuggestion || {};
      return `${suggestion.type}${suggestion._xMatchedTabId ? `#${suggestion._xMatchedTabId}` : ''}`;
    }).join(',');
    if (frames[frames.length - 1] !== rows) frames.push(rows);
  };
  const observer = new surface.window.MutationObserver(snapshot);
  observer.observe(surface.root, { subtree: true, childList: true, attributes: true });
  const input = surface.input();
  input.value = query;
  input.dispatchEvent(new surface.window.InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
  await surface.settle(900);
  observer.disconnect();
  surface.close();
  return { frames: frames.filter(Boolean), tabsAskedBeforeTyping };
}

(async () => {
  const matched = await framesWhileTyping('localhost:3000/app', { localMs: 300 });
  assert.ok(matched.tabsAskedBeforeTyping, 'New Tab should load its open tabs before the first input');
  assert.strictEqual(matched.frames[0], 'directUrl#7,newtab',
    'a typed URL that is already open should show its final switch row at once, before local results arrive');

  const fast = await framesWhileTyping('example.com/docs', { localMs: 30 });
  assert.strictEqual(fast.frames[0], 'directUrl,newtab,history',
    'when local results arrive quickly, the URL row should not flash on its own first');

  const slow = await framesWhileTyping('example.com/docs', { localMs: 600 });
  assert.deepStrictEqual(slow.frames.slice(0, 2), ['directUrl,newtab', 'directUrl,newtab,history'],
    'when local results are slow, the URL row should show first and keep its place');

  const searchFirst = await framesWhileTyping('cats', { localMs: 50, priority: 'search' });
  const firstLocal = searchFirst.frames.findIndex((frame) => frame.includes('history'));
  assert.ok(firstLocal > 0 && searchFirst.frames[firstLocal].includes('googleSuggest'),
    `search-first ordering should not flash local results before the search suggestions: ${searchFirst.frames.join(' | ')}`);

  console.log('suggestion render stability tests passed');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
