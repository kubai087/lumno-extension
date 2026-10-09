const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { readPageSource } = require('./helpers/page-source');

const repoRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
);
const newtabHtml = readPageSource('newtab.html');
const optionsHtml = readPageSource('src/options/options.html');
const optionsSource = fs.readFileSync(
  path.join(repoRoot, 'src/options/options.js'),
  'utf8'
);
const onboardingHtml = readPageSource('src/onboarding/onboarding.html');
const onboardingSource = fs.readFileSync(
  path.join(repoRoot, 'src/onboarding/onboarding.js'),
  'utf8'
);
const overlaySuggestionsCss = fs.readFileSync(
  path.join(repoRoot, 'src/overlay/suggestions-view.css'),
  'utf8'
);
const overlaySource = fs.readFileSync(
  path.join(repoRoot, 'src/overlay/search-panel.js'),
  'utf8'
);
const reactSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/shortcut-dialog.tsx'),
  'utf8'
);
const recentSitesReactSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/recent-sites.tsx'),
  'utf8'
);
const bookmarksReactSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/bookmarks.tsx'),
  'utf8'
);
const suggestionsReactSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/search/suggestions.tsx'),
  'utf8'
);
const shortcutsReactSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/shortcuts.tsx'),
  'utf8'
);
const feedbackReactSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/feedback.tsx'),
  'utf8'
);
const selectMenuReactSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/select-menu.tsx'),
  'utf8'
);
const dockReactSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/dock.tsx'),
  'utf8'
);
const wordmarkReactSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/newtab/wordmark.tsx'),
  'utf8'
);
const searchInputReactSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/shared/search-input.tsx'),
  'utf8'
);
const toastReactSource = fs.readFileSync(
  path.join(repoRoot, 'react-src/shared/toast.tsx'),
  'utf8'
);
const bootstrapPath = path.join(repoRoot, 'src/shared/react-page-bootstrap.js');
const bootstrap = fs.readFileSync(bootstrapPath, 'utf8');
const newtabBundlePath = path.join(
  repoRoot,
  'src/react/newtab-islands.js'
);
const optionsBundlePath = path.join(repoRoot, 'src/react/options-islands.js');
const onboardingBundlePath = path.join(
  repoRoot,
  'src/react/onboarding-islands.js'
);
const overlayBundlePath = path.join(repoRoot, 'src/react/overlay-islands.js');
const sharedBundlePath = path.join(repoRoot, 'src/react/react-shared.js');
const tabSwitcherSharedBundlePath = path.join(
  repoRoot,
  'src/react/tab-switcher-shared.js'
);
const runtimeBundlePath = path.join(repoRoot, 'src/react/react-runtime.js');
const newtabBundle = fs.readFileSync(newtabBundlePath, 'utf8');
const optionsBundle = fs.readFileSync(optionsBundlePath, 'utf8');
const onboardingBundle = fs.readFileSync(onboardingBundlePath, 'utf8');
const overlayBundle = fs.readFileSync(overlayBundlePath, 'utf8');
const sharedBundle = fs.readFileSync(sharedBundlePath, 'utf8');
const tabSwitcherSharedBundle = fs.readFileSync(
  tabSwitcherSharedBundlePath,
  'utf8'
);
const runtimeBundle = fs.readFileSync(runtimeBundlePath, 'utf8');
const bundles = [
  runtimeBundle,
  sharedBundle,
  tabSwitcherSharedBundle,
  newtabBundle,
  optionsBundle,
  onboardingBundle,
  overlayBundle
];
const bundle = bundles.join('\n');
const bundlePaths = [
  runtimeBundlePath,
  sharedBundlePath,
  tabSwitcherSharedBundlePath,
  newtabBundlePath,
  optionsBundlePath,
  onboardingBundlePath,
  overlayBundlePath
];

