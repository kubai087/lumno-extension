// The settings a runtime context uses, read once per storage area, kept in
// step with storage through one storage.onChanged listener, and written back
// through their schemas. Each context (the worker, a page, a content script)
// shares one store (getContextSettingsStore), which every module adds the
// settings it needs to.
import type { Setting, SettingFamily } from '../domain/settings/define';
import { localPrimary } from '../domain/settings/sync-state';
import type { StorageAreaLike, StorageChanges, StorageItems, StoredValuePort } from '../domain/storage-port';
import { callStorage, isRecord } from './storage-call';
import { SettingsAreas, isStoreArea, readWebStorage, writeWebStorage } from './settings-areas';
import type { SettingsStoreChromeApi, SettingsStoreWindow, StoreArea, WebStorageLike } from './settings-areas';
import type { StorageAreaFacade } from './settings-storage';
import { writeStorageValues } from './settings-storage';
import { SettingValues } from './setting-values';
import type { MemberListener, SettingsListener } from './setting-values';

interface SettingsStoreOptions {
  chromeApi: SettingsStoreChromeApi | null | undefined;
  settings: readonly Setting<unknown>[];
  windowObj?: SettingsStoreWindow | null;
  // Values a preload already read, by area, so the store does not read them
  // again.
  initial?: Partial<Record<StoreArea, StorageItems>>;
  // Follow storage only while something subscribes; values nobody follows
  // are read again by the next include(). For a store shared by modules
  // that come and go, so the last one leaving releases the listener.
  listenWhileSubscribed?: boolean;
  // A page's preload may have read some keys before the store exists: the
  // values it holds for `keys` of `area`, or null to read storage.
  takePreloadedRead?(area: object, keys: readonly string[]): Promise<StorageItems | null>;
}

interface SettingsStore {
  // Settles once every area has been read; get() answers defaults before.
  readonly ready: Promise<void>;
  get<T>(setting: Setting<T>): T;
  // Adds settings to the store, read from storage the first time; settles
  // once they are read.
  include(settings: Setting<unknown> | readonly Setting<unknown>[]): Promise<void>;
  // What storage holds, before the schema reads it; undefined when nothing is
  // stored.
  getStored(setting: Setting<unknown>): unknown;
  // False while storage could not be read for the setting, so a caller that
  // would save a whole list can refuse instead of overwriting it.
  isRead(setting: Setting<unknown>): boolean;
  set<T>(setting: Setting<T>, value: T): Promise<void>;
  // Writes several values, one storage call per area.
  setMany(entries: ReadonlyArray<readonly [Setting<unknown>, unknown]>): Promise<void>;
  remove(settings: Setting<unknown> | readonly Setting<unknown>[]): Promise<void>;
  // Calls `listener` whenever one of `settings` changes, here or in storage.
  // A setting not yet included is followed without being read: get()
  // answers its default until a change arrives.
  subscribe(settings: Setting<unknown> | readonly Setting<unknown>[], listener: SettingsListener): () => void;
  // Calls `listener` with a member's id whenever a member of `family`
  // changes in storage.
  subscribeMembers(family: SettingFamily<unknown>, listener: (id: string) => void): () => void;
  // Members of a family are read from storage on request (they are not
  // kept), written and removed by id.
  readMembers(family: SettingFamily<unknown>, ids: readonly (string | number)[]): Promise<Map<string, unknown>>;
  writeMembers(family: SettingFamily<unknown>, values: ReadonlyMap<string, unknown>): Promise<void>;
  removeMembers(family: SettingFamily<unknown>, ids: readonly (string | number)[]): Promise<void>;
  destroy(): void;
}

function toList(list: Setting<unknown> | readonly Setting<unknown>[]): readonly Setting<unknown>[] {
  return isSettingList(list) ? list : [list];
}

function isSettingList(value: Setting<unknown> | readonly Setting<unknown>[]): value is readonly Setting<unknown>[] {
  return Array.isArray(value);
}

function groupByArea(list: readonly Setting<unknown>[]): Map<StoreArea, Setting<unknown>[]> {
  const groups = new Map<StoreArea, Setting<unknown>[]>();
  list.forEach((setting) => {
    if (!isStoreArea(setting.area)) return;
    const group = groups.get(setting.area) || [];
    group.push(setting);
    groups.set(setting.area, group);
  });
  return groups;
}

