// The settings an Options view reads and saves, kept in memory: the store,
// what it wrote to each area, and a way to change a stored value the way
// another page would.
import { act } from 'react';
import type { Setting } from '../../src/domain/settings/define';
import type { StorageChangeListener, StorageItems } from '../../src/domain/storage-port';
import { createSettingsStore } from '../../src/platform/settings-store';

type AreaName = 'sync' | 'local';

interface OptionsTestSettingsOptions {
  sync?: StorageItems;
  local?: StorageItems;
}

function createOptionsTestSettings(options: OptionsTestSettingsOptions = {}) {
  const listeners: StorageChangeListener[] = [];
  const writes: Record<AreaName, StorageItems[]> = { sync: [], local: [] };
  const removals: Record<AreaName, string[][]> = { sync: [], local: [] };
  const data: Record<AreaName, StorageItems> = { sync: { ...options.sync }, local: { ...options.local } };

  function emit(changes: Record<string, { newValue?: unknown }>, name: AreaName): void {
    listeners.slice().forEach((listener) => listener(changes, name));
  }

  function createArea(name: AreaName) {
    const items = data[name];
    return {
      get(keys: string | string[] | StorageItems | null, callback?: (result: StorageItems) => void) {
        const list = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(items));
        const result = Object.fromEntries(list.filter((key) => key in items).map((key) => [key, structuredClone(items[key])]));
        if (callback) queueMicrotask(() => callback(result));
        return callback ? undefined : Promise.resolve(result);
      },
      set(values: StorageItems, callback?: () => void) {
        writes[name].push(structuredClone(values));
        Object.assign(items, structuredClone(values));
        queueMicrotask(() => {
          if (callback) callback();
          emit(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { newValue: value }])), name);
        });
        return callback ? undefined : Promise.resolve();
      },
      remove(keys: string | string[], callback?: () => void) {
        const list = Array.isArray(keys) ? keys : [keys];
        removals[name].push(list);
        list.forEach((key) => { delete items[key]; });
        queueMicrotask(() => {
          if (callback) callback();
          emit(Object.fromEntries(list.map((key) => [key, {}])), name);
        });
        return callback ? undefined : Promise.resolve();
      }
    };
  }

  const chromeApi = {
    runtime: { lastError: null },
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
  // Lets the reads, writes and change events in flight finish.
  async function settle(): Promise<void> {
    await act(async () => {
      for (let index = 0; index < 5; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
  }

  // Another page stores a value.
  async function change(setting: Setting<unknown>, value: unknown, area: AreaName = setting.area === 'preferences' || setting.area === 'browserSync' ? 'sync' : 'local'): Promise<void> {
    data[area][setting.key] = structuredClone(value);
    await act(async () => {
      emit({ [setting.key]: { newValue: value } }, area);
    });
  }

  return {
    store,
    writes: writes.sync,
    localWrites: writes.local,
    removals,
    data,
    settle,
    change
  };
}

export { createOptionsTestSettings };
