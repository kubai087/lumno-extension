// Search requests from New Tab and the overlay: interactive site-search
// providers, aggregate search across several engines, the help center index,
// and the search and site-search message handlers.
//
// A module of the service worker; background.ts imports it before its own code
// runs.

import * as AGGREGATE_SEARCH_STORE from '../domain/search/aggregate-search-store';
import * as LumnoHelpCenterIndex from '../platform/help-center-index';
import * as AI_PROVIDER_SUBMIT from './ai-provider-submit';
import * as COMMUNITY_LINKS from '../domain/community-links';
import * as SEARCH_RESULT_TABS from './search-result-tabs';
import { aggregateSearchAutoGroupEnabled, aggregateSearches } from '../domain/settings';
import { getShortcutUrl, loadShortcutRules, waitForTabComplete, workerSettings } from './worker-context';
import { buildDefaultSearchUrl, getDirectNavigationUrl } from './search/default-engine';
import { getSearchEngineSuggestions } from './search/engine-suggestions';
import {
  abortSearchEngineSuggestionRequest,
  consumeSearchEngineSuggestionRequest,
  getSearchEngineSuggestionRequestKey,
  releaseSearchEngineSuggestionRequest,
  scheduleSearchEngineSuggestionPrefetch,
  searchEngineSuggestionRequests,
  shouldPrefetchSearchEngineSuggestions,
  startSearchEngineSuggestionRequest
} from './search/engine-requests';
import { deleteHistoryUrlFromSearch } from './search/local-sources';
import { clearPendingSearch, markPendingSearchTab, pendingSearchTabId } from './search/pending-search';
import { getSearchSuggestions } from './search/pipeline';
import { recordSearchSuggestionSelection } from './search/selection-stats';
import { getSiteSearchProviderEntryUrl, isInteractiveSiteSearchProvider, loadSiteSearchProviders } from './search/site-search-providers';
import { resolveSearchResultTabPlacement } from './browser-urls-service';
import { openSearchResultTab } from './split-view-tabs';
import type { CreatedTabCallback } from './tab-groups';
import type { SiteSearchProvider } from '../domain/search/types';
import type { OkReply, OpenDisposition } from '../domain/messages';
import type { HandlersFor, MessageSender } from './message-router';
import * as IndexBuild from '../domain/search/help-center/index-build';
import * as Search from '../domain/search/help-center/search';
import type { HelpIndexDoc, HelpSearchResult } from '../domain/search/help-center/types';
import * as Open from './aggregate-search/open';
import * as Runner from './aggregate-search/runner';
import type { AggregateSearchQueryRunner } from './aggregate-search/types';

type SearchAction =
  | 'searchOrNavigate'
  | 'getSearchSuggestions'
  | 'getSearchEngineSuggestions'
  | 'recordSearchSuggestionSelection'
  | 'deleteHistoryUrl';

type SiteSearchAction =
  | 'getSiteSearchProviders'
  | 'getHelpCenterSearchResults'
  | 'runSiteSearchProviderQuery'
  | 'runAggregateSearchQuery';

// What running an interactive provider did: the tab it used and how the
// prompt went in.
interface ProviderRunResult extends OkReply {
  tabId?: number;
  url?: string;
  strategy?: string;
  method?: string;
}