// Settings included in the same task are read together, one storage call
// per area.
interface PendingRead {
  settings: Setting<unknown>[];
  done: Promise<void>;
}

class ContextSettingsStore implements SettingsStore {
  readonly ready: Promise<void>;
  private readonly areas: SettingsAreas;
  private readonly values = new SettingValues();
  private readonly initialValues: Partial<Record<StoreArea, StorageItems>> | null;
  // Follow storage only while something subscribes (see SettingsStoreOptions).
  private readonly listenWhileSubscribed: boolean;
  private readonly takePreloadedRead: SettingsStoreOptions['takePreloadedRead'];
  private readonly loading = new Map<string, Promise<void>>();
  private readonly pendingReads = new Map<StoreArea, PendingRead>();
  private listening = false;
  private destroyed = false;

  constructor(options: SettingsStoreOptions) {
    this.areas = new SettingsAreas(options.chromeApi || null, options.windowObj || null);
    this.initialValues = options.initial || null;
    this.listenWhileSubscribed = options.listenWhileSubscribed === true;
    this.takePreloadedRead = options.takePreloadedRead;
    this.ready = this.include(options.settings);
  }

  get<T>(setting: Setting<T>): T {
    return this.values.get(setting);
  }

  getStored(setting: Setting<unknown>): unknown {
    return this.values.getStored(setting);
  }

  isRead(setting: Setting<unknown>): boolean {
    return this.values.isRead(setting);
  }

  include(list: Setting<unknown> | readonly Setting<unknown>[]): Promise<void> {
    const targets = toList(list);
    // A shared store that follows nothing may hold stale values: read again.
    const stale = this.listenWhileSubscribed && !this.listening;
    const added = targets.filter((setting) => stale || !this.loading.has(setting.key));
    added.forEach((setting) => this.know(setting));
    if (added.length && !this.listenWhileSubscribed) this.listen();
    added.filter((setting) => !isStoreArea(setting.area)).forEach((setting) => {
      this.values.accept(setting, readWebStorage(this.webStorageFor(setting), setting.key), true);
    });
    const read = Promise.all(Array.from(groupByArea(added), ([area, group]) => this.scheduleRead(area, group)))
      .then(() => undefined);
    added.forEach((setting) => this.loading.set(setting.key, read));
    return Promise.all(targets.map((setting) => this.loading.get(setting.key))).then(() => undefined);
  }

  set<T>(setting: Setting<T>, value: T): Promise<void> {
    return this.setMany([[setting, value]]);
  }

  async setMany(entries: ReadonlyArray<readonly [Setting<unknown>, unknown]>): Promise<void> {
    const writes = new Map<StoreArea, StorageItems>();
    entries.forEach(([setting, value]) => {
      const next = setting.parse(value);
      if (isStoreArea(setting.area)) {
        const items = writes.get(setting.area) || {};
        items[setting.key] = next;
        writes.set(setting.area, items);
      } else {
        writeWebStorage(this.webStorageFor(setting), setting.key, next);
      }
      this.values.accept(setting, next);
    });
    await Promise.all(Array.from(writes, async ([area, items]) => {
      if (area === 'preferences') await this.areas.preferences().ready;
      await writeStorageValues(this.areas.areaFor(area), this.areas.chromeApi, items);
    }));
  }

  async remove(list: Setting<unknown> | readonly Setting<unknown>[]): Promise<void> {
    const targets = toList(list);
    targets.forEach((setting) => {
      if (!isStoreArea(setting.area)) writeWebStorage(this.webStorageFor(setting), setting.key, undefined);
      this.values.accept(setting, undefined);
    });
    await Promise.all(Array.from(groupByArea(targets), async ([area, group]) => {
      if (area === 'preferences') await this.areas.preferences().ready;
      await this.removeKeys(this.areas.areaFor(area), group.map((setting) => setting.key));
    }));
  }

  subscribe(list: Setting<unknown> | readonly Setting<unknown>[], listener: SettingsListener): () => void {
    const targets = toList(list);
    targets.forEach((setting) => {
      if (!this.values.byKey.has(setting.key)) this.know(setting);
    });
    this.values.follow(targets, listener);
    this.listen();
    return () => {
      this.values.unfollow(targets, listener);
      this.stopListeningWhenUnfollowed();
    };
  }

