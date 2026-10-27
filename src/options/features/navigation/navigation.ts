// Which settings tab is open. This is its one owner: it starts on the tab
// the link names ("#tab" or "#tab:target"), keeps the address in step, and
// remembers a target in the Search sources lists until they have drawn it.
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';
import { scrollToTarget } from '../../dom/scroll-to-target';
import { normalizeSettingsTabKey, type SettingsTabKey } from './tabs';

interface NavigationState {
  activeTab: SettingsTabKey;
}

interface NavigationDeps {
  win: Window;
  doc: Document;
  // Stops a running panel height animation, which belongs to the old tab.
  cancelPanelMotion(): void;
  // The Search sources tab reads its providers again whenever it opens.
  onSearchSourcesOpened(): void;
}

// The tab and target a link names, after the "#".
function readRoute(win: Window): { tabKey: string; targetKey: string } {
  const parts = win.location.hash.replace('#', '').trim().split(':').map((part) => part.trim()).filter(Boolean);
  return { tabKey: parts[0] || '', targetKey: parts.slice(1).join(':') };
}

class OptionsNavigation {
  readonly store: Store<NavigationState>;
  private readonly deps: NavigationDeps;
  // A target in the Search sources lists, scrolled to once they draw it.
  private pendingTarget = '';

  constructor(deps: NavigationDeps) {
    this.deps = deps;
    this.store = createStore<NavigationState>({ activeTab: normalizeSettingsTabKey(readRoute(deps.win).tabKey) });
  }

  // Opens the linked tab: a Labs row scrolls into view and flashes at once;
  // a Search sources row waits for its list.
  start(): void {
    const { tabKey, targetKey } = readRoute(this.deps.win);
    const tab = normalizeSettingsTabKey(tabKey);
    this.show(tab);
    if (tab === 'labs') {
      scrollToTarget(this.deps.doc, this.deps.win, targetKey, { behavior: 'auto', block: 'center', flash: true });
    }
    if (tab === 'shortcuts') {
      this.pendingTarget = targetKey;
      this.deps.onSearchSourcesOpened();
    }
  }

  // The reader's choice: a different tab starts at the top of the page.
  select(value: string): void {
    const tab = normalizeSettingsTabKey(value);
    const changed = tab !== this.store.getSnapshot().activeTab;
    this.show(tab);
    if (changed) {
      this.deps.win.scrollTo({ top: 0, behavior: 'auto' });
    }
    if (tab === 'shortcuts') {
      this.deps.onSearchSourcesOpened();
    }
  }

  scrollToPendingTarget(): void {
    if (this.pendingTarget && scrollToTarget(this.deps.doc, this.deps.win, this.pendingTarget, { behavior: 'auto' })) {
      this.pendingTarget = '';
    }
  }

  private show(tab: SettingsTabKey): void {
    this.deps.cancelPanelMotion();
    this.store.setState({ activeTab: tab });
    const hash = `#${tab}`;
    if (this.deps.win.location.hash !== hash) {
      this.deps.win.history.replaceState(null, '', hash);
    }
  }
}

export { OptionsNavigation };
export type { NavigationState };
