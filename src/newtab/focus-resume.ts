const MAX_AGE_MS = 5000;
// Never hold the old frame longer than this, whatever is still loading.
const MAX_HOLD_MS = 1200;
const VIEW_TRANSITION_STYLE_ATTRIBUTE = 'data-nt-focus-resume-transition';
// Both pages opt in. The old frame stays opaque over the new page until the
// transition is skipped, or until the hold runs out.
const OUTGOING_TRANSITION_CSS = '@view-transition { navigation: auto; }';
const INCOMING_TRANSITION_CSS = `${OUTGOING_TRANSITION_CSS}
@keyframes x-nt-focus-resume-hold { from, to { opacity: 1; } }
@keyframes x-nt-focus-resume-wait { from, to { opacity: 0; } }
::view-transition-group(root) { animation-duration: ${MAX_HOLD_MS}ms; }
::view-transition-old(root) { animation: x-nt-focus-resume-hold ${MAX_HOLD_MS}ms step-end both; }
::view-transition-new(root) { animation: x-nt-focus-resume-wait ${MAX_HOLD_MS}ms step-end both; }
html[data-nt-focus-resume-settling="true"] body *,
html[data-nt-focus-resume-settling="true"] body *::before,
html[data-nt-focus-resume-settling="true"] body *::after {
transition: none !important;
animation-duration: 0s !important;
animation-delay: 0s !important;
}`;

import type { SearchSourceType, SiteSearchProvider } from '../domain/search/types';
import type { Suggestion } from '../shared/react/search/suggestion-list/types';
import { publishBootValue, takeBootValue } from '../platform/boot-handoff';
import { newtabFocusResume } from '../domain/settings/page-cache';
import type { SearchQuery } from '../shared/search-panel/search-query';
import type { SearchMode } from '../shared/search-panel/search-mode';
import type { SearchResults } from '../shared/search-panel/search-results';
import type { SearchModeActions } from '../shared/search-panel/mode-actions';

// The search on screen, carried across the focus reload.
interface SearchSnapshot {
  savedAt: number;
  rawQuery: string;
  siteSearchId: string;
  localSourceType: SearchSourceType | '';
  suggestions: Suggestion[];
  selectedIndex: number;
}

// The view transition holding the old page's last frame.
interface HeldViewTransition {
  skipTransition(): void;
}

interface FocusResumeState {
  inputParts: { input: HTMLInputElement } | null;
}

interface FocusResumeDeps {
  modeActions: SearchModeActions<SiteSearchProvider>;
  searchResults: SearchResults<Suggestion>;
  searchMode: SearchMode<SiteSearchProvider>;
  searchQuery: SearchQuery;
  getSiteSearchSnapshotId(provider: SiteSearchProvider): string;
  findSiteSearchBySnapshotId(id: string): SiteSearchProvider | null;
  showSuggestionSnapshot(suggestions: Suggestion[], query: string, selectedIndex: number): Promise<void>;
  focusSearchInputPreservingScroll(): void;
  pageState: FocusResumeState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isSearchSourceType(value: unknown): value is SearchSourceType {
  return value === 'history' || value === 'bookmark' || value === 'topSite';
}

// A result row saved before the reload, read back as untrusted.
function isSavedSuggestion(value: unknown): value is Suggestion {
  return isRecord(value) &&
    (value.type === undefined || typeof value.type === 'string') &&
    (value.url === undefined || typeof value.url === 'string') &&
    (value.title === undefined || typeof value.title === 'string');
}

function isHeldTransition(value: unknown): value is HeldViewTransition {
  return isRecord(value) && typeof value.skipTransition === 'function';
}

// A snapshot read back from storage; null when it is not one.
function readSearchSnapshot(value: unknown): SearchSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  const suggestions: unknown[] = Array.isArray(value.suggestions) ? value.suggestions : [];
  const selectedIndex = value.selectedIndex;
  return {
    savedAt: Number(value.savedAt),
    rawQuery: typeof value.rawQuery === 'string' ? value.rawQuery : '',
    siteSearchId: typeof value.siteSearchId === 'string' ? value.siteSearchId : '',
    localSourceType: isSearchSourceType(value.localSourceType) ? value.localSourceType : '',
    suggestions: suggestions.filter(isSavedSuggestion),
    selectedIndex: typeof selectedIndex === 'number' && Number.isInteger(selectedIndex) ? selectedIndex : -1
  };
}

