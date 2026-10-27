// Site search providers on the Options page: the rules for adding and
// editing a provider, cleaning up stored custom providers, and the refresh
// coordinator that keeps the lists in step with storage. Validation results
// name a locale message key in `error`; the page turns it into text.
import * as AggregateSearchStore from '../domain/search/aggregate-search-store';
import type { AggregateSearch } from '../domain/search/aggregate-search-store';
import type { SiteSearchProvider } from '../domain/search/types';
import * as SearchSiteSearchMatching from '../domain/search/utils/site-search-matching';
import * as SearchSiteSearchProviders from '../domain/search/utils/site-search-providers';

// What a refresh step reports: whether storage needs the cleaned snapshot.
interface PreparedSnapshot {
  needsPersistence?: boolean;
}

interface PersistContext {
  // False once a newer refresh has started.
  isCurrent(): boolean;
}

interface RefreshCoordinatorConfig<S, P extends PreparedSnapshot> {
  load(): Promise<S>;
  prepare(snapshot: S): P;
  persist(prepared: P, context: PersistContext): Promise<unknown>;
  apply(prepared: P): void;
  onError?(error: unknown): void;
}

type RefreshResult<P> = { stale: true } | { stale: false; value: P };

// Runs one storage operation after the ones before it.
type EnqueueOperation = <R>(operation: () => R | PromiseLike<R>) => Promise<R>;

// Site search providers as storage holds them, after reading.
interface SiteSearchProviderSnapshot {
  defaults: SiteSearchProvider[];
  custom: SiteSearchProvider[];
  disabled: string[];
}

interface PreparedSiteSearchProviders {
  custom: SiteSearchProvider[];
  defaults: SiteSearchProvider[];
  disabledKeys: Set<string>;
  needsPersistence: boolean;
}

interface SnapshotPersisterOptions<S, P extends PreparedSnapshot & { custom: unknown; disabledKeys: unknown }> {
  enqueue: EnqueueOperation;
  load(): Promise<S>;
  prepare(snapshot: S): P;
  write(custom: P['custom'], disabledKeys: P['disabledKeys']): unknown;
}

// The add and edit forms' fields.
interface SiteSearchDraft {
  key?: string;
  name?: string;
  template?: string;
  // Comma-separated, as typed.
  aliases?: string;
  category?: string;
}

type SiteSearchEditResult =
  { ok: false; error: string } |
  { ok: true; custom: SiteSearchProvider[]; disabledKeys: Set<string> };

interface SiteSearchEditState {
  custom: SiteSearchProvider[];
  disabledKeys: Iterable<string>;
  hasKeyConflict(key: string, allowedKey: string): boolean;
  createId(): string;
}

// Serializes refreshes so the newest one wins. A refresh that loses to a
// newer one (or to invalidate()) resolves as { stale: true } without
// applying anything. When prepare() reports needsPersistence, the snapshot
// is re-read inside the serialized path before persisting, and the stored
// result is read back before it is applied.
function createSiteSearchProviderRefreshCoordinator<S, P extends PreparedSnapshot>(
  config: RefreshCoordinatorConfig<S, P>
) {
  const { load, prepare, persist, apply } = config;
  const onError = config.onError || (() => {});
  let generation = 0;
  let refreshQueue: Promise<unknown> = Promise.resolve();

  function isCurrent(token: number): boolean {
    return token === generation;
  }

  async function run(token: number): Promise<RefreshResult<P>> {
    try {
      let snapshot = await load();
      if (!isCurrent(token)) {
        return { stale: true };
      }
      let prepared = prepare(snapshot);
      if (prepared.needsPersistence) {
        // A refresh can spend time loading the bundled provider catalog. Re-read
        // sync storage inside the serialized migration path so cleanup never uses
        // the earlier snapshot merely because it happened to finish last.
        snapshot = await load();
        if (!isCurrent(token)) {
          return { stale: true };
        }
        prepared = prepare(snapshot);
        if (prepared.needsPersistence) {
          if (!isCurrent(token)) {
            return { stale: true };
          }
          await persist(prepared, {
            isCurrent: () => isCurrent(token)
          });
          if (!isCurrent(token)) {
            return { stale: true };
          }
          // Publish what storage now contains, rather than assuming the write
          // result still represents the newest provider state.
          snapshot = await load();
          if (!isCurrent(token)) {
            return { stale: true };
          }
          prepared = prepare(snapshot);
        }
      }
      if (!isCurrent(token)) {
        return { stale: true };
      }
      apply(prepared);
      return { stale: false, value: prepared };
    } catch (error) {
      if (isCurrent(token)) {
        onError(error);
      }
      throw error;
    }
  }

  return {
    invalidate(): void {
      generation += 1;
    },
    refresh(): Promise<RefreshResult<P>> {
      const token = ++generation;
      const task = refreshQueue.then(
        () => run(token),
        () => run(token)
      );
      // The caller gets this refresh's own result; the queue only needs to
      // know it settled.
      refreshQueue = task.catch(() => {});
      return task;
    }
  };
}

