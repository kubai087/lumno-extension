// What the shortcut tiles and the dialog follow: the shortcuts or their
// groups changed, something else the tiles show changed, or a save could
// not store a shortcut's own icon image.
import { createEventBus } from '../../shared/state/events';

interface ShortcutEvents {
  // `animateLayout` slides the tiles to their new places.
  changed: { animateLayout: boolean };
  stale: null;
  iconSaveFailed: null;
}

const shortcutEvents = createEventBus<ShortcutEvents>();

export { shortcutEvents };
