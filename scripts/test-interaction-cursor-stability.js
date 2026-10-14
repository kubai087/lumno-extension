const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPageSource } = require('./helpers/page-source');

const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const newtabHtml = readPageSource('newtab.html');
const optionsHtml = readPageSource('src/options/options.html');
const onboardingHtml = readPageSource('src/onboarding/onboarding.html');
const overlayShell = read('react-src/overlay/shell.tsx');
const documentPipPicker = read('src/content/document-pip-picker.js');
const tooltipCss = read('src/shared/tooltip.css');
const cursorTooltipCss = read('src/shared/cursor-tooltip.css');
const featureHintsCss = read('src/shared/feature-hints.css');
const overlaySuggestionsCss = read('src/overlay/suggestions-view.css');
const searchInputCss = read('src/shared/search-input.css');
const shortcutDialogCss = read('src/newtab/shortcut-dialog.css');
const infoButtonCss = read('src/shared/info-button.css');

function getRule(source, selector) {
  const escapedSelector = selector.trim().split(/\s+/)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  // The selector must open its rule, not end a longer selector such as
  // `.x-nt-shortcut-group-empty .x-nt-shortcut-icon`.
  const match = source.match(new RegExp(`(?:^|[\\n}])[ \\t]*${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected CSS rule for ${selector}`);
  return match[1];
}

function assertStableHoverTarget(source, selector) {
  const declarations = getRule(source, selector);
  assert.match(
    declarations,
    /transform:\s*none;/,
    `${selector} should keep its hit box stationary while hovered`
  );
  assert.doesNotMatch(
    declarations,
    /transform:\s*(?:var\([^;]*(?:translate|rotate)|[^;]*(?:translate|rotate))/,
    `${selector} should not move or rotate its own hit box while hovered`
  );
}

function assertCursorInheritanceWithoutHitSuppression(source, selector) {
  const declarations = getRule(source, selector);
  assert.match(
    declarations,
    /cursor:\s*inherit;/,
    `${selector} should inherit the owning control cursor`
  );
  assert.doesNotMatch(
    declarations,
    /pointer-events:\s*none;/,
    `${selector} should not disable every descendant hit target`
  );
}

assertStableHoverTarget(
  newtabHtml,
  '.x-nt-bookmark-card.x-nt-bookmark-card--hover'
);
assert.match(
  getRule(newtabHtml, '.x-nt-bookmark-card'),
  /cursor:\s*pointer;/,
  'bookmark cards should use a pointer while clickable'
);
assert.match(
  getRule(newtabHtml, '.x-nt-bookmark-card[data-bookmark-draggable="true"]'),
  /cursor:\s*pointer;/,
  'clickable draggable bookmark cards should use a pointer while idle'
);
assert.match(
  getRule(newtabHtml, '.x-nt-bookmark-cascade-item[data-bookmark-draggable="true"]'),
  /cursor:\s*pointer;/,
  'clickable draggable cascade items should use a pointer while idle'
);
assert.match(
  getRule(newtabHtml, '.x-nt-shortcut-tile[data-shortcut-draggable="true"]'),
  /cursor:\s*pointer;/,
  'clickable draggable shortcut tiles should use a pointer while idle'
);
assert.match(
  getRule(
    newtabHtml,
    '.x-nt-shortcuts-grid[data-shortcut-dragging="true"] .x-nt-shortcut-tile'
  ),
  /cursor:\s*grabbing;/,
  'shortcut tiles should use a grabbing cursor during drag sessions'
);
assert.match(
  getRule(
    newtabHtml,
    '.x-nt-bookmark-cascade-menu[data-drag-mode="true"] .x-nt-bookmark-cascade-item,\n      .x-nt-bookmark-cascade-item[data-bookmark-dragging="true"]'
  ),
  /cursor:\s*grabbing;/,
  'cascade items should use a grabbing cursor during drag sessions'
);
assert.match(
  getRule(
    newtabHtml,
    '#_x_extension_newtab_bookmarks_grid_2024_unique_[data-bookmark-dragging="true"] .x-nt-bookmark-card'
  ),
  /cursor:\s*grabbing;/,
  'bookmark cards should use a grabbing cursor during drag sessions'
);
assert.match(
  getRule(
    newtabHtml,
    'body[data-drag-source],\n      body[data-drag-source] *'
  ),
  /cursor:\s*var\(--x-nt-drag-cursor, grabbing\)\s*!important;/,
  'bookmark and shortcut drags should keep a grabbing cursor over every underlying page target'
);
assertStableHoverTarget(newtabHtml, '.x-nt-recent-card:hover');
assert.match(
  getRule(
    newtabHtml,
    '.x-nt-recent-card:hover .x-nt-recent-card-visual'
  ),
  /transform:\s*var\(--x-nt-dock-recent-card-hover-transform,\s*rotate\(-3deg\)\s+scale\(1\.01,\s*1\.005\)\);/,
  'recent cards should rotate their visual layer without moving the pointer hit box'
);
assert.match(
  getRule(newtabHtml, '.x-nt-recent-card'),
  /cursor:\s*pointer;/,
  'recent cards should use a pointer while clickable'
);
assert.match(
  getRule(newtabHtml, '#_x_extension_newtab_bottom_dock_2024_unique_'),
  /--x-nt-dock-recent-card-hover-transform:\s*rotate\(-3deg\)\s+scale\(1\.01,\s*1\.005\);/,
  'default recent cards should use the full hover rotation'
);
assert.match(
  getRule(
    newtabHtml,
    '#_x_extension_newtab_bottom_dock_2024_unique_[data-density="compact"]'
  ),
  /--x-nt-dock-recent-card-hover-transform:\s*rotate\(-1\.5deg\)\s+scale\(1\.006\);/,
  'compact recent cards should use the reduced hover rotation'
);
assert.match(
  getRule(
    newtabHtml,
    '#_x_extension_newtab_bottom_dock_2024_unique_[data-density="tiny"]'
  ),
  /--x-nt-dock-recent-card-hover-transform:\s*scale\(1\.004\);/,
  'tiny recent cards should keep the subtle hover scale without rotation'
);
assertStableHoverTarget(newtabHtml, '.x-nt-feedback-action:hover');
assertStableHoverTarget(
  newtabHtml,
  '.x-nt-suggestion-action-button[data-visible="true"]:hover'
);
assertStableHoverTarget(
  documentPipPicker,
  '.lumno-pip-dock-btn:hover,\n        .lumno-pip-dock-btn:focus-visible'
);
assert.match(
  getRule(documentPipPicker, '.lumno-pip-dock-btn > *'),
  /cursor:\s*inherit;[\s\S]*pointer-events:\s*none;|pointer-events:\s*none;[\s\S]*cursor:\s*inherit;/,
  'document PiP dock contents should not create nested cursor hit targets'
);
assert.match(
  getRule(
    documentPipPicker,
    '.lumno-pip-dock-btn:hover .ri-icon,\n        .lumno-pip-dock-btn:focus-visible .ri-icon'
  ),
  /transform:\s*scale\(1\.03\);/,
  'document PiP hover motion should stay on the decorative icon'
);
assertStableHoverTarget(featureHintsCss, '.x-lumno-feature-hint__link:hover');
assertStableHoverTarget(
  searchInputCss,
  '.x-lumno-search-input__right-icon[data-hover-active="true"]'
);
assert.match(
  getRule(
    searchInputCss,
    '.x-lumno-search-input__right-icon[data-hover-active="true"] .ri-icon'
  ),
  /transform:\s*scale\(1\.06\);/,
  'search-input hover motion should stay on the decorative icon'
);
assertStableHoverTarget(
  overlaySuggestionsCss,
  ':is(#_x_extension_overlay_2024_unique_, #_x_extension_onboarding_overlay_demo_2026_unique_) .x-ov-close-other-tabs[data-hover-active="true"]'
);
assert.match(
  getRule(
    overlaySuggestionsCss,
    ':is(#_x_extension_overlay_2024_unique_, #_x_extension_onboarding_overlay_demo_2026_unique_) .x-ov-close-other-tabs[data-hover-active="true"] .ri-icon'
  ),
  /transform:\s*scale\(1\.06\);/,
  'overlay close-tabs hover motion should stay on the decorative icon'
);
assertStableHoverTarget(
  overlaySuggestionsCss,
  ':is(#_x_extension_overlay_2024_unique_, #_x_extension_onboarding_overlay_demo_2026_unique_) .x-ov-suggestion-utility-button[data-hover="true"]'
);
assertStableHoverTarget(
  newtabHtml,
  '.x-nt-suggestion-utility-button[data-hover="true"]'
);

assert.doesNotMatch(
  tooltipCss,
  /\._x_extension_tooltip_host_(?:2026|2024)_unique_\[data-tooltip\][^{]*\{[^}]*cursor\s*:/,
  'shared tooltips should not declare a cursor for their owning control'
);
assert.doesNotMatch(
  cursorTooltipCss,
  /\._x_extension_cursor_tooltip_host_2026_unique_\[data-cursor-tooltip\][^{]*\{[^}]*cursor\s*:/,
  'cursor-following tooltips should preserve pointer, grab, and disabled cursors'
);
assert.doesNotMatch(
  optionsHtml,
  /\._x_extension_tooltip_host_(?:2026|2024)_unique_\[data-tooltip\][^{]*\{[^}]*cursor\s*:/,
  'options tooltip compatibility styles should not override cursor semantics'
);

assert.match(
  getRule(infoButtonCss, '._x_extension_info_button_2026_unique_'),
  /cursor:\s*help;/,
  'hover-only help affordances should use the help cursor'
);
assert.match(
  getRule(optionsHtml, '[role="img"][data-tooltip]'),
  /cursor:\s*help;/,
  'static tooltip-only status and hint elements should use the help cursor'
);
assert.match(
  getRule(newtabHtml, '.x-nt-appearance-info-button'),
  /cursor:\s*help;/,
  'new-tab hover-only information buttons should use the help cursor'
);
assert.match(
  getRule(
    newtabHtml,
    '.x-nt-bookmarks-pager-btn:disabled,\n      .x-nt-bookmarks-pager-btn[aria-disabled="true"]'
  ),
  /cursor:\s*not-allowed;/,
  'unavailable pager actions should use the not-allowed cursor'
);
assert.match(
  getRule(newtabHtml, '.x-nt-feedback-detail-action:disabled'),
  /cursor:\s*progress;/,
  'locally loading actions should use the progress cursor'
);
assert.match(
  getRule(newtabHtml, '.x-nt-wallpaper-tile[data-loading="true"]'),
  /cursor:\s*progress;/,
  'loading wallpaper tiles should use the progress cursor'
);
assert.match(
  getRule(shortcutDialogCss, '.x-lumno-action-button:disabled'),
  /cursor:\s*not-allowed;/,
  'disabled dialog actions should use the not-allowed cursor by default'
);

assertCursorInheritanceWithoutHitSuppression(
  newtabHtml,
  'body[data-lumno-page="newtab"] button *,\n      body[data-lumno-page="newtab"] a[href] *,\n      body[data-lumno-page="newtab"] [role="button"] *,\n      body[data-lumno-page="newtab"] [role="menuitem"] *,\n      body[data-lumno-page="newtab"] [role="option"] *'
);
assertCursorInheritanceWithoutHitSuppression(
  optionsHtml,
  'button *,\n      a[href] *,\n      [role="button"] *,\n      [role="menuitem"] *,\n      [role="option"] *'
);
assertCursorInheritanceWithoutHitSuppression(
  onboardingHtml,
  'button *,\n      a[href] *,\n      [role="button"] *,\n      [role="menuitem"] *,\n      [role="option"] *'
);
assertCursorInheritanceWithoutHitSuppression(
  overlayShell,
  '#_x_extension_overlay_2024_unique_ button *,\n    #_x_extension_overlay_2024_unique_ a[href] *,\n    #_x_extension_overlay_2024_unique_ [role="button"] *,\n    #_x_extension_overlay_2024_unique_ [role="menuitem"] *,\n    #_x_extension_overlay_2024_unique_ [role="option"] *,\n    #_x_extension_overlay_2024_unique_ .x-ov-suggestion-item *'
);
assert.match(
  getRule(
    newtabHtml,
    'body[data-lumno-page="newtab"] button .ri-icon,\n      body[data-lumno-page="newtab"] a[href] .ri-icon,\n      body[data-lumno-page="newtab"] [role="button"] .ri-icon'
  ),
  /pointer-events:\s*none;/,
  'new-tab decorative icons should stay outside hit testing'
);
assert.match(
  getRule(
    optionsHtml,
    'button .ri-icon,\n      a[href] .ri-icon,\n      [role="button"] .ri-icon'
  ),
  /pointer-events:\s*none;/,
  'options decorative icons should stay outside hit testing'
);
assert.match(
  getRule(
    onboardingHtml,
    'button .ri-icon,\n      a[href] .ri-icon,\n      [role="button"] .ri-icon'
  ),
  /pointer-events:\s*none;/,
  'onboarding decorative icons should stay outside hit testing'
);
assert.match(
  getRule(
    overlayShell,
    '#_x_extension_overlay_2024_unique_ button .ri-icon,\n    #_x_extension_overlay_2024_unique_ a[href] .ri-icon,\n    #_x_extension_overlay_2024_unique_ [role="button"] .ri-icon,\n    #_x_extension_overlay_2024_unique_ .x-ov-suggestion-item .ri-icon'
  ),
  /pointer-events:\s*none;/,
  'overlay decorative icons should stay outside hit testing'
);
assert.match(
  getRule(newtabHtml, '.x-nt-shortcut-icon'),
  /cursor:\s*inherit;[\s\S]*pointer-events:\s*none;|pointer-events:\s*none;[\s\S]*cursor:\s*inherit;/,
  'animated shortcut visuals should not extend the pointer hit target'
);
assert.match(
  getRule(newtabHtml, '.x-nt-bookmark-card > :not(button)'),
  /cursor:\s*inherit;[\s\S]*pointer-events:\s*none;|pointer-events:\s*none;[\s\S]*cursor:\s*inherit;/,
  'bookmark-card visuals should not compete with the semantic card cursor'
);
assert.match(
  getRule(newtabHtml, '.x-nt-recent-card-visual'),
  /cursor:\s*inherit;[\s\S]*pointer-events:\s*none;|pointer-events:\s*none;[\s\S]*cursor:\s*inherit;/,
  'rotating recent-card visuals should not extend the pointer hit target'
);
assert.match(
  getRule(newtabHtml, '.x-nt-wallpaper-tile > :not(button)'),
  /cursor:\s*inherit;[\s\S]*pointer-events:\s*none;|pointer-events:\s*none;[\s\S]*cursor:\s*inherit;/,
  'wallpaper-tile visuals should not compete with the semantic tile cursor'
);
assert.doesNotMatch(
  newtabHtml,
  /\.x-nt-bookmarks-pager-btn:disabled\s*\{[^}]*pointer-events:\s*none;/,
  'disabled pager buttons must remain hit-testable so not-allowed can render'
);
assert.match(
  getRule(optionsHtml, '._x_extension_tabs_indicator_2024_unique_'),
  /pointer-events:\s*none;/,
  'options navigation indicator should not cover tab cursors'
);
assert.match(
  getRule(optionsHtml, '._x_extension_theme_indicator_2024_unique_'),
  /pointer-events:\s*none;/,
  'options segmented-control indicators should not cover button cursors'
);
assert.match(
  getRule(searchInputCss, '.x-lumno-search-input__right-icon *'),
  /cursor:\s*inherit;[\s\S]*pointer-events:\s*none;|pointer-events:\s*none;[\s\S]*cursor:\s*inherit;/,
  'search-input icons should inherit their owning button cursor'
);
assert.match(
  getRule(
    overlaySuggestionsCss,
    ':is(#_x_extension_overlay_2024_unique_, #_x_extension_onboarding_overlay_demo_2026_unique_) .x-ov-close-other-tabs .ri-icon'
  ),
  /cursor:\s*inherit;[\s\S]*pointer-events:\s*none;|pointer-events:\s*none;[\s\S]*cursor:\s*inherit;/,
  'overlay action icons should inherit their owning button cursor'
);
assert.match(
  getRule(
    newtabHtml,
    'body[data-lumno-page="newtab"] button:not(:disabled),\n      body[data-lumno-page="newtab"] a[href],\n      body[data-lumno-page="newtab"] [role="button"]:not([aria-disabled="true"]),\n      body[data-lumno-page="newtab"] [role="menuitem"]:not([aria-disabled="true"]),\n      body[data-lumno-page="newtab"] [role="option"]:not([aria-disabled="true"])'
  ),
  /cursor:\s*pointer;/,
  'the new-tab page pointer baseline should cover body-level React islands and exclude disabled controls'
);
assert.match(
  newtabHtml,
  /<body[^>]*data-lumno-page="newtab"/,
  'the new-tab page should expose a stable cursor-semantics scope outside the legacy React root'
);
assert.match(
  getRule(
    optionsHtml,
    'button:not(:disabled),\n      a[href],\n      [role="button"]:not([aria-disabled="true"]),\n      [role="menuitem"]:not([aria-disabled="true"]),\n      [role="option"]:not([aria-disabled="true"])'
  ),
  /cursor:\s*pointer;/,
  'options should apply the shared pointer baseline'
);
assert.match(
  getRule(
    onboardingHtml,
    'button:not(:disabled),\n      a[href],\n      [role="button"]:not([aria-disabled="true"]),\n      [role="menuitem"]:not([aria-disabled="true"]),\n      [role="option"]:not([aria-disabled="true"])'
  ),
  /cursor:\s*pointer;/,
  'onboarding should apply the shared pointer baseline'
);
assert.match(
  getRule(
    overlayShell,
    '#_x_extension_overlay_2024_unique_ button:not(:disabled),\n    #_x_extension_overlay_2024_unique_ a[href],\n    #_x_extension_overlay_2024_unique_ [role="button"]:not([aria-disabled="true"]),\n    #_x_extension_overlay_2024_unique_ [role="menuitem"]:not([aria-disabled="true"]),\n    #_x_extension_overlay_2024_unique_ [role="option"]:not([aria-disabled="true"])'
  ),
  /cursor:\s*pointer;/,
  'overlay should apply the shared pointer baseline'
);
assert.match(
  getRule(
    overlayShell,
    '#_x_extension_overlay_2024_unique_ button:disabled,\n    #_x_extension_overlay_2024_unique_ [role="button"][aria-disabled="true"],\n    #_x_extension_overlay_2024_unique_ [role="menuitem"][aria-disabled="true"],\n    #_x_extension_overlay_2024_unique_ [role="option"][aria-disabled="true"]'
  ),
  /cursor:\s*not-allowed;/,
  'overlay disabled controls should use not-allowed'
);
assert.match(
  getRule(
    overlayShell,
    '#_x_extension_overlay_2024_unique_ button[aria-busy="true"]:disabled,\n    #_x_extension_overlay_2024_unique_ [role="button"][aria-busy="true"]'
  ),
  /cursor:\s*progress;/,
  'overlay busy controls should use progress'
);

process.stdout.write('Interaction cursor stability tests passed.\n');