const PROVIDER_STRING_FIELDS = ['id', 'name', 'template', 'action', 'submitStrategy', 'category', 'builtinKey', 'icon', 'iconUrl'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function readDisposition(value: unknown): OpenDisposition | undefined {
  return value === 'currentTab' || value === 'newTab' || value === 'backgroundTab' || value === 'splitTab' ? value : undefined;
}

// A provider a page asks to run, with only the string fields running it reads.
export function readSiteSearchProvider(value: unknown): SiteSearchProvider | null {
  if (!isRecord(value)) {
    return null;
  }
  const provider: SiteSearchProvider = { key: typeof value.key === 'string' ? value.key : '' };
  PROVIDER_STRING_FIELDS.forEach((field) => {
    const fieldValue = value[field];
    if (typeof fieldValue === 'string') {
      provider[field] = fieldValue;
    }
  });
  return provider;
}

function runInteractiveSiteSearchProvider(
  provider: SiteSearchProvider | null,
  query: unknown,
  sender: MessageSender | null | undefined,
  disposition: OpenDisposition | undefined
): Promise<ProviderRunResult> {
  const prompt = String(query || '').trim();
  const entryUrl = getSiteSearchProviderEntryUrl(provider, prompt);
  const submitStrategy = String((provider && provider.submitStrategy) || '').trim();
  const targetDisposition = disposition || 'newTab';
  return new Promise((resolve) => {
    if (!entryUrl || !prompt || !isInteractiveSiteSearchProvider(provider)) {
      resolve({ ok: false, reason: 'invalid-provider-request' });
      return;
    }
    const finish = (result: ProviderRunResult): void => {
      resolve(result && typeof result === 'object' ? result : { ok: false, reason: 'unknown' });
    };
    const handleReadyTab = (tab: chrome.tabs.Tab | null | undefined): void => {
      if (!tab || typeof tab.id !== 'number') {
        finish({ ok: false, reason: 'tab-unavailable' });
        return;
      }
      const tabId = tab.id;
      waitForTabComplete(tabId, 15000)
        .catch(() => tab)
        .then(() => AI_PROVIDER_SUBMIT.submitPromptInTab(
          chrome,
          tabId,
          prompt,
          submitStrategy,
          entryUrl
        ))
        .then((result) => {
          finish({
            ok: Boolean(result && result.ok),
            tabId,
            url: entryUrl,
            strategy: submitStrategy,
            method: result && result.method ? result.method : '',
            reason: result && result.reason ? result.reason : ''
          });
        })
        .catch((error: unknown) => {
          finish({
            ok: false,
            tabId,
            url: entryUrl,
            reason: getErrorMessage(error, 'interactive-site-search-failed')
          });
        });
    };
    const updateTab = (tabId: number): void => {
      chrome.tabs.update(tabId, { url: entryUrl, active: true }, (tab) => {
        const lastError = chrome.runtime && chrome.runtime.lastError;
        if (lastError) {
          finish({ ok: false, reason: lastError.message || 'tab-update-failed' });
          return;
        }
        handleReadyTab(tab);
      });
    };
    if (targetDisposition === 'currentTab') {
      if (sender && sender.tab && typeof sender.tab.id === 'number') {
        updateTab(sender.tab.id);
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const lastError = chrome.runtime && chrome.runtime.lastError;
        if (lastError) {
          finish({ ok: false, reason: lastError.message || 'active-tab-unavailable' });
          return;
        }
        const activeTab = Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null;
        if (activeTab && typeof activeTab.id === 'number') {
          updateTab(activeTab.id);
          return;
        }
        finish({ ok: false, reason: 'active-tab-unavailable' });
      });
      return;
    }
    const sourceTab = sender && sender.tab ? sender.tab : null;
    openSearchResultTab(entryUrl, targetDisposition, sourceTab, (tab, info) => {
      if (!info || info.ok === false) {
        finish({ ok: false, reason: (info && info.reason) || 'tab-create-failed' });
        return;
      }
      handleReadyTab(tab);
    });
  });
}

