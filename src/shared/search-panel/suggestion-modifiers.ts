// The keys held down that change where a result opens: Alt opens it in
// this tab, Shift opens a switch-to-tab row in a new tab, Ctrl/Cmd opens
// it in the background (unless Ctrl/Cmd+number opens rows at once). The
// rows show the action these keys pick; this is their one owner.
import { numberShortcutInstantEnabled } from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';
import { createStore } from '../state/store';
import type { Store } from '../state/store';

interface SuggestionModifierState {
  openInCurrentTab: boolean;
  openSwitchInNewTab: boolean;
  openInBackgroundTab: boolean;
}

type ModifierEvent = Pick<KeyboardEvent, 'altKey' | 'shiftKey' | 'metaKey' | 'ctrlKey'>;

class SuggestionModifiers {
  readonly store: Store<SuggestionModifierState> = createStore<SuggestionModifierState>({
    openInCurrentTab: false,
    openSwitchInNewTab: false,
    openInBackgroundTab: false
  });
  private readonly settings: Pick<SettingsStore, 'get'>;

  constructor(settings: Pick<SettingsStore, 'get'>) {
    this.settings = settings;
  }

  readonly set = (openInCurrentTab: boolean, openSwitchInNewTab: boolean, openInBackgroundTab: boolean): void => {
    const state = this.store.getSnapshot();
    if (state.openInCurrentTab === Boolean(openInCurrentTab) &&
        state.openSwitchInNewTab === Boolean(openSwitchInNewTab) &&
        state.openInBackgroundTab === Boolean(openInBackgroundTab)) {
      return;
    }
    this.store.setState({
      openInCurrentTab: Boolean(openInCurrentTab),
      openSwitchInNewTab: Boolean(openSwitchInNewTab),
      openInBackgroundTab: Boolean(openInBackgroundTab)
    });
  };

  readonly syncFromEvent = (event: ModifierEvent | null | undefined): void => {
    this.set(
      Boolean(event && event.altKey),
      Boolean(event && event.shiftKey),
      Boolean(event && (event.metaKey || event.ctrlKey) && !this.settings.get(numberShortcutInstantEnabled))
    );
  };
}

export { SuggestionModifiers };
export type { SuggestionModifierState };
