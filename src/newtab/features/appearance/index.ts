// How the page looks: its theme, layout, the content above the search box,
// and the wallpaper with the page's entry.
import type { PageContext } from '../../app/context';
import type { ShellFeature } from '../shell';
import type { StoresFeature } from '../stores';
import type { SourcesFeature } from '../sources';
import type { MenusFeature } from '../menus';
import { createThemePart } from './theme';
import { createLayoutPart } from './layout';
import { createTopContentPart } from './top-content';
import { createWallpaperPart } from './wallpaper';

interface AppearanceFeatureDeps {
  shell: ShellFeature;
  stores: StoresFeature;
  sources: SourcesFeature;
  menus: MenusFeature;
}

function createAppearanceFeature(ctx: PageContext, deps: AppearanceFeatureDeps) {
  const { shell, stores, sources, menus } = deps;
  const theme = createThemePart(ctx, { shell, bookmarkStore: stores, navigation: shell, bookmarkMenus: menus, searchCore: sources, recentCore: sources });
  const layout = createLayoutPart(ctx, { shell, bookmarkStore: stores, shortcutStore: stores, shortcutMenus: menus, recentCore: sources });
  const topContent = createTopContentPart(ctx, { shell, navigation: shell, recentCore: sources, layout });
  const wallpaper = createWallpaperPart(ctx, { shell, bookmarkStore: stores, shortcutStore: stores, navigation: shell, bookmarkMenus: menus, theme, layout, topContent });
  return { ...theme, ...layout, ...topContent, ...wallpaper };
}

type AppearanceFeature = ReturnType<typeof createAppearanceFeature>;

export { createAppearanceFeature };
export type { AppearanceFeature };
