// The keys held down that change where a result opens: Shift flips it
// between this tab and a new one and opens a switch-to-tab row in a new
// tab, Option/Alt opens it in a split view, Ctrl/Cmd opens it in the
// background (unless Ctrl/Cmd+number opens rows at once). The rows show the
// action these keys pick; this is their one owner.
import { numberShortcutInstantEnabled } from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';
import { createStore } from '../state/store';
import type { Store } from '../state/store';

interface SuggestionModifierState {
  openInCurrentTab: boolean;
  openSwitchInNewTab: boolean;
  openInBackgroundTab: boolean;
  openInSplitView: boolean;
}

type ModifierEvent = Pick<KeyboardEvent, 'altKey' | 'shiftKey' | 'metaKey' | 'ctrlKey'>;

class SuggestionModifiers {
  readonly store: Store<SuggestionModifierState> = createStore<SuggestionModifierState>({
    openInCurrentTab: false,
    openSwitchInNewTab: false,
    openInBackgroundTab: false,
    openInSplitView: false
  });
  private readonly settings: Pick<SettingsStore, 'get'>;

  constructor(settings: Pick<SettingsStore, 'get'>) {
    this.settings = settings;
  }

  readonly set = (
    openInCurrentTab: boolean,
    openSwitchInNewTab: boolean,
    openInBackgroundTab: boolean,
    openInSplitView = false
  ): void => {
    const state = this.store.getSnapshot();
    if (state.openInCurrentTab === Boolean(openInCurrentTab) &&
        state.openSwitchInNewTab === Boolean(openSwitchInNewTab) &&
        state.openInBackgroundTab === Boolean(openInBackgroundTab) &&
        state.openInSplitView === Boolean(openInSplitView)) {
      return;
    }
    this.store.setState({
      openInCurrentTab: Boolean(openInCurrentTab),
      openSwitchInNewTab: Boolean(openSwitchInNewTab),
      openInBackgroundTab: Boolean(openInBackgroundTab),
      openInSplitView: Boolean(openInSplitView)
    });
  };

  readonly syncFromEvent = (event: ModifierEvent | null | undefined): void => {
    this.set(
      Boolean(event && event.shiftKey),
      Boolean(event && event.shiftKey),
      Boolean(event && (event.metaKey || event.ctrlKey) && !this.settings.get(numberShortcutInstantEnabled)),
      Boolean(event && event.altKey)
    );
  };
}

export { SuggestionModifiers };
export type { SuggestionModifierState };
