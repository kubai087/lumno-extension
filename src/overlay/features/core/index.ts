// The session's holders and guards, then the search's owners over them.
import type { OverlayContext } from '../../app/context';
import { createSessionPart } from './session';
import { createSearchPart } from './search';

function createCoreFeature(ctx: OverlayContext) {
  const session = createSessionPart(ctx);
  const search = createSearchPart(ctx, { session });
  return { ...session, ...search };
}

type CoreFeature = ReturnType<typeof createCoreFeature>;

export { createCoreFeature };
export type { CoreFeature };
