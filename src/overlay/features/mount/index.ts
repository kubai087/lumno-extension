// The panel mounted into the page, then its input and what draws around it.
// Null when the panel cannot be mounted.
import type { OverlayContext } from '../../app/context';
import type { CoreFeature } from '../core';
import type { PanelFeature } from '../panel';
import type { SuggestionsFeature } from '../suggestions';
import type { ControlsFeature } from '../controls';
import { createPanelMountPart } from './panel-mount';
import { createInputPart } from './input';

interface MountFeatureDeps {
  core: CoreFeature;
  panel: PanelFeature;
  suggestions: SuggestionsFeature;
  controls: ControlsFeature;
}

function createMountFeature(ctx: OverlayContext, deps: MountFeatureDeps) {
  const panelMount = createPanelMountPart(ctx, deps);
  if (!panelMount) {
    return null;
  }
  const input = createInputPart(ctx, { ...deps, mount: panelMount });
  return { ...panelMount, ...input };
}

type MountFeature = NonNullable<ReturnType<typeof createMountFeature>>;

export { createMountFeature };
export type { MountFeature };
