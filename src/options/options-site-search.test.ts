import { describe, expect, it } from 'vitest';
import type { SiteSearchProvider } from '../domain/search/types';
import {
  getDefaultSiteSearchProviders,
  isAiSiteSearchProvider,
  normalizeSiteSearchProvider
} from '../domain/search/utils/site-search-providers';
import { required } from '../../tests/fakes/dom';
import {
  createOperationQueue,
  createSiteSearchModel,
  createSiteSearchProviderRefreshCoordinator,
  createSnapshotPersister,
  getActiveBuiltinSiteSearchProviders,
  normalizeAliases,
  type PersistContext,
  type SiteSearchEditResult
} from './options-site-search';

const model = createSiteSearchModel();
const defaults = getDefaultSiteSearchProviders()
  .map((item) => normalizeSiteSearchProvider(item))
  .filter((item) => item !== null);
const youtube = required(defaults.find((item) => item.key === 'yt'), 'the YouTube provider');
const github = required(defaults.find((item) => item.key === 'gh'), 'the GitHub provider');
const chatgpt = required(defaults.find((item) => isAiSiteSearchProvider(item)), 'an AI provider');

let nextId = 0;
const createId = () => `source-${++nextId}`;
const noConflict = () => false;

function edited(result: SiteSearchEditResult) {
  if (!result.ok) {
    throw new Error(`Expected the edit to succeed, got ${result.error}`);
  }
  return result;
}

