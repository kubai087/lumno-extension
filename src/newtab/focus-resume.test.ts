import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SiteSearchProvider } from '../domain/search/types';
import { newtabFocusResume } from '../domain/settings/page-cache';
import type { Suggestion } from '../shared/react/search/suggestion-list/types';
import { SearchModeActions } from '../shared/search-panel/mode-actions';
import { SearchMode } from '../shared/search-panel/search-mode';
import { SearchQuery } from '../shared/search-panel/search-query';
import { SearchResults } from '../shared/search-panel/search-results';
import { createModeParts } from '../../tests/fakes/search-input-mode';
import { getElement } from '../../tests/fakes/dom';
import { createFocusResume, prepareResumeLoad } from './focus-resume';
import { SearchBoxParts } from './search/search-box-parts';

// The search shortcut's focus reload carries the query, its search mode and
// the results on screen, and holds the old frame until they are back.
const STORAGE_KEY = newtabFocusResume.key;
const root = document.documentElement;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ResumeSetUp {
  rawQuery?: string;
  site?: SiteSearchProvider;
  lastResponse?: Suggestion[];
  selectedIndex?: number;
}

function createResume(setUp: ResumeSetUp = {}) {
  const calls: unknown[][] = [];
  const parts = createModeParts();
  const input = parts.input;
  vi.spyOn(input, 'select').mockImplementation(() => calls.push(['select']));
  const searchBox = new SearchBoxParts();
  searchBox.mountInput(parts);
  vi.spyOn(searchBox, 'focusInput').mockImplementation(() => calls.push(['focus']) > 0);
  const searchQuery = new SearchQuery();
  searchQuery.set(setUp.rawQuery || '');
  const searchMode = new SearchMode<SiteSearchProvider>();
  if (setUp.site) searchMode.enterSite(setUp.site);
  const searchResults = new SearchResults<Suggestion>();
  searchResults.setLastResponse(setUp.lastResponse || []);
  searchResults.select(setUp.selectedIndex === undefined ? -1 : setUp.selectedIndex);
  const modeActions = new SearchModeActions<SiteSearchProvider>({
    settings: { get: (setting) => setting.default },
    locale: { t: (_key, fallback) => fallback, formatMessage: (_key, fallback) => fallback },
    mode: searchMode,
    query: searchQuery,
    autocomplete: { clear() {} },
    source: { cancel() {} },
    surface: {
      getInput: () => input,
      getModeController: () => null,
      defaultTheme: {},
      getImmediateTheme: () => ({}),
      getThemeForProvider: async () => null
    }
  });
  // Records the mode changes instead of drawing them.
  vi.spyOn(modeActions, 'activateSiteSearch').mockImplementation((provider, options) => {
    calls.push(['site', provider && provider.key, options && options.preserveResults]);
    input.value = '';
  });
  vi.spyOn(modeActions, 'activateLocalSearchScope').mockImplementation((scope) => {
    calls.push(['local', scope && scope.sourceType]);
    input.value = '';
    return true;
  });
  vi.spyOn(modeActions, 'restoreSearchModeQuery').mockImplementation((rawQuery) => {
    calls.push(['query', rawQuery]);
    input.value = String(rawQuery);
  });
  const providers: Record<string, SiteSearchProvider> = { 'provider:gh': { key: 'gh', name: 'GitHub' } };
  const resume = createFocusResume({
    getSiteSearchSnapshotId: (provider) => `provider:${provider.key}`,
    findSiteSearchBySnapshotId: (id) => providers[id] || null,
    modeActions,
    showSuggestionSnapshot: (suggestions, query, selectedIndex) => {
      calls.push(['results', suggestions.length, query, selectedIndex]);
      return wait(5).then(() => {
        calls.push(['rendered']);
      });
    },
    searchQuery,
    searchMode,
    searchResults,
    searchBox
  });
  return { resume, calls, input, searchResults };
}

function saveSnapshot(fields: Record<string, unknown>): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
    savedAt: Date.now(), rawQuery: '', siteSearchId: '', localSourceType: '', suggestions: [], selectedIndex: -1, ...fields
  }));
}

