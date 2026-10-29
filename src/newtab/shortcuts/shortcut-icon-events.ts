// Tells the shortcut tiles that a page's icon snapshot was saved, so a tile
// that drew before it arrived reads its tint again from the icon it now shows.
import { createEventBus } from '../../shared/state/events';

interface ShortcutIconEvents {
  // `pageUrl` is normalized as the snapshot cache keys it.
  snapshotSaved: { pageUrl: string };
}

const shortcutIconEvents = createEventBus<ShortcutIconEvents>();

export { shortcutIconEvents };