  subscribeMembers(family: SettingFamily<unknown>, listener: MemberListener): () => void {
    if (family.area === 'preferences') this.areas.preferences();
    const set = this.values.followMembers(family, listener);
    this.listen();
    return () => {
      set.delete(listener);
      this.stopListeningWhenUnfollowed();
    };
  }

  async readMembers(family: SettingFamily<unknown>, ids: readonly (string | number)[]): Promise<Map<string, unknown>> {
    const members = new Map<string, unknown>();
    const target = this.familyArea(family);
    if (!target || !ids.length) return members;
    if (family.area === 'preferences') await this.areas.preferences().ready;
    const keys = ids.map((id) => family.keyFor(id));
    const items = await callStorage(this.areas.chromeApi, (done) => target.get(keys, done));
    const values = isRecord(items) ? items : {};
    ids.forEach((id) => {
      const value = values[family.keyFor(id)];
      if (value !== undefined) members.set(String(id), value);
    });
    return members;
  }

  async writeMembers(family: SettingFamily<unknown>, values: ReadonlyMap<string, unknown>): Promise<void> {
    const target = this.familyArea(family);
    if (!target || !values.size) return;
    if (family.area === 'preferences') await this.areas.preferences().ready;
    const items: StorageItems = {};
    values.forEach((value, id) => {
      items[family.keyFor(id)] = family.parse(value);
    });
    await writeStorageValues(target, this.areas.chromeApi, items);
  }

  async removeMembers(family: SettingFamily<unknown>, ids: readonly (string | number)[]): Promise<void> {
    const target = this.familyArea(family);
    if (!target || !ids.length || typeof target.remove !== 'function') return;
    if (family.area === 'preferences') await this.areas.preferences().ready;
    await this.removeKeys(target, ids.map((id) => family.keyFor(id)));
  }

  destroy(): void {
    this.destroyed = true;
    this.values.clearFollowers();
    const onChanged = this.areas.onChanged;
    if (onChanged && typeof onChanged.removeListener === 'function') onChanged.removeListener(this.storageListener);
  }

  // The storage listener, one function so unfollowing removes the one listen() added.
  private readonly storageListener = (changes: StorageChanges, areaName: string): void => {
    if (this.destroyed || !changes) return;
    if (this.areas.hasPreferences() && areaName === 'local' && Object.hasOwn(changes, localPrimary.key)) {
      // The user moved settings between browser sync and this device: every
      // preference now reads from the other area.
      const preferences = Array.from(this.values.byKey.values()).filter((setting) => setting.area === 'preferences');
      void this.areas.preferences().ready.then(() => this.readArea('preferences', preferences));
    }
    Object.keys(changes).forEach((key) => this.applyChange(key, changes[key].newValue, areaName));
  };

  private applyChange(key: string, newValue: unknown, areaName: string): void {
    const setting = this.values.byKey.get(key);
    if (setting && isStoreArea(setting.area) && this.areas.matches(setting.area, areaName)) {
      this.values.accept(setting, newValue);
    }
    this.values.memberListeners.forEach((set, family) => {
      const id = family.idOf(key);
      if (id === null || !isStoreArea(family.area) || !this.areas.matches(family.area, areaName)) return;
      Array.from(set).forEach((listener) => listener(id));
    });
  }

  private know(setting: Setting<unknown>): void {
    this.values.know(setting);
    if (setting.area === 'preferences') this.areas.preferences();
  }

  private webStorageFor(setting: Setting<unknown>): WebStorageLike | null {
    return this.areas.webStorageFor(setting.area === 'tab' ? 'tab' : 'page');
  }

  private familyArea(family: SettingFamily<unknown>): StorageAreaLike | StorageAreaFacade | null {
    return isStoreArea(family.area) ? this.areas.areaFor(family.area) : null;
  }

  private async removeKeys(target: StorageAreaLike | StorageAreaFacade | null, keys: string[]): Promise<void> {
    if (!target || typeof target.remove !== 'function') return;
    await callStorage(this.areas.chromeApi, (done) => target.remove ? target.remove(keys, () => done()) : done());
  }

  private scheduleRead(area: StoreArea, list: readonly Setting<unknown>[]): Promise<void> {
    const pending = this.pendingReads.get(area);
    if (pending) {
      pending.settings.push(...list);
      return pending.done;
    }
    const settings = list.slice();
    const done = Promise.resolve().then(() => {
      this.pendingReads.delete(area);
      return this.readArea(area, settings);
    });
    this.pendingReads.set(area, { settings, done });
    return done;
  }

