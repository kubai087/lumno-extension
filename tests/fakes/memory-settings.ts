// A page's settings store over in-memory sync and local storage: what each
// area holds, a switch that makes writes fail as a full or broken storage
// does, and a way to store a value the way another page would.
import type { StorageAreaLike, StorageChangeListener, StorageItems, StorageKeys } from '../../src/domain/storage-port';
import { createSettingsStore } from '../../src/platform/settings-store';

type AreaName = 'sync' | 'local';

interface MemorySettingsOptions {
  sync?: StorageItems;
  local?: StorageItems;
}

function createMemorySettings(options: MemorySettingsOptions = {}) {
  const data: Record<AreaName, StorageItems> = { sync: { ...options.sync }, local: { ...options.local } };
  const listeners: StorageChangeListener[] = [];
  const state = { failWrites: false };
  const runtime: { lastError: { message: string } | null } = { lastError: null };
  const emit = (name: AreaName, changes: Record<string, { newValue?: unknown }>) => {
    listeners.slice().forEach((listener) => listener(changes, name));
  };

  function createArea(name: AreaName): StorageAreaLike {
    const items = data[name];
    return {
      get(keys: StorageKeys, callback?: (result: StorageItems | undefined) => void) {
        const list = keys === null ? Object.keys(items) : (Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys)));
        callback?.(Object.fromEntries(list.filter((key) => Object.hasOwn(items, key)).map((key) => [key, items[key]])));
      },
      set(values: StorageItems, callback?: () => void) {
        if (state.failWrites) {
          runtime.lastError = { message: 'storage error' };
        } else {
          Object.assign(items, values);
        }
        if (callback) callback();
        runtime.lastError = null;
        if (!state.failWrites) {
          emit(name, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { newValue: value }])));
        }
      },
      remove(keys: string | string[], callback?: () => void) {
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((key) => { delete items[key]; });
        if (callback) callback();
        emit(name, Object.fromEntries(list.map((key) => [key, {}])));
      }
    };
  }

  const chromeApi = {
    runtime,
    storage: {
      sync: createArea('sync'),
      local: createArea('local'),
      onChanged: {
        addListener: (listener: StorageChangeListener) => { listeners.push(listener); },
        removeListener: (listener: StorageChangeListener) => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        }
      }
    }
  };
  const store = createSettingsStore({ chromeApi, settings: [] });
  return {
    store,
    data,
    state,
    // Another page stored `value` under `key` in the `name` area.
    receive(name: AreaName, key: string, value: unknown) {
      data[name][key] = value;
      emit(name, { [key]: { newValue: value } });
    }
  };
}

type MemorySettings = ReturnType<typeof createMemorySettings>;

export { createMemorySettings };
export type { MemorySettings };
