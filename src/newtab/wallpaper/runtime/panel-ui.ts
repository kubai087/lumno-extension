// What the appearance panel shows besides the settings it edits: whether it
// is open, the wallpaper source tab, the link form and an import under way,
// the online wallpaper whose menu is open, and the theme options' labels
// while they slide to another scope. The panel draws again on each change.
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';
import type { ThemeScope, WallpaperSourceTab } from '../../react/wallpaper-panel/panel-model';
import type { AppearanceMode } from './wallpaper-runtime-types';

interface PanelUiState {
  open: boolean;
  tab: WallpaperSourceTab;
  // A file or link is being imported.
  importing: boolean;
  urlFormOpen: boolean;
  urlInvalid: boolean;
  // Bumped when a link is saved, so the view clears the field for the next one.
  urlClearToken: number;
  // The online wallpaper whose context menu is open, or ''.
  onlineMenuId: string;
  // While the theme options slide to another scope: the scope the tabs
  // already show, and the labels the options keep until they swap.
  pendingThemeScope: ThemeScope | null;
  heldModeLabels: Record<AppearanceMode, string> | null;
}

class WallpaperPanelUi {
  readonly store: Store<PanelUiState> = createStore<PanelUiState>({
    open: false,
    tab: 'built-in',
    importing: false,
    urlFormOpen: false,
    urlInvalid: false,
    urlClearToken: 0,
    onlineMenuId: '',
    pendingThemeScope: null,
    heldModeLabels: null
  });

  get state(): PanelUiState {
    return this.store.getSnapshot();
  }

  setOpen(open: boolean): void {
    this.store.setState({ open });
  }

  setTab(tab: WallpaperSourceTab): void {
    this.store.setState({ tab });
  }

  setImporting(importing: boolean): void {
    this.store.setState({ importing });
  }

  // Opening or closing the link form clears its error.
  setUrlFormOpen(urlFormOpen: boolean): void {
    this.store.setState({ urlFormOpen, urlInvalid: false });
  }

  setUrlInvalid(urlInvalid: boolean): void {
    this.store.setState({ urlInvalid });
  }

  clearUrl(): void {
    this.store.setState((state) => ({ urlClearToken: state.urlClearToken + 1 }));
  }

  setOnlineMenuId(onlineMenuId: string): void {
    this.store.setState({ onlineMenuId });
  }

  holdModeLabels(heldModeLabels: Record<AppearanceMode, string>, pendingThemeScope: ThemeScope): void {
    this.store.setState({ heldModeLabels, pendingThemeScope });
  }

  releaseModeLabels(): void {
    this.store.setState({ heldModeLabels: null, pendingThemeScope: null });
  }
}

export { WallpaperPanelUi };
export type { PanelUiState };