let aggregateSearchQueryRunner: AggregateSearchQueryRunner | null = null;
function runAggregateSearchQuery(
  aggregateId: unknown,
  query: unknown,
  sender: MessageSender,
  disposition: OpenDisposition | undefined
): ReturnType<AggregateSearchQueryRunner> {
  if (!aggregateSearchQueryRunner) {
    aggregateSearchQueryRunner = Runner.createAggregateSearchQueryRunner({
      aggregateSearchStore: AGGREGATE_SEARCH_STORE,
      chromeApi: chrome,
      loadAggregateSearches: () => workerSettings.ready
        .then(() => AGGREGATE_SEARCH_STORE.normalizeAggregateSearches(workerSettings.getStored(aggregateSearches))),
      loadSiteSearchProviders,
      resolveTabPlacement: resolveSearchResultTabPlacement,
      loadAggregateSearchAutoGroupEnabled() {
        return workerSettings.ready.then(() => workerSettings.get(aggregateSearchAutoGroupEnabled));
      },
      openAggregateSearch: Open.openAggregateSearch,
      getEntryUrl: getSiteSearchProviderEntryUrl,
      isInteractiveProvider: isInteractiveSiteSearchProvider,
      waitForTabComplete,
      submitPromptInTab: AI_PROVIDER_SUBMIT.submitPromptInTab
    });
  }
  return aggregateSearchQueryRunner(aggregateId, query, sender, disposition);
}

// Loads the query's shortcut, address or search in the tab it came from.
function searchOrNavigateInTab(
  sourceTab: chrome.tabs.Tab,
  tabId: number,
  query: string,
  forceSearch: boolean,
  sendResponse: (reply: { ok: boolean; url: string }) => void
): void {
  loadShortcutRules().then((rules) => {
    const targetUrl = getShortcutUrl(query, rules) || (!forceSearch ? getDirectNavigationUrl(query) : '');
    if (targetUrl) {
      chrome.tabs.update(tabId, { url: targetUrl }, () => {
        sendResponse({ ok: !(chrome.runtime && chrome.runtime.lastError), url: targetUrl });
      });
      return;
    }
    const fallbackUrl = buildDefaultSearchUrl(query);
    // The results page this search loads tells which engine is the default.
    markPendingSearchTab(tabId, sourceTab);
    SEARCH_RESULT_TABS.searchInTab(chrome, {
      query,
      tabId,
      fallbackUrl,
      onFallback() {
        if (pendingSearchTabId === tabId) {
          clearPendingSearch();
        }
      }
    }, (result) => {
      sendResponse({ ...result, url: fallbackUrl });
    });
  });
}

