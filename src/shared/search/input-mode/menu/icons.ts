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
  private providerKeys = new Map<string, string>();
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

  // A host refresh may change icon data or theme settings without changing
  // the provider itself. Retire pending answers as well as cached colors.
  invalidate(): void {
    this.providerThemes.clear();
    this.pendingThemes.clear();
    this.providerKeys.clear();
    this.requestVersions.forEach((version, id) => this.requestVersions.set(id, version + 1));
  }

  // Asks the surface for the themes of the providers not asked about yet.
  request(items: readonly ModeMenuItem[]): void {
    const resolveTheme = this.options.getThemeForProvider;
    if (!resolveTheme) {
      return;
    }
    const themes = this.providerThemes;
    const pending = this.pendingThemes;
    const activeIds = new Set(items.filter((item) => item.provider).map((item) => item.id));
    this.providerKeys.forEach((_key, id) => {
      if (!activeIds.has(id)) {
        this.providerKeys.delete(id);
        themes.delete(id);
        pending.delete(id);
        this.requestVersions.set(id, (this.requestVersions.get(id) || 0) + 1);
      }
    });
    items.forEach((item) => {
      const provider = item.provider;
      const providerKey = JSON.stringify([provider, item.iconUrl]);
      if (provider && this.providerKeys.get(item.id) !== providerKey) {
        this.providerKeys.set(item.id, providerKey);
        themes.delete(item.id);
        pending.delete(item.id);
      }
      if (!provider || themes.has(item.id) || pending.has(item.id)) {
        return;
      }
      pending.add(item.id);
      const requestVersion = (this.requestVersions.get(item.id) || 0) + 1;
      this.requestVersions.set(item.id, requestVersion);
      Promise.resolve(resolveTheme(provider)).then((theme: InputModeTheme | null | undefined) => {
        if (this.requestVersions.get(item.id) !== requestVersion) return;
        pending.delete(item.id);
        if (this.disposed || !theme) {
          return;
        }
        themes.set(item.id, theme);
        if (!this.redrawPending) {
          this.redrawPending = true;
          queueMicrotask(() => {
            this.redrawPending = false;
            if (!this.disposed) this.onThemesChange();
          });
        }
      }).catch(() => {
        if (this.requestVersions.get(item.id) === requestVersion) pending.delete(item.id);
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
}

export type { ModeMenuIconOptions };
export { ModeMenuIcons };
