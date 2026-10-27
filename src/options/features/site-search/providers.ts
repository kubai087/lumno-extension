// The site search providers Options lists and edits: the bundled built-ins,
// the person's custom providers, and the keys of built-ins they turned off.
// This is their one owner. It reads them from storage, follows storage
// changes, and saves the edits the lists and the add form ask for; the
// lists, the aggregate searches and the help links follow its store.
import { readSiteSearchProviders } from '../../../domain/search/site-search-provider-reader';
import type { SiteSearchProvider } from '../../../domain/search/types';
import * as SearchSiteSearchProviders from '../../../domain/search/utils/site-search-providers';
import { siteSearchCustom, siteSearchDisabled } from '../../../domain/settings/search';
import * as LumnoMessaging from '../../../platform/messaging';
import { readStoredSetting } from '../../../platform/settings-store';
import type { SettingsStore } from '../../../platform/settings-store';
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';
import {
  createOperationQueue,
  createSiteSearchModel,
  createSiteSearchProviderRefreshCoordinator,
  createSnapshotPersister,
  getActiveBuiltinSiteSearchProviders,
  getSiteSearchBuiltinKey
} from '../../options-site-search';
import type {
  PreparedSiteSearchProviders,
  SiteSearchDraft,
  SiteSearchProviderSnapshot
} from '../../options-site-search';
import { createPersistentId } from '../../persistent-id';

interface SiteSearchProvidersState {
  defaults: SiteSearchProvider[];
  custom: SiteSearchProvider[];
  disabledKeys: ReadonlySet<string>;
  // The stored providers have been read at least once.
  loaded: boolean;
  // Every custom provider has its stored id. Not while a refresh may still
  // give one an id, so aggregate searches do not lose their references.
  customIdsReady: boolean;
}

// A save that failed names a locale message key; saveFailed when storage
// refused the write rather than the draft being invalid.
type EditOutcome = { ok: true } | { ok: false; error: string; saveFailed?: boolean };

// Whether a provider's trigger key is taken, ignoring the one being edited.
type KeyConflictCheck = (key: string, allowedKey: string) => boolean;

// A custom key the developer build adds to test duplicate handling.
const DEBUG_DUPLICATE_CUSTOM_KEY = 'dup';
// A save holds refreshes from storage back this long, so its own write
// does not redraw the list mid-animation.
const SAVE_REFRESH_PAUSE_MS = 260;

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function normalizeProviders(items: readonly SiteSearchProvider[]): SiteSearchProvider[] {
  return items.map((item) => SearchSiteSearchProviders.normalizeSiteSearchProvider(item)).filter(isPresent);
}

function normalizeKeys(keys: Iterable<string>): string[] {
  return Array.from(keys).map((item) => item.toLowerCase()).filter(Boolean);
}

// The built-ins still on and the custom providers, with the custom copy of
// a built-in in its place.
function getActiveProviders(state: SiteSearchProvidersState): SiteSearchProvider[] {
  return [
    ...getActiveBuiltinSiteSearchProviders(state.defaults, state.custom, state.disabledKeys),
    ...state.custom
  ];
}

// Whether the Help Center search (lm) is on; null until the providers load,
// so nothing claims it before it is known.
function isHelpCenterSearchEnabled(state: SiteSearchProvidersState): boolean | null {
  if (!state.loaded) {
    return null;
  }
  return getActiveProviders(state).some((item) => SearchSiteSearchProviders.isHelpCenterSiteSearchProvider(item));
}

// The providers an aggregate search can include: built-ins that are on and
// custom providers with an id to refer to them by.
function getAggregateSearchProviders(state: SiteSearchProvidersState): SiteSearchProvider[] {
  const activeDefaults = state.defaults.filter((item) => {
    const key = item.key.trim().toLowerCase();
    return Boolean(key) && !state.disabledKeys.has(key);
  });
  const custom = state.customIdsReady
    ? state.custom
    : state.custom.filter((item) => String(item.id || '').trim());
  return SearchSiteSearchProviders.mergeCustomProviders(activeDefaults, custom);
}

class SiteSearchProviders {
  readonly store: Store<SiteSearchProvidersState>;
  private readonly settingsStore: SettingsStore;
  private readonly onLoadError: (error: unknown) => void;
  private readonly model = createSiteSearchModel();
  // Every write runs after the ones before it.
  private readonly enqueue = createOperationQueue();
  private readonly coordinator: ReturnType<typeof createSiteSearchProviderRefreshCoordinator<
    SiteSearchProviderSnapshot,
    PreparedSiteSearchProviders
  >>;
  private refreshPausedUntil = 0;
  private refreshTimer = 0;