describe('Options site search model', () => {
  it('reads aliases split by either comma width, without blanks or repeats', () => {
    expect(normalizeAliases(' a, b，a ,, c ')).toEqual(['a', 'b', 'c']);
    expect(normalizeAliases('')).toEqual([]);
  });

  it('counts only built-ins that are neither overridden nor turned off as active', () => {
    expect(getActiveBuiltinSiteSearchProviders([youtube, github, chatgpt], [{ key: 'GH' }], new Set(['gpt']))
      .map((item) => item.key)).toEqual(['yt']);
  });

  describe('adding a custom provider', () => {
    const base = {
      custom: [{ key: 'docs', name: 'Old docs', template: 'https://old/{query}' }],
      disabledKeys: new Set(['docs', 'yt']),
      createId
    };

    it.each([
      [{ key: '' }, 'shortcuts_error_key', noConflict],
      [{ key: 'a b' }, 'shortcuts_error_key_space', noConflict],
      [{ key: 'docs', template: 'https://x/{query}' }, 'shortcuts_error_key_duplicate', () => true],
      [{ key: 'docs', template: 'https://x/' }, 'toast_error_template', noConflict]
    ])('refuses %j with %s', (draft, error, hasKeyConflict) => {
      expect(model.addCustomSiteSearchProvider(draft, { ...base, hasKeyConflict })).toEqual({ ok: false, error });
    });

    it('stores the provider first, replacing one with its trigger and turning that key back on', () => {
      const conflictChecks: Array<[string, string]> = [];
      const added = edited(model.addCustomSiteSearchProvider(
        { key: 'Docs', template: 'https://docs.example/?q={query}', aliases: 'd, dd', category: 'searchEngine' },
        {
          ...base,
          hasKeyConflict: (key, allowedKey) => {
            conflictChecks.push([key, allowedKey]);
            return false;
          }
        }
      ));
      // A new trigger may not reuse any existing one.
      expect(conflictChecks).toEqual([['Docs', '']]);
      expect(added.custom).toHaveLength(1);
      expect(added.custom[0]).toMatchObject({ key: 'Docs', name: 'Docs', category: 'searchEngine', aliases: ['d', 'dd'] });
      expect(added.custom[0].id).toMatch(/^source-/);
      expect(Array.from(added.disabledKeys).sort()).toEqual(['yt']);
      // The page's own state is left as it was.
      expect(Array.from(base.disabledKeys).sort()).toEqual(['docs', 'yt']);
    });
  });

  describe('editing a built-in', () => {
    it('stores a custom copy that remembers its origin and hides the original', () => {
      const result = edited(model.editSiteSearchProvider(youtube, true, {
        key: 'tube',
        name: 'Tube',
        template: youtube.template,
        category: 'searchEngine'
      }, { defaults, custom: [], disabledKeys: new Set(), hasKeyConflict: noConflict, createId }));
      // An override never counts as a duplicate of its origin.
      expect(result.custom[0]).toMatchObject({ key: 'tube', builtinKey: 'yt', category: 'searchEngine', disabled: false });
      expect(result.disabledKeys.has('yt')).toBe(true);
    });

    it('may keep its own trigger', () => {
      const conflictChecks: Array<[string, string]> = [];
      model.editSiteSearchProvider(youtube, true, { key: 'yt', template: youtube.template }, {
        defaults,
        custom: [],
        disabledKeys: new Set(),
        hasKeyConflict: (key, allowedKey) => {
          conflictChecks.push([key, allowedKey]);
          return false;
        },
        createId
      });
      expect(conflictChecks).toEqual([['yt', 'yt']]);
    });

    it('lets a built-in AI provider go without a {query} placeholder', () => {
      const result = edited(model.editSiteSearchProvider(chatgpt, true, { key: chatgpt.key, template: 'https://chatgpt.com/' }, {
        defaults, custom: [], disabledKeys: new Set(), hasKeyConflict: noConflict, createId
      }));
      expect(result.custom[0].category).toBe('aiSearch');
    });
  });

  describe('editing a custom provider', () => {
    const custom: SiteSearchProvider[] = [{ id: 'c1', key: 'mine', name: 'Mine', template: 'https://mine/{query}' }];

    it('drops the old entry on a rename and marks a copy of an active built-in as a duplicate', () => {
      const result = edited(model.editSiteSearchProvider(custom[0], false, { key: 'tube2', template: youtube.template }, {
        defaults, custom, disabledKeys: new Set(['tube2']), hasKeyConflict: noConflict, createId
      }));
      expect(result.custom.map((item) => item.key)).toEqual(['tube2']);
      expect(result.custom[0]).toMatchObject({ id: 'c1', disabled: true, disabledReason: 'duplicate' });
      expect(result.disabledKeys.has('tube2')).toBe(false);
    });

    it('does not count a turned-off built-in as the original', () => {
      const result = edited(model.editSiteSearchProvider(custom[0], false, { key: 'tube2', template: youtube.template }, {
        defaults, custom, disabledKeys: new Set(['yt']), hasKeyConflict: noConflict, createId
      }));
      expect(result.custom[0].disabled).toBe(false);
    });
  });

  it('finds trigger conflicts among providers and aggregate searches', () => {
    const state = {
      providers: [youtube, { key: 'docs' }],
      aggregateSearches: [{ id: 'agg-1', key: 'tech', name: 'Tech', sourceRefs: [], autoCreateTabGroup: false }]
    };
    expect(model.findSiteSearchKeyConflict('YT', '', '', state)).toMatchObject({ key: 'yt' });
    expect(model.findSiteSearchKeyConflict('yt', 'yt', '', state)).toBeNull();
    expect(model.findSiteSearchKeyConflict('tech', '', '', state)).toMatchObject({ id: 'agg-1' });
    expect(model.findSiteSearchKeyConflict('tech', '', 'agg-1', state)).toBeNull();
    expect(model.findSiteSearchKeyConflict('  ', '', '', state)).toBeNull();
  });

  describe('cleaning a stored snapshot', () => {
    const redundant = { key: 'yt', name: youtube.name, template: youtube.template, aliases: youtube.aliases.slice().reverse() };
    const changed = { key: 'gh', name: 'My GitHub', template: github.template };
    const debug = { id: 'd', key: 'dup', template: 'https://dup/{query}' };
    const duplicate = { key: 'tube', template: youtube.template };
    const snapshot = () => ({ defaults, custom: [redundant, changed, debug, duplicate], disabled: ['gh'] });

    it('drops unchanged copies of built-ins and the debug provider and ids the rest', () => {
      const prepared = model.prepareSiteSearchProviderSnapshot(snapshot(), { debugDuplicateKey: 'dup' });
      expect(prepared.custom.map((item) => item.key)).toEqual(['gh', 'tube']);
      expect(prepared.custom.every((item) => item.id)).toBe(true);
      expect(prepared.custom[1].disabledReason).toBe('duplicate');
      expect(prepared.needsPersistence).toBe(true);
    });

    it('gives legacy providers the same ids on every device that migrates them', () => {
      const first = model.prepareSiteSearchProviderSnapshot(snapshot(), { debugDuplicateKey: 'dup' });
      const again = model.prepareSiteSearchProviderSnapshot(snapshot(), { debugDuplicateKey: 'dup' });
      expect(again.custom.map((item) => item.id)).toEqual(first.custom.map((item) => item.id));
    });

    it('needs no further write once cleaned', () => {
      const prepared = model.prepareSiteSearchProviderSnapshot(snapshot(), { debugDuplicateKey: 'dup' });
      const clean = model.prepareSiteSearchProviderSnapshot({
        defaults,
        custom: prepared.custom,
        disabled: Array.from(prepared.disabledKeys)
      }, { debugDuplicateKey: 'dup' });
      expect(clean.needsPersistence).toBe(false);
    });

    it('turns the built-ins back on when everything was off', () => {
      const allOff = model.prepareSiteSearchProviderSnapshot({ defaults: [youtube], custom: [], disabled: ['yt'] });
      expect(allOff.disabledKeys.size).toBe(0);
      expect(allOff.needsPersistence).toBe(true);
    });
  });
});

