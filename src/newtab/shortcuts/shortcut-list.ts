// The shortcuts the page shows, in order, and their custom icon images by
// shortcut id. The shortcuts controller loads and saves them; a drag
// reorders the list while it previews a move.
import type { ShortcutItem } from '../../domain/shortcuts/types';
import type { ShortcutIconMap } from './shortcut-icon-store';

class ShortcutList {
  private list: ShortcutItem[] = [];
  private iconMap: ShortcutIconMap = {};

  get items(): ShortcutItem[] {
    return this.list;
  }

  get icons(): ShortcutIconMap {
    return this.iconMap;
  }

  replaceItems(items: ShortcutItem[]): void {
    this.list = items;
  }

  replaceIcons(icons: ShortcutIconMap): void {
    this.iconMap = icons;
  }
}

export { ShortcutList };
