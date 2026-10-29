// The appearance panel's React view once it is mounted, and the elements of
// it the runtime measures, focuses and samples. Until then there is none,
// and whatever would draw into it waits.
import type { WallpaperViewController } from '../../react/wallpaper-view';

class WallpaperPanelView {
  private mounted: WallpaperViewController | null = null;

  get controller(): WallpaperViewController | null {
    return this.mounted;
  }

  get control(): HTMLDivElement | null {
    return this.mounted ? this.mounted.control : null;
  }

  get button(): HTMLButtonElement | null {
    return this.mounted ? this.mounted.button : null;
  }

  get panel(): HTMLDivElement | null {
    return this.mounted ? this.mounted.panel : null;
  }

  mount(controller: WallpaperViewController): void {
    this.mounted = controller;
  }

  focus(name: string): void {
    if (this.mounted) {
      this.mounted.focus(name);
    }
  }

  getRefs(): Readonly<Partial<Record<string, HTMLElement>>> {
    return this.mounted ? this.mounted.getRefs() : {};
  }
}

export { WallpaperPanelView };
