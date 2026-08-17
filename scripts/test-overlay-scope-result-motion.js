const assert = require('assert');
const fs = require('fs');

const overlaySource = fs.readFileSync('src/overlay/search-panel.js', 'utf8');
const suggestionsCss = fs.readFileSync('src/overlay/suggestions-view.css', 'utf8');

assert.match(
  overlaySource,
  /const shouldAnimateScopeResultEnter = Boolean\([\s\S]*?getSearchPanelsLayoutTransitionMenu\(\)[\s\S]*?siteSearchQueryModeActive[\s\S]*?updateKind === 'structure'[\s\S]*?currentSuggestions\.length === 0[\s\S]*?suggestion\.type === 'siteSearch'/,
  'the scope result motion should only run for the first tagged site-search result while the lower panel is open'
);
assert.match(
  overlaySource,
  /if \(shouldAnimateScopeResultEnter\) \{[\s\S]*?data-scope-result-enter', 'run'[\s\S]*?\} else \{\s*suggestionsContainer\.removeAttribute\('data-scope-result-enter'\);/,
  'site-search results without a lower panel should clear the expansion marker'
);
assert.doesNotMatch(
  overlaySource,
  /allowFromZero|scheduleSearchPanelsLayoutTransition|animateSuggestionsHeight/,
  'the optional row entrance should not reintroduce a coordinated container-height animation'
);
assert.match(
  overlaySource,
  /if \(shouldAnimateScopeResultEnter\) \{[\s\S]*?commitSuggestionsNaturalHeightAfterRender\(\);/,
  'the row-only entrance marker should coexist with a direct natural-height commit'
);
assert.match(
  overlaySource,
  /animationName !== '_x_ov_scope_result_enter_2026_unique_'[\s\S]*?data-scope-result-enter', 'done'/,
  'the tagged result motion should release its will-change hint after finishing'
);
assert.match(
  suggestionsCss,
  /data-scope-result-enter="run"[\s\S]*?_x_ov_scope_result_enter_2026_unique_ 180ms ease-in-out both[\s\S]*?translateY\(8px\)[\s\S]*?translateY\(0\)/,
  'the tagged result should reuse the lower panel timing while moving into place'
);
assert.match(
  suggestionsCss,
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*?data-scope-result-enter="run"[\s\S]*?animation: none !important[\s\S]*?transform: none !important/,
  'the tagged result motion should respect reduced-motion preferences'
);

console.log('overlay scope result motion tests passed');
