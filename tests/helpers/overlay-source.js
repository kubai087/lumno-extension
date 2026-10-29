const fs = require('fs');
const path = require('path');
const { withoutExports } = require('./closure-source');

const repoRoot = path.resolve(__dirname, '..', '..');
// The parts of the overlay panel split out into src/overlay/panel/, then
// search-panel.ts, in the order the overlay injection list loads them.
const OVERLAY_PANEL_FILES = [
  'src/overlay/panel/entry-motion.ts',
  'src/overlay/panel/panel-language.ts',
  'src/shared/search-panel/default-engine.ts',
  'src/shared/search-panel/site-search/catalog.ts',
  'src/overlay/panel/panel-session.ts',
  'src/overlay/panel/favicon-policy.ts',
  'src/overlay/panel/page-guards.ts',
  'src/overlay/panel/results-layout.ts',
  'src/overlay/panel/slash-commands.ts',
  'src/overlay/panel/panel-theme.ts',
  'src/overlay/panel/suggestion-themes.ts',
  'src/shared/search-panel/result-activation.ts',
  'src/overlay/panel/result-activation.ts',
  'src/overlay/panel/tab-matching.ts',
  'src/shared/search-panel/autocomplete.ts',
  'src/shared/search-panel/search-query.ts',
  'src/overlay/panel/site-search-providers.ts',
  'src/overlay/panel/search-mode-menu.ts',
  'src/overlay/panel/search-modes.ts',
  'src/overlay/panel/search-input-events.ts',
  'src/overlay/panel/panel-keys.ts',
  'src/overlay/panel/suggestions-render.ts',
  'src/overlay/panel/suggestion-sources.ts',
  'src/overlay/panel/remote-suggestions.ts',
  'src/overlay/panel/copy-actions.ts',
  'src/overlay/panel/panel-notices.ts',
  'src/overlay/panel/settings-sync.ts',
  'src/overlay/search-panel.ts'
];

// The panel source for source checks and extracted functions. The parts
// share panel state as properties of one `overlayState` object; that prefix
// is dropped so checks see the code as it read inside the single panel
// closure.
function readOverlayPanelSource() {
  return withoutExports(OVERLAY_PANEL_FILES
    .map((file) => fs.readFileSync(path.join(repoRoot, file), 'utf8'))
    .join('\n'))
    .replace(/\boverlayState\./g, '');
}

module.exports = { OVERLAY_PANEL_FILES, readOverlayPanelSource };
