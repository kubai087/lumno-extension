// The aggregate searches Options lists and edits. This is their one owner:
// it reads them from storage, follows storage changes, and saves each edit
// against freshly read items, one at a time; the list and the trigger key
// checks read its store.
import * as AggregateSearchStore from '../../../domain/search/aggregate-search-store';
import type { AggregateSearch } from '../../../domain/search/aggregate-search-store';
import type { SiteSearchProvider } from '../../../domain/search/types';
import { aggregateSearches } from '../../../domain/settings/search';
import * as LumnoAggregateSearchStorage from '../../../platform/aggregate-search-storage';
import type { ProviderStorageRuntime } from '../../../platform/settings-storage';
import type { SettingsStore } from '../../../platform/settings-store';
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';
import { createAggregateSearchModel, createAggregateSearchStateCoordinator } from '../../options-aggregate-search';
import type { AggregateSearchDraft, AggregateSearchItem } from '../../options-aggregate-search';
import { createPersistentId } from '../../persistent-id';

interface AggregateSearchesState {
  items: AggregateSearch[];
  // Read from storage; edits wait for it, so they never overwrite a list
  // that could not be read.
  ready: boolean;
}

// An edit that failed names a locale message key; saveFailed when storage
// refused the write rather than the draft being invalid.
type AggregateEditOutcome = { ok: true } | { ok: false; error: string; saveFailed?: boolean };

// Whether a trigger key is taken, ignoring the aggregate search being edited.
type AggregateKeyConflictCheck = (key: string, currentId: string) => boolean;

const STORAGE_UNAVAILABLE: AggregateEditOutcome = { ok: false, error: 'storage_unavailable' };
const SAVE_FAILED: AggregateEditOutcome = { ok: false, error: 'toast_error', saveFailed: true };

class AggregateSearches {
  readonly store: Store<AggregateSearchesState>;
  private readonly model = createAggregateSearchModel();
  readonly limits = this.model.limits;
  private readonly settingsStore: SettingsStore;
  private readonly coordinator: ReturnType<typeof createAggregateSearchStateCoordinator<AggregateSearch, AggregateSearchItem>>;

  constructor(
    settingsStore: SettingsStore,
    providerStorage: Pick<ProviderStorageRuntime, 'getActiveAreaName'>,
    onLoadError: (error: unknown) => void
  ) {
    this.settingsStore = settingsStore;
    this.store = createStore<AggregateSearchesState>({ items: [], ready: false });
    this.coordinator = createAggregateSearchStateCoordinator<AggregateSearch, AggregateSearchItem>({
      apply: (items) => this.store.setState({ items, ready: true }),
      getCurrent: () => this.store.getSnapshot().items,
      load: () => LumnoAggregateSearchStorage.readAggregateSearches(settingsStore),
      normalize: (value) => AggregateSearchStore.normalizeAggregateSearches(value),
      onLoadError: (error) => {
        this.store.setState({ ready: false });
        onLoadError(error);
      },
      // Synced storage holds each value in one item, which has a byte limit.
      save: (items) => {
        const serialized = AggregateSearchStore.serializeAggregateSearches(items);
        const bytes = AggregateSearchStore.getSerializedStorageByteLength(serialized, aggregateSearches.key);
        if (providerStorage.getActiveAreaName() === 'sync' && bytes > AggregateSearchStore.SYNC_ITEM_BYTE_BUDGET) {
          return Promise.reject(new Error('aggregate-search-sync-item-quota-exceeded'));
        }
        return settingsStore.set(aggregateSearches, serialized).then(() => serialized.items);
      }
    });
  }

  // Reads the list again. A failed read was reported through onLoadError.
  refresh(): Promise<void> {
    return this.coordinator.refresh().then(() => undefined, () => undefined);
  }

  // Takes every stored change, which makes reads in flight stale.
  followStorage(): () => void {
    return this.settingsStore.subscribe(aggregateSearches, () => {
      this.coordinator.applyStorageChange(this.settingsStore.getStored(aggregateSearches));
    });
  }

  // A new aggregate search (id null) or an edit of one.
  async save(
    id: string | null,
    draft: AggregateSearchDraft,
    availableProviders: readonly SiteSearchProvider[],
    hasKeyConflict: AggregateKeyConflictCheck
  ): Promise<AggregateEditOutcome> {
    const state = this.store.getSnapshot();
    if (!state.ready) {
      return STORAGE_UNAVAILABLE;
    }
    const built = this.model.buildAggregateSearchItem(id, draft, {
      availableProviders,
      createId: () => createPersistentId('aggregate'),
      hasKeyConflict,
      items: state.items
    });
    if (built.ok === false) {
      return built;
    }
    const item = built.item;
    try {
      const result = await this.coordinator.enqueueMutation((items): {
        ok: boolean;
        error?: string;
        items?: AggregateSearchItem[];
      } => this.model.mergeAggregateSearchItem(items, item, id));
      return result.ok ? { ok: true } : { ok: false, error: result.error || 'toast_error' };
    } catch (error) {
      return SAVE_FAILED;
    }
  }

  remove(id: string): Promise<AggregateEditOutcome> {
    return this.replaceItems((items) => items.filter((item) => item.id !== id));
  }

  clear(): Promise<AggregateEditOutcome> {
    return this.replaceItems(() => []);
  }

  private async replaceItems(next: (items: AggregateSearch[]) => AggregateSearchItem[]): Promise<AggregateEditOutcome> {
    if (!this.store.getSnapshot().ready) {
      return STORAGE_UNAVAILABLE;
    }
    try {
      await this.coordinator.enqueueMutation((items) => ({ items: next(items), ok: true }));
      return { ok: true };
    } catch (error) {
      return SAVE_FAILED;
    }
  }
}

export { AggregateSearches };
export type { AggregateEditOutcome, AggregateKeyConflictCheck, AggregateSearchesState };