interface Snapshot {
  items: Array<{ id?: string; key: string }>;
  needsMigration: boolean;
}

interface Prepared {
  items: Array<{ id: string; key: string }>;
  needsPersistence: boolean;
}

function prepareSnapshot(snapshot: Snapshot | null): Prepared {
  return {
    items: (snapshot ? snapshot.items : []).map((item) => ({ ...item, id: item.id || `stable-${item.key}` })),
    needsPersistence: Boolean(snapshot && snapshot.needsMigration)
  };
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function flushTasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const keys = (prepared: Prepared) => prepared.items.map((item) => item.key);

describe('Options site search provider refreshes', () => {
  it('runs refreshes one at a time and neither migrates nor shows a read a newer refresh overtook', async () => {
    const loadCalls: Array<ReturnType<typeof createDeferred<Snapshot>>> = [];
    const persisted: string[][] = [];
    const applied: string[][] = [];
    const coordinator = createSiteSearchProviderRefreshCoordinator<Snapshot, Prepared>({
      apply: (prepared) => { applied.push(keys(prepared)); },
      load: () => {
        const deferred = createDeferred<Snapshot>();
        loadCalls.push(deferred);
        return deferred.promise;
      },
      persist: (prepared) => {
        persisted.push(keys(prepared));
        return Promise.resolve();
      },
      prepare: prepareSnapshot
    });

    const olderRefresh = coordinator.refresh();
    await flushTasks();
    const newerRefresh = coordinator.refresh();
    loadCalls[0].resolve({ items: [{ key: 'old' }], needsMigration: true });
    await olderRefresh;
    await flushTasks();
    expect(loadCalls).toHaveLength(2);
    loadCalls[1].resolve({ items: [{ id: 'new-id', key: 'new' }], needsMigration: false });
    await newerRefresh;

    expect(persisted).toEqual([]);
    expect(applied).toEqual([['new']]);
  });

  it('reads storage again before and after a migration and shows what storage then holds', async () => {
    const snapshots: Snapshot[] = [
      { items: [{ key: 'old' }], needsMigration: true },
      { items: [{ key: 'old' }, { key: 'external' }], needsMigration: true }
    ];
    const persisted: Prepared['items'][] = [];
    const applied: string[][] = [];
    let storedSnapshot: Snapshot | null = null;
    let loadCount = 0;
    const coordinator = createSiteSearchProviderRefreshCoordinator<Snapshot | null, Prepared>({
      apply: (prepared) => { applied.push(keys(prepared)); },
      load: () => {
        loadCount += 1;
        return Promise.resolve(snapshots.shift() || storedSnapshot);
      },
      persist: (prepared) => {
        const items = prepared.items.map((item) => ({ ...item }));
        persisted.push(items);
        storedSnapshot = { items, needsMigration: false };
        return Promise.resolve();
      },
      prepare: prepareSnapshot
    });

    await coordinator.refresh();
    expect(loadCount).toBe(3);
    // Providers added after the first read survive, with stable ids.
    expect(persisted[0].map((item) => item.key)).toEqual(['old', 'external']);
    expect(persisted[0].every((item) => item.id)).toBe(true);
    expect(applied).toEqual([['old', 'external']]);
  });

  it('does not show the old snapshot of a migration a newer refresh overtook', async () => {
    const persistDeferred = createDeferred<void>();
    const applied: string[][] = [];
    const loadSnapshots: Snapshot[] = [
      { items: [{ key: 'old' }], needsMigration: true },
      { items: [{ key: 'old' }], needsMigration: true },
      { items: [{ id: 'new-id', key: 'new' }], needsMigration: false }
    ];
    let persistCount = 0;
    const persistContexts: PersistContext[] = [];
    const coordinator = createSiteSearchProviderRefreshCoordinator<Snapshot | null, Prepared>({
      apply: (prepared) => { applied.push(keys(prepared)); },
      load: () => Promise.resolve(loadSnapshots.shift() || null),
      persist: (_prepared, context) => {
        persistCount += 1;
        persistContexts.push(context);
        return persistDeferred.promise;
      },
      prepare: prepareSnapshot
    });

    const olderRefresh = coordinator.refresh();
    await flushTasks();
    await flushTasks();
    expect(persistCount).toBe(1);

    const newerRefresh = coordinator.refresh();
    // The queued provider write can tell its migration was overtaken.
    expect(required(persistContexts[0], 'the migration context').isCurrent()).toBe(false);
    persistDeferred.resolve();
    await olderRefresh;
    await newerRefresh;
    expect(applied).toEqual([['new']]);
  });
});

describe('Options site search write queue', () => {
  it('runs writes in order, each reporting its own failure without blocking the next', async () => {
    const enqueue = createOperationQueue();
    const order: string[] = [];
    const first = createDeferred<void>();
    const a = enqueue(() => {
      order.push('a:start');
      return first.promise.then(() => { order.push('a:end'); });
    });
    const b = enqueue(() => {
      order.push('b:start');
      return Promise.reject(new Error('b failed'));
    });
    const c = enqueue(() => {
      order.push('c:start');
      return 'c';
    });
    await flushTasks();
    expect(order).toEqual(['a:start']);
    first.resolve();
    await a;
    await expect(b).rejects.toThrow('b failed');
    expect(await c).toBe('c');
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'c:start']);
  });

  it('migrates from storage read again after earlier writes, and only while current', async () => {
    interface Stored {
      needsPersistence: boolean;
      custom: string[];
      disabledKeys: Set<string>;
    }
    const enqueue = createOperationQueue();
    const events: unknown[] = [];
    const blocker = createDeferred<void>();
    void enqueue(() => blocker.promise.then(() => { events.push('earlier save'); }));
    let stored: Stored = { needsPersistence: true, custom: ['old'], disabledKeys: new Set() };
    const persist = createSnapshotPersister<Stored, Stored>({
      enqueue,
      load: () => {
        events.push('load');
        return Promise.resolve(stored);
      },
      prepare: (snapshot) => snapshot,
      write: (custom, disabledKeys) => { events.push(['write', custom, Array.from(disabledKeys)]); }
    });
    const pending = persist({ custom: ['stale'] }, { isCurrent: () => true });
    stored = { needsPersistence: true, custom: ['old', 'saved meanwhile'], disabledKeys: new Set(['x']) };
    blocker.resolve();
    await pending;
    expect(events).toEqual(['earlier save', 'load', ['write', ['old', 'saved meanwhile'], ['x']]]);

    // Nothing is written when the fresh snapshot is clean.
    events.length = 0;
    stored = { needsPersistence: false, custom: [], disabledKeys: new Set() };
    await persist({}, { isCurrent: () => true });
    expect(events).toEqual(['load']);

    // An overtaken migration does not even read.
    events.length = 0;
    await persist({}, { isCurrent: () => false });
    expect(events).toEqual([]);
  });
});