// Search, suggestions and history.
export const SEARCH_MESSAGE_HANDLERS: HandlersFor<SearchAction> = Object.freeze({
  searchOrNavigate(request, sender, sendResponse) {
    const query = request.query ? String(request.query) : '';
    const forceSearch = Boolean(request.forceSearch);
    const openInBackgroundTab = request.disposition === 'backgroundTab';
    const sourceTab = sender && sender.tab ? sender.tab : null;
    // The overlay set to open results in its own tab: the query's shortcut,
    // address or search loads there instead of in a new tab.
    if (request.disposition === 'currentTab' && sourceTab && typeof sourceTab.id === 'number') {
      searchOrNavigateInTab(sourceTab, sourceTab.id, query, forceSearch, sendResponse);
      return true;
    }
    Promise.all([loadShortcutRules(), resolveSearchResultTabPlacement(sourceTab)]).then(([rules, placement]) => {
      const createResolvedTab = (url: string, callback: CreatedTabCallback): void => {
        openSearchResultTab(url, readDisposition(request.disposition), sourceTab, callback, placement);
      };
      const shortcutUrl = getShortcutUrl(query, rules);
      if (shortcutUrl) {
        createResolvedTab(shortcutUrl, () => {
          sendResponse({ ok: true, url: shortcutUrl });
        });
        return;
      }
      const directUrl = !forceSearch ? getDirectNavigationUrl(query) : '';
      if (directUrl) {
        createResolvedTab(directUrl, () => {
          sendResponse({ ok: true, url: directUrl });
        });
      } else {
        // It's a search query - use browser default search engine
        const fallbackUrl = buildDefaultSearchUrl(query);
        // Preserve the original browser search path unless an adjacent
        // position is selected or the search opens in a split view.
        if (typeof placement.index !== 'number' && request.disposition !== 'splitTab') {
          if (openInBackgroundTab) {
            createResolvedTab(fallbackUrl, () => {
              sendResponse({ ok: true, url: fallbackUrl });
            });
            return;
          }
          if (chrome && chrome.search && typeof chrome.search.query === 'function') {
            markPendingSearchTab(null, sourceTab);
            try {
              chrome.search.query({ text: query, disposition: 'NEW_TAB' }, () => {
                if (chrome.runtime && chrome.runtime.lastError) {
                  clearPendingSearch();
                  createResolvedTab(fallbackUrl, () => {
                    sendResponse({ ok: true, url: fallbackUrl });
                  });
                  return;
                }
                sendResponse({ ok: true, url: fallbackUrl });
              });
              return;
            } catch (_error) {
              clearPendingSearch();
            }
          }
          createResolvedTab(fallbackUrl, () => {
            sendResponse({ ok: true, url: fallbackUrl });
          });
          return;
        }
        if (chrome && chrome.search && typeof chrome.search.query === 'function') {
          createResolvedTab('about:blank', (tab, info) => {
            if (!tab || typeof tab.id !== 'number' || !info || !info.ok) {
              sendResponse({ ok: false, reason: (info && info.reason) || 'tab-create-failed' });
              return;
            }
            markPendingSearchTab(tab.id, sourceTab);
            SEARCH_RESULT_TABS.searchInTab(chrome, {
              query,
              tabId: tab.id,
              fallbackUrl,
              onFallback() {
                if (pendingSearchTabId === tab.id) {
                  clearPendingSearch();
                }
              }
            }, (result) => {
              sendResponse({ ...result, url: fallbackUrl });
            });
          });
          return;
        }
        createResolvedTab(fallbackUrl, () => {
          sendResponse({ ok: true, url: fallbackUrl });
        });
      }
    });
    return true;
  },
  getSearchSuggestions(request, sender, sendResponse) {
    const query = request.query;
    const requestKey = getSearchEngineSuggestionRequestKey(request, sender);
    if (shouldPrefetchSearchEngineSuggestions(request, query)) {
      scheduleSearchEngineSuggestionPrefetch(requestKey, query);
    } else {
      abortSearchEngineSuggestionRequest(requestKey);
    }
    getSearchSuggestions(query, {
      sourceTypes: request.sourceTypes,
      includeOpenTabs: request.includeOpenTabs
    }).then((suggestions) => {
      sendResponse({ suggestions: suggestions });
    }).catch(() => {
      sendResponse({ suggestions: [] });
    });
    return true; // Keep the message channel open for async response
  },
  getSearchEngineSuggestions(request, sender, sendResponse) {
    const query = request.query;
    const requestKey = getSearchEngineSuggestionRequestKey(request, sender);
    const requestRecord = consumeSearchEngineSuggestionRequest(requestKey, query);
    if (!requestRecord) {
      sendResponse({ suggestions: [], aborted: false, hasRemoteSuggestions: false });
      return;
    }
    const controller = requestRecord.controller;
    getSearchEngineSuggestions(query, request.localSuggestions, {
      signal: controller.signal,
      rawEngineSuggestionsPromise: startSearchEngineSuggestionRequest(requestRecord),
      searchFirst: request.searchFirst === true
    }).then((suggestions) => {
      const isCurrent = searchEngineSuggestionRequests.get(requestKey) === requestRecord;
      const hasRemoteSuggestions = isCurrent && !controller.signal.aborted && suggestions.some((suggestion) => (
        suggestion && suggestion.type === 'googleSuggest'
      ));
      sendResponse({
        suggestions: isCurrent && !controller.signal.aborted ? suggestions : [],
        aborted: !isCurrent || controller.signal.aborted,
        hasRemoteSuggestions
      });
    }).catch(() => {
      sendResponse({ suggestions: [], aborted: controller.signal.aborted, hasRemoteSuggestions: false });
    }).finally(() => {
      if (searchEngineSuggestionRequests.get(requestKey) === requestRecord) {
        releaseSearchEngineSuggestionRequest(requestKey, requestRecord);
      }
    });
    return true;
  },
  recordSearchSuggestionSelection(request, sender, sendResponse) {
    recordSearchSuggestionSelection(request)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          reason: getErrorMessage(error, 'record-selection-failed')
        });
      });
    return true;
  },
  deleteHistoryUrl(request, sender, sendResponse) {
    const targetUrl = typeof request.url === 'string' ? request.url : '';
    return deleteHistoryUrlFromSearch(targetUrl, sendResponse);
  }
});