// Chrome reloads the same tab, so session storage carries the search.
// Firefox swaps in a new tab, which shares only local storage.
function getStorage(): Storage | null {
  try {
    return globalThis.location.protocol === 'moz-extension:' ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function readSnapshot(consume: boolean): SearchSnapshot | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(newtabFocusResume.key);
    if (!raw) {
      return null;
    }
    if (consume) {
      storage.removeItem(newtabFocusResume.key);
    }
    const snapshot = readSearchSnapshot(JSON.parse(raw));
    const age = Date.now() - Number(snapshot && snapshot.savedAt);
    return age >= 0 && age <= MAX_AGE_MS ? snapshot : null;
  } catch {
    return null;
  }
}

function saveSnapshot(snapshot: SearchSnapshot | null): boolean {
  const storage = getStorage();
  if (!storage || !snapshot) {
    return false;
  }
  try {
    storage.setItem(newtabFocusResume.key, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

function addTransitionStyle(cssText: string): void {
  const head = document.head || document.documentElement;
  if (!head || document.querySelector(`style[${VIEW_TRANSITION_STYLE_ATTRIBUTE}]`)) {
    return;
  }
  const style = document.createElement('style');
  style.setAttribute(VIEW_TRANSITION_STYLE_ATTRIBUTE, 'true');
  style.textContent = cssText;
  head.appendChild(style);
}

// Runs in the head of the reloaded page, before its first frame. Marks the
// load as a resume and keeps the old frame up while the page rebuilds.
function prepareResumeLoad(): boolean {
  const documentElement = document.documentElement;
  if (!documentElement || !readSnapshot(false)) {
    return false;
  }
  documentElement.setAttribute('data-nt-focus-resume', 'true');
  documentElement.setAttribute('data-nt-focus-route-pending', 'true');
  // The page rebuilds out of sight, so it shows up settled: no entry fades
  // or opening results.
  documentElement.setAttribute('data-nt-focus-resume-settling', 'true');
  addTransitionStyle(INCOMING_TRANSITION_CSS);
  globalThis.addEventListener('pagereveal', (event) => {
    const transition = event && 'viewTransition' in event ? event.viewTransition : null;
    publishBootValue('focusResumeTransition', isHeldTransition(transition) ? transition : null);
  }, { once: true });
  return true;
}

function createFocusResume(deps: FocusResumeDeps) {
  const {
    modeActions,
    searchResults,
    searchMode,
    searchQuery,
    getSiteSearchSnapshotId,
    findSiteSearchBySnapshotId,
    showSuggestionSnapshot,
    focusSearchInputPreservingScroll
  } = deps;

  // The page state object shared with newtab.js and the other modules.
  const pageState = deps.pageState;

  function captureSearch(): SearchSnapshot {
    const input = pageState.inputParts && pageState.inputParts.input;
    const value = input ? String(input.value || '') : '';
    // Inline autocomplete writes its completion into the input; keep what
    // the user typed.
    const typed = String(searchQuery.raw || '');
    return {
      savedAt: Date.now(),
      rawQuery: typed && value.startsWith(typed) ? typed : value,
      siteSearchId: searchMode.site ? getSiteSearchSnapshotId(searchMode.site) : '',
      localSourceType: searchMode.local ? searchMode.local.sourceType : '',
      suggestions: searchResults.lastResponse || [],
      selectedIndex: Number.isInteger(searchResults.selectedIndex) ? searchResults.selectedIndex : -1
    };
  }

  // Called right before the focus reload.
  function prepareFocusReload(): boolean {
    const saved = saveSnapshot(captureSearch());
    if (saved) {
      addTransitionStyle(OUTGOING_TRANSITION_CSS);
    }
    return saved;
  }

  function restoreSearch(snapshot: SearchSnapshot): Promise<void> | undefined {
    const input = pageState.inputParts && pageState.inputParts.input;
    if (!input) {
      return undefined;
    }
    // Each mode clears the input, so the mode goes first.
    if (snapshot.localSourceType) {
      modeActions.activateLocalSearchScope({ sourceType: snapshot.localSourceType }, { preserveResults: true });
    } else if (snapshot.siteSearchId) {
      const provider = findSiteSearchBySnapshotId(snapshot.siteSearchId);
      if (provider) {
        modeActions.activateSiteSearch(provider, { preserveResults: true, animatePrefix: false });
      }
    }
    const rawQuery = String(snapshot.rawQuery || '');
    let rendered = Promise.resolve();
    if (rawQuery) {
      modeActions.restoreSearchModeQuery(rawQuery);
      rendered = showSuggestionSnapshot(snapshot.suggestions, rawQuery.trim(), snapshot.selectedIndex);
    }
    // The shortcut selects the query, as it does when the page has focus.
    try {
      input.select();
    } catch {
      // Ignore selection failures.
    }
    return rendered;
  }

  function nextFrame(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(() => resolve());
      } else {
        globalThis.setTimeout(() => resolve(), 16);
      }
    });
  }

  function whenPageReady(): Promise<void> {
    return new Promise<void>((resolve) => {
      const body = document.body;
      if (!body || body.getAttribute('data-nt-ready') === '1' || typeof globalThis.MutationObserver !== 'function') {
        resolve();
        return;
      }
      const observer = new globalThis.MutationObserver(() => {
        if (body.getAttribute('data-nt-ready') === '1') {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(body, { attributes: true, attributeFilter: ['data-nt-ready'] });
    });
  }

  function reveal(): void {
    const documentElement = document.documentElement;
    if (!documentElement || documentElement.getAttribute('data-nt-focus-route-pending') !== 'true') {
      return;
    }
    documentElement.removeAttribute('data-nt-focus-route-pending');
    const heldTransition = takeBootValue('focusResumeTransition');
    if (heldTransition && typeof heldTransition.skipTransition === 'function') {
      heldTransition.skipTransition();
    }
    if (globalThis.performance && typeof globalThis.performance.mark === 'function') {
      globalThis.performance.mark('lumno-newtab-milestone-focus-resume-visible');
    }
    // A hidden input cannot take focus, so focus waits for the reveal.
    focusSearchInputPreservingScroll();
    void nextFrame().then(nextFrame).then(() => {
      documentElement.removeAttribute('data-nt-focus-resume-settling');
    });
  }

  // providersReady resolves once the site search providers can be looked up.
  function resume(providersReady: PromiseLike<unknown> | null | undefined): Promise<boolean> {
    const documentElement = document.documentElement;
    if (!documentElement || documentElement.getAttribute('data-nt-focus-resume') !== 'true') {
      return Promise.resolve(false);
    }
    const snapshot = readSnapshot(true);
    const holdTimer = globalThis.setTimeout(reveal, MAX_HOLD_MS);
    // Restore after the providers load: their search modes are looked up
    // by id, and the page re-requests results for the current query once
    // aggregate searches arrive, which would replace the saved results.
    const restored = Promise.resolve(providersReady).catch(() => {}).then(() => {
      return snapshot ? restoreSearch(snapshot) : null;
    }).catch((error) => {
      console.warn('[Lumno] Failed to restore the search after the focus reload.', error);
    });
    // One more frame lets layout that waits for a frame (the results'
    // position) land before the reveal.
    return Promise.all([restored, whenPageReady()]).then(nextFrame).then(() => {
      globalThis.clearTimeout(holdTimer);
      reveal();
      return Boolean(snapshot);
    });
  }

  return {
    prepareFocusReload,
    resume
  };
}

type FocusResume = ReturnType<typeof createFocusResume>;

export { prepareResumeLoad, createFocusResume };
export type { FocusResume, FocusResumeDeps, FocusResumeState, HeldViewTransition, SearchSnapshot };