  constructor(settingsStore: SettingsStore, onLoadError: (error: unknown) => void) {
    this.settingsStore = settingsStore;
    this.onLoadError = onLoadError;
    this.store = createStore<SiteSearchProvidersState>({
      defaults: [],
      custom: [],
      disabledKeys: new Set<string>(),
      loaded: false,
      customIdsReady: true
    });
    const prepare = (snapshot: SiteSearchProviderSnapshot) => this.model.prepareSiteSearchProviderSnapshot(snapshot, {
      debugDuplicateKey: DEBUG_DUPLICATE_CUSTOM_KEY
    });
    this.coordinator = createSiteSearchProviderRefreshCoordinator<SiteSearchProviderSnapshot, PreparedSiteSearchProviders>({
      apply: (prepared) => this.store.setState({
        defaults: prepared.defaults,
        custom: prepared.custom,
        disabledKeys: prepared.disabledKeys,
        customIdsReady: true,
        loaded: true
      }),
      load: () => this.loadSnapshot(),
      onError: (error) => {
        this.store.setState({ customIdsReady: false });
        this.onLoadError(error);
      },
      persist: createSnapshotPersister({
        enqueue: this.enqueue,
        load: () => this.loadSnapshot(),
        prepare,
        write: (custom, disabledKeys) => this.writeState(custom, disabledKeys)
      }),
      prepare
    });
  }

  // Reads the providers again. Until the bundled list has loaded once, the
  // fallback list shows.
  refresh(): Promise<void> {
    const state = this.store.getSnapshot();
    this.store.setState({
      defaults: state.defaults.length === 0 ? SearchSiteSearchProviders.getDefaultSiteSearchProviders() : state.defaults,
      customIdsReady: false
    });
    // A failed refresh was already reported through onLoadError; one
    // overtaken by a newer refresh is dropped on purpose.
    return this.coordinator.refresh().then(() => undefined, () => undefined);
  }

  // Refreshes on every stored change, after any save's pause.
  followStorage(): () => void {
    return this.settingsStore.subscribe([siteSearchCustom, siteSearchDisabled], () => {
      this.coordinator.invalidate();
      const wait = this.refreshPausedUntil - Date.now();
      window.clearTimeout(this.refreshTimer);
      if (wait > 0) {
        this.refreshTimer = window.setTimeout(() => void this.refresh(), wait + 40);
        return;
      }
      void this.refresh();
    });
  }

  findProvider(key: string, isBuiltin: boolean): SiteSearchProvider | null {
    const state = this.store.getSnapshot();
    return (isBuiltin ? state.defaults : state.custom).find((entry) => String(entry.key || '') === key) || null;
  }

  // A new custom provider from the add form.
  async add(draft: SiteSearchDraft, hasKeyConflict: KeyConflictCheck): Promise<EditOutcome> {
    this.pauseRefresh();
    const state = this.store.getSnapshot();
    const result = this.model.addCustomSiteSearchProvider(draft, {
      createId: () => createPersistentId('source'),
      custom: state.custom,
      disabledKeys: state.disabledKeys,
      hasKeyConflict
    });
    if (result.ok === false) {
      return result;
    }
    const saved = await this.save(result.custom, result.disabledKeys);
    if (saved.ok) {
      void this.refresh();
    }
    return saved;
  }

  // An edit of a built-in or custom provider from its list row.
  async edit(key: string, isBuiltin: boolean, draft: SiteSearchDraft, hasKeyConflict: KeyConflictCheck): Promise<EditOutcome> {
    this.pauseRefresh();
    const item = this.findProvider(key, isBuiltin);
    const state = this.store.getSnapshot();
    const result = item
      ? this.model.editSiteSearchProvider(item, isBuiltin, draft, {
        createId: () => createPersistentId('source'),
        custom: state.custom,
        defaults: state.defaults,
        disabledKeys: state.disabledKeys,
        hasKeyConflict
      })
      : null;
    if (!result) {
      return { ok: false, error: 'toast_error' };
    }
    if (result.ok === false) {
      return result;
    }
    return this.save(result.custom, result.disabledKeys);
  }

  // A built-in is turned off by its key; a custom provider is dropped, and
  // the built-in it replaced comes back. Rejects when storage refuses.
  async remove(key: string, isBuiltin: boolean): Promise<void> {
    const state = this.store.getSnapshot();
    const disabledKeys = new Set(state.disabledKeys);
    if (isBuiltin) {
      disabledKeys.add(key.toLowerCase());
      await this.enqueue(() => this.settingsStore.set(siteSearchDisabled, normalizeKeys(disabledKeys)));
      this.store.setState({ disabledKeys });
    } else {
      const removed = state.custom.find((item) => String(item.key || '') === key);
      const custom = state.custom.filter((item) => String(item.key || '') !== key);
      const builtinKey = getSiteSearchBuiltinKey(removed);
      if (builtinKey) {
        disabledKeys.delete(builtinKey);
      }
      await this.enqueue(() => this.writeState(custom, disabledKeys));
      this.store.setState({ custom, disabledKeys, customIdsReady: true });
    }
    void this.refresh();
  }

