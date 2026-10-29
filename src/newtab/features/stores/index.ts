// The page's data: the bookmarks and the shortcuts with what keeps them,
// and the moves between them with their undo.
import type { PageContext } from '../../app/context';
import type { ShellFeature } from '../shell';
import { createBookmarkStorePart } from './bookmark-store';
import { createShortcutStorePart } from './shortcut-store';
import { createTransfersPart } from './transfers';

interface StoresFeatureDeps {
  shell: ShellFeature;
}

function createStoresFeature(ctx: PageContext, deps: StoresFeatureDeps) {
  const { shell } = deps;
  const bookmarkStore = createBookmarkStorePart(ctx);
  const shortcutStore = createShortcutStorePart(ctx, { shell, bookmarkStore });
  const transfers = createTransfersPart(ctx, { shell, bookmarkStore, shortcutStore });
  return { ...bookmarkStore, ...shortcutStore, ...transfers };
}

type StoresFeature = ReturnType<typeof createStoresFeature>;

export { createStoresFeature };
export type { StoresFeature };
