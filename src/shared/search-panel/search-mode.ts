// The search the input runs: the web, a site search, a local scope or the
// open tabs; and the hints the typed text gives without a mode: the site
// search or scope Tab would switch to, and the site search or address
// Enter would run. This is their one owner; the modes, the keys and the
// results change them through its methods.
import type { LocalSearchScope } from '../../domain/search/types';
import { createStore } from '../state/store';
import type { Store } from '../state/store';

// The local scope the input is narrowed to: a typed trigger's, or one
// picked in the mode menu, which has only its source.
type ActiveLocalScope = Pick<LocalSearchScope, 'sourceType'> & Partial<Pick<LocalSearchScope, 'trigger' | 'key'>>;

// A typed trigger that would switch to a site search on Tab.
interface SiteSearchTrigger<Provider> {
  provider: Provider;
  rawInput: string;
}

// A typed trigger that would narrow search to one local source on Tab.
interface LocalSearchScopeTrigger {
  scope: LocalSearchScope;
  rawInput: string;
}

// The site search or address the typed text runs on Enter without a mode,
// shown as the first row.
interface InlineSearchState<Provider> {
  url?: string;
  provider?: Provider | null;
  query?: string;
  rawInput: string;
  // The list highlights it, so Enter runs it.
  isAuto?: boolean;
}

interface SearchModeState<Provider> {
  site: Provider | null;
  local: ActiveLocalScope | null;
  openTabs: boolean;
  siteTrigger: SiteSearchTrigger<Provider> | null;
  localTrigger: LocalSearchScopeTrigger | null;
  inline: InlineSearchState<Provider> | null;
}

class SearchMode<Provider> {
  readonly store: Store<SearchModeState<Provider>> = createStore<SearchModeState<Provider>>({
    site: null,
    local: null,
    openTabs: false,
    siteTrigger: null,
    localTrigger: null,
    inline: null
  });

  get site(): Provider | null {
    return this.store.getSnapshot().site;
  }

  get local(): ActiveLocalScope | null {
    return this.store.getSnapshot().local;
  }

  get openTabs(): boolean {
    return this.store.getSnapshot().openTabs;
  }

  get siteTrigger(): SiteSearchTrigger<Provider> | null {
    return this.store.getSnapshot().siteTrigger;
  }

  get localTrigger(): LocalSearchScopeTrigger | null {
    return this.store.getSnapshot().localTrigger;
  }

  get inline(): InlineSearchState<Provider> | null {
    return this.store.getSnapshot().inline;
  }

  enterSite(provider: Provider): void {
    this.store.setState({ site: provider, local: null, localTrigger: null, inline: null, openTabs: false });
  }

  // The site search changed under its mode (its catalog entry was edited).
  replaceSite(provider: Provider): void {
    this.store.setState({ site: provider });
  }

  leaveSite(): void {
    this.store.setState({ site: null, inline: null });
  }

  enterLocal(scope: ActiveLocalScope): void {
    this.store.setState({ local: scope, localTrigger: null, site: null, siteTrigger: null, inline: null, openTabs: false });
  }

  leaveLocal(): void {
    this.store.setState({ local: null, localTrigger: null, inline: null });
  }

  enterOpenTabs(): void {
    this.store.setState({ openTabs: true, site: null, local: null, siteTrigger: null, localTrigger: null, inline: null });
  }

  leaveOpenTabs(): void {
    this.store.setState({ openTabs: false });
  }

  // What the typed text offers: the row Enter runs and the trigger Tab
  // takes.
  setHints(inline: InlineSearchState<Provider> | null, siteTrigger: SiteSearchTrigger<Provider> | null,
    localTrigger: LocalSearchScopeTrigger | null): void {
    this.store.setState({ inline, siteTrigger, localTrigger });
  }

  setTriggers(siteTrigger: SiteSearchTrigger<Provider> | null, localTrigger: LocalSearchScopeTrigger | null): void {
    this.store.setState({ siteTrigger, localTrigger });
  }

  clearHints(): void {
    this.setHints(null, null, null);
  }
}

export { SearchMode };
export type { ActiveLocalScope, InlineSearchState, LocalSearchScopeTrigger, SearchModeState, SiteSearchTrigger };
