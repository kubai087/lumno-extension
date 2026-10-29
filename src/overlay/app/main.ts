// Opens or closes the search overlay: makes the session's context and its
// features in order, leaves the page to a panel already open there, then
// mounts this session's panel and runs its startup.
import { createOverlayContext } from './context';
import { runOverlayStartup } from './startup';
import { createCoreFeature } from '../features/core';
import { createPanelFeature } from '../features/panel';
import { createSuggestionsFeature } from '../features/suggestions';
import { createControlsFeature } from '../features/controls';
import { createMountFeature } from '../features/mount';
import { createRevealFeature } from '../features/reveal';

// The window's tabs and the context the overlay was opened with are both
// read as untrusted.
function toggleSearchOverlay(requestedTabs: unknown, openContext: unknown): void {
  const ctx = createOverlayContext(requestedTabs, openContext);
  const core = createCoreFeature(ctx);
  const panel = createPanelFeature(ctx, { core });
  const suggestions = createSuggestionsFeature(ctx, { core, panel });
  const controls = createControlsFeature(ctx, { core, panel, suggestions });
  if (!panel.claimPage()) {
    return;
  }
  // No overlay is open here (an open one has closed, a stale one is being
  // replaced): create it.
  const mount = createMountFeature(ctx, { core, panel, suggestions, controls });
  if (!mount) {
    return;
  }
  const reveal = createRevealFeature(ctx, { core, panel, suggestions, controls, mount });
  void runOverlayStartup({
    settingsLoaded: ctx.settings.loaded,
    languageReady: mount.initialLanguageReady,
    styleGate: mount.overlayRevealGate.waitUntilReady(),
    settingsApplied: mount.settingsApplied,
    placeInitialInput: reveal.placeInitialInput,
    showOpenTabs: suggestions.requestTabsAndRender,
    reveal: reveal.revealPanel
  });
}

export { toggleSearchOverlay };
