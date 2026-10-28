const assert = require('assert');
const vm = require('vm');
const { moduleScript } = require('../helpers/module-script');

// The search shortcut's focus reload carries the query, its search mode and
// the results on screen, and holds the old frame until they are back.

const STORAGE_KEY = 'lumno:newtab-focus-resume';

function createElement(tagName) {
  const attributes = new Map();
  return {
    tagName,
    textContent: '',
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    removeAttribute: (name) => attributes.delete(name),
    hasAttribute: (name) => attributes.has(name)
  };
}

function bootPage(options = {}) {
  const store = new Map(Object.entries(options.storage || {}));
  const documentElement = createElement('HTML');
  const body = createElement('BODY');
  if (options.ready !== false) {
    body.setAttribute('data-nt-ready', '1');
  }
  const styles = [];
  const head = { appendChild: (node) => styles.push(node) };
  const windowListeners = {};
  const observers = [];
  const document = {
    documentElement,
    body,
    head,
    createElement,
    querySelector: (selector) => (selector.startsWith('style[') ? styles[0] || null : null)
  };
  const context = vm.createContext({
    document,
    location: { protocol: options.protocol || 'chrome-extension:' },
    sessionStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key)
    },
    localStorage: null,
    performance: { mark() {} },
    console: { warn() {} },
    Promise,
    JSON,
    Date,
    Number,
    String,
    Array,
    Boolean,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    addEventListener: (name, listener) => { windowListeners[name] = listener; },
    MutationObserver: function(callback) {
      observers.push(callback);
      this.observe = () => {};
      this.disconnect = () => {};
    }
  });
  context.globalThis = context;
  vm.runInContext(moduleScript('src/newtab/focus-resume.ts', 'LumnoNewtabFocusResume'), context);
  return {
    api: context.LumnoNewtabFocusResume,
    documentElement,
    body,
    styles,
    store,
    windowListeners,
    markReady() {
      body.setAttribute('data-nt-ready', '1');
      observers.forEach((callback) => callback());
    }
  };
}

const { SearchQuery } = require('../../src/shared/search-panel/search-query.ts');
const { SearchMode } = require('../../src/shared/search-panel/search-mode.ts');
const { SearchResults } = require('../../src/shared/search-panel/search-results.ts');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createResume(page, overrides = {}) {
  const calls = [];
  const input = {
    value: '',
    select() { calls.push(['select']); }
  };
  const searchQuery = new SearchQuery();
  searchQuery.set(overrides.rawQuery || '');
  const searchMode = new SearchMode();
  const searchResults = new SearchResults();
  searchResults.setLastResponse(overrides.lastResponse || []);
  searchResults.select(overrides.selectedIndex === undefined ? -1 : overrides.selectedIndex);
  if (overrides.site) searchMode.enterSite(overrides.site);
  const pageState = {
    inputParts: { input },
    ...overrides.pageState
  };
  const providers = { 'provider:gh': { key: 'gh', name: 'GitHub' } };
  const resume = page.api.createFocusResume({
    getSiteSearchSnapshotId: (provider) => `provider:${provider.key}`,
    findSiteSearchBySnapshotId: (id) => providers[id] || null,
    activateSiteSearch: (provider, options) => {
      calls.push(['site', provider.key, options.preserveResults]);
      input.value = '';
    },
    activateLocalSearchScope: (scope) => {
      calls.push(['local', scope.sourceType]);
      input.value = '';
    },
    restoreSearchModeQuery: (rawQuery) => {
      calls.push(['query', rawQuery]);
      input.value = rawQuery;
    },
    showSuggestionSnapshot: (suggestions, query, selectedIndex) => {
      calls.push(['results', suggestions.length, query, selectedIndex]);
      return wait(5).then(() => calls.push(['rendered']));
    },
    focusSearchInputPreservingScroll: () => calls.push(['focus']),
    searchQuery,
    searchMode,
    searchResults,
    pageState
  });
  return { resume, calls, input, pageState, searchResults };
}

function snapshot(fields) {
  return JSON.stringify({ savedAt: Date.now(), rawQuery: '', siteSearchId: '', localSourceType: '', suggestions: [], selectedIndex: -1, ...fields });
}

