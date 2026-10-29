// Whether the page's first wallpaper is on screen, and a promise that
// settles then. Start-up waits on it before the effect and the tones.
import { readBootValue } from '../../../platform/boot-handoff';

class InitialWallpaper {
  readonly ready: Promise<void>;
  private appliedFlag = false;
  private resolveReady: () => void = () => {};

  constructor() {
    this.ready = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
  }

  get applied(): boolean {
    return this.appliedFlag;
  }

  finish(): void {
    if (this.appliedFlag) {
      return;
    }
    this.appliedFlag = true;
    // The first sample has taken the preload's decoded image if it showed the same wallpaper.
    const wallpaperPreload = readBootValue('wallpaperPreload');
    if (wallpaperPreload && wallpaperPreload.decodedImage) {
      wallpaperPreload.decodedImage = null;
    }
    this.resolveReady();
  }
}

export { InitialWallpaper };
