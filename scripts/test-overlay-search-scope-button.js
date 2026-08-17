const assert = require('assert');
const fs = require('fs');

const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
const searchInputCss = fs.readFileSync('src/shared/search-input.css', 'utf8');
const searchInputModeSource = fs.readFileSync(
  'src/shared/search-input-mode.js',
  'utf8'
);

assert.match(
  overlaySource,
  /iconStyleOverrides:\s*\{\s*left: '13px'/,
  'the overlay search action should stay optically aligned with its settings action'
);
assert.match(
  overlaySource,
  /searchScopeIcon\.dataset\.searchScopeAction = 'true'[\s\S]*?setAttribute\('role', 'button'\)[\s\S]*?setAttribute\('tabindex', '0'\)[\s\S]*?setAttribute\('aria-label', searchScopeTooltipText\(\)\)/,
  'the overlay search icon should expose the same accessible action contract'
);
assert.match(
  overlaySource,
  /const activateSearchScopeIcon = \(event\) => \{[\s\S]*?resetModeMenuDoubleTab\(\)[\s\S]*?openSearchModeMenuFromDoubleTab\(\)/,
  'the overlay icon should reuse the scope-panel result and normal tag entrance animation'
);
assert.match(
  overlaySource,
  /searchScopeIcon\.addEventListener\('click', activateSearchScopeIcon\)[\s\S]*?event\.key !== 'Enter' && event\.key !== ' '[\s\S]*?activateSearchScopeIcon\(event\)/,
  'the overlay icon should support pointer and keyboard activation'
);
assert.match(
  overlaySource,
  /bindInputActionCursorTooltip\(searchScopeIcon, searchScopeTooltipText\)/,
  'the overlay search icon should use the same cursor Tooltip as settings'
);
assert.match(
  overlaySource,
  /function openSearchModeMenuFromDoubleTab\(\)[\s\S]*?activateSiteSearch\(provider, \{ animatePrefix: false \}\);[\s\S]*?function activateSiteSearch\(provider, activationOptions\)[\s\S]*?animate: options\.animatePrefix !== false/,
  'double-Tab should use the shared provider path without starting an animation that its menu-open cancels'
);
assert.match(
  overlaySource,
  /function openSearchModeMenuFromDoubleTab\(\)[\s\S]*?if \(expectedInputValue\.trim\(\)\) \{[\s\S]*?preserveResults: true[\s\S]*?restoreSearchModeQuery\(expectedInputValue\);/,
  'the overlay search action should preserve a typed query without starting a result-height transition'
);
assert.doesNotMatch(
  overlaySource,
  /function openSearchModeMenuFromDoubleTab\(\)[\s\S]*?expectedInputValue === ''[\s\S]*?const activateDefaultProvider/,
  'a non-empty query should not disable the clickable scope action'
);
assert.match(
  searchInputModeSource,
  /surface === 'overlay'[\s\S]*?siteSearchPrefixCurrentText\.style\.setProperty\('display', 'inline-block'\)[\s\S]*?siteSearchPrefixCurrent\.style\.cssText = cssText\([\s\S]*?\['overflow', 'hidden'\]/,
  'the overlay current label should be clipped by its in-flow slot before the isolated stylesheet loads'
);
assert.match(
  searchInputModeSource,
  /function playInputModePrefixCurrentResizeAnimation\(fromState, toState\)[\s\S]*?siteSearchPrefixCurrent\.animate\(\[[\s\S]*?marginLeft:[\s\S]*?width:/,
  'the overlay current label should expand in normal flow and continuously move the chevron'
);
assert.doesNotMatch(
  searchInputModeSource,
  /setInputModePrefixCurrentOverlay|data-current-overlay|current-overlay-left/,
  'the current label should not reintroduce the overlapping chevron overlay state'
);
assert.match(
  searchInputCss,
  /\.x-lumno-search-input__icon\[data-search-scope-action="true"\]\[data-hover-active="true"\][\s\S]*?var\(--x-ext-input-icon-hover-bg/,
  'both surfaces should share the settings hover tokens'
);

console.log('overlay search scope button tests passed');