async function main() {
  // Saving: what the user typed, its mode and the results, plus the opt-in.
  {
    const page = bootPage();
    const { resume, input, searchResults } = createResume(page, {
      rawQuery: 'git',
      site: { key: 'gh' },
      lastResponse: [{ url: 'https://github.com' }],
      selectedIndex: 2,
      pageState: {
      }
    });
    input.value = 'github.com';
    assert.strictEqual(resume.prepareFocusReload(), true);
    const saved = JSON.parse(page.store.get(STORAGE_KEY));
    assert.strictEqual(saved.rawQuery, 'git', 'inline autocomplete text is not part of the query');
    assert.strictEqual(saved.siteSearchId, 'provider:gh');
    assert.deepStrictEqual(saved.suggestions, searchResults.lastResponse);
    assert.strictEqual(saved.selectedIndex, 2);
    assert.match(page.styles[0].textContent, /@view-transition \{ navigation: auto; \}/);
  }

  // A plain New Tab load or a stale snapshot is not a resume.
  {
    assert.strictEqual(bootPage().api.prepareResumeLoad(), false);
    const stale = bootPage({
      storage: { [STORAGE_KEY]: JSON.stringify({ savedAt: Date.now() - 60000 }) }
    });
    assert.strictEqual(stale.api.prepareResumeLoad(), false);
    assert.strictEqual(stale.documentElement.getAttribute('data-nt-focus-resume'), null);
  }

  // The reloaded page restores the mode first, then the query and results,
  // and reveals itself only once they are rendered and the page is ready.
  {
    const page = bootPage({
      ready: false,
      storage: {
        [STORAGE_KEY]: snapshot({
          rawQuery: 'react ',
          siteSearchId: 'provider:gh',
          suggestions: [{ url: 'a' }, { url: 'b' }],
          selectedIndex: 1
        })
      }
    });
    assert.strictEqual(page.api.prepareResumeLoad(), true);
    assert.strictEqual(page.documentElement.getAttribute('data-nt-focus-resume'), 'true');
    assert.strictEqual(page.documentElement.getAttribute('data-nt-focus-route-pending'), 'true');
    assert.strictEqual(page.documentElement.getAttribute('data-nt-focus-resume-settling'), 'true');
    assert.match(page.styles[0].textContent, /::view-transition-old\(root\)/);
    let skipped = 0;
    page.windowListeners.pagereveal({ viewTransition: { skipTransition: () => { skipped += 1; } } });

    const { resume, calls } = createResume(page);
    const done = resume.resume(Promise.resolve());
    await wait(20);
    assert.deepStrictEqual(calls.slice(0, 5), [
      ['site', 'gh', true],
      ['query', 'react '],
      ['results', 2, 'react', 1],
      ['select'],
      ['rendered']
    ]);
    assert.strictEqual(page.store.has(STORAGE_KEY), false, 'the snapshot is used once');
    assert.strictEqual(page.documentElement.getAttribute('data-nt-focus-route-pending'), 'true',
      'the page stays hidden until it is ready');
    assert.strictEqual(skipped, 0);
    page.markReady();
    assert.strictEqual(await done, true);
    assert.strictEqual(page.documentElement.getAttribute('data-nt-focus-route-pending'), null);
    assert.strictEqual(skipped, 1, 'the held old frame gives way at once');
    assert.deepStrictEqual(calls[calls.length - 1], ['focus']);
    await wait(10);
    assert.strictEqual(page.documentElement.getAttribute('data-nt-focus-resume-settling'), null);
  }

  // A local search scope comes back the same way.
  {
    const page = bootPage({
      storage: { [STORAGE_KEY]: snapshot({ rawQuery: 'docs', localSourceType: 'bookmark' }) }
    });
    page.api.prepareResumeLoad();
    const { resume, calls } = createResume(page);
    await resume.resume(Promise.resolve());
    assert.deepStrictEqual(calls[0], ['local', 'bookmark']);
    assert.deepStrictEqual(calls[1], ['query', 'docs']);
  }

  // A page that never gets ready still shows up after the hold runs out.
  {
    const page = bootPage({ ready: false, storage: { [STORAGE_KEY]: snapshot({}) } });
    page.api.prepareResumeLoad();
    const { resume } = createResume(page);
    resume.resume(Promise.resolve());
    await wait(1300);
    assert.strictEqual(page.documentElement.getAttribute('data-nt-focus-route-pending'), null);
  }

  console.log('newtab focus resume tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