const kibibytes = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`;
const gzipSize = (source) =>
  zlib.gzipSync(source, {
    level: zlib.constants.Z_BEST_COMPRESSION
  }).length;
const assertWithinBudget = (actualBytes, budgetKiB, label) => {
  const budgetBytes = budgetKiB * 1024;
  assert(
    actualBytes <= budgetBytes,
    `${label} is ${kibibytes(actualBytes)}; budget is ${budgetKiB} KiB`
  );
};

// Keep these as durable regression ceilings rather than exact snapshots. The
// rounded limits leave about 5% headroom over the 0.9.44 production bundles,
// while the explicit gzip level avoids relying on Node's default compression.
// Options was rebased at 0.9.56 (277 KiB / 81.4 KiB gzip) after the settings
// growth since 0.9.44 and the WebDAV connection cards; the total rises by the
// same amount so it stays consistent with the per-page ceilings.
// New Tab moved to 386 KiB at 0.9.61 for the shared search input clear button.
const bundleBudgets = {
  newtab: { uncompressed: 386, gzip: 115 },
  options: { uncompressed: 290, gzip: 85 },
  overlay: { uncompressed: 271, gzip: 82 },
  total: { uncompressed: 772, gzip: 225 }
};

const retiredNewtabRendererScripts = [
  'bookmarks-topbar.js',
  'page-notice.js',
  'toast.js',
  'dock.js',
  'recent-sites-view.js',
  'bookmarks-view.js',
  'suggestions-view.js',
  'shortcut-dialog.js',
  'shortcuts-view.js'
].map((name) => `<script src="${name}"></script>`);
const retiredRendererFiles = [
  'src/newtab/bookmarks-topbar.js',
  'src/newtab/bookmarks-view.js',
  'src/newtab/dock.js',
  'src/newtab/page-notice.js',
  'src/newtab/recent-sites-view.js',
  'src/newtab/shortcut-dialog.js',
  'src/newtab/shortcuts-view.js',
  'src/newtab/suggestions-view.js',
  'src/newtab/toast.js',
  'src/overlay/input-ui.js',
  'src/overlay/shell.js',
  'src/shared/checkbox.js',
  'src/shared/custom-select.js',
  'src/shared/search-input-ui.js'
];
const bootstrapScript = 'src="../shared/react-page-bootstrap.js"';

assert(
  retiredNewtabRendererScripts.every((script) => !newtabHtml.includes(script)) &&
    newtabHtml.includes(bootstrapScript),
  'New Tab should load its React entry without retired renderer scripts'
);
assert(
  retiredRendererFiles.every(
    (relativePath) => !fs.existsSync(path.join(repoRoot, relativePath))
  ),
  'retired UI renderer and fallback files should stay deleted'
);
assert(
  !newtabHtml.includes('<script src="newtab.js"></script>') &&
    newtabHtml.includes('data-react-entry="../react/newtab-islands.js"') &&
    newtabHtml.includes('data-page-entry="../newtab/newtab.js"') &&
    newtabHtml.includes('data-react-state="LumnoNewtabReactBootstrap"') &&
    newtabHtml.includes('data-react-ready-script="../overlay/tab-switcher-page-bridge.js"') &&
    bootstrap.includes('import(reactEntryUrl)') &&
    bootstrap.includes('if (!bootstrapState.reactReady)') &&
    bootstrap.includes('loadReactReadyScript()') &&
    bootstrap.includes('startPage();'),
  'the bootstrap should require React readiness before connecting bridges and injecting the browser adapter'
);
assert(
  !optionsHtml.includes('<script src="options.js"></script>') &&
    optionsHtml.includes(bootstrapScript) &&
    optionsHtml.includes('data-react-entry="../react/options-islands.js"') &&
    optionsHtml.includes('data-react-ready-script="../overlay/tab-switcher-page-bridge.js"') &&
    optionsHtml.includes('data-page-entry="../options/options.js"') &&
    optionsHtml.includes('data-react-state="LumnoOptionsReactBootstrap"'),
  'Options should use the shared React-aware bootstrap and retain classic page semantics'
);
assert(
  !onboardingHtml.includes('<script src="onboarding.js"></script>') &&
    onboardingHtml.includes(bootstrapScript) &&
    onboardingHtml.includes('data-react-entry="../react/onboarding-islands.js"') &&
    onboardingHtml.includes('data-react-ready-script="../overlay/tab-switcher-page-bridge.js"') &&
    onboardingHtml.includes('data-page-entry="../onboarding/onboarding.js"') &&
    onboardingHtml.includes('data-react-state="LumnoOnboardingReactBootstrap"'),
  'Onboarding should use the shared React-aware bootstrap and retain classic page semantics'
);
assert(
  /id="_x_extension_blacklist_form_2026_unique_"[^>]*><\/div>/.test(optionsHtml) &&
    /id="_x_extension_favicon_blacklist_form_2026_unique_"[^>]*><\/div>/.test(optionsHtml) &&
    !optionsSource.includes('blacklistFormExpanded') &&
    !optionsSource.includes('faviconBlacklistFormExpanded') &&
    !optionsSource.includes('setBlacklistFormExpanded') &&
    !optionsSource.includes('setFaviconBlacklistFormExpanded') &&
    optionsSource.includes('searchBlacklistFormController?.reset()') &&
    optionsSource.includes('faviconBlacklistFormController?.reset()'),
  'React-owned blacklist forms should not retain legacy DOM state or event-handler fallbacks'
);
assert(
  !onboardingSource.includes('if (!copyActionsController)'),
  'Onboarding should not retain an empty copy-actions fallback branch'
);
assert(
  !bootstrap.includes("startPage('legacy')") &&
    !bootstrap.includes('allowReactUpgrade') &&
    !bootstrap.includes('1500') &&
    bootstrap.includes("root.dataset.lumnoReactRuntime = 'error'") &&
    bootstrap.includes('React page failed to start'),
  'the bootstrap should fail explicitly instead of reviving a legacy UI path'
);
assert.strictEqual(
  packageJson.scripts['build:react'],
  'vite build --config vite.react.config.mjs && vite build --config vite.overlay-react.config.mjs',
  'the React output should have a reproducible local build command'
);
assert(
  packageJson.scripts.test.includes('test:legacy') &&
    packageJson.scripts.test.includes('test:react'),
  'the default test command should cover both runtimes'
);
assert.strictEqual(
  packageJson.scripts.verify,
  'npm test && npm run check',
  'the local verification command should match the CI test and check sequence'
);
assert(
  packageJson.dependencies.react && packageJson.dependencies['react-dom'],
  'React runtime dependencies should be explicit'
);
assertWithinBudget(
  fs.statSync(runtimeBundlePath).size +
    fs.statSync(sharedBundlePath).size +
    fs.statSync(tabSwitcherSharedBundlePath).size +
    fs.statSync(newtabBundlePath).size,
  bundleBudgets.newtab.uncompressed,
  'the New Tab React route (uncompressed)'
);
assertWithinBudget(
  gzipSize(runtimeBundle) +
    gzipSize(sharedBundle) +
    gzipSize(tabSwitcherSharedBundle) +
    gzipSize(newtabBundle),
  bundleBudgets.newtab.gzip,
  'the New Tab React route (gzip)'
);
assertWithinBudget(
  fs.statSync(runtimeBundlePath).size +
    fs.statSync(sharedBundlePath).size +
    fs.statSync(tabSwitcherSharedBundlePath).size +
    fs.statSync(optionsBundlePath).size,
  bundleBudgets.options.uncompressed,
  'the Options React route (uncompressed)'
);
assertWithinBudget(
  gzipSize(runtimeBundle) +
    gzipSize(sharedBundle) +
    gzipSize(tabSwitcherSharedBundle) +
    gzipSize(optionsBundle),
  bundleBudgets.options.gzip,
  'the Options React route (gzip)'
);
assertWithinBudget(
  fs.statSync(overlayBundlePath).size,
  bundleBudgets.overlay.uncompressed,
  'the injected Overlay React route (uncompressed)'
);
assertWithinBudget(
  gzipSize(overlayBundle),
  bundleBudgets.overlay.gzip,
  'the injected Overlay React route (gzip)'
);
assertWithinBudget(
  bundlePaths.reduce((total, file) => total + fs.statSync(file).size, 0),
  bundleBudgets.total.uncompressed,
  'all shared React artifacts and four page entries (uncompressed)'
);
assertWithinBudget(
  bundles.reduce((total, source) => total + gzipSize(source), 0),
  bundleBudgets.total.gzip,
  'all shared React artifacts and four page entries (gzip)'
);
assert(
  newtabBundle.includes('from"./react-runtime.js"') &&
    newtabBundle.includes('from"./react-shared.js"') &&
    newtabBundle.includes('from"./tab-switcher-shared.js"') &&
    optionsBundle.includes('from"./react-shared.js"') &&
    optionsBundle.includes('from"./tab-switcher-shared.js"') &&
    onboardingBundle.includes('from"./react-runtime.js"') &&
    sharedBundle.includes('from"./react-runtime.js"') &&
    tabSwitcherSharedBundle.includes('from"./react-runtime.js"'),
  'New Tab and Options should reuse the shared tab-switcher implementation and React runtime'
);
assert(
  newtabBundle.includes('LumnoOverlayTabSwitcherViewReact') &&
    optionsBundle.includes('LumnoOverlayTabSwitcherViewReact') &&
    tabSwitcherSharedBundle.includes('overlay-tab-switcher'),
  'extension-page React entries should install the tab-switcher API before their bridge connects'
);
assert(
  overlayBundle.includes('LumnoOverlayReactBootstrap') &&
    overlayBundle.includes('LumnoOverlayShellReact') &&
    overlayBundle.includes('LumnoOverlaySuggestionsViewReact') &&
    overlayBundle.includes('LumnoOverlayTabSwitcherViewReact') &&
    overlayBundle.includes('LumnoSearchInputUIReact') &&
    overlayBundle.includes('overlay-shell') &&
    overlayBundle.includes('overlay-tab-switcher') &&
    overlayBundle.includes('suggestions') &&
    overlayBundle.includes('shared-search-input'),
  'the injected Overlay IIFE should install React shell, suggestions, and search-input APIs'
);
assert(
  /\.x-ov-suggestion-mark\s*\{[^}]*background:\s*var\(--x-ext-mark-bg,\s*#CFE8FF\)[^}]*color:\s*var\(--x-ext-mark-text,\s*#1E3A8A\)/s.test(
    overlaySuggestionsCss
  ),
  'the Overlay query mark should retain its themed background and text colors'
);
assert(
  overlaySource.includes(
    'overlay._lumnoSuggestionsView = overlaySuggestionsView'
  ) &&
    overlaySource.includes(
      'const mountedSuggestionsView = overlayElement._lumnoSuggestionsView ||'
    ) &&
    overlaySource.includes('mountedSuggestionsView.destroy()'),
  'the Overlay panel should retain and destroy the React suggestions owner across toggle invocations'
);
assert(
  overlaySource.includes(
    'const overlayMountParent = document.fullscreenElement ||\n' +
      '      document.documentElement ||\n' +
      '      document.body;'
  ) &&
    overlaySource.includes('overlayMountParent.appendChild(overlayHost);') &&
    overlaySource.includes("typeof overlayHost.showPopover === 'function'") &&
    overlaySource.includes('overlayHost.showPopover();') &&
    overlaySource.includes("overlayHost.removeAttribute('popover');") &&
    overlaySource.includes('function focusOverlayInputForReveal()') &&
    overlaySource.includes('searchInput.focus({ preventScroll: true });') &&
    overlaySource.includes('focusOverlayInputForReveal();') &&
    !overlaySource.includes(
      'setTimeout(() => searchInput.focus({ preventScroll: true }), 100);'
    ),
  'the Overlay panel should avoid hidden body containers, stay inside the fullscreen subtree, enter the browser top layer, and focus as part of the reveal transaction'
);
assert(
  newtabBundle.includes('LumnoNewtabShortcutDialogReact') &&
    newtabBundle.includes('LumnoNewtabRecentSitesViewReact') &&
    newtabBundle.includes('LumnoNewtabBookmarksViewReact') &&
    newtabBundle.includes('LumnoNewtabSuggestionsViewReact') &&
    newtabBundle.includes('LumnoNewtabShortcutsViewReact') &&
    newtabBundle.includes('LumnoNewtabToastReact') &&
    newtabBundle.includes('LumnoNewtabFeedbackControlReact') &&
    newtabBundle.includes('LumnoNewtabSelectMenuReact') &&
    newtabBundle.includes('LumnoNewtabDockReact') &&
    newtabBundle.includes('LumnoNewtabWordmarkReact') &&
    newtabBundle.includes('LumnoSearchInputUIReact') &&
    newtabBundle.includes('LumnoNewtabReactIslands') &&
    newtabBundle.includes('newtab-feedback-control') &&
    newtabBundle.includes('newtab-select-menu') &&
    newtabBundle.includes('newtab-bottom-dock') &&
    newtabBundle.includes('newtab-wordmark') &&
    feedbackReactSource.includes('createFeedbackControlController') &&
    feedbackReactSource.includes("host.dataset.reactIsland = 'newtab-feedback-control'") &&
    selectMenuReactSource.includes('createSelectMenuController') &&
    selectMenuReactSource.includes("host.dataset.reactIsland = 'newtab-select-menu'") &&
    dockReactSource.includes("bottomDock.dataset.reactIsland = 'newtab-bottom-dock'") &&
    wordmarkReactSource.includes("host.dataset.reactIsland = 'newtab-wordmark'") &&
    sharedBundle.includes('data-react-island'),
  'the compiled islands should expose diagnostic APIs and host markers'
);
// The search input is New Tab's (the overlay builds its own copy), so it ships
// in the New Tab bundle rather than the chunk every page loads.
assert(
  newtabBundle.includes('shared-search-input') &&
    !sharedBundle.includes('shared-search-input') &&
    sharedBundle.includes('_x_lumnoTooltipRenderReact_2026_unique_') &&
    overlayBundle.includes('_x_lumnoTooltipRenderReact_2026_unique_') &&
    searchInputReactSource.includes('createSearchInput') &&
    searchInputReactSource.includes(
      "container.dataset.reactIsland = 'shared-search-input'"
    ),
  'the shared React search input should keep a diagnostic host marker'
);
assert(
  [
    'LumnoOptionsToastReact',
    'LumnoOptionsBlacklistListReact',
    'LumnoOptionsPopconfirmReact',
    'LumnoOptionsSegmentedControlReact',
    'LumnoOptionsSelectControlReact',
    'LumnoOptionsSettingsNavigationReact',
    'LumnoOptionsSettingsControlsReact',
    'LumnoOptionsSettingsFormsReact',
    'LumnoOptionsShortcutReferenceReact',
    'LumnoOptionsShortcutHotkeyReact',
    'LumnoOptionsSiteSearchListReact',
    'LumnoOptionsThemePickerReact',
    'LumnoOptionsReactIslands'
  ].every((name) => optionsBundle.includes(name)) &&
    [
      'optionsBlacklistListApi.createBlacklistListController',
      'optionsPopconfirmApi',
      'optionsSegmentedControlApi.createSegmentedControlController',
      'optionsSelectControlApi.createSelectControlController',
      'optionsSettingsControlsApi.createToggleControlController',
      'optionsSettingsControlsApi.createRequiredCheckboxGroupController',
      'optionsSettingsFormsApi.createSiteSearchFormController',
      'optionsSettingsFormsApi.createBlacklistFormController',
      'optionsSettingsNavigationApi.createSettingsNavigationController',
      'optionsShortcutReferenceApi.createShortcutReferenceController',
      'optionsShortcutHotkeyApi.createShortcutHotkeyController',
      'optionsSiteSearchListApi.createSiteSearchListController',
      'optionsThemePickerApi.createThemePickerController',
      'optionsToastApi.createToastController'
    ].every((contract) => optionsSource.includes(contract)),
  'Options should install and consume every migrated React controller'
);
assert(
  [
    'LumnoOnboardingPageStripReact',
    'LumnoOnboardingActionsReact',
    'LumnoOnboardingBodyCopyReact',
    'LumnoOnboardingCopyHeadingReact',
    'LumnoOnboardingCursorLayerReact',
    'LumnoOnboardingInteractionsReact',
    'LumnoOnboardingVisualSurfaceReact',
    'LumnoOnboardingReactIslands'
  ].every((name) => onboardingBundle.includes(name)) &&
    sharedBundle.includes('renderBrowserAvatarTooltip') &&
    [
      'onboardingPageStripApi.createPageStripController',
      'onboardingActionsApi.createActionButtonsController',
      'onboardingBodyCopyApi.createBodyCopyController',
      'onboardingCopyHeadingApi.createCopyHeadingController',
      'onboardingCursorLayerApi.createCursorLayerController',
      'onboardingInteractionsApi.createInteractionsController',
      'onboardingVisualSurfaceApi.createVisualSurfaceController',
      'tooltipView.renderBrowserAvatarTooltip('
    ].every((contract) => onboardingSource.includes(contract)),
  'Onboarding should install and consume every migrated React controller'
);
assert(
  !bundle.includes('process.env.NODE_ENV') &&
    !bundle.includes('sourceMappingURL=') &&
    !bootstrap.includes('sourceMappingURL=') &&
    !/\beval\(|new Function/.test(`${bundle}\n${bootstrap}`),
  'the extension bundle should be production-only, CSP-safe, and omit source maps'
);
assert(
  !/<script[^>]+src=["']https?:\/\//i.test(newtabHtml) &&
    !/<script[^>]+src=["']https?:\/\//i.test(optionsHtml) &&
    !/<script[^>]+src=["']https?:\/\//i.test(onboardingHtml),
  'MV3 pages should not load React or any script from a CDN'
);
assert(
  !reactSource.includes("from '../../src/newtab/wallpaper") &&
    !reactSource.includes("from '../../src/newtab/theme") &&
    !reactSource.includes("from '../../src/newtab/newtab") &&
    !recentSitesReactSource.includes("from '../../src/newtab/wallpaper") &&
    !recentSitesReactSource.includes("from '../../src/newtab/theme") &&
    !recentSitesReactSource.includes("from '../../src/newtab/newtab") &&
    !bookmarksReactSource.includes("from '../../src/newtab/wallpaper") &&
    !bookmarksReactSource.includes("from '../../src/newtab/theme") &&
    !bookmarksReactSource.includes("from '../../src/newtab/newtab") &&
    !suggestionsReactSource.includes("from '../../src/newtab/wallpaper") &&
    !suggestionsReactSource.includes("from '../../src/newtab/theme") &&
    !suggestionsReactSource.includes("from '../../src/newtab/newtab") &&
    !shortcutsReactSource.includes("from '../../src/newtab/wallpaper") &&
    !shortcutsReactSource.includes("from '../../src/newtab/theme") &&
    !shortcutsReactSource.includes("from '../../src/newtab/newtab") &&
    !toastReactSource.includes("from '../../src/newtab/wallpaper") &&
    !toastReactSource.includes("from '../../src/newtab/theme") &&
    !toastReactSource.includes("from '../../src/newtab/newtab"),
  'the pilot islands should remain isolated from recently changed page systems'
);
assert(
  !fs.existsSync(path.join(repoRoot, 'src/newtab/react-islands.js')),
  'the obsolete monolithic New Tab bundle should not remain in the extension'
);
assert(
  !fs.existsSync(path.join(repoRoot, 'src/newtab/react-bootstrap.js')),
  'page-specific bootstrap copies should not remain after sharing the loader'
);
assert(
  !fs.existsSync(path.join(repoRoot, 'src/newtab/shortcut-dialog-react.js')),
  'the extension should ship one shared React runtime instead of per-island copies'
);
assert(
  !fs.existsSync(path.join(repoRoot, 'src/newtab/shortcuts-view-react.js')),
  'the shortcuts grid should reuse the shared React runtime'
);
assert(
  !fs.existsSync(path.join(repoRoot, 'src/newtab/toast-react.js')),
  'the toast should reuse the shared React runtime'
);

console.log('React migration contract tests passed');
