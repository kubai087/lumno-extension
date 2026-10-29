// The wallpaper chosen per color mode: the synced prefs, this device's
// overrides, the mode the panel edits while the modes differ, the wallpaper
// on screen, and whether the stored choice has been read. Each change to the
// stored choice gets a token; a read of storage started before a later
// change does not apply.
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';
import { NEWTAB_WALLPAPER_MODE_LIGHT } from '../wallpaper-options';
import type { LocalWallpaperOverrides, WallpaperMode, WallpaperPrefs } from './wallpaper-runtime-types';

interface WallpaperChoiceState {
  // Null until the stored choice or the defaults are in.
  prefs: WallpaperPrefs | null;
  overrides: LocalWallpaperOverrides | null;
  editMode: WallpaperMode;
  // The wallpaper on screen, or '' for none.
  shownId: string;
  loaded: boolean;
}

class WallpaperChoice {
  readonly store: Store<WallpaperChoiceState> = createStore<WallpaperChoiceState>({
    prefs: null,
    overrides: null,
    editMode: NEWTAB_WALLPAPER_MODE_LIGHT,
    shownId: '',
    loaded: false
  });
  private storageChangeSeq = 0;

  get state(): WallpaperChoiceState {
    return this.store.getSnapshot();
  }

  setPrefs(prefs: WallpaperPrefs, overrides: LocalWallpaperOverrides, editMode: WallpaperMode = this.state.editMode): void {
    this.store.setState({ prefs, overrides, editMode });
  }

  setEditMode(editMode: WallpaperMode): void {
    this.store.setState({ editMode });
  }

  setShownId(shownId: string): void {
    this.store.setState({ shownId });
  }

  markLoaded(): void {
    this.store.setState({ loaded: true });
  }

  // Starts a change to the stored choice; returns its token.
  beginStorageChange(): number {
    this.storageChangeSeq += 1;
    return this.storageChangeSeq;
  }

  // The token of the latest change, for a read that must not outlive it.
  get storageChange(): number {
    return this.storageChangeSeq;
  }

  isLatestStorageChange(seq: number): boolean {
    return seq === this.storageChangeSeq;
  }
}

export { WallpaperChoice };
export type { WallpaperChoiceState };