// The coordinator's persist step: inside the shared write queue it reads
// storage again and writes only if the fresh snapshot still needs cleanup,
// so a migration never writes back an older snapshot over a newer save.
function createSnapshotPersister<S, P extends PreparedSnapshot & { custom: unknown; disabledKeys: unknown }>(
  options: SnapshotPersisterOptions<S, P>
) {
  return function persist(_prepared: unknown, context: PersistContext): Promise<unknown> {
    const isCurrent = context.isCurrent;
    return options.enqueue(async () => {
      if (!isCurrent()) {
        return undefined;
      }
      const snapshot = await options.load();
      if (!isCurrent()) {
        return undefined;
      }
      const latest = options.prepare(snapshot);
      if (!latest.needsPersistence || !isCurrent()) {
        return undefined;
      }
      return options.write(latest.custom, latest.disabledKeys);
    });
  };
}

// Runs storage writes one after another; each caller gets its own result.
function createOperationQueue(): EnqueueOperation {
  let queue: Promise<unknown> = Promise.resolve();
  return function enqueue<R>(operation: () => R | PromiseLike<R>): Promise<R> {
    const task = queue.then(operation, operation);
    // A failed write is reported to its caller and must not stop the next one.
    queue = task.catch(() => {});
    return task;
  };
}

function normalizeKey(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

// "a, b，c" -> ['a', 'b', 'c'] (both comma widths, blanks and repeats dropped).
function normalizeAliases(input: string): string[] {
  if (!input) {
    return [];
  }
  return Array.from(new Set(
    input
      .split(/[,，]/)
      .map((alias) => alias.trim())
      .filter(Boolean)
  ));
}

function normalizeAliasList(list: unknown): string[] {
  const items = Array.isArray(list) ? list : [];
  const cleaned = items
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(cleaned)).sort();
}

// The built-in provider a custom provider overrides, if any.
function getSiteSearchBuiltinKey(item: Pick<SiteSearchProvider, 'builtinKey'> | null | undefined): string {
  return normalizeKey(item && item.builtinKey);
}

// Built-ins still shown: not overridden by a custom provider with the same
// key and not turned off.
function getActiveBuiltinSiteSearchProviders<T extends Pick<SiteSearchProvider, 'key'>>(
  defaults: readonly T[],
  custom: readonly Pick<SiteSearchProvider, 'key'>[],
  disabledKeys: ReadonlySet<string> | Iterable<string>
): T[] {
  const customKeys = new Set(custom.map((item) => normalizeKey(item.key)).filter(Boolean));
  const disabled = disabledKeys instanceof Set
    ? disabledKeys
    : new Set(Array.from(disabledKeys).map((key) => key.toLowerCase()));
  return defaults.filter((item) => {
    const key = normalizeKey(item.key);
    return Boolean(key) && !customKeys.has(key) && !disabled.has(key);
  });
}