function transitionStyle(): string {
  return getElement(document, 'style[data-nt-focus-resume-transition]').textContent || '';
}

describe('New Tab focus resume', () => {
  afterEach(() => {
    vi.useRealTimers();
    window.sessionStorage.clear();
    document.head.replaceChildren();
    ['data-nt-focus-resume', 'data-nt-focus-route-pending', 'data-nt-focus-resume-settling'].forEach((name) => root.removeAttribute(name));
    document.body.removeAttribute('data-nt-ready');
    Reflect.deleteProperty(globalThis, '__lumnoBoot');
  });

  it('saves what the user typed, its mode and the results before the reload', () => {
    const { resume, input, searchResults } = createResume({
      rawQuery: 'git',
      site: { key: 'gh' },
      lastResponse: [{ url: 'https://github.com' }],
      selectedIndex: 2
    });
    // Inline autocomplete wrote its completion into the input.
    input.value = 'github.com';

    expect(resume.prepareFocusReload()).toBe(true);
    const saved: unknown = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
    expect(saved).toMatchObject({
      rawQuery: 'git',
      siteSearchId: 'provider:gh',
      suggestions: searchResults.lastResponse,
      selectedIndex: 2
    });
    expect(transitionStyle()).toContain('@view-transition { navigation: auto; }');
  });

  it('does not treat a plain load or a stale snapshot as a resume', () => {
    expect(prepareResumeLoad()).toBe(false);

    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now() - 60000 }));
    expect(prepareResumeLoad()).toBe(false);
    expect(root.getAttribute('data-nt-focus-resume')).toBeNull();
  });

  it('restores the mode, then the query and results, and reveals once rendered and ready', async () => {
    saveSnapshot({ rawQuery: 'react ', siteSearchId: 'provider:gh', suggestions: [{ url: 'a' }, { url: 'b' }], selectedIndex: 1 });

    expect(prepareResumeLoad()).toBe(true);
    expect(root.getAttribute('data-nt-focus-resume')).toBe('true');
    expect(root.getAttribute('data-nt-focus-route-pending')).toBe('true');
    expect(root.getAttribute('data-nt-focus-resume-settling')).toBe('true');
    expect(transitionStyle()).toContain('::view-transition-old(root)');
    const skipTransition = vi.fn();
    window.dispatchEvent(Object.assign(new Event('pagereveal'), { viewTransition: { skipTransition } }));

    const { resume, calls } = createResume();
    const done = resume.resume(Promise.resolve());
    await wait(20);
    expect(calls.slice(0, 5)).toEqual([
      ['site', 'gh', true],
      ['query', 'react '],
      ['results', 2, 'react', 1],
      ['select'],
      ['rendered']
    ]);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(root.getAttribute('data-nt-focus-route-pending')).toBe('true');
    expect(skipTransition).not.toHaveBeenCalled();

    document.body.setAttribute('data-nt-ready', '1');
    await expect(done).resolves.toBe(true);
    expect(root.getAttribute('data-nt-focus-route-pending')).toBeNull();
    expect(skipTransition).toHaveBeenCalledTimes(1);
    expect(calls[calls.length - 1]).toEqual(['focus']);
    await wait(50);
    expect(root.getAttribute('data-nt-focus-resume-settling')).toBeNull();
  });

  it('brings a local search scope back the same way', async () => {
    document.body.setAttribute('data-nt-ready', '1');
    saveSnapshot({ rawQuery: 'docs', localSourceType: 'bookmark' });
    prepareResumeLoad();
    const { resume, calls } = createResume();

    await resume.resume(Promise.resolve());
    expect(calls.slice(0, 2)).toEqual([['local', 'bookmark'], ['query', 'docs']]);
  });

  it('shows a page that never gets ready once the hold runs out', async () => {
    vi.useFakeTimers();
    saveSnapshot({});
    prepareResumeLoad();
    const { resume } = createResume();

    void resume.resume(Promise.resolve());
    await vi.advanceTimersByTimeAsync(1300);
    expect(root.getAttribute('data-nt-focus-route-pending')).toBeNull();
  });
});
