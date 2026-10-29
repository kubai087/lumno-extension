// Firefox's website appearance setting (the color scheme pages see), read
// and switched through the background for the /appearance command. Other
// browsers have none: it stays unsupported there.
import type { WebAppearanceMode } from '../../domain/messages';
import * as LumnoMessaging from '../../platform/messaging';
import { createEventBus } from '../../shared/state/events';

interface WebAppearanceState {
  supported: boolean;
  mode: WebAppearanceMode;
}

function isWebAppearanceMode(value: unknown): value is WebAppearanceMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}

class WebAppearance {
  private current: WebAppearanceState = { supported: false, mode: 'auto' };
  // `changed`: the mode shown changed, or the setting turned out to exist.
  readonly events = createEventBus<{ changed: null }>();

  get state(): WebAppearanceState {
    return this.current;
  }

  load(): void {
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.sendMessage !== 'function') {
      return;
    }
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'getWebAppearance' }, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      this.accept(response);
    });
  }

  // Takes the mode a suggestion carries; anything else is ignored.
  set(mode: unknown): void {
    if (!isWebAppearanceMode(mode)) {
      return;
    }
    // Show the choice at once; the reply carries what Firefox kept.
    this.current = { ...this.current, mode };
    this.events.emit('changed', null);
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'setWebAppearance', mode }, (response) => {
      if (!chrome.runtime.lastError && response && typeof response.mode === 'string') {
        this.accept(response);
        return;
      }
      this.load();
    });
  }

  private accept(response: { supported?: boolean; mode?: WebAppearanceMode } | undefined): void {
    if (!response || response.supported === false || typeof response.mode !== 'string') {
      return;
    }
    this.current = { supported: true, mode: response.mode };
    this.events.emit('changed', null);
  }
}

export { WebAppearance };
