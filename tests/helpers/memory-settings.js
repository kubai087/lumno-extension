// A page's settings store over in-memory sync and local storage: what each
// area holds, a switch that makes writes fail, and a way to store a value
// the way another page would.
const { createSettingsStore } = require('../../src/platform/settings-store.ts');

function createMemorySettings(initial = {}) {
  const data = { sync: { ...initial.sync }, local: { ...initial.local } };
  const listeners = [];
  const state = { failWrites: false };
  const chrome = {
    runtime: { lastError: null },
    storage: {
      onChanged: {
        addListener: (listener) => { listeners.push(listener); },
        removeListener: (listener) => {
          const index = listeners.indexOf(listener);
          if (index >= 0) listeners.splice(index, 1);
        }
      }
    }
  };
  const emit = (name, changes) => listeners.slice().forEach((listener) => listener(changes, name));

  function createArea(name) {
    const items = data[name];
    return {
      get(keys, callback) {
        const list = keys == null ? Object.keys(items) : (Array.isArray(keys) ? keys : [keys]);
        const result = {};
        list.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(items, key)) result[key] = items[key];
        });
        callback(result);
      },
      set(values, callback) {
        if (state.failWrites) {
          chrome.runtime.lastError = { message: 'storage error' };
        } else {
          Object.assign(items, values);
        }
        if (callback) callback();
        chrome.runtime.lastError = null;
        if (!state.failWrites) {
          emit(name, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { newValue: value }])));
        }
      },
      remove(keys, callback) {
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((key) => { delete items[key]; });
        if (callback) callback();
        emit(name, Object.fromEntries(list.map((key) => [key, {}])));
      }
    };
  }

  chrome.storage.sync = createArea('sync');
  chrome.storage.local = createArea('local');
  const store = createSettingsStore({ chromeApi: chrome, settings: [] });
  return {
    store,
    data,
    state,
    // Another page stored `value` under `key` in the `name` area.
    receive(name, key, value) {
      data[name][key] = value;
      emit(name, { [key]: { newValue: value } });
    }
  };
}

module.exports = { createMemorySettings };
