const assert = require('assert');
const fs = require('fs');

const contentHotkeySource = fs.readFileSync('src/content/hotkey-listener.js', 'utf8');
const shortcutReleaseRelaySource = fs.readFileSync(
  'src/content/shortcut-key-observer.js',
  'utf8'
);
const backgroundSource = fs.readFileSync('src/background/background.js', 'utf8');
const switcherSource = fs.readFileSync('src/overlay/tab-switcher.js', 'utf8');
const switcherViewReactSource = fs.readFileSync(
  'react-src/overlay/tab-switcher.tsx',
  'utf8'
);
const switcherBridgePath = 'src/overlay/tab-switcher-page-bridge.js';
const switcherBridgeSource = fs.existsSync(switcherBridgePath)
  ? fs.readFileSync(switcherBridgePath, 'utf8')
  : '';
const manifestSource = fs.readFileSync('manifest.json', 'utf8');
const newtabHtmlSource = fs.readFileSync('src/newtab/newtab.html', 'utf8');
const optionsHtmlSource = fs.readFileSync('src/options/options.html', 'utf8');
const optionsSource = fs.readFileSync('src/options/options.js', 'utf8');
const onboardingHtmlSource = fs.readFileSync('src/onboarding/onboarding.html', 'utf8');
const manifest = JSON.parse(manifestSource);
const localeNames = ['en', 'ja', 'zh_CN', 'zh_TW'];
const localeMessages = Object.fromEntries(localeNames.map((locale) => [
  locale,
  JSON.parse(fs.readFileSync(`_locales/${locale}/messages.json`, 'utf8'))
]));

function getFunctionBlock(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notStrictEqual(start, -1, `${startNeedle} should exist`);
  const end = source.indexOf(endNeedle, start);
  assert.notStrictEqual(end, -1, `${endNeedle} should exist after ${startNeedle}`);
  return source.slice(start, end);
}

function getCssRuleBlock(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));
  assert(match, `${selector} style block should exist`);
  return match[1];
}