type HelpSynonyms = ReturnType<typeof IndexBuild.normalizeSynonyms>;

let helpCenterLoaders: {
  index: { load(url: unknown): Promise<HelpIndexDoc[] | never[]> };
  synonyms: { load(url: unknown): Promise<HelpSynonyms | never[]> };
} | null = null;

// Help center pages matching the query, read from the index and synonym list of the given
// interface language. Without synonyms the search still runs, only more literally.
function getHelpCenterSearchResults(query: unknown, locale: unknown): Promise<HelpSearchResult[]> {
  if (!String(query || '').trim()) {
    return Promise.resolve([]);
  }
  if (!helpCenterLoaders) {
    const fetchImpl = (url: string, init?: { signal: AbortSignal }): Promise<Response> => fetch(url, init);
    helpCenterLoaders = {
      index: LumnoHelpCenterIndex.createIndexLoader({ fetchImpl }),
      // A language with no synonym list (404) is cached as empty rather than asked for on every key.
      synonyms: LumnoHelpCenterIndex.createIndexLoader({
        fetchImpl: (url, init) => fetch(url, init).then((response) => (
          response.status === 404 ? { ok: true, json: () => [] } : response
        )),
        parse: IndexBuild.normalizeSynonyms
      })
    };
  }
  const loaders = helpCenterLoaders;
  return Promise.all([
    loaders.index.load(COMMUNITY_LINKS.getHelpSearchIndexUrl(locale)),
    loaders.synonyms.load(COMMUNITY_LINKS.getHelpSearchSynonymsUrl(locale)).catch((): never[] => [])
  ]).then(([index, synonyms]) => Search.searchIndex(index, query, {
    origin: COMMUNITY_LINKS.WEB_ORIGIN,
    synonyms
  }));
}

// Site search, help center and aggregate search.
export const SITE_SEARCH_MESSAGE_HANDLERS: HandlersFor<SiteSearchAction> = Object.freeze({
  getSiteSearchProviders(request, sender, sendResponse) {
    loadSiteSearchProviders().then((items) => {
      sendResponse({ items: items });
    }).catch(() => {
      sendResponse({
        items: [],
        reason: 'site-search-provider-load-failed'
      });
    });
    return true;
  },
  getHelpCenterSearchResults(request, sender, sendResponse) {
    getHelpCenterSearchResults(request.query, request.locale).then((items) => {
      sendResponse({ items });
    }).catch(() => {
      sendResponse({ items: [], reason: 'help-center-index-unavailable' });
    });
    return true;
  },
  runSiteSearchProviderQuery(request, sender, sendResponse) {
    runInteractiveSiteSearchProvider(
      readSiteSearchProvider(request.provider),
      request.query,
      sender,
      readDisposition(request.disposition)
    ).then((result) => {
      sendResponse(result);
    }).catch((error: unknown) => {
      sendResponse({
        ok: false,
        reason: getErrorMessage(error, 'interactive-site-search-failed')
      });
    });
    return true;
  },
  runAggregateSearchQuery(request, sender, sendResponse) {
    runAggregateSearchQuery(
      request.aggregateId,
      request.query,
      sender,
      readDisposition(request.disposition)
    ).then(sendResponse).catch((error: unknown) => {
      sendResponse({
        ok: false,
        reason: getErrorMessage(error, 'aggregate-search-failed')
      });
    });
    return true;
  }
});
