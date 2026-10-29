// Where the page's results and cards come from: the search's state and
// actions with the site themes, and the recent sites.
import type { PageContext } from '../../app/context';
import type { ShellFeature } from '../shell';
import type { StoresFeature } from '../stores';
import { createSearchCorePart } from './search-core';
import { createRecentCorePart } from './recent-core';

interface SourcesFeatureDeps {
  shell: ShellFeature;
  stores: StoresFeature;
}

function createSourcesFeature(ctx: PageContext, deps: SourcesFeatureDeps) {
  const { shell, stores } = deps;
  const searchCore = createSearchCorePart(ctx, { shell, shortcutStore: stores, navigation: shell });
  const recentCore = createRecentCorePart(ctx, { shell, shortcutStore: stores, navigation: shell, searchCore });
  return { ...searchCore, ...recentCore };
}

type SourcesFeature = ReturnType<typeof createSourcesFeature>;

export { createSourcesFeature };
export type { SourcesFeature };
