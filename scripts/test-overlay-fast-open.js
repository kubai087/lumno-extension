const assert = require('assert');
const fs = require('fs');

const backgroundSource = fs.readFileSync('src/background/background.js', 'utf8');
const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');

const triggerStart = backgroundSource.indexOf('function triggerShowSearchForTab(tab, source)');
const triggerEnd = backgroundSource.indexOf('\nfunction injectTabSwitcherOnTab', triggerStart);
const triggerSource = backgroundSource.slice(triggerStart, triggerEnd);
assert.ok(triggerStart >= 0 && triggerEnd > triggerStart, 'show-search trigger should remain discoverable');
assert.match(
  triggerSource,
  /const activeUrl = getResolvedTabUrl\(tab\);[\s\S]*?if \(canOpenOverlayOnUrl\(activeUrl\)\) \{[\s\S]*?openOverlayOnTab\(tab, \[\], source\);[\s\S]*?return;[\s\S]*?chrome\.tabs\.query/,
  'injectable pages should start opening immediately and reserve a tab query for restricted-page recovery'
);
assert.match(
  triggerSource,
  /if \(shouldDeferRestrictedOverlayNavigation\(tab\)\) \{[\s\S]*?openOverlayOnTab\(tab, \[\], source\);[\s\S]*?return;/,
  'a shortcut on any unresolved restricted navigation should record intent without waiting for a tab refresh'
);

const pendingIntentStart = backgroundSource.indexOf(
  'function rememberOverlayPendingNavigationIntent(activeTab, source, pendingUrl)'
);
const pendingRuleStart = backgroundSource.indexOf(
  'function getPendingOverlayNavigationUrl(tab)'
);
const pendingRuleSource = backgroundSource.slice(pendingRuleStart, pendingIntentStart);
assert.ok(
  pendingRuleStart >= 0 && pendingIntentStart > pendingRuleStart,
  'shared pending-navigation rule should remain discoverable'
);
assert.match(
  pendingRuleSource,
  /getPendingInjectableUrl\([\s\S]*?tab,[\s\S]*?canOpenOverlayOnUrl[\s\S]*?\)/,
  'pending navigation should use the same URL capability guard as ordinary Overlay injection'
);
assert.doesNotMatch(
  pendingRuleSource,
  /accounts\.google|feishu|dribbble|hostname|hostMatches/,
  'the pending-navigation rule must stay capability-based rather than site-specific'
);
const pendingIntentEnd = backgroundSource.indexOf(
  '\nfunction queueOverlayLoadingUpdate',
  pendingIntentStart
);
const pendingIntentSource = backgroundSource.slice(pendingIntentStart, pendingIntentEnd);
assert.ok(
  pendingIntentStart >= 0 && pendingIntentEnd > pendingIntentStart,
  'pending-navigation intent helper should remain discoverable'
);
assert.match(
  pendingIntentSource,
  /createRecord\(activeTab, source, Date\.now\(\)\)[\s\S]*?pendingNavigationDeferred: true,[\s\S]*?pendingNavigationUrl:[\s\S]*?setOverlayLoadingRecord\(nextRecord\)/,
  'a provisional navigation should persist the same loading-lifecycle record even before Chrome exposes its URL'
);
assert.doesNotMatch(
  pendingIntentSource,
  /overlayLoadingRecoveryInFlightByTabId\.add|open(?:Browser)?NewtabFallback/,
  'recording a provisional navigation must neither claim an injection is in flight nor open a fallback tab'
);

const runtimeVersionMatch = overlaySource.match(
  /_x_extension_search_overlay_runtime_version_2026_unique_\s*=\s*\n?\s*'([^']+)'/
);
assert.ok(runtimeVersionMatch, 'overlay should publish a runtime version for safe same-page reuse');
assert.ok(
  backgroundSource.includes(`const OVERLAY_RUNTIME_VERSION = '${runtimeVersionMatch[1]}'`),
  'background and injected overlay should agree on the reusable runtime version'
);
const immediateOpenStart = backgroundSource.indexOf('function openOverlayOnTab(');
const immediateOpenSource = backgroundSource.slice(immediateOpenStart, triggerStart);
assert.strictEqual(
  (immediateOpenSource.match(/injectImmediately:\s*true/g) || []).length,
  3,
  'runtime probing, file injection, and Overlay activation should all bypass document_idle'
);
const loadingProbeStart = backgroundSource.indexOf('function probeOverlayLoadingState(');
const loadingProbeEnd = backgroundSource.indexOf(
  '\nfunction scheduleOverlayLoadingRecoveryRetry',
  loadingProbeStart
);
const loadingProbeSource = backgroundSource.slice(loadingProbeStart, loadingProbeEnd);
assert.match(
  loadingProbeSource,
  /target: \{ tabId \},\s*injectImmediately: true,/,
  'loading recovery should probe the committed Document without waiting for document_idle'
);
assert.match(
  backgroundSource,
  /chrome\.scripting\.executeScript\(\{\s*target: \{tabId: activeTab\.id\},\s*injectImmediately: true,\s*func: \(runtimeVersion\) => \{[\s\S]*?_x_extension_search_overlay_runtime_version_2026_unique_[\s\S]*?_x_extension_toggleSearchOverlay_2026_unique_[\s\S]*?args: \[OVERLAY_RUNTIME_VERSION\][\s\S]*?if \(runtimeReady\) \{[\s\S]*?runOverlayWithResolvedZoom\(\);\s*return;\s*\}[\s\S]*?injectOverlayRuntime\(\);/,
  'same-page reopen should call the existing runtime and inject the full file set only after a failed version probe'
);
assert.match(
  backgroundSource,
  /const overlayOpeningByTabId = new Map\(\);[\s\S]*?function beginOverlayOpening\(tab, source\)[\s\S]*?overlayOpeningByTabId\.set\(tab\.id, opening\);/,
  'each tab should keep a bounded guard against concurrent Overlay startup'
);
assert.match(
  backgroundSource,
  /function recoverOverlayAfterLoadingUpdate\(tabId, changeInfo, tab\)[\s\S]*?probeOverlayLoadingState\(tabId,[\s\S]*?OVERLAY_LOADING_LIFECYCLE\.decideRecovery[\s\S]*?restoreOverlayAfterLoadingDocumentChange/,
  'loading completion should probe the current Document and restore only when lifecycle state requires it'
);
assert.match(
  backgroundSource,
  /function restoreOverlayAfterLoadingDocumentChange\(tab, record, complete\)[\s\S]*?loadingRecovery: true,[\s\S]*?loadingRecord: record,[\s\S]*?ensureOpen: true/,
  'loading recovery should use idempotent ensure-open semantics and carry the saved session record'
);
assert.match(
  backgroundSource,
  /function scheduleOverlayLoadingRecoveryRetry\(tab, record\)[\s\S]*?OVERLAY_LOADING_RECOVERY_MAX_ATTEMPTS[\s\S]*?recoverOverlayAfterLoadingUpdate\(tab\.id, \{ status: 'complete' \}, tab\)[\s\S]*?if \(complete === true\) \{[\s\S]*?if \(ok\) \{[\s\S]*?clearOverlayLoadingRecord\(tab\.id\);[\s\S]*?scheduleOverlayLoadingRecoveryRetry\(tab, record\);/,
  'a transient final-Document injection failure should retry without prematurely discarding the session'
);
const preCompleteRetryStart = backgroundSource.indexOf(
  'function scheduleOverlayLoadingPreCompleteRetry(tab, record)'
);
const preCompleteRetryEnd = backgroundSource.indexOf(
  '\nfunction restoreOverlayAfterLoadingDocumentChange',
  preCompleteRetryStart
);
const preCompleteRetrySource = backgroundSource.slice(
  preCompleteRetryStart,
  preCompleteRetryEnd
);
assert.ok(
  preCompleteRetryStart >= 0 && preCompleteRetryEnd > preCompleteRetryStart,
  'pre-complete loading retry helper should remain discoverable'
);
assert.match(
  preCompleteRetrySource,
  /OVERLAY_LOADING_PRE_COMPLETE_RETRY_MAX_ATTEMPTS[\s\S]*?getOverlayLoadingRecord\(tab\.id,[\s\S]*?retryTab\.status === 'complete'[\s\S]*?recoverOverlayAfterLoadingUpdate\(tab\.id, retryChangeInfo, retryTab\)/,
  'any transient loading-Document race should refresh the live tab and retry from its actual URL/status'
);
assert.match(
  preCompleteRetrySource,
  /chrome\.tabs\.get\(tab\.id,[\s\S]*?retryWithCurrentTab\(currentTab\);/,
  'a pre-complete retry should re-read the live tab instead of replaying a stale site URL'
);
assert.doesNotMatch(
  preCompleteRetrySource,
  /\{ status: 'complete' \}/,
  'a pre-complete retry must retain loading-session tracking for later Document replacement'
);
assert.match(
  backgroundSource,
  /if \(chrome\.runtime && chrome\.runtime\.lastError\) \{[\s\S]*?if \(isComplete\) \{[\s\S]*?restoreOverlayAfterLoadingDocumentChange\(resolvedTab, record, true\);[\s\S]*?\} else \{[\s\S]*?scheduleOverlayLoadingPreCompleteRetry\(resolvedTab, record\);/,
  'a failed probe at URL commit should retry before the final load event'
);
assert.match(
  backgroundSource,
  /if \(!ok\) \{[\s\S]*?loading-recovery-failed[\s\S]*?scheduleOverlayLoadingPreCompleteRetry\(tab, record\);/,
  'a failed injection at URL commit should also retry while the target is still loading'
);
const openOverlayStart = backgroundSource.indexOf('function openOverlayOnTab(');
const openOverlaySource = backgroundSource.slice(openOverlayStart, triggerStart);
assert.match(
  openOverlaySource,
  /overlayOpening = beginOverlayOpening\(activeTab, source\);[\s\S]*?if \(!overlayOpening\) \{[\s\S]*?finishOpenAttempt\(false\);[\s\S]*?return;[\s\S]*?rememberOverlayLoadingRecord/,
  'a concurrent cold start should stop before it can replace loading-session ownership'
);
assert.match(
  openOverlaySource,
  /if \(\(openOptions\.loadingRecovery === true \|\| shouldRetryPreCompleteFailure\)[\s\S]*?finishOverlayLoadingOpenAttempt\(activeTab\.id\);/,
  'only an attempt that owns loading recovery should release its in-flight state'
);
assert.match(
  openOverlaySource,
  /let shouldRetryPreCompleteFailure = false;[\s\S]*?if \(ok !== true[\s\S]*?shouldRetryPreCompleteFailure[\s\S]*?scheduleOverlayLoadingPreCompleteRetry\(activeTab, trackedRecord\);[\s\S]*?const overlayLoadingRecord = rememberOverlayLoadingRecord\(activeTab, source, openOptions\);[\s\S]*?shouldRetryPreCompleteFailure = Boolean\(overlayLoadingRecord\);/,
  'an initial injection failure in any injectable loading Document should use the same pre-complete retry path'
);
assert.match(
  overlaySource,
  /if \(ensureOverlayOpen && !shouldReplaceStaleOverlay\) \{[\s\S]*?_x_extension_search_overlay_open_2026_unique_ = true;[\s\S]*?return;/,
  'a duplicate loading recovery must keep an existing Overlay open instead of toggling it closed'
);
assert.match(
  backgroundSource,
  /func: \(overlayTabs, overlayPanelContext, overlayHostId\)[\s\S]*?_x_extension_search_overlay_open_2026_unique_[\s\S]*?overlayHost\.isConnected/,
  'Overlay invocation results should report whether the host remains open in the injected Document'
);
assert.match(
  overlaySource,
  /function removeOverlay\(overlayElement, options\)[\s\S]*?_x_extension_search_overlay_open_2026_unique_ = false;[\s\S]*?notifyOverlayClosed\(\);/,
  'intentional Overlay closes should cancel any loading-persistence intent'
);
assert.match(
  overlaySource,
  /const initialOverlaySettingsReady = overlayRuntime\.getStorageValues\([\s\S]*?LANGUAGE_STORAGE_KEY,[\s\S]*?THEME_STORAGE_KEY,[\s\S]*?OVERLAY_SIZE_MODE_STORAGE_KEY,[\s\S]*?OVERLAY_ENTER_ANIMATION_STORAGE_KEY,[\s\S]*?MOTION_EFFECTS_ENABLED_STORAGE_KEY,[\s\S]*?OVERLAY_OPEN_TABS_DEFAULT_VISIBLE_STORAGE_KEY[\s\S]*?\)\.catch\(\(\) => \(\{\}\)\);/,
  'first open should batch initial overlay preferences into one storage read'
);
assert.match(
  overlaySource,
  /const initialOverlayContentReady = Promise\.all\([\s\S]*?initialOverlayOpenTabsDefaultVisibleReady,[\s\S]*?initialFaviconEnhancedFetchReady[\s\S]*?if \(initialLoadingSession \|\| initialPrefillQuery\)[\s\S]*?requestTabsAndRender\(\)/,
  'non-critical initial content should still hydrate after its preferences are ready'
);
const initialContentStart = overlaySource.indexOf('const initialOverlayContentReady = Promise.all([');
const revealStart = overlaySource.indexOf('\n    const revealOverlay =', initialContentStart);
const initialContentSource = overlaySource.slice(initialContentStart, revealStart);
assert.ok(
  initialContentStart >= 0 && revealStart > initialContentStart,
  'initial overlay content block should remain discoverable'
);
assert.doesNotMatch(
  initialContentSource,
  /renderTabSuggestions\(filterTabsForOverlay\(tabs, ''\)\)/,
  'the overlay should not render a caller snapshot and immediately replace it with a fresh tab query'
);
assert.match(
  overlaySource,
  /function applyLanguageStrings\(options\)[\s\S]*?const refreshResults = !options \|\| options\.refreshResults !== false;[\s\S]*?if \(!refreshResults\) \{[\s\S]*?return;[\s\S]*?requestTabsAndRender\(\);/,
  'initial language hydration should be able to update labels without starting a second tab request'
);
assert.match(
  overlaySource,
  /initialLanguageReady\.then\(\(\) => \{[\s\S]*?applyLanguageStrings\(\{ refreshResults: false \}\);/,
  'initial language hydration should leave the first tab request to the content pipeline'
);
assert.match(
  initialContentSource,
  /if \(initialLoadingSession \|\| initialPrefillQuery\)[\s\S]*?setSelectionRange\([\s\S]*?selectionStart,[\s\S]*?selectionEnd,[\s\S]*?selectionDirection[\s\S]*?return true;[\s\S]*?return initialLanguageReady\.catch\(\(\) => \{\}\)\.then\(\(\) => \{[\s\S]*?requestTabsAndRender\(\);/,
  'a restored loading session should retain its exact draft and selection before ordinary empty-query hydration'
);
assert.match(
  overlaySource,
  /function notifyOverlayLoadingSession\(input\)[\s\S]*?action: 'updateOverlayLoadingSession',[\s\S]*?inputValue,[\s\S]*?selectionStart,[\s\S]*?selectionEnd,[\s\S]*?focused:/,
  'typing in a loading Document should persist the live draft, selection, and focus state'
);
assert.match(
  backgroundSource,
  /case 'updateOverlayLoadingSession': \{[\s\S]*?updateOverlayLoadingSessionFromMessage\(request, sender, sendResponse\);[\s\S]*?return true;/,
  'the background router should accept asynchronous loading-session updates from the Overlay'
);
assert.doesNotMatch(
  overlaySource.slice(overlaySource.lastIndexOf('const revealReady =')),
  /initialLanguageReady|initialOverlayContentReady|initialFaviconEnhancedFetchReady/,
  'visible input reveal should not wait for language, tab rows, or favicon policy'
);
assert.match(
  backgroundSource,
  /const siteSearchProviders = Array\.isArray\(siteSearchCache\) \? siteSearchCache : \[\];[\s\S]*?loadSiteSearchProviders\(\)[\s\S]*?chrome\.scripting\.executeScript\(\{/,
  'cold startup should open with cached providers immediately and warm missing provider data in parallel'
);
assert.match(
  backgroundSource,
  /function createOverlayTabPayload\(tab, fetchSeq\) \{[\s\S]*?id: tab\.id,[\s\S]*?title:[\s\S]*?url:[\s\S]*?favIconUrl:[\s\S]*?_xTabFetchSeq: fetchSeq[\s\S]*?\}/,
  'open-tab responses should project browser tabs to the fields consumed by the overlay'
);
assert.match(
  backgroundSource,
  /const withSeq = sortedTabs\.map\(\(tab\) => createOverlayTabPayload\(tab, tabOverlayFetchSeq\)\);/,
  'open-tab responses should avoid serializing full browser Tab objects into the page'
);
assert.match(
  overlaySource,
  /let overlayTabsCacheReady = initialOverlayTabs\.length > 0;[\s\S]*?let overlayTabsRequestInFlight = false;[\s\S]*?let overlayTabsRequestSeq = 0;/,
  'the overlay should track a reusable full-tab cache and its active request'
);
assert.match(
  overlaySource,
  /function renderCachedTabsOrRequest\(filterQuery\) \{[\s\S]*?renderCachedTabsForOverlay\(filterQuery\)[\s\S]*?if \(!overlayTabsRequestInFlight\) \{[\s\S]*?requestTabsAndRender\(filterQuery\);/,
  'open-tab input should filter the cache and coalesce cache-miss requests'
);
const inputHandlerStart = overlaySource.indexOf('function handleSearchInputCompositionEnd(event)');
const inputHandlerEnd = overlaySource.indexOf("searchInput.addEventListener('compositionstart'", inputHandlerStart);
const inputHandlerSource = overlaySource.slice(inputHandlerStart, inputHandlerEnd);
assert.ok(
  inputHandlerStart >= 0 && inputHandlerEnd > inputHandlerStart,
  'search input handlers should remain discoverable'
);
assert.doesNotMatch(
  inputHandlerSource,
  /if \(openTabsSearchModeActive\) \{\s*requestTabsAndRender\(/,
  'typing in open-tab mode should not query every keystroke'
);
assert.match(
  inputHandlerSource,
  /if \(openTabsSearchModeActive\) \{\s*renderCachedTabsOrRequest\(query\);/,
  'typing in open-tab mode should render from the full-tab cache'
);
const activateOpenTabsStart = overlaySource.indexOf('function activateOpenTabsSearchMode(options)');
const activateOpenTabsEnd = overlaySource.indexOf('\n    function clearOpenTabsSearchMode', activateOpenTabsStart);
const activateOpenTabsSource = overlaySource.slice(activateOpenTabsStart, activateOpenTabsEnd);
assert.match(
  activateOpenTabsSource,
  /renderCachedTabsForOverlay\(latestOverlayQuery\);[\s\S]*?requestTabsAndRender\(latestOverlayQuery\);/,
  'entering open-tab mode should render cached rows immediately and refresh them once'
);
assert.match(
  overlaySource,
  /const requestSeq = overlayTabsRequestSeq;[\s\S]*?if \(requestSeq !== overlayTabsRequestSeq\) \{[\s\S]*?return;[\s\S]*?tabs = freshTabs;[\s\S]*?overlayTabsCacheReady = true;[\s\S]*?renderCachedTabsForOverlay\(activeQuery\);/,
  'only the latest tab response should replace the full cache and render the active query'
);
assert.doesNotMatch(
  overlaySource,
  /tabs = filteredTabs;/,
  'filtering should not overwrite the reusable full-tab cache'
);

console.log('overlay fast-open contract tests passed');
