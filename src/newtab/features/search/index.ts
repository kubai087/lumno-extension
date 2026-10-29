// The search box and the page around it: the box and its suggestions,
// the page's window follows and keys, and putting the page together.
import type { PageContext } from '../../app/context';
import type { ShellFeature } from '../shell';
import type { StoresFeature } from '../stores';
import type { SourcesFeature } from '../sources';
import type { MenusFeature } from '../menus';
import type { AppearanceFeature } from '../appearance';
import type { SectionsFeature } from '../sections';
import { createSearchUiPart } from './search-ui';
import { createPagePart } from './page';
import { createMountPart } from './mount';

interface SearchFeatureDeps {
  shell: ShellFeature;
  stores: StoresFeature;
  sources: SourcesFeature;
  menus: MenusFeature;
  appearance: AppearanceFeature;
  sections: SectionsFeature;
}

function createSearchFeature(ctx: PageContext, deps: SearchFeatureDeps) {
  const { shell, stores, sources, menus, appearance, sections } = deps;
  const searchUi = createSearchUiPart(ctx, { shell, bookmarkStore: stores, shortcutStore: stores, navigation: shell, bookmarkMenus: menus, shortcutMenus: menus, searchCore: sources, recentCore: sources, theme: appearance, layout: appearance, topContent: appearance, wallpaper: appearance, sectionViews: sections });
  const page = createPagePart(ctx, { shell, bookmarkStore: stores, transfers: stores, bookmarkMenus: menus, searchCore: sources, recentCore: sources, theme: appearance, layout: appearance, topContent: appearance, sections, drags: sections, sectionViews: sections, searchUi });
  const mount = createMountPart(ctx, { shell, bookmarkStore: stores, navigation: shell, bookmarkMenus: menus, theme: appearance, topContent: appearance, wallpaper: appearance, drags: sections, sectionViews: sections, searchUi });
  return { ...searchUi, ...page, ...mount };
}

type SearchFeature = ReturnType<typeof createSearchFeature>;

export { createSearchFeature };
export type { SearchFeature };
