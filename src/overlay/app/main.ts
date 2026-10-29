// Opens or closes the search overlay: makes the session's context and its
// features in order, leaves the page to a panel already open there, then
// mounts this session's panel and shows it.
import { createOverlayContext } from './context';
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
  createRevealFeature(ctx, { core, panel, suggestions, controls, mount });
}

export { toggleSearchOverlay };
