// Tells the shortcut tiles to draw again because something they show changed.
import { createEventBus } from '../../shared/state/events';

interface ShortcutEvents {
  stale: null;
}

const shortcutEvents = createEventBus<ShortcutEvents>();

export { shortcutEvents };