  // Brings every built-in back and drops custom providers that copy one.
  async resetBuiltins(): Promise<void> {
    const defaults = await this.loadDefaults();
    const stored = await this.loadCustom(defaults);
    const defaultKeys = new Set(defaults.map((item) => item.key.toLowerCase()));
    const custom = stored.filter((item) => {
      const key = item.key.toLowerCase();
      const builtinKey = getSiteSearchBuiltinKey(item);
      return Boolean(key) && !defaultKeys.has(key) && !defaultKeys.has(builtinKey);
    });
    const disabledKeys = new Set<string>();
    await this.enqueue(() => this.writeState(custom, disabledKeys));
    this.store.setState({ custom, disabledKeys, customIdsReady: true });
  }

  // Drops every custom provider; built-ins they replaced come back.
  async clearCustom(): Promise<void> {
    const state = this.store.getSnapshot();
    const disabledKeys = new Set(state.disabledKeys);
    state.custom.forEach((item) => {
      const builtinKey = getSiteSearchBuiltinKey(item);
      if (builtinKey) {
        disabledKeys.delete(builtinKey);
      }
    });
    await this.enqueue(() => this.writeState([], disabledKeys));
    this.store.setState({ custom: [], disabledKeys, customIdsReady: true });
  }

  private pauseRefresh(): void {
    this.refreshPausedUntil = Math.max(this.refreshPausedUntil, Date.now() + SAVE_REFRESH_PAUSE_MS);
  }

  private async save(custom: SiteSearchProvider[], disabledKeys: Set<string>): Promise<EditOutcome> {
    try {
      await this.enqueue(() => this.writeState(custom, disabledKeys));
    } catch (error) {
      return { ok: false, error: 'toast_error', saveFailed: true };
    }
    this.store.setState({ custom, disabledKeys, customIdsReady: true });
    return { ok: true };
  }

  private writeState(custom: readonly SiteSearchProvider[], disabledKeys: Iterable<string>): Promise<void> {
    return this.settingsStore.setMany([
      [siteSearchCustom, normalizeProviders(custom)],
      [siteSearchDisabled, normalizeKeys(disabledKeys)]
    ]);
  }

  private async loadSnapshot(): Promise<SiteSearchProviderSnapshot> {
    const defaults = await this.loadDefaults();
    const [custom, disabled] = await Promise.all([this.loadCustom(defaults), this.loadDisabledKeys()]);
    return { custom, defaults, disabled };
  }

  // The bundled providers, from the extension's data file or, failing
  // that, the worker; the fallback list when both are empty.
  private loadDefaults(): Promise<SiteSearchProvider[]> {
    const normalizeDefaults = (items: SiteSearchProvider[]) => normalizeProviders(
      items.length > 0 ? items : SearchSiteSearchProviders.getDefaultSiteSearchProviders()
    );
    return fetch(chrome.runtime.getURL('assets/data/site-search.json'))
      .then((response) => response.json())
      .then((data: unknown) => normalizeDefaults(
        readSiteSearchProviders(data && typeof data === 'object' && 'items' in data ? data.items : null)
      ))
      .catch(() => new Promise<SiteSearchProvider[]>((resolve) => {
        LumnoMessaging.sendBackgroundMessage(chrome.runtime, { action: 'getSiteSearchProviders' }, (response) => {
          resolve(normalizeDefaults(response ? readSiteSearchProviders(response.items) : []));
        });
      }));
  }

  private loadCustom(defaults: readonly SiteSearchProvider[]): Promise<SiteSearchProvider[]> {
    return readStoredSetting(this.settingsStore, siteSearchCustom).then((value) => {
      const byKey = new Map(defaults.map((item) => [item.key.toLowerCase(), item]));
      return readSiteSearchProviders(value).map((item) => {
        const builtinKey = getSiteSearchBuiltinKey(item);
        return SearchSiteSearchProviders.normalizeSiteSearchProvider(item, byKey.get(builtinKey || item.key.toLowerCase()));
      }).filter(isPresent);
    });
  }

  private loadDisabledKeys(): Promise<string[]> {
    return readStoredSetting(this.settingsStore, siteSearchDisabled).then((value) => {
      const items: unknown[] = Array.isArray(value) ? value : [];
      return items.map((item) => String(item).toLowerCase()).filter(Boolean);
    });
  }
}

export { SiteSearchProviders, getActiveProviders, getAggregateSearchProviders, isHelpCenterSearchEnabled };
export type { EditOutcome, KeyConflictCheck, SiteSearchProvidersState };
