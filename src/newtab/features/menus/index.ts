// Acting on bookmarks and shortcuts: their context menus, the folder menu,
// folder colors, the bookmark bar's display, the shortcut tiles' lookups
// and the dock.
import type { PageContext } from '../../app/context';
import type { ShellFeature } from '../shell';
import type { StoresFeature } from '../stores';
import { createBookmarkMenusPart } from './bookmark-menus';
import { createShortcutMenusPart } from './shortcut-menus';

interface MenusFeatureDeps {
  shell: ShellFeature;
  stores: StoresFeature;
}

function createMenusFeature(ctx: PageContext, deps: MenusFeatureDeps) {
  const { shell, stores } = deps;
  const bookmarkMenus = createBookmarkMenusPart(ctx, { shell, bookmarkStore: stores, shortcutStore: stores, transfers: stores, navigation: shell });
  const shortcutMenus = createShortcutMenusPart(ctx, { shell, bookmarkStore: stores, shortcutStore: stores, navigation: shell, bookmarkMenus });
  return { ...bookmarkMenus, ...shortcutMenus };
}

type MenusFeature = ReturnType<typeof createMenusFeature>;

export { createMenusFeature };
export type { MenusFeature };