  private async readArea(area: StoreArea, list: readonly Setting<unknown>[]): Promise<void> {
    const initial = this.initialValues && this.initialValues[area];
    if (initial) {
      list.forEach((setting) => this.values.accept(setting, initial[setting.key], true));
      return;
    }
    const target = this.areas.areaFor(area);
    if (!target) return;
    if (area === 'preferences') await this.areas.preferences().ready;
    const keys = list.map((setting) => setting.key);
    let items: unknown;
    try {
      const preloaded = this.takePreloadedRead ? await this.takePreloadedRead(target, keys) : null;
      items = preloaded || await callStorage(this.areas.chromeApi, (done) => target.get(keys, done));
    } catch (_error) {
      // An area that cannot be read leaves its settings at their defaults.
      this.values.markUnread(list);
      return;
    }
    const values = isRecord(items) ? items : {};
    if (!this.destroyed) list.forEach((setting) => this.values.accept(setting, values[setting.key], !this.values.hasBeenRead(setting)));
    this.values.markRead(list);
  }

  // A store kept only for families has nothing to follow.
  private listen(): void {
    const onChanged = this.areas.onChanged;
    if (this.listening || !onChanged || typeof onChanged.addListener !== 'function') return;
    this.listening = true;
    onChanged.addListener(this.storageListener);
  }

  private stopListeningWhenUnfollowed(): void {
    if (!this.listenWhileSubscribed || !this.listening || this.values.hasFollowers()) return;
    this.listening = false;
    const onChanged = this.areas.onChanged;
    if (onChanged && typeof onChanged.removeListener === 'function') onChanged.removeListener(this.storageListener);
    // Nothing follows storage now, so what is kept may go stale.
    this.loading.clear();
  }
}

function createSettingsStore(options: SettingsStoreOptions): SettingsStore {
  return new ContextSettingsStore(options);
}

// The store every module of one runtime context shares, so the context
// follows storage through one listener; each module includes the settings it
// uses.
const contextStores = new WeakMap<object, SettingsStore>();

// The first caller may hand the store a page preload's reads.
function getContextSettingsStore(
  chromeApi: SettingsStoreChromeApi,
  windowObj?: SettingsStoreWindow | null,
  takePreloadedRead?: SettingsStoreOptions['takePreloadedRead']
): SettingsStore {
  let store = contextStores.get(chromeApi);
  if (!store) {
    // Page and tab values live in the extension page's own window.
    const pageWindow = windowObj || (typeof window !== 'undefined' ? window : null);
    store = createSettingsStore({ chromeApi, settings: [], windowObj: pageWindow, listenWhileSubscribed: true, takePreloadedRead });
    contextStores.set(chromeApi, store);
  }
  return store;
}

// What storage holds for a setting, read through the store; rejects when
// storage could not be read, so a caller about to save a list built on it
// can stop instead of overwriting what it could not see.
async function readStoredSetting(store: Pick<SettingsStore, 'include' | 'isRead' | 'getStored'>, setting: Setting<unknown>): Promise<unknown> {
  await store.include(setting);
  if (!store.isRead(setting)) {
    throw new Error(`${setting.key} could not be read`);
  }
  return store.getStored(setting);
}

// One setting as a domain module's StoredValuePort.
function createSettingPort(store: SettingsStore, setting: Setting<unknown>): StoredValuePort {
  return Object.freeze({
    read: () => store.include(setting).then(() => store.getStored(setting)),
    write: (value: unknown) => store.set(setting, setting.parse(value)),
    subscribe: (listener: (value: unknown) => void) => store.subscribe(setting, () => listener(store.getStored(setting)))
  });
}

// A value worked out from a setting's stored value (rules from a list, an
// index from a map), worked out again only when the stored value changes.
function deriveFromSetting<T>(store: SettingsStore, setting: Setting<unknown>, derive: (stored: unknown) => T): () => T {
  let cache: { source: unknown; value: T } | null = null;
  return () => {
    const stored = store.getStored(setting);
    if (!cache || cache.source !== stored) {
      cache = { source: stored, value: derive(stored) };
    }
    return cache.value;
  };
}

export { createSettingPort, createSettingsStore, deriveFromSetting, getContextSettingsStore, readStoredSetting };
export type { SettingsStore, SettingsStoreOptions };
