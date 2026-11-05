// Which icon a mode menu tile shows (a built-in line icon, a site icon or a
// glyph) and its colors. A site search's theme can come from its icon, so
// the surface caches provider themes and batches redraws as they arrive.
import { getModeLineIconPaths } from '../line-icons';
import { getModeMenuTileColors } from '../colors';
import type { ModeColorOptions } from '../colors';
import type { ControllerOptions } from '../mode-options';
import type { ModeMenuTileColors, ModeMenuTileIcon } from '../mode-menu-model';
import type { InputModeTheme, ModeMenuItem } from '../types';

type ModeMenuIconOptions = ModeColorOptions &
  Pick<ControllerOptions, 'getThemeForProvider' | 'resolveProviderIconUrl' | 'getProviderThemeHost'>;

function getLineIconName(item: ModeMenuItem): string {
  const name = item.menuIconName ? String(item.menuIconName).trim() : '';
  return getModeLineIconPaths(name) ? name : '';
}

class ModeMenuIcons {
  // Provider themes by item id, and the ids still being resolved.
  private providerThemes = new Map<string, InputModeTheme>();
  private pendingThemes = new Set<string>();
  // Themes kept on the tiles after a refresh until their new answer comes.
  private staleThemes = new Set<string>();
  // What each theme was resolved for: the provider and its icon.
  private providerKeys = new Map<string, string>();
  // Bumped to retire the answer still on its way for an item.
  private requestVersions = new Map<string, number>();
  private redrawPending = false;
  private disposed = false;
  private readonly options: ModeMenuIconOptions;
  // Called when a provider theme arrives, to draw the tiles again.
  private readonly onThemesChange: () => void;

  constructor(options: ModeMenuIconOptions, onThemesChange: () => void) {
    this.options = options;
    this.onThemesChange = onThemesChange;
  }

  // A refresh may change icon data or theme settings without changing the
  // provider, so every theme is asked for again. The tiles keep the ones
  // they have until the new answers come, instead of flashing the default.
  invalidate(): void {
    this.providerThemes.forEach((_theme, id) => this.staleThemes.add(id));
    this.pendingThemes.forEach((id) => this.retireRequest(id));
    this.pendingThemes.clear();
  }

  // Asks the surface for the themes of the providers not asked about yet.
  request(items: readonly ModeMenuItem[]): void {
    const resolveTheme = this.options.getThemeForProvider;
    if (!resolveTheme) {
      return;
    }
    const activeIds = new Set(items.filter((item) => item.provider).map((item) => item.id));
    this.providerKeys.forEach((_key, id) => {
      if (!activeIds.has(id)) {
        this.providerKeys.delete(id);
        this.forget(id);
      }
    });
    items.forEach((item) => {
      const provider = item.provider;
      if (!provider) {
        return;
      }
      const providerKey = JSON.stringify([provider, item.iconUrl]);
      if (this.providerKeys.get(item.id) !== providerKey) {
        this.providerKeys.set(item.id, providerKey);
        this.forget(item.id);
      }
      const current = this.providerThemes.has(item.id) && !this.staleThemes.has(item.id);
      if (current || this.pendingThemes.has(item.id)) {
        return;
      }
      this.pendingThemes.add(item.id);
      const requestVersion = this.retireRequest(item.id);
      const isCurrentRequest = () => this.requestVersions.get(item.id) === requestVersion;
      Promise.resolve(resolveTheme(provider)).then((theme: InputModeTheme | null | undefined) => {
        if (!isCurrentRequest()) {
          return;
        }
        this.pendingThemes.delete(item.id);
        this.staleThemes.delete(item.id);
        if (this.disposed) {
          return;
        }
        if (theme) {
          this.providerThemes.set(item.id, theme);
          this.scheduleRedraw();
        } else if (this.providerThemes.delete(item.id)) {
          this.scheduleRedraw();
        }
      }).catch(() => {
        if (isCurrentRequest()) {
          this.pendingThemes.delete(item.id);
        }
      });
    });
  }

  tileColors(item: ModeMenuItem): ModeMenuTileColors {
    const theme = this.providerThemes.get(item.id) || item.theme || this.options.defaultTheme;
    return getModeMenuTileColors(this.options, theme, item.menuIconName);
  }

  tileIcon(item: ModeMenuItem): ModeMenuTileIcon {
    const provider = item.provider || null;
    return {
      lineIcon: getLineIconName(item),
      glyphName: item.iconName || (item.isAi ? 'ri-search-ai-line' : 'ri-search-line'),
      iconUrl: item.iconUrl ? String(this.options.resolveProviderIconUrl(item.provider, item.iconUrl) || '').trim() : '',
      iconHost: provider ? String(this.options.getProviderThemeHost(provider) || '').trim() : ''
    };
  }

  dispose(): void {
    this.disposed = true;
  }

  // Drops an item's theme and retires the answer still on its way.
  private forget(id: string): void {
    this.providerThemes.delete(id);
    this.staleThemes.delete(id);
    this.pendingThemes.delete(id);
    this.retireRequest(id);
  }

  // Bumps the item's request version and returns the new one.
  private retireRequest(id: string): number {
    const version = (this.requestVersions.get(id) || 0) + 1;
    this.requestVersions.set(id, version);
    return version;
  }

  // Themes that arrive together redraw the tiles once.
  private scheduleRedraw(): void {
    if (this.redrawPending) {
      return;
    }
    this.redrawPending = true;
    queueMicrotask(() => {
      this.redrawPending = false;
      if (!this.disposed) {
        this.onThemesChange();
      }
    });
  }
}

export type { ModeMenuIconOptions };
export { ModeMenuIcons };