function createSiteSearchModel() {
  const normalizeTemplate = (template: string): string => SearchSiteSearchProviders.normalizeSiteSearchTemplate(template);

  function isDuplicateTemplate(template: string | undefined, providers: readonly SiteSearchProvider[]): boolean {
    const normalized = normalizeTemplate(String(template || '').trim());
    if (!normalized) {
      return false;
    }
    return providers.some((item) => normalizeTemplate(String(item.template || '').trim()) === normalized);
  }

  function isSameProviderContent(a: SiteSearchProvider | null | undefined, b: SiteSearchProvider | null | undefined): boolean {
    if (!a || !b) {
      return false;
    }
    const nameA = String(a.name || a.key || '').trim();
    const nameB = String(b.name || b.key || '').trim();
    const templateA = normalizeTemplate(String(a.template || '').trim());
    const templateB = normalizeTemplate(String(b.template || '').trim());
    if (nameA !== nameB || templateA !== templateB) {
      return false;
    }
    return JSON.stringify(normalizeAliasList(a.aliases)) === JSON.stringify(normalizeAliasList(b.aliases));
  }

  // Drops stored custom providers that merely repeat a built-in unchanged.
  function filterRedundantCustomProviders(
    defaults: readonly SiteSearchProvider[],
    custom: readonly SiteSearchProvider[]
  ): SiteSearchProvider[] {
    const map = new Map(defaults.map((item) => [String(item.key || '').toLowerCase(), item]));
    return custom.filter((item) => {
      if (getSiteSearchBuiltinKey(item)) {
        return true;
      }
      const base = map.get(String(item.key || '').toLowerCase());
      return !base || !isSameProviderContent(item, base);
    });
  }

  // The provider or aggregate search already using a trigger, ignoring the
  // provider key (or aggregate id) being edited.
  function findSiteSearchKeyConflict(
    key: string,
    allowedKey: string,
    allowedAggregateId: string,
    state: { providers: readonly SiteSearchProvider[]; aggregateSearches: readonly AggregateSearch[] }
  ): SiteSearchProvider | AggregateSearch | null {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey) {
      return null;
    }
    const providerConflict = SearchSiteSearchMatching.findSiteSearchProviderKeyConflict(
      normalizedKey,
      state.providers,
      normalizeKey(allowedKey)
    );
    if (providerConflict) {
      return providerConflict;
    }
    const normalizedAllowedAggregateId = allowedAggregateId.trim();
    return state.aggregateSearches.find(
      (item) => item.id.trim() !== normalizedAllowedAggregateId && normalizeKey(item.key) === normalizedKey
    ) || null;
  }

  // Cleans a stored snapshot: drops redundant and debug providers, gives
  // every custom provider a stable id, marks customs that duplicate an
  // active built-in, and turns built-ins back on when everything was off.
  function prepareSiteSearchProviderSnapshot(
    snapshot: SiteSearchProviderSnapshot,
    options?: { debugDuplicateKey?: string }
  ): PreparedSiteSearchProviders {
    const debugDuplicateKey = options && options.debugDuplicateKey;
    const { defaults, custom } = snapshot;
    let disabledKeys = new Set(snapshot.disabled);
    const filteredCustom = filterRedundantCustomProviders(defaults, custom);
    const withoutDebug = filteredCustom.filter(
      (item) => String(item.key || '').toLowerCase() !== debugDuplicateKey
    );
    const stableCustom = AggregateSearchStore.ensureCustomProviderIds(
      withoutDebug,
      AggregateSearchStore.createDeterministicCustomProviderId
    );
    const customWithStableIds = stableCustom.items;
    const didFilter = filteredCustom.length !== custom.length;
    const didRemoveDebug = withoutDebug.length !== filteredCustom.length;
    const activeBuiltins = getActiveBuiltinSiteSearchProviders(
      defaults,
      customWithStableIds,
      disabledKeys
    );
    const nextCustom = customWithStableIds.map((item) => {
      const shouldDisable = !getSiteSearchBuiltinKey(item) &&
        isDuplicateTemplate(item.template, activeBuiltins);
      return {
        ...item,
        disabled: shouldDisable,
        disabledReason: shouldDisable ? 'duplicate' : ''
      };
    });
    const didUpdateDisabled = nextCustom.some((item, index) => {
      const before: Partial<SiteSearchProvider> = customWithStableIds[index] || {};
      return Boolean(before.disabled) !== Boolean(item.disabled) ||
        String(before.disabledReason || '') !== String(item.disabledReason || '');
    });
    const filteredBase = defaults.filter((item) => {
      const key = String(item && item.key ? item.key : '').toLowerCase();
      return key && !disabledKeys.has(key);
    });
    const didResetDisabled = filteredBase.length === 0 &&
      nextCustom.length === 0 &&
      defaults.length > 0 &&
      disabledKeys.size > 0;
    if (didResetDisabled) {
      disabledKeys = new Set<string>();
    }
    return {
      custom: nextCustom,
      defaults,
      disabledKeys,
      needsPersistence: didFilter || didUpdateDisabled || didRemoveDebug ||
        stableCustom.changed || didResetDisabled
    };
  }

  // The checks shared by every add or edit of a trigger key.
  function validateTriggerKey(key: string, hasConflict: (key: string) => boolean): string {
    if (!key) {
      return 'shortcuts_error_key';
    }
    if (/\s/.test(key)) {
      return 'shortcuts_error_key_space';
    }
    if (hasConflict(key)) {
      return 'shortcuts_error_key_duplicate';
    }
    return '';
  }

  // A new custom provider from the add form.
  function addCustomSiteSearchProvider(draft: SiteSearchDraft | null, state: SiteSearchEditState): SiteSearchEditResult {
    const key = String(draft && draft.key ? draft.key : '').trim();
    const keyError = validateTriggerKey(key, (value) => state.hasKeyConflict(value, ''));
    if (keyError) {
      return { ok: false, error: keyError };
    }
    const template = normalizeTemplate(String(draft && draft.template ? draft.template : '').trim());
    if (!template || !template.includes('{query}')) {
      return { ok: false, error: 'toast_error_template' };
    }
    const name = String(draft && draft.name ? draft.name : '').trim();
    const nextItem = SearchSiteSearchProviders.normalizeSiteSearchProvider({
      id: state.createId(),
      aliases: normalizeAliases(draft && draft.aliases ? draft.aliases : ''),
      key,
      name: name || key,
      template,
      category: draft && draft.category === 'searchEngine' ? 'searchEngine' : 'site'
    });
    if (!nextItem) {
      return { ok: false, error: 'toast_error' };
    }
    const normalizedKey = key.toLowerCase();
    const disabledKeys = new Set(state.disabledKeys);
    disabledKeys.delete(normalizedKey);
    return {
      ok: true,
      custom: [nextItem, ...state.custom.filter((item) => String(item.key || '').toLowerCase() !== normalizedKey)],
      disabledKeys
    };
  }

  // An edit of a built-in or custom provider from its list row. Editing a
  // built-in stores a custom copy that names it in builtinKey and turns the
  // built-in off; a plain custom provider that repeats an active built-in's
  // template is kept but marked disabled as a duplicate.
  function editSiteSearchProvider(
    item: SiteSearchProvider,
    isBuiltin: boolean,
    draft: SiteSearchDraft | null,
    state: SiteSearchEditState & { defaults: readonly SiteSearchProvider[] }
  ): SiteSearchEditResult {
    const nextKeyRaw = String(draft && draft.key ? draft.key : '').trim();
    const previousKey = String(item.key || '').toLowerCase();
    const keyError = validateTriggerKey(nextKeyRaw, (value) => state.hasKeyConflict(value, previousKey));
    if (keyError) {
      return { ok: false, error: keyError };
    }
    const template = normalizeTemplate(String(draft && draft.template ? draft.template : '').trim());
    const isBuiltinAiProvider = isBuiltin && SearchSiteSearchProviders.isAiSiteSearchProvider(item);
    if (!template || (!isBuiltinAiProvider && !template.includes('{query}'))) {
      return { ok: false, error: 'toast_error_template' };
    }
    const normalizedKey = nextKeyRaw.toLowerCase();
    let custom = state.custom.filter(
      (entry) => String(entry.key || '').toLowerCase() !== normalizedKey
    );
    if (previousKey && previousKey !== normalizedKey) {
      custom = custom.filter((entry) => String(entry.key || '').toLowerCase() !== previousKey);
    }
    const builtinKey = isBuiltin ? previousKey : getSiteSearchBuiltinKey(item);
    const disabledKeys = new Set(state.disabledKeys);
    if (builtinKey) {
      disabledKeys.add(builtinKey);
    } else {
      disabledKeys.delete(normalizedKey);
    }
    const nextItemDraft: SiteSearchProvider = {
      ...item,
      id: String(item.id || '').trim() || state.createId(),
      key: nextKeyRaw,
      name: String(draft && draft.name ? draft.name : '').trim() || nextKeyRaw,
      template,
      aliases: normalizeAliases(draft && draft.aliases ? draft.aliases : ''),
      category: isBuiltinAiProvider
        ? 'aiSearch'
        : (draft && draft.category === 'searchEngine' ? 'searchEngine' : 'site')
    };
    if (builtinKey) {
      nextItemDraft.builtinKey = builtinKey;
    }
    const activeBuiltins = getActiveBuiltinSiteSearchProviders(
      state.defaults,
      [nextItemDraft, ...custom],
      disabledKeys
    );
    const shouldDisable = !builtinKey && isDuplicateTemplate(template, activeBuiltins);
    const nextItem = SearchSiteSearchProviders.normalizeSiteSearchProvider({
      ...nextItemDraft,
      disabled: shouldDisable,
      disabledReason: shouldDisable ? 'duplicate' : ''
    });
    if (!nextItem) {
      return { ok: false, error: 'toast_error' };
    }
    custom.unshift(nextItem);
    return { ok: true, custom, disabledKeys };
  }

  return Object.freeze({
    addCustomSiteSearchProvider,
    editSiteSearchProvider,
    filterRedundantCustomProviders,
    findSiteSearchKeyConflict,
    isDuplicateTemplate,
    isSameProviderContent,
    prepareSiteSearchProviderSnapshot,
    validateTriggerKey
  });
}

export {
  createOperationQueue,
  createSiteSearchModel,
  createSiteSearchProviderRefreshCoordinator,
  createSnapshotPersister,
  getActiveBuiltinSiteSearchProviders,
  getSiteSearchBuiltinKey,
  normalizeAliasList,
  normalizeAliases
};
export type {
  EnqueueOperation,
  PersistContext,
  PreparedSiteSearchProviders,
  RefreshCoordinatorConfig,
  RefreshResult,
  SiteSearchDraft,
  SiteSearchEditResult,
  SiteSearchEditState,
  SiteSearchProviderSnapshot
};
