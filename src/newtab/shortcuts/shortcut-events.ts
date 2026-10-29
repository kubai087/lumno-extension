// What the shortcut tiles and the dialog follow: the shortcuts or their
// groups changed, something else the tiles show changed, a save could not
// store a shortcut's own icon image, or the context menu marks what it is
// open for (null clears the mark).
import { createEventBus } from '../../shared/state/events';
import type { ShortcutContextMenuMark } from '../react/shortcuts';

interface ShortcutEvents {
  // `animateLayout` slides the tiles to their new places.
  changed: { animateLayout: boolean };
  stale: null;
  iconSaveFailed: null;
  menuMarked: { mark: ShortcutContextMenuMark | null };
}

const shortcutEvents = createEventBus<ShortcutEvents>();

export { shortcutEvents };