function getCssBlockFromNeedle(source, startNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notStrictEqual(start, -1, `${startNeedle} should exist`);
  const tail = source.slice(start + startNeedle.length);
  const blockMatch = tail.match(/\{\s*\n/);
  assert(blockMatch, `${startNeedle} should have a declaration block`);
  const openBrace = start + startNeedle.length + blockMatch.index;
  const closeBrace = source.indexOf('}', openBrace);
  assert.notStrictEqual(closeBrace, -1, `${startNeedle} declaration block should close`);
  return source.slice(openBrace + 1, closeBrace);
}

assert.strictEqual(
  contentHotkeySource.includes('isBestEffortAltTabEvent'),
  false,
  'content script should not try to force-capture Alt+Tab'
);
assert.strictEqual(
  contentHotkeySource.includes('triggerTabSwitcherFromPageHotkey'),
  false,
  'content script should not expose an Alt+Tab page-hotkey switcher trigger'
);
assert.match(
  switcherBridgeSource,
  /advanceOpenTabSwitcherFromCommand[\s\S]*host\._lumnoTabSwitcherAdvance[\s\S]*advanced:\s*didAdvance === true[\s\S]*suppressed:\s*didAdvance === false/,
  'shared tab switcher bridge should call the same in-page advance hook and report suppressed initial shortcuts'
);
assert.ok(
  manifest.content_scripts &&
    manifest.content_scripts[0] &&
    Array.isArray(manifest.content_scripts[0].js) &&
    manifest.content_scripts[0].js.includes('src/content/hotkey-listener.js') &&
    !manifest.content_scripts[0].js.includes('src/overlay/tab-switcher.js') &&
    !manifest.content_scripts[0].js.includes('src/overlay/tab-switcher-page-bridge.js'),
  'normal pages should not preload the tab switcher runtime or bridge as content scripts'
);
assert.match(
  switcherBridgeSource,
  /openTabSwitcherFromCommand[\s\S]*_x_extension_toggleTabSwitcher_2026_unique_[\s\S]*toggle\(context\)/,
  'shared tab switcher bridge should open the extension-page tab switcher runtime from a background message'
);
assert.match(
  switcherSource,
  /function advanceOpenSwitcherFromMessage\(request\)[\s\S]*_lumnoTabSwitcherAdvance\(request && request\.offset\)[\s\S]*advanced:\s*didAdvance === true/,
  'normal-page runtime messages should advance an already-open switcher without executeScript'
);
assert.match(
  switcherSource,
  /function openSwitcherFromMessage\(request\)[\s\S]*_x_extension_toggleTabSwitcher_2026_unique_[\s\S]*toggle\(request && request\.context\)/,
  'normal-page runtime messages should reuse an injected switcher runtime on later opens'
);
assert.match(
  switcherSource,
  /function commitOpenSwitcherFromShortcutReleaseMessage\(\)[\s\S]*_lumnoTabSwitcherCommitFromShortcutRelease\(\)[\s\S]*request\.action === 'commitOpenTabSwitcherFromShortcutRelease'/,
  'normal-page switchers should accept the configured release relayed from the tab that received the original key sequence'
);
assert.match(
  switcherSource,
  /previousRuntimeMessageListener[\s\S]*removeListener\(previousRuntimeMessageListener\)[\s\S]*addListener\(runtimeMessageListener\)/,
  'reinjection should replace an invalidated runtime listener after an extension reload'
);
assert.strictEqual(
  /TAB_SWITCHER_RUNTIME_VERSION|_x_extension_tab_switcher_runtime_version_2026_unique_|_lumnoTabSwitcherRuntimeVersion/.test(switcherSource),
  false,
  'tab switcher should not keep reload-time runtime version markers'
);
assert.match(
  switcherViewReactSource,
  /data-active=\{active \? 'true' : 'false'\}[\s\S]*?tabIndex=\{active \? 0 : -1\}/,
  'the React tab switcher should keep selected-card focusability in sync'
);
assert.strictEqual(
  /updateSelection\(index\)[\s\S]*?focus\(/.test(switcherViewReactSource),
  false,
  'React tab switcher selection updates should not force focus because it can cause visible jumpiness'
);
assert.strictEqual(
  /getTabSwitcherRuntimeVersion|tab_switcher_runtime_stale|runtimeVersion/.test(switcherBridgeSource),
  false,
  'shared tab switcher bridge should not keep stale-runtime reload update logic'
);
assert.match(
  switcherBridgeSource,
  /function setTabSwitcherCaptureVisibility\(hidden\)[\s\S]*TAB_SWITCHER_HOST_ID[\s\S]*style\.getPropertyValue\('visibility'\)[\s\S]*style\.setProperty\('visibility',\s*'hidden',\s*'important'\)[\s\S]*style\.removeProperty\('visibility'\)[\s\S]*return \{ ok: true \}/,
  'shared tab switcher bridge should hide and restore the switcher host for thumbnail captures'
);
assert.match(
  switcherBridgeSource,
  /setTabSwitcherCaptureVisibility[\s\S]*request\.hidden/,
  'shared tab switcher bridge should handle background capture-visibility commands'
);
assert.match(
  switcherBridgeSource,
  /function getOpenTabSwitcherState\(\)[\s\S]*TAB_SWITCHER_HOST_ID[\s\S]*open:\s*Boolean\(host\)/,
  'shared tab switcher bridge should report whether an extension-page tab switcher is already open'
);
assert.match(
  switcherBridgeSource,
  /respondToExtensionPageRequest[\s\S]*advanced:[\s\S]*open:[\s\S]*suppressed:/,
  'shared tab switcher bridge should pass command advance and open-state status back to extension-page ports'
);
assert.match(
  switcherBridgeSource,
  /function commitOpenTabSwitcherFromShortcutRelease\(\)[\s\S]*_lumnoTabSwitcherCommitFromShortcutRelease\(\)[\s\S]*request\.action === 'commitOpenTabSwitcherFromShortcutRelease'/,
  'extension-page switchers should accept the same relayed configured-key release command'
);
assert.match(
  shortcutReleaseRelaySource,
  /RUNTIME_KEY[\s\S]*previousRuntime\.cleanup\(\)[\s\S]*RELEASE_REPLAY_WINDOW_MS[\s\S]*function rememberTrustedShortcutRelease\(event\)[\s\S]*function getBufferedReleasedShortcutKey\(keys, commandStartedAt\)[\s\S]*observedAt >= startedAt[\s\S]*request\.commandStartedAt[\s\S]*function notifyTabSwitcherShortcutModifierReleased\(event\)[\s\S]*event\.isTrusted !== true[\s\S]*rememberTrustedShortcutRelease\(event\)[\s\S]*relayTabSwitcherShortcutRelease\(key\)[\s\S]*window\.addEventListener\('keyup',\s*notifyTabSwitcherShortcutModifierReleased,\s*true\)[\s\S]*removeEventListener\('keyup',\s*notifyTabSwitcherShortcutModifierReleased/,
  'the document-start observer should relay live releases and replay only trusted releases from the current shortcut command'
);
assert.match(
  backgroundSource,
  /function prepareShortcutKeyObserver\(tab\)[\s\S]*allFrames:\s*true[\s\S]*files:\s*\['src\/shared\/shortcut-key-matcher\.js',\s*'src\/content\/shortcut-key-observer\.js'\]/,
  'the background should dynamically install the release observer in already-open tabs and focused frames'
);
assert.match(
  backgroundSource,
  /function prepareShortcutKeyObserversInOpenTabs\(\)[\s\S]*chrome\.tabs\.query\(\{\},[\s\S]*prepareShortcutKeyObserver\(tab\)[\s\S]*chrome\.runtime\.onInstalled\.addListener\([\s\S]*prepareShortcutKeyObserversInOpenTabs\(\)[\s\S]*chrome\.runtime\.onStartup\.addListener\([\s\S]*prepareShortcutKeyObserversInOpenTabs\(\)/,
  'extension reload and browser startup should prepare already-open tabs before the user presses the shortcut'
);
const shortcutReleaseContentScript = manifest.content_scripts.find((entry) => (
  entry &&
  Array.isArray(entry.js) &&
  entry.js.includes('src/content/shortcut-key-observer.js')
));
assert.ok(
  shortcutReleaseContentScript &&
    shortcutReleaseContentScript.js[0] === 'src/shared/shortcut-key-matcher.js' &&
    shortcutReleaseContentScript.run_at === 'document_start' &&
    shortcutReleaseContentScript.all_frames === true &&
    shortcutReleaseContentScript.match_about_blank === true &&
    shortcutReleaseContentScript.match_origin_as_fallback === true,
  'the shortcut observer should be present in every focused frame and related transient document'
);
assert.match(
  shortcutReleaseRelaySource,
  /function relayUnresolvedShowSearchShortcut\(event, descriptor\)[\s\S]*requiresShortcutVerification:\s*true[\s\S]*if \(!showSearchShortcutSpec\)\s*\{\s*relayUnresolvedShowSearchShortcut\(event, descriptor\);\s*return;/,
  'the first trusted keydown should be relayed for background verification while shortcut configuration is pending'
);
assert.match(
  backgroundSource,
  /case 'triggerShowSearchFromPageHotkey':[\s\S]*request\.requiresShortcutVerification === true[\s\S]*getConfiguredFallbackShortcut\(\(shortcut\) =>[\s\S]*SHORTCUT_KEY_MATCHER\.descriptorMatchesShortcut\(request\.observedShortcut, spec\)[\s\S]*triggerVerifiedPageHotkey\(shortcut\)/,
  'the background should validate the cold-start key descriptor against the live browser shortcut before opening Lumno'
);
assert.match(
  switcherBridgeSource,
  /TAB_SWITCHER_RELEASE_REPLAY_WINDOW_MS[\s\S]*function rememberTrustedTabSwitcherShortcutRelease\(event\)[\s\S]*function getBufferedTabSwitcherShortcutReleaseKey\(keys, commandStartedAt\)[\s\S]*observedAt >= startedAt[\s\S]*request\.commandStartedAt[\s\S]*function notifyTabSwitcherShortcutModifierReleased\(event\)[\s\S]*event\.isTrusted !== true[\s\S]*rememberTrustedTabSwitcherShortcutRelease\(event\)[\s\S]*relayTabSwitcherShortcutRelease\(key\)[\s\S]*window\.addEventListener\('keyup',\s*notifyTabSwitcherShortcutModifierReleased,\s*true\)/,
  'extension pages should preserve the same current-command release replay behavior through their persistent bridge'
);
assert.match(
  switcherBridgeSource,
  /function updateOpenTabSwitcherThumbnail\(request\)[\s\S]*_lumnoTabSwitcherUpdateThumbnail[\s\S]*request\.action === 'updateTabSwitcherThumbnail'/,
  'shared tab switcher bridge should forward live thumbnail updates into extension-page switchers'
);
assert.strictEqual(
  /openTabSwitcherFromCommand|advanceOpenTabSwitcherFromCommand|_x_extension_tab_switcher_advance_command_2026_unique_/.test(contentHotkeySource),
  false,
  'content hotkey listener should not duplicate tab switcher command bridge logic'
);
assert.match(
  switcherBridgeSource,
  /const TAB_SWITCHER_EXTENSION_PAGE_PORT_NAME = 'lumno-tab-switcher-extension-page';[\s\S]*chromeApi\.runtime\.connect\(\{ name: TAB_SWITCHER_EXTENSION_PAGE_PORT_NAME \}\)/,
  'shared tab switcher bridge should connect extension pages to the background with a named port'
);
assert.match(
  switcherBridgeSource,
  /chromeApi\.tabs\.getCurrent[\s\S]*registerTabSwitcherExtensionPage/,
  'shared tab switcher bridge should register the current extension page tab id'
);
[
  ['newtab', newtabHtmlSource],
  ['options', optionsHtmlSource],
  ['onboarding', onboardingHtmlSource]
].forEach(([pageName, html]) => {
  assert.ok(
    html.includes('<script src="../overlay/tab-switcher.js"></script>') &&
      html.includes('data-react-ready-script="../overlay/tab-switcher-page-bridge.js"') &&
      !html.includes('<script src="../overlay/tab-switcher-page-bridge.js"></script>') &&
      html.indexOf('<script src="../overlay/tab-switcher.js"></script>') <
        html.indexOf('data-react-ready-script="../overlay/tab-switcher-page-bridge.js"'),
    `${pageName} should connect its tab switcher bridge only after the React entry is ready`
  );
});
assert.match(
  switcherSource,
  /const tabSwitcherReactViewApi = window\.LumnoOverlayTabSwitcherView;[\s\S]*typeof tabSwitcherReactViewApi\.createTabSwitcherView !== 'function'[\s\S]*reason: 'react-view-unavailable'/,
  'the classic switcher runtime should resolve the page React API at invocation time'
);
assert.match(
  switcherBridgeSource,
  /const result = toggle\(context\);[\s\S]*typeof result === 'object'[\s\S]*result/,
  'the extension-page bridge should propagate switcher startup failures'
);
assert.match(
  backgroundSource,
  /const TAB_SWITCHER_EXTENSION_PAGE_PORT_NAME = 'lumno-tab-switcher-extension-page';[\s\S]*const tabSwitcherExtensionPagePortsByTabId = new Map\(\);/,
  'background should keep targeted ports for extension-page tab switcher hosts'
);
assert.match(
  backgroundSource,
  /function isOwnExtensionPageUrl\(url\)[\s\S]*chrome\.runtime\.id[\s\S]*parsed\.hostname === chrome\.runtime\.id/,
  'Alt+Q should only treat this extension own pages as extension-page switcher hosts'
);
assert.match(
  backgroundSource,
  /function hasTabSwitcherExtensionPagePort\(tab\)[\s\S]*tabSwitcherExtensionPagePortsByTabId\.get\(tab\.id\)[\s\S]*typeof record\.port\.postMessage === 'function'/,
  'Alt+Q should be able to recognize chrome://newtab tabs that have already registered the Lumno extension-page bridge'
);
assert.match(
  backgroundSource,
  /function canHostSwitcherSurface\(tab\)[\s\S]*isOwnExtensionPageUrl\(url\)[\s\S]*isBrowserNewtabUrl\(url\) && hasTabSwitcherExtensionPagePort\(tab\)[\s\S]*canOpenOverlayOnUrl\(url\)/,
  'Alt+Q should allow browser newtab URLs to host only when the Lumno extension-page bridge is registered'
);
assert.match(
  backgroundSource,
  /function postTabSwitcherMessageToExtensionPage\(tab,\s*message,\s*callback\)[\s\S]*isTabSwitcherExtensionPageMessageTarget\(tab\)[\s\S]*(?:record\.)?port\.postMessage\((?:message|payload)\)/,
  'background should send switcher open and advance messages to extension-page message targets through the registered port'
);
const openOverlayBlock = getFunctionBlock(
  backgroundSource,
  'function openOverlayOnTab(activeTab, tabs, source, options)',
  'function triggerShowSearchForTab(tab, source)'
);
assert.match(
  openOverlayBlock,
  /if \(restricted\)[\s\S]*isSearchCommandSource\(source\) && \(isLumnoNewtabUrl\(activeUrl\) \|\| isBrowserNewtabUrl\(activeUrl\)\)[\s\S]*requestFocusVisibleNewtabInput\(source,\s*activeTab\.id\)[\s\S]*return;/,
  'show-search commands on restricted Lumno/browser newtab URLs should keep focusing the visible newtab input'
);
assert.match(
  openOverlayBlock,
  /if \(action === 'none'\)[\s\S]*fallback-open-browser-newtab[\s\S]*openBrowserNewtabFallback\(\{ sourceTab: activeTab \}\)[\s\S]*return;/,
  'restricted browser-setting action should open the browser-selected newtab provider instead of suppressing the shortcut'
);
assert.strictEqual(
  (manifest.permissions || []).includes('management'),
  false,
  'automatic restricted action detection should not add the broad extension management permission'
);
assert.match(
  backgroundSource,
  /const BROWSER_NEWTAB_PROVIDER_DETECTION_MS = \d+;[\s\S]*const browserNewtabProviderCandidateTabIds = new Map\(\);/,
  'background should keep a bounded candidate window for browser-selected newtab provider detection'
);
assert.match(
  backgroundSource,
  /const RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY = '_x_extension_restricted_action_auto_browser_setting_done_2026_unique_';/,
  'background should persist a one-shot marker after automatic browser-setting selection'
);
assert.match(
  backgroundSource,
  /function rememberBrowserNewtabProviderCandidate\(tab\)[\s\S]*isPotentialBrowserNewtabProviderCandidate\(tab\)[\s\S]*browserNewtabProviderCandidateTabIds\.set/,
  'background should only track tabs that look like browser-created newtab candidates'
);
assert.match(
  backgroundSource,
  /let restrictedActionAutoBrowserSettingDoneCache = false;/,
  'background should cache whether automatic restricted-action selection has already run'
);
assert.match(
  backgroundSource,
  /function setRestrictedActionFromBrowserNewtabProvider\(providerType,\s*tab,\s*stage\)[\s\S]*restrictedActionAutoBrowserSettingDoneCache[\s\S]*RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY[\s\S]*storageArea\.set\(payload\)/,
  'background should set the browser-setting action and one-shot marker together'
);
assert.match(
  backgroundSource,
  /function maybeAutoSelectRestrictedBrowserSetting\(tab,\s*stage\)[\s\S]*restrictedActionAutoBrowserSettingDoneCache[\s\S]*providerType === 'other-extension'[\s\S]*setRestrictedActionFromBrowserNewtabProvider/,
  'background should auto-select browser setting when a browser newtab resolves to another extension provider'
);
assert.match(
  backgroundSource,
  /changes\[RESTRICTED_ACTION_AUTO_BROWSER_SETTING_DONE_STORAGE_KEY\][\s\S]*restrictedActionAutoBrowserSettingDoneCache = next === true;/,
  'background should keep the one-shot marker cache synced from storage changes'
);
assert.match(
  backgroundSource,
  /chrome\.tabs\.onCreated\.addListener\(\(tab\) => \{[\s\S]*rememberBrowserNewtabProviderCandidate\(tab\);[\s\S]*maybeAutoSelectRestrictedBrowserSetting\(tab,\s*'created'\);/,
  'tab creation should feed automatic newtab-provider detection before hotkey recovery work'
);
assert.match(
  backgroundSource,
  /chrome\.tabs\.onUpdated\.addListener\(\(tabId,\s*changeInfo,\s*tab\) => \{[\s\S]*maybeAutoSelectRestrictedBrowserSetting\([\s\S]*'updated/,
  'tab URL updates should resolve browser-created newtab candidates into the active provider'
);
assert.doesNotMatch(
  openOverlayBlock,
  /if \(action === 'none'\)[\s\S]*restricted_action_none[\s\S]*return;/,
  'restricted browser-setting action should no longer be treated as no action'
);
assert.strictEqual(
  /TAB_SWITCHER_RUNTIME_VERSION|getTabSwitcherRuntimeVersionOnTab|tab_switcher_runtime_stale/.test(backgroundSource),
  false,
  'background should not keep the reload-time tab switcher runtime update path'
);
assert.match(
  backgroundSource,
  /function setTabSwitcherCaptureVisibility\(tab,\s*hidden\)[\s\S]*action:\s*'setTabSwitcherCaptureVisibility'[\s\S]*sendTabSwitcherHostMessage/,
  'background should set tab switcher capture visibility through the shared host message helper'
);
assert.match(
  backgroundSource,
  /function getOpenTabSwitcherState\(tab\)[\s\S]*action:\s*'getOpenTabSwitcherState'[\s\S]*sendTabSwitcherHostMessage/,
  'background should read open tab switcher state through the shared host message helper'
);
assert.match(
  backgroundSource,
  /function postTabSwitcherThumbnailUpdate\(tab,\s*update\)[\s\S]*action:\s*'updateTabSwitcherThumbnail'[\s\S]*sendTabSwitcherHostMessage/,
  'background should push fresh thumbnail captures through the shared host message helper'
);
const hostMessageBlock = getFunctionBlock(
  backgroundSource,
  'function sendTabSwitcherHostMessage(tab, payload, optionsArg)',
  'function setTabSwitcherCaptureVisibility(tab, hidden)'
);
assert.match(
  hostMessageBlock,
  /postTabSwitcherMessageToExtensionPage/,
  'background tab switcher host messages should try the extension-page port path'
);
assert.match(
  hostMessageBlock,
  /chrome\.tabs\.sendMessage/,
  'background tab switcher host messages should try the content-script message path'
);
assert.match(
  hostMessageBlock,
  /runTabSwitcherHostScript/,
  'background tab switcher host messages should share one executeScript fallback path'
);
[
  ['setTabSwitcherCaptureVisibility', 'function setTabSwitcherCaptureVisibility(tab, hidden)'],
  ['getOpenTabSwitcherState', 'function getOpenTabSwitcherState(tab)'],
  ['postTabSwitcherThumbnailUpdate', 'function postTabSwitcherThumbnailUpdate(tab, update)']
].forEach(([name, startNeedle]) => {
  const block = getFunctionBlock(
    backgroundSource,
    startNeedle,
    name === 'postTabSwitcherThumbnailUpdate'
      ? 'function waitForTabSwitcherCapturePaint'
      : name === 'getOpenTabSwitcherState'
        ? 'function postTabSwitcherThumbnailUpdate'
        : 'function getOpenTabSwitcherState'
  );
  assert.match(
    block,
    /sendTabSwitcherHostMessage\(/,
    `${name} should delegate transport details to the shared host message helper`
  );
  assert.strictEqual(
    /function runExecuteScriptFallback|const runExecuteScriptFallback/.test(block),
    false,
    `${name} should not keep local executeScript fallback plumbing`
  );
});
assert.match(
  backgroundSource,
  /function withTabSwitcherHiddenForCapture\(tab,\s*capture\)[\s\S]*setTabSwitcherCaptureVisibility\(tab,\s*true\)[\s\S]*\.finally\(\(\) => setTabSwitcherCaptureVisibility\(tab,\s*false\)\)/,
  'background should restore the switcher host after thumbnail capture success or failure'
);
const captureSwitcherThumbnailBlock = getFunctionBlock(
  backgroundSource,
  'function captureSwitcherThumbnailForTab(tab, reason)',
  'function captureSwitcherThumbnailNow(request)'
);
assert.match(
  captureSwitcherThumbnailBlock,
  /shouldSkipSwitcherThumbnailCaptureForOpenSwitcher\(resolvedTab,\s*reason\)[\s\S]*logSwitcherThumbnailCaptureFailure\(resolvedTab,\s*'tab-switcher-open'/,
  'thumbnail capture should skip instead of hiding the page when the tab switcher is opening or already open'
);
assert.match(
  captureSwitcherThumbnailBlock,
  /withTabSwitcherHiddenForCapture\(resolvedTab,[\s\S]*chrome\.tabs\.captureVisibleTab/,
  'thumbnail capture should still hide and restore any late switcher host before calling captureVisibleTab'
);
assert.match(
  captureSwitcherThumbnailBlock,
  /recentTabTracker\.setThumbnail\(resolvedTab\.id,[\s\S]*postTabSwitcherThumbnailUpdate\(resolvedTab,/,
  'thumbnail capture success should publish the fresh cover to an already-open switcher'
);
assert.strictEqual(
  backgroundSource.includes('triggerTabSwitcherFromPageHotkey'),
  false,
  'background router should not keep the removed Alt+Tab page-hotkey action'
);
assert.match(
  switcherSource,
  /isTabSwitcherShortcutTriggerEvent\(shortcut,\s*event\)[\s\S]*selectByOffset\(1\)/,
  'tab switcher should allow the configured shortcut key to cycle to the next item'
);
assert.match(
  switcherSource,
  /let suppressInitialShortcutAdvanceUntilTriggerKeyup = context\.suppressInitialShortcutAdvance === true;/,
  'tab switcher should suppress only the initial held shortcut key until its first keyup'
);
assert.match(
  switcherSource,
  /function shouldSuppressInitialShortcutAdvance\(\)[\s\S]*return suppressInitialShortcutAdvanceUntilTriggerKeyup;/,
  'tab switcher should use key state, not a time window, for initial held-shortcut suppression'
);
assert.strictEqual(
  /INITIAL_SHORTCUT_ADVANCE_SUPPRESS_MS|Date\.now\(\)\s*\+/.test(switcherSource),
  false,
  'tab switcher should not use a sliding time window because it makes Q feel dead after the opening flash'
);
assert.match(
  switcherSource,
  /function advanceSelectionFromShortcut\(offset\)[\s\S]*suppressInitialShortcutAdvanceUntilTriggerKeyup = false;[\s\S]*selectByOffset\(offset\);[\s\S]*return true;/,
  'tab switcher command re-entry should clear initial suppression and advance while Alt remains held'
);
assert.match(
  switcherSource,
  /if \(isTabSwitcherShortcutTriggerEvent\(shortcut,\s*event\)\)[\s\S]*if \(shouldSuppressInitialShortcutAdvance\(\) && isTabSwitcherCommitModifierPressed\(shortcut,\s*event\)\)[\s\S]*return;[\s\S]*selectByOffset\(1\)/,
  'tab switcher should ignore immediate held shortcut duplicate keydowns without preventing later cycling'
);
assert.match(
  switcherSource,
  /if \(isTabSwitcherShortcutTriggerEvent\(shortcut,\s*event\)\)[\s\S]*if \(shouldSuppressInitialShortcutAdvance\(\) && isTabSwitcherCommitModifierPressed\(shortcut,\s*event\)\)[\s\S]*return;[\s\S]*suppressInitialShortcutAdvanceUntilTriggerKeyup = false;[\s\S]*selectByOffset\(1\)/,
  'tab switcher should clear initial suppression when the shortcut key is pressed after its modifier has been released'
);
assert.match(
  switcherSource,
  /function handleKeyup[\s\S]*isTabSwitcherShortcutTriggerEvent\(shortcut,\s*event\)[\s\S]*suppressInitialShortcutAdvanceUntilTriggerKeyup = false;[\s\S]*stopHandledKeyEvent\(event\);[\s\S]*return;/,
  'releasing a custom shortcut trigger should clear suppression without committing while its modifier remains held'
);
assert.match(
  switcherSource,
  /function handleKeyup[\s\S]*shortcut\.commitModifierEventKey[\s\S]*event\.key === shortcut\.commitModifierEventKey[\s\S]*clickSelectedCardFromShortcutRelease\(\)/,
  'default and custom shortcuts should commit when their configured primary modifier is released'
);
assert.match(
  switcherSource,
  /window\.addEventListener\('keyup',\s*handleKeyup,\s*true\)/,
  'tab switcher should listen for keyup so command-key release can commit the selection'
);
assert.strictEqual(
  /focusSelectedCardForShortcutRelease|focusedElementBeforeOpen|restoreFocusAfterClose/.test(switcherSource),
  false,
  'shortcut release recovery should not steal or rewrite the page focus chain'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-card\s*\{[\s\S]*?cursor:\s*pointer;/,
  'tab switcher cards should use a pointer cursor for hover selection'
);
assert.match(
  switcherViewReactSource,
  /onPointerEnter=\{\(\) => options\.onSelect\(index\)\}/,
  'React tab switcher cards should select on pointer hover'
);
assert.strictEqual(
  switcherSource.includes("createElement(document, 'div', 'x-tab-switcher-title')"),
  false,
  'tab switcher should not render a visible title row'
);
assert.match(
  switcherSource,
  /const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';/,
  'tab switcher should read the shared theme setting'
);
assert.match(
  switcherSource,
  /function applySwitcherTheme\(panel,\s*mode\)[\s\S]*setAttribute\('data-theme',\s*resolved\)/,
  'tab switcher should resolve and apply a data-theme value'
);
const detectSwitcherPageThemeBlock = getFunctionBlock(
  switcherSource,
  'function detectSwitcherPageTheme()',
  'function resolveSwitcherTheme(mode)'
);
assert.match(
  detectSwitcherPageThemeBlock,
  /data-color-scheme/,
  'tab switcher system theme should read page theme attributes'
);
assert.match(
  detectSwitcherPageThemeBlock,
  /meta\[name="color-scheme"\]/,
  'tab switcher system theme should read color-scheme meta'
);
assert.match(
  detectSwitcherPageThemeBlock,
  /meta\[name="theme-color"\][\s\S]*themeFromSwitcherColor/,
  'tab switcher system theme should infer page brightness from theme-color meta'
);
assert.match(
  switcherSource,
  /function themeFromSwitcherColor\(color\)[\s\S]*getSwitcherLuminance\(rgb\)\s*<\s*0\.42/,
  'tab switcher color-based page theme detection should use luminance instead of raw brightness'
);
const resolveSwitcherThemeBlock = getFunctionBlock(
  switcherSource,
  'function resolveSwitcherTheme(mode)',
  'function applySwitcherTheme(panel, mode)'
);
assert.match(
  resolveSwitcherThemeBlock,
  /const pageTheme = detectSwitcherPageTheme\(\);[\s\S]*if \(pageTheme\)[\s\S]*return pageTheme;[\s\S]*return getSystemSwitcherTheme\(\);/,
  'tab switcher system theme should prefer page theme detection before system media fallback'
);
assert.ok(
  resolveSwitcherThemeBlock.indexOf('const pageTheme = detectSwitcherPageTheme();') <
    resolveSwitcherThemeBlock.indexOf("if (normalized !== 'system')"),
  'tab switcher should prefer explicit page/plugin-page theme over stored extension theme mode'
);
assert.match(
  switcherSource,
  /function createSwitcherThemeController\(panel\)[\s\S]*MutationObserver[\s\S]*observe\(docEl[\s\S]*observe\(body[\s\S]*observe\(head[\s\S]*return \{[\s\S]*start[\s\S]*destroy/,
  'tab switcher theme listener and page observer cleanup should live in a controller instead of inline patches'
);
assert.match(
  switcherSource,
  /chromeApi\.storage\.onChanged\.addListener\(themeStorageListener\)/,
  'tab switcher should react to theme setting changes'
);
assert.match(
  switcherSource,
  /switcherThemeMediaQuery\.addEventListener\('change',\s*themeMediaListener\)/,
  'tab switcher should react to system dark-mode changes when using system theme'
);
assert.match(
  switcherSource,
  /#\$\{PANEL_ID\}\s*\{[\s\S]*--x-tab-switcher-accent:\s*#2563eb;/,
  'tab switcher panel should expose a fallback accent color'
);
assert.match(
  switcherSource,
  /#\$\{PANEL_ID\}\s*\{[\s\S]*color-scheme:\s*light;/,
  'tab switcher light theme should declare a light color scheme'
);
const panelBlock = getCssRuleBlock(switcherSource, '#${PANEL_ID}');
assert.match(
  panelBlock,
  /--x-tab-switcher-padding-panel:\s*10px;[\s\S]*--x-tab-switcher-padding-card:\s*7px;[\s\S]*--x-tab-switcher-border-card:\s*1px;[\s\S]*--x-tab-switcher-radius-panel:\s*30px;[\s\S]*--x-tab-switcher-radius-card:\s*calc\(var\(--x-tab-switcher-radius-panel\) - var\(--x-tab-switcher-padding-panel\)\);[\s\S]*--x-tab-switcher-radius-thumb:\s*calc\(var\(--x-tab-switcher-radius-card\) - var\(--x-tab-switcher-padding-card\) - var\(--x-tab-switcher-border-card\)\);/,
  'tab switcher rounded corners should be derived from panel/card spacing so nested curves stay visually coordinated'
);
assert.match(
  panelBlock,
  /--x-tab-switcher-motion-card:\s*180ms cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\);[\s\S]*--x-tab-switcher-motion-fade:\s*150ms ease;[\s\S]*--x-tab-switcher-thumb-stroke-inset:\s*-0\.5px;[\s\S]*--x-tab-switcher-thumb-stroke-radius-offset:\s*0\.5px;[\s\S]*--x-tab-switcher-thumb-stroke-color:\s*rgba\(15,\s*23,\s*42,\s*0\.2\);/,
  'tab switcher visual timing and thumbnail stroke constants should live in panel tokens instead of scattered patch values'
);
assert.match(
  panelBlock,
  /--x-tab-switcher-title-icon-size:\s*16px;[\s\S]*--x-tab-switcher-title-icon-gap:\s*5px;/,
  'tab switcher title favicon sizing should be centralized so responsive overrides stay structural'
);
assert.match(
  panelBlock,
  /left:\s*var\(--x-tab-switcher-center-left,\s*50%\);[\s\S]*top:\s*var\(--x-tab-switcher-center-top,\s*50%\);/,
  'tab switcher panel should use visual-viewport-aware center tokens'
);
assert.match(
  panelBlock,
  /--x-tab-switcher-visible-scale:\s*1;/,
  'tab switcher panel should expose a stable scale token so page zoom compensation does not alter centering'
);
assert.match(
  panelBlock,
  /transform:\s*translate3d\(-50%,\s*-50%,\s*0\)\s*scale\(var\(--x-tab-switcher-visible-scale\)\);/,
  'tab switcher panel entrance should use the final transform so opening cannot jump between frames'
);
assert.match(
  switcherSource,
  /#\$\{PANEL_ID\}\[data-visible="true"\]\s*\{[\s\S]*transform:\s*translate3d\(-50%,\s*-50%,\s*0\)\s*scale\(var\(--x-tab-switcher-visible-scale\)\);/,
  'tab switcher visible state should remain vertically centered'
);
assert.ok(
  switcherViewReactSource.includes('data-visible="true"') &&
    switcherSource.includes('document.documentElement.appendChild(host)'),
  'the React tab switcher should mount in its visible state on first paint'
);
assert.strictEqual(
  /requestAnimationFrame\(\(\) => \{\s*requestAnimationFrame\(\(\) => \{[\s\S]*data-visible/.test(switcherSource),
  false,
  'tab switcher should not delay its visible state by nested requestAnimationFrame calls'
);
assert.strictEqual(
  /--x-tab-switcher-entrance-scale/.test(panelBlock),
  false,
  'tab switcher should not keep a separate entrance scale because it can make the panel flash-jump after summon'
);
assert.match(
  panelBlock,
  /transition:\s*opacity 90ms ease;/,
  'tab switcher opening should use a minimal opacity-only transition'
);
assert.strictEqual(
  /transition:[^;]*(?:transform|filter)/.test(panelBlock),
  false,
  'tab switcher opening should avoid transform and filter transitions that can cause visible jumpiness'
);
assert.strictEqual(
  /style\.setProperty\('zoom'/.test(switcherSource),
  false,
  'tab switcher should not use CSS zoom for page zoom compensation because it can shift the visual center'
);
assert.match(
  switcherSource,
  /applySwitcherZoomCompensation\(panel,\s*context\.tabZoomFactor,\s*getSwitcherVisualViewportScale\(window\)\)/,
  'tab switcher should centralize page zoom compensation before rendering'
);
const applySwitcherZoomCompensationBlock = getFunctionBlock(
  switcherSource,
  'function applySwitcherZoomCompensation(panel, tabZoomFactor, visualViewportScale)',
  'function buildStyles()'
);
assert.match(
  applySwitcherZoomCompensationBlock,
  /--x-tab-switcher-visible-scale/,
  'tab switcher page zoom compensation should update the stable transform scale token'
);
assert.match(
  switcherSource,
  /function getSwitcherVisualViewportScale\(win\)[\s\S]*visualViewport\.scale/,
  'tab switcher should read visualViewport.scale for cmd+wheel zoom compensation'
);
assert.match(
  switcherSource,
  /function getSwitcherViewportComfortScale\(win\)[\s\S]*return 1\.08;[\s\S]*return 1\.045;[\s\S]*return 1;/,
  'tab switcher should gently enlarge on roomy viewports while leaving compact windows at the base scale'
);
assert.match(
  switcherSource,
  /function applySwitcherZoomCompensation\(panel,\s*tabZoomFactor,\s*visualViewportScale\)[\s\S]*zoomRaw \* visualScale/,
  'tab switcher should combine tab zoom and visual viewport scale before computing the visible scale'
);
assert.match(
  applySwitcherZoomCompensationBlock,
  /const viewportComfortScale = getSwitcherViewportComfortScale\(window\);[\s\S]*baseVisibleScale \* viewportComfortScale/,
  'tab switcher zoom compensation should include the large-viewport comfort scale in the same stable transform token'
);
assert.match(
  switcherSource,
  /applySwitcherZoomCompensation\(panel,\s*context\.tabZoomFactor,\s*getSwitcherVisualViewportScale\(window\)\)/,
  'tab switcher should apply visual viewport scale when it first opens'
);
assert.match(
  switcherSource,
  /switcherVisualViewport\.addEventListener\('resize',\s*syncSwitcherZoomCompensation/,
  'tab switcher should resync when cmd+wheel changes visual viewport scale while the panel is open'
);
assert.strictEqual(
  /top:\s*clamp\(120px,\s*30vh,\s*320px\);/.test(panelBlock),
  false,
  'tab switcher panel should no longer be biased toward the upper-middle'
);
assert.match(
  panelBlock,
  /--x-tab-switcher-gap:\s*6px;/,
  'tab switcher list spacing should be tightly compact'
);
assert.match(
  panelBlock,
  /padding:\s*var\(--x-tab-switcher-padding-panel\);/,
  'tab switcher panel chrome should be tightly compact'
);
assert.match(
  panelBlock,
  /background:\s*[\s\S]*radial-gradient\(120% 160% at 12% -24%,[\s\S]*linear-gradient\(135deg,/,
  'tab switcher panel should use layered gradients for a richer floating surface'
);
assert.match(
  panelBlock,
  /radial-gradient\(120% 160% at 12% -24%,\s*rgba\(255,\s*255,\s*255,\s*0\.78\)[\s\S]*rgba\(255,\s*255,\s*255,\s*0\.44\)[\s\S]*rgba\(241,\s*245,\s*249,\s*0\.26\)[\s\S]*linear-gradient\(135deg,\s*rgba\(255,\s*255,\s*255,\s*0\.48\),\s*rgba\(226,\s*232,\s*240,\s*0\.28\)\)/,
  'tab switcher light panel acrylic should lower the background alpha so more page color comes through'
);
assert.match(
  panelBlock,
  /box-shadow:\s*[\s\S]*inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*0\.86\)[\s\S]*inset 0 -18px 44px rgba\(255,\s*255,\s*255,\s*0\.22\)[\s\S]*inset 0 0 0 1px rgba\(255,\s*255,\s*255,\s*0\.3\)/,
  'tab switcher panel should keep subtler white inner highlights for a lighter acrylic surface'
);
assert.match(
  switcherSource,
  /#\$\{PANEL_ID\}\s*\{[\s\S]*--x-tab-switcher-card-width:\s*clamp\(136px,\s*calc\(\(100vw - 68px\) \/ 5\),\s*204px\);[\s\S]*width:\s*fit-content;/,
  'tab switcher panel should size to fixed-width cards instead of stretching cards to fill the viewport'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(var\(--x-tab-count,\s*5\),\s*var\(--x-tab-switcher-card-width\)\);[\s\S]*width:\s*max-content;/,
  'tab switcher cards should use fixed grid tracks in one row'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-card\s*\{[\s\S]*width:\s*var\(--x-tab-switcher-card-width\);[\s\S]*min-width:\s*var\(--x-tab-switcher-card-width\);[\s\S]*max-width:\s*var\(--x-tab-switcher-card-width\);/,
  'tab switcher card width should be fixed rather than based on available grid width'
);
assert.strictEqual(
  /grid-template-columns:\s*1fr;/.test(switcherSource),
  false,
  'tab switcher should keep recent tabs in one row on narrow screens'
);
assert.strictEqual(
  /grid-template-columns:\s*148px minmax\(0,\s*1fr\);/.test(switcherSource),
  false,
  'tab switcher should not switch cards into a mobile stacked row layout'
);
assert.match(
  switcherSource,
  /backdrop-filter:\s*blur\(56px\)\s*saturate\(210%\)/,
  'tab switcher panel should use a stronger acrylic backdrop blur'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-card\s*\{[\s\S]*border:\s*var\(--x-tab-switcher-border-card\) solid transparent;/,
  'tab switcher cards should reserve a transparent border so selected borders follow the same rounded curve without layout shift'
);
const baseCardBlock = getCssRuleBlock(switcherSource, '.x-tab-switcher-card');
assert.match(
  panelBlock,
  /border-radius:\s*var\(--x-tab-switcher-radius-panel\);/,
  'tab switcher panel should use the coordinated panel radius token'
);
assert.match(
  baseCardBlock,
  /border-radius:\s*var\(--x-tab-switcher-radius-card\);/,
  'tab switcher cards should use the coordinated card radius token'
);
assert.match(
  baseCardBlock,
  /gap:\s*7px;/,
  'tab switcher card internals should be tightly compact'
);
assert.match(
  baseCardBlock,
  /padding:\s*var\(--x-tab-switcher-padding-card\);/,
  'tab switcher cards should use tighter padding'
);
assert.match(
  baseCardBlock,
  /background:\s*transparent;/,
  'tab switcher inactive cards should not draw a white card background'
);
assert.strictEqual(
  /background:\s*rgba\(255,\s*255,\s*255,/.test(baseCardBlock),
  false,
  'tab switcher inactive cards should not keep a white translucent background'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-card\s*\{[\s\S]*transition:\s*border-color 140ms ease,\s*background 140ms ease,\s*box-shadow var\(--x-tab-switcher-motion-card\);/,
  'tab switcher hover and selection transitions should ease the highlight shadow without animating unrelated properties'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-card\[data-active="true"\]\s*\{[\s\S]*border-color:\s*color-mix\(in srgb,\s*var\(--x-tab-switcher-card-accent,\s*var\(--x-tab-switcher-accent\)\)\s*32%,\s*rgba\(15,\s*23,\s*42,\s*0\.08\)\);/,
  'tab switcher selected card border should be a softer one-pixel theme tint that follows the card radius'
);
const activeCardBlock = getCssRuleBlock(switcherSource, '.x-tab-switcher-card[data-active="true"]');
assert.match(
  activeCardBlock,
  /background:\s*[\s\S]*color-mix\(in srgb,\s*var\(--x-tab-switcher-card-accent,\s*var\(--x-tab-switcher-accent\)\)\s*16%,/,
  'tab switcher selected cards should add a soft per-tab theme tint to the background'
);
assert.match(
  activeCardBlock,
  /0 0 16px color-mix\(in srgb,\s*var\(--x-tab-switcher-card-accent,\s*var\(--x-tab-switcher-accent\)\)\s*7%,\s*transparent\)[\s\S]*0 4px 10px color-mix\(in srgb,\s*var\(--x-tab-switcher-card-accent,\s*var\(--x-tab-switcher-accent\)\)\s*3%,\s*transparent\)/,
  'tab switcher selected cards should add a barely-there theme-color glow instead of a dark drop shadow'
);
const thumbBlock = getCssRuleBlock(switcherSource, '.x-tab-switcher-thumb');
const thumbStrokeBlock = getCssRuleBlock(switcherSource, '.x-tab-switcher-thumb::after');
const thumbFaviconBlock = getCssRuleBlock(switcherSource, '.x-tab-switcher-thumb-favicon');
assert.match(
  thumbBlock,
  /border-radius:\s*var\(--x-tab-switcher-radius-thumb\);/,
  'tab switcher thumbnails should use the coordinated thumbnail radius token'
);
assert.strictEqual(
  /border(?:-color)?\s*:/.test(thumbBlock),
  false,
  'tab switcher screenshot containers should not draw a thumbnail border'
);
assert.match(
  thumbStrokeBlock,
  /content:\s*"";[\s\S]*position:\s*absolute;[\s\S]*inset:\s*var\(--x-tab-switcher-thumb-stroke-inset\);[\s\S]*z-index:\s*2;[\s\S]*border-radius:\s*calc\(var\(--x-tab-switcher-radius-thumb\) \+ var\(--x-tab-switcher-thumb-stroke-radius-offset\)\);[\s\S]*box-sizing:\s*border-box;[\s\S]*border:\s*1px solid var\(--x-tab-switcher-thumb-stroke-color\);[\s\S]*box-shadow:\s*none;/,
  'tab switcher screenshot containers should center a neutral overlay stroke on the thumbnail clipping edge'
);
const thumbnailImageBlock = getCssRuleBlock(switcherSource, '.x-tab-switcher-thumb img[data-kind="thumbnail"]');
assert.match(
  thumbnailImageBlock,
  /position:\s*absolute;[\s\S]*inset:\s*0;[\s\S]*opacity:\s*1;[\s\S]*transition:\s*opacity var\(--x-tab-switcher-motion-cover\);/,
  'tab switcher screenshot images should stack and fade so fresh captures can cover cached thumbnails'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-thumb img\[data-kind="thumbnail"\]\[data-entering="true"\]\s*\{[\s\S]*opacity:\s*0;/,
  'tab switcher fresh screenshot images should start transparent before fading over cached covers'
);
assert.strictEqual(
  /box-shadow\s*:/.test(thumbBlock),
  false,
  'tab switcher thumbnails should leave the edge stroke to the overlay so the line follows one contour'
);
assert.strictEqual(
  /\.x-tab-switcher-thumb\[data-thumbnail-status=/.test(switcherSource),
  false,
  'tab switcher thumbnail status should not duplicate base thumbnail styling'
);
assert.strictEqual(
  /\.x-tab-switcher-card\[data-thumbnail-status=/.test(switcherSource),
  false,
  'tab switcher thumbnail status should not duplicate base card transitions'
);
assert.strictEqual(
  /\.x-tab-switcher-card\[data-active="true"\]\s+\.x-tab-switcher-thumb\[data-thumbnail-status=/.test(switcherSource),
  false,
  'tab switcher selected cards should not tint thumbnail backgrounds separately from inactive cards'
);
assert.match(
  thumbFaviconBlock,
  /position:\s*absolute;[\s\S]*z-index:\s*3;[\s\S]*left:\s*8px;[\s\S]*bottom:\s*8px;[\s\S]*width:\s*24px;[\s\S]*height:\s*24px;[\s\S]*object-fit:\s*cover;[\s\S]*opacity:\s*0;[\s\S]*transform:\s*translate3d\(-2px,\s*4px,\s*0\)\s*scale\(0\.92\);[\s\S]*transition:\s*opacity var\(--x-tab-switcher-motion-fade\),\s*transform var\(--x-tab-switcher-motion-card\);[\s\S]*will-change:\s*opacity,\s*transform;/,
  'tab switcher should stage the favicon as a plain thumbnail overlay with only opacity and transform motion'
);
assert.strictEqual(
  /border-radius|box-shadow|background\s*:|filter\s*:/.test(thumbFaviconBlock),
  false,
  'tab switcher thumbnail favicon should not add rounded corners, stroke, background, shadow, or blur'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-card\[data-active="true"\]\s+\.x-tab-switcher-thumb-favicon\s*\{[\s\S]*opacity:\s*1;[\s\S]*transform:\s*translate3d\(0,\s*0,\s*0\)\s*scale\(1\);[\s\S]*\}/,
  'tab switcher should reveal the active favicon in the screenshot lower-left corner'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-title-favicon\s*\{[\s\S]*width:\s*var\(--x-tab-switcher-title-icon-size\);[\s\S]*height:\s*var\(--x-tab-switcher-title-icon-size\);[\s\S]*opacity:\s*1;[\s\S]*transition:\s*width var\(--x-tab-switcher-motion-card\),\s*opacity var\(--x-tab-switcher-motion-fade\),\s*transform var\(--x-tab-switcher-motion-card\),\s*filter var\(--x-tab-switcher-motion-card\);/,
  'tab switcher should keep the title favicon for inactive cards with a matching exit transition'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-card\[data-active="true"\]\s+\.x-tab-switcher-name-row\s*\{[\s\S]*grid-template-columns:\s*0 minmax\(0,\s*1fr\);[\s\S]*gap:\s*0;/,
  'tab switcher should let active titles expand into the title favicon space'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-card\[data-active="true"\]\s+\.x-tab-switcher-title-favicon\s*\{[\s\S]*width:\s*0;[\s\S]*opacity:\s*0;[\s\S]*transform:\s*translate3d\(-2px,\s*0,\s*0\)\s*scale\(0\.88\);/,
  'tab switcher should hide the active title favicon while the thumbnail favicon appears'
);
assert.match(
  switcherSource,
  /@supports \(corner-shape:\s*superellipse\(1\.25\)\)\s*\{[\s\S]*#\$\{PANEL_ID\}[\s\S]*\.x-tab-switcher-card[\s\S]*\.x-tab-switcher-thumb,[\s\S]*\.x-tab-switcher-thumb::after,[\s\S]*\.x-tab-switcher-favicon[\s\S]*\.x-tab-switcher-title-favicon[\s\S]*corner-shape:\s*superellipse\(1\.25\);[\s\S]*\}/,
  'tab switcher should use the same superellipse corner curve as the overlay'
);
assert.match(
  switcherSource,
  /#\$\{PANEL_ID\}\[data-theme="dark"\]\s*\{[\s\S]*color-scheme:\s*dark;[\s\S]*background:/,
  'tab switcher panel should have explicit dark-mode acrylic styling'
);
const darkPanelBlock = getCssRuleBlock(switcherSource, '#${PANEL_ID}[data-theme="dark"]');
assert.match(
  darkPanelBlock,
  /background:\s*[\s\S]*radial-gradient\(120% 150% at 12% -22%,[\s\S]*linear-gradient\(135deg,/,
  'tab switcher dark panel should use layered gradients instead of a flat acrylic wash'
);
assert.match(
  darkPanelBlock,
  /radial-gradient\(120% 150% at 12% -22%,\s*rgba\(71,\s*85,\s*105,\s*0\.4\)[\s\S]*rgba\(30,\s*41,\s*59,\s*0\.5\)[\s\S]*rgba\(8,\s*13,\s*24,\s*0\.44\)[\s\S]*linear-gradient\(135deg,\s*rgba\(30,\s*41,\s*59,\s*0\.54\),\s*rgba\(8,\s*13,\s*24,\s*0\.46\)\)/,
  'tab switcher dark panel acrylic should be less opaque while preserving dark-mode depth'
);
assert.match(
  darkPanelBlock,
  /box-shadow:\s*[\s\S]*inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*0\.16\)[\s\S]*inset 0 -18px 42px rgba\(255,\s*255,\s*255,\s*0\.04\)[\s\S]*inset 0 0 0 1px rgba\(255,\s*255,\s*255,\s*0\.05\)/,
  'tab switcher dark panel should keep subtler white inner highlights'
);
const darkBaseCardBlock = getCssRuleBlock(switcherSource, '#${PANEL_ID}[data-theme="dark"] .x-tab-switcher-card');
assert.match(
  darkBaseCardBlock,
  /background:\s*transparent;/,
  'tab switcher dark inactive cards should not draw their own filled surface'
);
assert.match(
  switcherSource,
  /#\$\{PANEL_ID\}\[data-theme="dark"\]\s+\.x-tab-switcher-card\[data-active="true"\]\s*\{[\s\S]*border-color:\s*color-mix\(in srgb,\s*var\(--x-tab-switcher-card-accent,\s*var\(--x-tab-switcher-accent\)\)\s*34%,\s*rgba\(255,\s*255,\s*255,\s*0\.12\)\);/,
  'tab switcher dark selected card border should stay soft while following the card radius'
);
const darkActiveCardBlock = getCssRuleBlock(switcherSource, '#${PANEL_ID}[data-theme="dark"] .x-tab-switcher-card[data-active="true"]');
assert.match(
  darkActiveCardBlock,
  /background:\s*[\s\S]*color-mix\(in srgb,\s*var\(--x-tab-switcher-card-accent,\s*var\(--x-tab-switcher-accent\)\)\s*18%,/,
  'tab switcher dark selected cards should add a subtle per-tab theme tint'
);
assert.match(
  darkActiveCardBlock,
  /0 0 18px color-mix\(in srgb,\s*var\(--x-tab-switcher-card-accent,\s*var\(--x-tab-switcher-accent\)\)\s*10%,\s*transparent\)[\s\S]*0 4px 10px color-mix\(in srgb,\s*var\(--x-tab-switcher-card-accent,\s*var\(--x-tab-switcher-accent\)\)\s*5%,\s*transparent\)/,
  'tab switcher dark selected cards should use a barely-there theme-color glow instead of a black shadow'
);
assert.match(
  darkPanelBlock,
  /--x-tab-switcher-thumb-stroke-color:\s*rgba\(255,\s*255,\s*255,\s*0\.24\);/,
  'tab switcher dark thumbnails should use a neutral light edge-aligned overlay stroke through the shared token'
);
const darkThumbBlock = getCssRuleBlock(switcherSource, '#${PANEL_ID}[data-theme="dark"] .x-tab-switcher-thumb');
assert.match(
  darkThumbBlock,
  /background:\s*color-mix\(in srgb,\s*var\(--x-tab-switcher-card-accent,\s*var\(--x-tab-switcher-accent\)\)\s*18%,\s*rgba\(15,\s*23,\s*42,\s*0\.92\)\);/,
  'tab switcher dark thumbnail background should always default to the card theme color even when a screenshot exists'
);
assert.strictEqual(
  /border(?:-color)?\s*:/.test(darkThumbBlock),
  false,
  'tab switcher dark screenshot containers should not draw a thumbnail border'
);
assert.strictEqual(
  /linear-gradient/.test(darkThumbBlock),
  false,
  'tab switcher dark thumbnail background should not use a separate fallback gradient from the card theme'
);
const fallbackFaviconBlock = getCssRuleBlock(switcherSource, '.x-tab-switcher-favicon');
assert.match(
  switcherViewReactSource,
  /onError=\{\(event\) => \{[\s\S]*?setAttribute\('data-broken', 'true'\)[\s\S]*?removeAttribute\('src'\)/,
  'the React tab switcher should mark broken images instead of leaving visible broken-image icons'
);
assert.match(
  switcherViewReactSource,
  /updateThumbnail\(update\)[\s\S]*?_previousThumbnail:[\s\S]*?_thumbnailEntering:\s*true[\s\S]*?requestFrame\([\s\S]*?_thumbnailEntering:\s*false[\s\S]*?_previousThumbnail:\s*''/,
  'the React tab switcher should transition fresh screenshots over cached thumbnails'
);
assert.match(
  switcherSource,
  /host\._lumnoTabSwitcherUpdateThumbnail = function\(update\)[\s\S]*tabSwitcherReactView\.updateThumbnail\(update\)/,
  'the tab switcher adapter should expose its React thumbnail update hook while open'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-favicon\[data-broken="true"\],[\s\S]*\.x-tab-switcher-thumb-favicon\[data-broken="true"\][\s\S]*visibility:\s*hidden;/,
  'tab switcher broken favicons should hide while preserving layout'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-thumb img\[data-broken="true"\]\s*\{[\s\S]*display:\s*none;/,
  'tab switcher broken thumbnails should not render as broken-image icons'
);
assert.strictEqual(
  /background\s*:/.test(fallbackFaviconBlock),
  false,
  'tab switcher fallback favicon should not draw a surface behind the icon'
);
assert.strictEqual(
  /box-shadow\s*:/.test(fallbackFaviconBlock),
  false,
  'tab switcher fallback favicon should not draw a shadow behind the icon'
);
assert.strictEqual(
  /#\$\{PANEL_ID\}\[data-theme="dark"\]\s+\.x-tab-switcher-favicon\s*\{[\s\S]*background\s*:/.test(switcherSource),
  false,
  'tab switcher dark-mode fallback favicon should not draw a surface behind the icon'
);
assert.strictEqual(
  /x-tab-switcher-current/.test(switcherSource),
  false,
  'tab switcher should not render a current-tab badge'
);
assert.strictEqual(
  /tab_switcher_current/.test(switcherSource),
  false,
  'tab switcher should not keep current badge i18n wiring after the badge is removed'
);
localeNames.forEach((locale) => {
  [
    'tab_switcher_title',
    'tab_switcher_untitled',
    'tab_switcher_favicon_alt',
    'command_show_tab_switcher',
    'settings_tab_switcher_title',
    'settings_tab_switcher_desc'
  ].forEach((key) => {
    assert.ok(
      localeMessages[locale][key] && String(localeMessages[locale][key].message || '').trim(),
      `${locale} should localize ${key}`
    );
  });
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(localeMessages[locale], 'tab_switcher_current'),
    false,
    `${locale} should not keep unused current badge copy`
  );
  assert.match(
    localeMessages[locale].settings_tab_switcher_desc.message,
    /\{shortcut\}/,
    `${locale} should leave the tab switcher shortcut for platform-aware rendering`
  );
});
assert.notStrictEqual(
  localeMessages.zh_CN.tab_switcher_title.message,
  localeMessages.en.tab_switcher_title.message,
  'tab switcher title should have Chinese copy instead of falling back to English'
);
assert.ok(
  optionsHtmlSource.includes('data-i18n="settings_tab_switcher_title"') &&
    optionsHtmlSource.includes('data-i18n="settings_tab_switcher_desc"') &&
    optionsHtmlSource.includes('id="_x_extension_tab_switcher_toggle_2026_unique_"'),
  'settings General should expose a concise localized tab switcher toggle'
);
assert.ok(
  optionsHtmlSource.includes('快速切换最近标签页，默认 {shortcut}，可自定义'),
  'settings General fallback copy should explain the platform-aware default and customization'
);
assert.match(
  optionsSource,
  /shortcut:\s*formatShortcutForDisplay\('Alt\+Q'\)/,
  'settings i18n should render the tab switcher shortcut for the current platform'
);
assert.match(
  optionsSource,
  /const tabSwitcherToggle = document\.getElementById\('_x_extension_tab_switcher_toggle_2026_unique_'\);/,
  'settings page should wire the tab switcher General toggle'
);
assert.match(
  optionsSource,
  /const TAB_SWITCHER_ENABLED_STORAGE_KEY = '_x_extension_tab_switcher_enabled_2026_unique_';/,
  'settings page should use a dedicated synced storage key for the tab switcher toggle'
);
assert.match(
  optionsSource,
  /function normalizeTabSwitcherEnabled\(value\)[\s\S]*normalizeTabSwitcherEnabled/,
  'settings page should normalize the tab switcher toggle with default-on semantics'
);
assert.match(
  optionsSource,
  /storageArea\.set\(\{ \[TAB_SWITCHER_ENABLED_STORAGE_KEY\]: next \}\)/,
  'settings page should persist tab switcher toggle changes'
);
assert.match(
  optionsSource,
  /storageArea\.get\(\[TAB_SWITCHER_ENABLED_STORAGE_KEY\][\s\S]*setOptionsToggleState\(tabSwitcherToggle, stored\)[\s\S]*storageArea\.set\(\{ \[TAB_SWITCHER_ENABLED_STORAGE_KEY\]: stored \}\)/,
  'settings page should default missing tab switcher storage to enabled for all users'
);
assert.strictEqual(
  /\.x-tab-switcher-thumb\[data-thumbnail-status="pending"\]::after/.test(switcherSource),
  false,
  'tab switcher cards without a screenshot should not render a pending shimmer layer'
);
assert.strictEqual(
  /x-tab-switcher-thumb-pending/.test(switcherSource),
  false,
  'tab switcher cards without a screenshot should not animate a pending thumbnail state'
);
assert.strictEqual(
  /\.x-tab-switcher-card\[data-thumbnail-status=/.test(switcherSource),
  false,
  'tab switcher cards without a screenshot should inherit base highlight motion instead of duplicating state-specific CSS'
);
assert.match(
  switcherViewReactSource,
  /function PreparedImage\([\s\S]*?<img[\s\S]*?className=\{className\}[\s\S]*?src=\{src\}[\s\S]*?alt=\{alt\}/,
  'React tab switcher favicon and thumbnail setup should use a shared prepared-image component'
);
assert.match(
  switcherViewReactSource,
  /function TitleFavicon\([\s\S]*?x-tab-switcher-title-favicon[\s\S]*?<PreparedImage/,
  'React tab switcher title favicon fallback should be encapsulated'
);
assert.match(
  switcherViewReactSource,
  /<TitleFavicon src=\{favicon\} \/>[\s\S]*?className="x-tab-switcher-name"/,
  'React tab switcher should render a title favicon before the title'
);
assert.match(
  thumbBlock,
  /background:\s*color-mix\(in srgb,\s*var\(--x-tab-switcher-card-accent,\s*var\(--x-tab-switcher-accent\)\)\s*14%,\s*rgba\(248,\s*250,\s*252,\s*0\.94\)\);/,
  'tab switcher thumbnail background should always default to the card theme color even when a screenshot exists'
);
assert.strictEqual(
  /linear-gradient/.test(thumbBlock),
  false,
  'tab switcher thumbnail background should not use a separate fallback gradient from the card theme'
);
assert.match(
  switcherSource,
  /\.x-tab-switcher-name-row\s*\{[\s\S]*grid-template-columns:\s*var\(--x-tab-switcher-title-icon-size\) minmax\(0,\s*1fr\);/,
  'tab switcher title row should reserve title favicon space before active expansion'
);
const metaBlock = getCssRuleBlock(switcherSource, '.x-tab-switcher-meta');
const nameRowBlock = getCssRuleBlock(switcherSource, '.x-tab-switcher-name-row');
const nameBlock = getCssRuleBlock(switcherSource, '.x-tab-switcher-name');
const hostBlock = getCssRuleBlock(switcherSource, '.x-tab-switcher-host');
assert.match(
  metaBlock,
  /gap:\s*3px;/,
  'tab switcher title metadata should be more compact'
);
assert.match(
  nameRowBlock,
  /gap:\s*var\(--x-tab-switcher-title-icon-gap\);[\s\S]*transition:\s*grid-template-columns var\(--x-tab-switcher-motion-card\),\s*gap var\(--x-tab-switcher-motion-card\);/,
  'tab switcher title row should animate when the active title favicon collapses'
);
assert.match(
  nameBlock,
  /font-size:\s*11\.5px;[\s\S]*font-weight:\s*500;[\s\S]*line-height:\s*1\.16;[\s\S]*letter-spacing:\s*0;[\s\S]*white-space:\s*nowrap;/,
  'tab switcher titles should use medium-weight compact typography while staying on one line'
);
assert.strictEqual(
  /letter-spacing:\s*-/.test(nameBlock),
  false,
  'tab switcher titles should not use negative letter spacing'
);
assert.match(
  hostBlock,
  /font-size:\s*11px;[\s\S]*font-weight:\s*560;[\s\S]*line-height:\s*1\.18;/,
  'tab switcher host labels should tighten with the title stack'
);
assert.match(
  switcherViewReactSource,
  /data-thumbnail-status/,
  'React tab switcher thumbnails should expose their capture status for stable fallback rendering'
);
assert.match(
  switcherViewReactSource,
  /data-thumbnail-status=\{thumbnailStatus\}/,
  'React tab switcher cards should expose thumbnail status so no-screenshot cards can disable animation'
);
assert.match(
  switcherSource,
  /stopHandledKeyEvent\(event\)/,
  'tab switcher should use a shared hard-stop helper for handled keys'
);
assert.match(
  switcherSource,
  /stopImmediatePropagation/,
  'tab switcher handled keys should stop page listeners from receiving the event'
);
assert.match(
  backgroundSource,
  /advanceOnExisting:\s*true/,
  'Alt+Q command re-entry should ask an already-open switcher to advance instead of closing'
);
assert.match(
  backgroundSource,
  /const TAB_SWITCHER_ENABLED_STORAGE_KEY = '_x_extension_tab_switcher_enabled_2026_unique_';/,
  'background should read the Labs tab switcher feature flag'
);
assert.match(
  backgroundSource,
  /let tabSwitcherEnabledCache = true;/,
  'background tab switcher feature flag should default to enabled'
);
assert.match(
  backgroundSource,
  /storageArea\.get\(\[[\s\S]*TAB_SWITCHER_ENABLED_STORAGE_KEY[\s\S]*\][\s\S]*tabSwitcherEnabledCache = normalizedTabSwitcher/,
  'background startup should load and normalize the tab switcher enabled setting'
);
assert.match(
  backgroundSource,
  /function advanceExistingTabSwitcherOnTab\(tab,\s*source,\s*callback\)[\s\S]*advanceOpenTabSwitcherFromCommand/,
  'Alt+Q command re-entry should have a lightweight advance path for an already-open switcher'
);
const advanceExistingBlock = getFunctionBlock(
  backgroundSource,
  'function advanceExistingTabSwitcherOnTab(tab, source, callback)',
  'function triggerTabSwitcherForTab(tab, source)'
);
assert.match(
  advanceExistingBlock,
  /isTabSwitcherExtensionPageMessageTarget\(tab\)[\s\S]*postTabSwitcherMessageToExtensionPage\(tab,\s*\{\s*action:\s*'advanceOpenTabSwitcherFromCommand'[\s\S]*offset:\s*1/,
  'Alt+Q command re-entry should still use the extension-page port bridge on extension-page message targets'
);
assert.match(
  advanceExistingBlock,
  /postTabSwitcherMessageToExtensionPage\(tab,[\s\S]*\(ok,\s*_?reason,\s*response\)\s*=>[\s\S]*response\.advanced === true[\s\S]*finish\(didAdvance\)/,
  'Alt+Q command re-entry should not treat an initial suppressed shortcut as an advance on extension pages'
);
assert.match(
  advanceExistingBlock,
  /chrome\.tabs\.sendMessage\(tab\.id,[\s\S]*action:\s*'advanceOpenTabSwitcherFromCommand'[\s\S]*offset:\s*1/,
  'Alt+Q command re-entry should advance normal pages through the installed runtime message path'
);
assert.match(
  advanceExistingBlock,
  /const didAdvance =[\s\S]*response\.ok === true[\s\S]*response\.advanced === true/,
  'Alt+Q command re-entry should not treat an initial suppressed shortcut as an advance on normal pages'
);
assert.strictEqual(
  /getTabSwitcherRuntimeVersionOnTab|TAB_SWITCHER_RUNTIME_VERSION|tab_switcher_runtime_stale|chrome\.scripting\.executeScript/.test(advanceExistingBlock),
  false,
  'Alt+Q command re-entry should not wait on executeScript or runtime-version probes'
);
const injectSwitcherBlock = getFunctionBlock(
  backgroundSource,
  'function injectTabSwitcherOnTab(hostTab, items, context)',
  'function advanceExistingTabSwitcherOnTab(tab, source, callback)'
);
assert.match(
  injectSwitcherBlock,
  /isTabSwitcherExtensionPageMessageTarget\(hostTab\)[\s\S]*postTabSwitcherMessageToExtensionPage\(hostTab,\s*\{\s*action:\s*'openTabSwitcherFromCommand'[\s\S]*context:\s*buildSwitcherContext\(1\)/,
  'Alt+Q should still open the switcher through the extension-page port bridge on extension-page message targets'
);
assert.match(
  backgroundSource,
  /const TAB_SWITCHER_EXTENSION_PAGE_PORT_WAIT_MS = \d+;[\s\S]*const TAB_SWITCHER_EXTENSION_PAGE_PORT_RETRY_MS = \d+;/,
  'Alt+Q should wait briefly for extension-page bridges such as a fresh Lumno newtab to register'
);
assert.match(
  backgroundSource,
  /function postTabSwitcherMessageToExtensionPage\(tab,\s*message,\s*callback\)[\s\S]*Date\.now\(\)[\s\S]*setTimeout\(attemptPost[\s\S]*TAB_SWITCHER_EXTENSION_PAGE_PORT_RETRY_MS/,
  'Alt+Q extension-page command posting should retry before falling back when the page bridge is still connecting'
);
assert.match(
  injectSwitcherBlock,
  /chrome\.scripting\.executeScript\(\{[\s\S]*files:\s*\[[\s\S]*'src\/react\/overlay-islands\.js',[\s\S]*'src\/overlay\/tab-switcher\.js'[\s\S]*\][\s\S]*runDynamicSwitcherScript\(switcherContext\)/,
  'Alt+Q should install the React entry before direct tab switcher injection'
);
const runSwitcherScriptStart = injectSwitcherBlock.indexOf('const runSwitcherScript = (tabZoomFactor) => {');
assert.notStrictEqual(runSwitcherScriptStart, -1, 'Alt+Q switcher opener should define the runtime open path');
const runSwitcherScriptEnd = injectSwitcherBlock.indexOf('if (chrome.tabs && typeof chrome.tabs.getZoom', runSwitcherScriptStart);
assert.notStrictEqual(runSwitcherScriptEnd, -1, 'Alt+Q switcher opener should finish before the zoom lookup');
const runSwitcherScriptBlock = injectSwitcherBlock.slice(runSwitcherScriptStart, runSwitcherScriptEnd);
assert.match(
  runSwitcherScriptBlock,
  /const switcherContext = buildSwitcherContext\(tabZoomFactor\);[\s\S]*chrome\.tabs\.sendMessage\(hostTab\.id,[\s\S]*action:\s*'openTabSwitcherFromCommand'[\s\S]*runDynamicSwitcherScript\(switcherContext\)/,
  'Alt+Q normal-page opener should reuse an installed runtime before falling back to dynamic injection'
);
assert.strictEqual(
  /getTabSwitcherRuntimeVersionOnTab|TAB_SWITCHER_RUNTIME_VERSION/.test(runSwitcherScriptBlock),
  false,
  'Alt+Q normal-page opener should not add a runtime-version round trip'
);
assert.match(
  backgroundSource,
  /function triggerTabSwitcherForTab\(tab,\s*source\)[\s\S]*if \(!tabSwitcherEnabledCache\)[\s\S]*tab-switcher-disabled[\s\S]*return;[\s\S]*advanceExistingTabSwitcherOnTab\(tab,\s*source,\s*\(didAdvance\)/,
  'Alt+Q should try the lightweight advance path before rebuilding the switcher payload'
);
assert.match(
  backgroundSource,
  /const TAB_SWITCHER_OPENING_GUARD_MS = \d+;/,
  'Alt+Q should have a bounded opening guard for command repeats before the switcher host exists'
);
assert.match(
  backgroundSource,
  /const tabSwitcherOpeningByWindowKey = new Map\(\);/,
  'Alt+Q opening guard should be scoped by window so focus changes during fallback hosting do not reopen the switcher'
);
assert.match(
  backgroundSource,
  /function beginTabSwitcherOpening\(tab,\s*source\)[\s\S]*tabSwitcherOpeningByWindowKey[\s\S]*tab-switcher-opening-guarded/,
  'Alt+Q should ignore repeated commands while an open flow is already building the switcher'
);
assert.match(
  backgroundSource,
  /function createTabSwitcherOpeningFinisher\(opening\)[\s\S]*finishTabSwitcherOpening\(opening\);/,
  'Alt+Q opening guard should be released through a single-shot finisher when open work completes'
);
assert.match(
  backgroundSource,
  /suppressInitialShortcutAdvance:\s*context && context\.source === 'commands-tab-switcher'/,
  'Alt+Q should mark the initial summon so held-key repeats do not immediately advance the fresh switcher'
);
assert.match(
  switcherSource,
  /_lumnoTabSwitcherAdvance/,
  'tab switcher should expose an in-page advance hook for command re-entry'
);
assert.match(
  switcherSource,
  /host\._lumnoTabSwitcherAdvance = function\(offset\)[\s\S]*return advanceSelectionFromShortcut\(normalizeAdvanceOffset\(offset\)\);/,
  'tab switcher command re-entry hook should use the advance path that clears stale initial shortcut suppression'
);
assert.match(
  switcherSource,
  /_x_extension_tab_switcher_advance_command_2026_unique_[\s\S]*document\.addEventListener\(TAB_SWITCHER_ADVANCE_EVENT,\s*handleExternalAdvance,\s*true\)/,
  'tab switcher should listen for content-script advance events for faster command cycling'
);
assert.match(
  switcherSource,
  /const switcherThemeController = createSwitcherThemeController\(panel\);[\s\S]*switcherThemeController\.start\(\)[\s\S]*switcherThemeController\.destroy\(\)/,
  'tab switcher should clean up theme listeners through the theme controller when the panel closes'
);
assert.match(
  switcherSource,
  /advanceOnExisting[\s\S]*_lumnoTabSwitcherAdvance/,
  'tab switcher should advance the existing instance when requested'
);
assert.match(
  backgroundSource,
  /function shouldTrackSwitcherTab[\s\S]*isBrowserInternalUrl/,
  'Alt+Q should track browser-internal tabs as switchable targets'
);
assert.match(
  backgroundSource,
  /\.filter\(shouldTrackSwitcherTab\)/,
  'Alt+Q list construction should use trackability, not overlay-host eligibility'
);
assert.match(
  backgroundSource,
  /const TAB_SWITCHER_LIMIT = 5;/,
  'Alt+Q should only request the five most recent switchable tabs'
);
assert.match(
  switcherSource,
  /const tabs = Array\.isArray\(context\.tabs\)[\s\S]*\.slice\(0,\s*5\)/,
  'tab switcher overlay should never render more than five cards'
);
assert.match(
  backgroundSource,
  /function canHostSwitcherSurface[\s\S]*canOpenOverlayOnUrl/,
  'Alt+Q should separately decide which tab can host the switcher surface'
);
assert.strictEqual(
  manifest.permissions.includes('activeTab'),
  false,
  'Alt+Q should not add activeTab because it creates an extra permission prompt'
);
assert.match(
  backgroundSource,
  /function buildSwitcherTabFavicon\(tab,\s*url\)[\s\S]*getPageFaviconCandidateUrl\(url\)/,
  'Alt+Q should use the shared favicon resolver for tab icons'
);
const switcherPayloadBlock = getFunctionBlock(
  backgroundSource,
  'function normalizeSwitcherTabForPayload(tab, currentTabId)',
  'function getRecentTabsForSwitcher(tabList, currentTabId)'
);
assert.match(
  switcherPayloadBlock,
  /favIconUrl:\s*buildSwitcherTabFavicon\(tab,\s*url\)/,
  'Alt+Q payload should use resolved favicon candidates instead of raw tab.favIconUrl'
);
assert.match(
  switcherPayloadBlock,
  /accentRgb:\s*getSwitcherTabAccentRgb\(tab,\s*url\)/,
  'Alt+Q payload should include the cached site theme accent color'
);
assert.match(
  backgroundSource,
  /importScripts\(chrome\.runtime\.getURL\('src\/newtab\/favicon-theme\.js'\)\)/,
  'Alt+Q should import the same favicon theme helpers used by newtab recent sites'
);
assert.match(
  backgroundSource,
  /const NEWTAB_FAVICON_THEME = globalThis\.LumnoNewtabFaviconTheme \|\| \{\};/,
  'Alt+Q should read the newtab favicon theme helper from the shared global'
);
assert.match(
  backgroundSource,
  /function getPersistedSiteThemeColorForSwitcher\(host\)[\s\S]*getPersistedThemeEntry/,
  'Alt+Q should read site theme colors from the shared persisted theme cache'
);
assert.match(
  backgroundSource,
  /function getSwitcherThemeHostCandidates\(host\)[\s\S]*dodopayments\.com[\s\S]*checkout\.dodopayments\.com/,
  'Alt+Q should normalize same-site theme host candidates so Dodo subdomains cannot render different fallback colors'
);
assert.match(
  backgroundSource,
  /function getPersistedSiteThemeColorForSwitcher\(host\)[\s\S]*getSwitcherThemeHostCandidates\(host\)[\s\S]*getPersistedThemeEntry\(candidateHost\)/,
  'Alt+Q should check shared same-site persisted theme candidates before falling back to the exact host'
);
assert.match(
  backgroundSource,
  /function getNewtabBrandAccentForSwitcher\(host,\s*url\)[\s\S]*getBrandAccentForHost[\s\S]*getBrandAccentForUrl/,
  'Alt+Q should share newtab recent-site brand accent lookup'
);
assert.match(
  backgroundSource,
  /function getSwitcherTabAccentRgb\(tab,\s*url\)[\s\S]*getPersistedSiteThemeColorForSwitcher\(host\)/,
  'Alt+Q payload accent should fall back to the shared persisted site theme cache'
);
const switcherAccentBlock = getFunctionBlock(
  backgroundSource,
  'function getSwitcherTabAccentRgb(tab, url)',
  'async function prepareSwitcherThumbnailDataUrl'
);
assert.match(
  switcherAccentBlock,
  /const brandAccent = getNewtabBrandAccentForSwitcher\(host,\s*resolved\);/,
  'Alt+Q should use the same brand accent as newtab before falling back to fetched site colors'
);
assert.match(
  switcherAccentBlock,
  /warmSwitcherTabThemeColor\(host,\s*resolved\);/,
  'Alt+Q should warm the shared theme-color cache without blocking the switcher'
);
assert.match(
  backgroundSource,
  /function normalizeSwitcherAccentRgbForPayload\(accentRgb\)[\s\S]*getThemeColorConfidence\(rgb\)[\s\S]*NEWTAB_FAVICON_THEME\.defaultAccentColor/,
  'Alt+Q payload should replace neutral cached theme colors such as pure white with the shared blue fallback'
);
assert.match(
  switcherAccentBlock,
  /return normalizeSwitcherAccentRgbForPayload\(cached && cached\.accentRgb\);/,
  'Alt+Q should sanitize cached site theme colors before exposing them to web card CSS'
);
assert.strictEqual(
  switcherAccentBlock.includes('return normalizeThemeAccentRgb(cached && cached.accentRgb);'),
  false,
  'Alt+Q should not expose cached pure-white theme colors directly'
);
assert.ok(
  switcherAccentBlock.indexOf('getNewtabBrandAccentForSwitcher(host, resolved)') <
    switcherAccentBlock.indexOf('getPersistedSiteThemeColorForSwitcher(host)'),
  'Alt+Q should prefer newtab brand accents over persisted site theme colors for consistency'
);
assert.strictEqual(
  switcherPayloadBlock.includes("typeof tab.favIconUrl === 'string' ? tab.favIconUrl : ''"),
  false,
  'Alt+Q payload should not directly expose tab.favIconUrl'
);
assert.match(
  backgroundSource,
  /function captureSwitcherThumbnailForTab\(tab,\s*reason\)[\s\S]*chrome\.tabs\.captureVisibleTab/,
  'Alt+Q should have a reusable immediate thumbnail capture helper'
);
assert.match(
  backgroundSource,
  /const TAB_SWITCHER_CAPTURE_REASON_COMMAND_IMMEDIATE = 'command-immediate';[\s\S]*function isSwitcherCommandCaptureReason\(reason\)[\s\S]*requestReason === TAB_SWITCHER_CAPTURE_REASON_COMMAND_IMMEDIATE/,
  'Alt+Q should keep only the pre-open immediate thumbnail capture reason on the command path'
);
assert.strictEqual(
  backgroundSource.includes('TAB_SWITCHER_CAPTURE_REASON_COMMAND_REFRESH'),
  false,
  'Alt+Q should not keep a post-open refresh capture reason because it hides the visible switcher host'
);
assert.match(
  backgroundSource,
  /ensureTabSwitcherStateLoaded\(\)[\s\S]*hydrateState\(state,\s*\{[\s\S]*merge:\s*tabSwitcherStateDirtyBeforeLoad === true/,
  'Alt+Q should merge persisted thumbnails when focus events arrive before switcher state hydration finishes'
);
assert.match(
  backgroundSource,
  /const tabSwitcherThumbnailTimersByTabId = new Map\(\)/,
  'Alt+Q thumbnail scheduling should keep per-tab timers instead of one global timer'
);
assert.match(
  backgroundSource,
  /function clearScheduledSwitcherThumbnailCapture\(tabId\)[\s\S]*tabSwitcherThumbnailTimersByTabId\.delete\(tabId\)/,
  'Alt+Q thumbnail capture should clear only the pending timer for the same tab'
);
assert.match(
  backgroundSource,
  /function enqueueSwitcherThumbnailCapture\(tab,\s*reason\)[\s\S]*tabSwitcherThumbnailCaptureChain/,
  'Alt+Q thumbnail capture should serialize captureVisibleTab calls to avoid Chrome rate limits'
);
assert.match(
  backgroundSource,
  /function logSwitcherThumbnailCaptureFailure\(tab,\s*failureReason,\s*requestReason\)[\s\S]*tab-switcher-thumbnail-failed/,
  'Alt+Q thumbnail capture failures should log a debuggable reason'
);
assert.match(
  backgroundSource,
  /function markSwitcherThumbnailStatus\(tab,\s*status,\s*requestReason,\s*failureReason\)[\s\S]*setThumbnailStatus/,
  'Alt+Q thumbnail capture should persist capture status alongside thumbnails'
);
assert.match(
  backgroundSource,
  /function isSwitcherThumbnailRefreshNeeded\(state\)[\s\S]*missing[\s\S]*stale[\s\S]*failed/,
  'Alt+Q should treat missing, stale, and failed thumbnails as refresh candidates without retrying restricted tabs'
);
assert.match(
  backgroundSource,
  /function shouldPreCaptureActiveSwitcherThumbnailBeforePayload\(tab\)[\s\S]*tab\.active === true[\s\S]*tab\.status === 'loading'[\s\S]*getSwitcherThumbnailStateForPayload\(tab,[\s\S]*isSwitcherThumbnailRefreshNeeded\(state\)/,
  'Alt+Q should refresh a missing active thumbnail only after the page has stopped loading'
);
assert.strictEqual(
  /TAB_SWITCHER_COMMAND_PRECAPTURE_BUDGET_MS|waitForSwitcherCommandPreCaptureBudget/.test(backgroundSource),
  false,
  'Alt+Q startup should not wait for active-tab thumbnail capture'
);
assert.match(
  backgroundSource,
  /const tabSwitcherThumbnailPriorityByTabId = new Map\(\);[\s\S]*function markSwitcherThumbnailPriorityForItems\(items,\s*tabList,\s*reason\)[\s\S]*isSwitcherThumbnailRefreshNeeded/,
  'Alt+Q should remember missing recent-tab thumbnails as priority refresh candidates'
);
assert.match(
  backgroundSource,
  /function getSwitcherThumbnailStatusForFailureReason\(reason\)[\s\S]*restricted/,
  'Alt+Q thumbnail capture should classify restricted capture failures separately'
);
assert.match(
  switcherPayloadBlock,
  /thumbnailStatus:\s*thumbnailState\.status/,
  'Alt+Q payload should include thumbnail capture status'
);
assert.match(
  switcherPayloadBlock,
  /thumbnailReason:\s*thumbnailState\.reason/,
  'Alt+Q payload should include thumbnail capture failure reason'
);
assert.match(
  switcherViewReactSource,
  /const accent = options\.normalizeAccentCss\(tab\.accentRgb\);[\s\S]*?'--x-tab-switcher-card-accent': accent/,
  'React tab switcher cards should expose each tab accent as a per-card CSS variable'
);
const scheduleThumbnailBlock = getFunctionBlock(
  backgroundSource,
  'function scheduleSwitcherThumbnailCapture(tab, reason)',
  'function normalizeSwitcherTabForPayload(tab, currentTabId)'
);
assert.strictEqual(
  scheduleThumbnailBlock.includes('clearTimeout(tabSwitcherThumbnailTimer)'),
  false,
  'Alt+Q thumbnail scheduling should not cancel every other pending tab capture'
);
assert.match(
  scheduleThumbnailBlock,
  /tabSwitcherThumbnailTimersByTabId\.set\(tab\.id,\s*timer\)/,
  'Alt+Q thumbnail scheduling should store pending capture timers by tab id'
);
assert.match(
  scheduleThumbnailBlock,
  /markSwitcherThumbnailStatus\(tab,\s*'pending',\s*reason/,
  'Alt+Q thumbnail scheduling should mark thumbnails as pending before deferred capture'
);
assert.match(
  scheduleThumbnailBlock,
  /consumeSwitcherThumbnailPriority\(tab[\s\S]*TAB_SWITCHER_PRIORITY_CAPTURE_DELAY_MS[\s\S]*TAB_SWITCHER_CAPTURE_DELAY_MS/,
  'Alt+Q thumbnail scheduling should use a shorter delay when a recent missing thumbnail becomes visible'
);
const triggerSwitcherBlock = getFunctionBlock(
  backgroundSource,
  'function triggerTabSwitcherForTab(tab, source)',
  'function detectAnyActiveVideoPiP(callback)'
);
assert.match(
  triggerSwitcherBlock,
  /if \(didAdvance\)[\s\S]*return;[\s\S]*const opening = beginTabSwitcherOpening\(tab,\s*source\);[\s\S]*if \(!opening\)[\s\S]*return;[\s\S]*const finishOpeningGuard = createTabSwitcherOpeningFinisher\(opening\);[\s\S]*const finishOpening = \(ok\) =>[\s\S]*ensureTabSwitcherStateLoaded/,
  'Alt+Q fast cycling should return before opening guard setup, then guard the async payload build before waiting on thumbnail state loading'
);
assert.match(
  triggerSwitcherBlock,
  /const shortcutObserverReady = prepareShortcutKeyObserver\(tab\);[\s\S]*advanceExistingTabSwitcherOnTab\(tab,[\s\S]*Promise\.all\(\[startupStateReady,\s*tabQueryReady,\s*shortcutReady,\s*shortcutObserverReady\]\)/,
  'the trusted release observer should start before asynchronous switcher opening work so quick releases can be buffered'
);
assert.match(
  triggerSwitcherBlock,
  /const startupStateReady = Promise\.all\(\[\s*ensureTabSwitcherStateLoaded\(\),\s*loadFaviconRequestBlacklistItems\(\),\s*loadFaviconEnhancedFetchEnabled\(\)\s*\]\)[\s\S]*const shortcutReady = new Promise[\s\S]*getConfiguredTabSwitcherShortcut\(resolve\)[\s\S]*const tabQueryReady = new Promise[\s\S]*Promise\.all\(\[startupStateReady,\s*tabQueryReady,\s*shortcutReady,\s*shortcutObserverReady\]\)[\s\S]*getRecentTabsForSwitcher/,
  'the tab switcher should resolve tabs, local state, favicon policy, and the configured shortcut in parallel'
);
assert.match(
  backgroundSource,
  /function getConfiguredTabSwitcherShortcut\(callback\)[\s\S]*chrome\.commands\.getAll\([\s\S]*SHOW_TAB_SWITCHER_COMMAND_NAME[\s\S]*callback\(shortcut \|\| fallbackShortcut\)/,
  'the background should read the current browser-configured tab switcher shortcut with an Alt+Q fallback'
);
const shortcutReleaseHandlerBlock = getFunctionBlock(
  backgroundSource,
  'function handleTabSwitcherShortcutModifierReleased(senderTab, releasedKey, callback)',
  'function waitForTabSwitcherCapturePaint()'
);
assert.match(
  shortcutReleaseHandlerBlock,
  /getConfiguredTabSwitcherShortcut[\s\S]*getShortcutReleaseEventKeys\(shortcut\)[\s\S]*expectedKeys\.includes\(key\)[\s\S]*commitOpenTabSwitcherInWindow\(senderTab\.windowId, 'keyup'\)/,
  'the background should validate the configured release key, then locate the real open switcher in the sender window'
);
assert.match(
  backgroundSource,
  /function armTabSwitcherShortcutReleaseObservers\(tabs, windowId, shortcut, commandStartedAt\)[\s\S]*getShortcutReleaseEventKeys\(shortcut\)[\s\S]*action:\s*'armTabSwitcherShortcutRelease'[\s\S]*commandStartedAt:\s*Number\(commandStartedAt\)[\s\S]*postTabSwitcherMessageToExtensionPage[\s\S]*chrome\.tabs\.sendMessage/,
  'every eligible release observer should receive the timestamp needed to recover a fast keyup'
);
assert.match(
  triggerSwitcherBlock,
  /const commandStartedAt = Date\.now\(\)[\s\S]*const finishOpeningAndArmShortcutRelease = \(ok\) => \{\s*finishOpening\(ok\);\s*if \(ok === true\) \{\s*armTabSwitcherShortcutReleaseObservers\([\s\S]*commandStartedAt[\s\S]*onOpenComplete:\s*finishOpeningAndArmShortcutRelease/,
  'release replay should be armed only after the switcher host is mounted and ready to commit'
);
assert.match(
  switcherSource,
  /function clickSelectedCardFromShortcutRelease\(\)[\s\S]*allowRelayedShortcutReleaseActivation = true;[\s\S]*selectedButton\.click\(\)[\s\S]*host\._lumnoTabSwitcherCommitFromShortcutRelease = function\(\)[\s\S]*clickSelectedCardFromShortcutRelease\(\)/,
  'custom shortcut modifier release should use a narrowly authorized click on the highlighted card'
);
[
  'createShortcutInactivityCommitController',
  'tabSwitcherShortcutInactivityCommitController',
  'TAB_SWITCHER_CUSTOM_INITIAL_INACTIVITY_COMMIT_MS',
  'TAB_SWITCHER_CUSTOM_REPEAT_INACTIVITY_COMMIT_MS',
  'commitOpenTabSwitcherAfterCommandInactivity',
  'inactivity-fired',
  'usesInactivityFallback'
].forEach((needle) => {
  assert.strictEqual(
    backgroundSource.includes(needle),
    false,
    `holding a custom shortcut must not retain the automatic ${needle} path`
  );
});
assert.match(
  triggerSwitcherBlock,
  /const windowId = typeof tab\.windowId[\s\S]*if \(didAdvance\)[\s\S]*tabSwitcherHostTabIdByWindowId\.set\(tab\.windowId, tab\.id\)[\s\S]*recordTabSwitcherShortcutDebug\('command-advanced',[\s\S]*const finishOpening = \(ok\)[\s\S]*tabSwitcherHostTabIdByWindowId\.set\(windowId, openingHostTabId\)[\s\S]*shortcut-configured[\s\S]*releaseKeys[\s\S]*onOpenComplete:\s*finishOpening/,
  'initial and repeated commands should remember the host and wait for the configured release key'
);
assert.match(
  backgroundSource,
  /function findOpenTabSwitcherHostInWindow\(windowId\)[\s\S]*TAB_SWITCHER_HOST_STATE_TIMEOUT_MS[\s\S]*getOpenTabSwitcherState\(tab\)[\s\S]*chrome\.tabs\.query\(\{ windowId \}[\s\S]*state\.open === true[\s\S]*function commitOpenTabSwitcherInWindow\(windowId, source\)[\s\S]*commitOpenTabSwitcherFromShortcutReleaseOnTab\(hostTab\)[\s\S]*commitOpenTabSwitcherInWindow\(senderTab\.windowId, 'keyup'\)/,
  'a real release should locate the actual open host before using the guarded click commit route'
);
assert.match(
  backgroundSource,
  /tabSwitcherHostTabIdByWindowId = new Map\(\)[\s\S]*tabSwitcherHostTabIdByWindowId\.set\(windowId, openingHostTabId\)/,
  'the switcher should remember the real host tab when opening completes'
);
assert.match(
  backgroundSource,
  /function commitOpenTabSwitcherInWindow\(windowId, source\)[\s\S]*knownHostTabId = tabSwitcherHostTabIdByWindowId\.get\(windowId\)[\s\S]*getTabForTabSwitcherCommit\(knownHostTabId\)[\s\S]*finishCommit\(hostTab, 'known-host'\)/,
  'the normal commit path should use the remembered host instead of waiting on every tab'
);
assert.match(
  backgroundSource,
  /function normalizeTabSwitcherCommitResponse\(response\)[\s\S]*response\.ok !== true[\s\S]*typeof response\.committed !== 'boolean'[\s\S]*response\.committed === true/,
  'the background should preserve the real committed message result instead of treating host reachability as a successful switch'
);
assert.match(
  backgroundSource,
  /function normalizeTabSwitcherCommitScriptResults\(results\)[\s\S]*typeof item\.result\.committed === 'boolean'[\s\S]*result\.result\.committed === true/,
  'the script fallback should preserve the real committed result'
);
assert.match(
  backgroundSource,
  /function commitOpenTabSwitcherFromShortcutReleaseOnTab\(tab\)[\s\S]*normalizeResponse:\s*normalizeTabSwitcherCommitResponse[\s\S]*normalizeScriptResults:\s*normalizeTabSwitcherCommitScriptResults/,
  'the guarded click route should use committed-aware response normalization for messages and script fallback'
);
assert.match(
  shortcutReleaseHandlerBlock,
  /commitOpenTabSwitcherInWindow\(senderTab\.windowId, 'keyup'\)[\s\S]*\.then\(\(didCommit\) => finish\(didCommit === true\)\)/,
  'a validated real release should be the only path that commits the highlighted tab'
);
assert.match(
  backgroundSource,
  /globalThis\._lumnoTabSwitcherShortcutDebug = Object\.freeze\(\{[\s\S]*snapshot\(\)[\s\S]*clear\(\)/,
  'the service worker should expose a bounded shortcut diagnostic trace'
);
[
  'shortcut-configured',
  'switcher-opened',
  'commit-host-resolved',
  'commit-finished'
].forEach((stage) => {
  assert.ok(
    backgroundSource.includes(`recordTabSwitcherShortcutDebug('${stage}'`),
    `the shortcut diagnostic trace should record ${stage}`
  );
});
assert.deepStrictEqual(
  [...backgroundSource.matchAll(/commitOpenTabSwitcherInWindow\([^\n]+/g)].map((match) => match[0]),
  [
    'commitOpenTabSwitcherInWindow(windowId, source) {',
    "commitOpenTabSwitcherInWindow(senderTab.windowId, 'keyup')"
  ],
  'the open switcher should only be committed by a real keyup notification'
);
assert.match(
  backgroundSource,
  /shortcuts:\s*\{[\s\S]*'notifyTabSwitcherShortcutModifierReleased'[\s\S]*handler:\s*handleShortcutMessage[\s\S]*case 'notifyTabSwitcherShortcutModifierReleased':[\s\S]*handleTabSwitcherShortcutModifierReleased/,
  'the trusted frame release notification should be routed into the tab switcher commit path'
);
assert.match(
  injectSwitcherBlock,
  /shortcut:\s*context && typeof context\.shortcut === 'string' \? context\.shortcut : 'Alt\+Q'/,
  'the switcher open context should carry the browser-configured shortcut into the page runtime'
);
assert.match(
  triggerSwitcherBlock,
  /clearScheduledSwitcherThumbnailCapture\(tab\.id\)[\s\S]*advanceExistingTabSwitcherOnTab/,
  'Alt+Q should cancel the active tab pending thumbnail timer before trying to open the visible switcher'
);
assert.match(
  triggerSwitcherBlock,
  /const activeTab = tabList\.find[\s\S]*clearScheduledSwitcherThumbnailCapture\(activeTab\.id\)[\s\S]*shouldTrackSwitcherTab\(activeTab\)/,
  'Alt+Q should cancel any resolved active-tab pending thumbnail timer before payload construction'
);
assert.match(
  triggerSwitcherBlock,
  /shouldPreCaptureActiveSwitcherThumbnailBeforePayload\(activeTab\)[\s\S]*captureSwitcherThumbnailForTab\([\s\S]*activeTab,[\s\S]*TAB_SWITCHER_CAPTURE_REASON_COMMAND_IMMEDIATE[\s\S]*\.catch\(\(\) => false\);[\s\S]*const items = getRecentTabsForSwitcher\(tabList,\s*activeTab\.id\)/,
  'Alt+Q should refresh eligible active thumbnails asynchronously without blocking payload construction'
);
assert.strictEqual(
  triggerSwitcherBlock.includes('activeThumbnailReady'),
  false,
  'Alt+Q startup should not keep a thumbnail readiness gate'
);
assert.match(
  triggerSwitcherBlock,
  /const items = getRecentTabsForSwitcher\(tabList,\s*activeTab\.id\);[\s\S]*markSwitcherThumbnailPriorityForItems\(items,\s*tabList,\s*'command-payload'\)/,
  'Alt+Q should inspect the rendered recent five tabs and mark missing thumbnails for future priority capture'
);
assert.strictEqual(
  backgroundSource.includes('function requestSwitcherThumbnailRefreshAfterOpen'),
  false,
  'Alt+Q should not schedule a thumbnail refresh after the switcher opens'
);
assert.strictEqual(
  triggerSwitcherBlock.includes('refreshThumbnailTab'),
  false,
  'Alt+Q should not pass the active tab through for a post-open cover refresh'
);
assert.match(
  backgroundSource,
  /chrome\.windows\.onFocusChanged\.addListener[\s\S]*WINDOW_ID_NONE[\s\S]*scheduleSwitcherThumbnailCapture\(tab,\s*'window-focus'\)/,
  'Alt+Q thumbnail cache should refresh the active tab when a browser window regains focus'
);

console.log('tab switcher hotkey tests passed');
