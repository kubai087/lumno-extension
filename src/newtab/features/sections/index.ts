// The bookmark and recent sections: their headers and pager, the shortcut
// tiles and the drags across the page, and the sections' views and data.
import type { PageContext } from '../../app/context';
import type { ShellFeature } from '../shell';
import type { StoresFeature } from '../stores';
import type { SourcesFeature } from '../sources';
import type { MenusFeature } from '../menus';
import type { AppearanceFeature } from '../appearance';
import { createHeadersPart } from './headers';
import { createDragsPart } from './drags';
import { createSectionViewsPart } from './section-views';

interface SectionsFeatureDeps {
  shell: ShellFeature;
  stores: StoresFeature;
  sources: SourcesFeature;
  menus: MenusFeature;
  appearance: AppearanceFeature;
}

function createSectionsFeature(ctx: PageContext, deps: SectionsFeatureDeps) {
  const { shell, stores, sources, menus, appearance } = deps;
  const sections = createHeadersPart(ctx, { shell, bookmarkStore: stores, bookmarkMenus: menus, layout: appearance });
  const drags = createDragsPart(ctx, { shell, bookmarkStore: stores, shortcutStore: stores, transfers: stores, navigation: shell, bookmarkMenus: menus, shortcutMenus: menus, searchCore: sources, recentCore: sources, theme: appearance, layout: appearance, sections });
  const sectionViews = createSectionViewsPart(ctx, { shell, bookmarkStore: stores, shortcutStore: stores, navigation: shell, bookmarkMenus: menus, searchCore: sources, recentCore: sources, theme: appearance, layout: appearance, topContent: appearance, sections, drags });
  return { ...sections, ...drags, ...sectionViews };
}

type SectionsFeature = ReturnType<typeof createSectionsFeature>;

export { createSectionsFeature };
export type { SectionsFeature };
