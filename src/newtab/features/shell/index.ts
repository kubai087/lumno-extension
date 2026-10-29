// What every feature leans on: the page's shared services (the search
// box's parts, the applied theme, favicon caches and policy, the drags and
// the undo lock, site names, select menus, tooltips and toasts) and where
// the page navigates.
import type { PageContext } from '../../app/context';
import { createServicesPart } from './services';
import { createNavigationPart } from './navigation';

function createShellFeature(ctx: PageContext) {
  const shell = createServicesPart(ctx);
  const navigation = createNavigationPart(ctx, { shell });
  return { ...shell, ...navigation };
}

type ShellFeature = ReturnType<typeof createShellFeature>;

export { createShellFeature };
export type { ShellFeature };
