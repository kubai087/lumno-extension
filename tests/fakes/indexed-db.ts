// An in-memory IndexedDB with what the wallpaper stores use: open (with an
// upgrade for a database not made yet), transactions over one object store
// with get, getAll, getAllKeys, put, delete, clear, count and a cursor over
// an index. Each request answers after the current task, as the browser's do,
// and a transaction completes once its last request has. installIndexedDb
// puts it on the page as window.indexedDB for the rest of the test.
import { vi } from 'vitest';

type Key = string | number;
type Callback = () => void;
type StoredRecord = Record<string, unknown>;

interface MemoryStore {
  keyPath: string;
  records: Map<Key, StoredRecord>;
  indexes: Map<string, string>;
}

interface MemoryDatabase {
  version: number;
  stores: Map<string, MemoryStore>;
}

interface FakeRequest<T> {
  result: T | undefined;
  error: Error | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

interface IndexedDbCalls {
  // Every database opened, with its version.
  open: Array<[string, number]>;
  // Keys read by get, and how many times a whole store was read.
  get: Key[];
  getAll: number;
}

// Seeds a database's stores: their key path and the records they start with.
type IndexedDbSeed = Record<string, Record<string, { keyPath: string; records?: StoredRecord[] }>>;

function later(callback: () => void): void {
  setTimeout(callback, 0);
}

function readKey(record: StoredRecord, keyPath: string): Key {
  const key = record[keyPath];
  if (typeof key !== 'string' && typeof key !== 'number') {
    throw new Error(`A record needs its ${keyPath}.`);
  }
  return key;
}

function createMemoryIndexedDb(seed: IndexedDbSeed = {}) {
  const databases = new Map<string, MemoryDatabase>();
  const calls: IndexedDbCalls = { open: [], get: [], getAll: 0 };
  Object.entries(seed).forEach(([name, stores]) => {
    databases.set(name, {
      version: 1,
      stores: new Map(Object.entries(stores).map(([storeName, { keyPath, records = [] }]) => [storeName, {
        keyPath,
        records: new Map(records.map((record) => [readKey(record, keyPath), { ...record }])),
        indexes: new Map()
      }]))
    });
  });

  function createTransaction(database: MemoryDatabase, storeName: string) {
    let pending = 0;
    let done = false;
    const transaction: {
      error: null;
      oncomplete: Callback | null;
      onerror: Callback | null;
      onabort: Callback | null;
      abort(): void;
      objectStore(name: string): ReturnType<typeof createObjectStore>;
    } = {
      error: null,
      oncomplete: null,
      onerror: null,
      onabort: null,
      abort() {
        done = true;
        if (transaction.onabort) transaction.onabort();
      },
      objectStore(name: string) {
        const store = database.stores.get(name);
        if (!store) {
          throw new Error(`No object store ${name}.`);
        }
        return createObjectStore(store);
      }
    };
    const settle = () => {
      later(() => {
        if (pending === 0 && !done) {
          done = true;
          if (transaction.oncomplete) transaction.oncomplete();
        }
      });
    };
    // A request the store answers after the current task.
    const respond = <T>(compute: () => T): FakeRequest<T> => {
      const request: FakeRequest<T> = { result: undefined, error: null, onsuccess: null, onerror: null };
      pending += 1;
      later(() => {
        request.result = compute();
        if (request.onsuccess) request.onsuccess();
        pending -= 1;
        settle();
      });
      return request;
    };
    function createObjectStore(store: MemoryStore) {
      return {
        get(key: Key) {
          calls.get.push(key);
          return respond(() => store.records.get(key));
        },
        getAll() {
          calls.getAll += 1;
          return respond(() => Array.from(store.records.values()));
        },
        getAllKeys() {
          return respond(() => Array.from(store.records.keys()));
        },
        put(value: StoredRecord) {
          return respond(() => {
            const key = readKey(value, store.keyPath);
            store.records.set(key, { ...value });
            return key;
          });
        },
        delete(key: Key) {
          return respond(() => {
            store.records.delete(key);
          });
        },
        clear() {
          return respond(() => {
            store.records.clear();
          });
        },
        count() {
          return respond(() => store.records.size);
        },
        createIndex(name: string, keyPath: string) {
          store.indexes.set(name, keyPath);
        },
        index(name: string) {
          const path = store.indexes.get(name) || name;
          return {
            // Walks the records in the index's order.
            openCursor() {
              const keys = Array.from(store.records.entries())
                .sort(([, first], [, second]) => Number(first[path]) - Number(second[path]))
                .map(([key]) => key);
              let position = 0;
              const request: FakeRequest<unknown> = { result: undefined, error: null, onsuccess: null, onerror: null };
              const step = () => {
                pending += 1;
                later(() => {
                  const key = keys[position];
                  request.result = key === undefined ? null : {
                    value: store.records.get(key),
                    delete() {
                      store.records.delete(key);
                    },
                    continue() {
                      position += 1;
                      step();
                    }
                  };
                  if (request.onsuccess) request.onsuccess();
                  pending -= 1;
                  settle();
                });
              };
              step();
              return request;
            }
          };
        }
      };
    }
    return transaction;
  }

  function createDb(database: MemoryDatabase) {
    return {
      version: database.version,
      objectStoreNames: { contains: (name: string) => database.stores.has(name) },
      createObjectStore(name: string, options: { keyPath: string }) {
        const store: MemoryStore = { keyPath: options.keyPath, records: new Map(), indexes: new Map() };
        database.stores.set(name, store);
        return {
          createIndex(indexName: string, keyPath: string) {
            store.indexes.set(indexName, keyPath);
          }
        };
      },
      transaction: (storeName: string | string[]) =>
        createTransaction(database, Array.isArray(storeName) ? storeName[0] : storeName),
      close() {}
    };
  }

  const factory = {
    open(name: string, version = 1) {
      calls.open.push([name, version]);
      const request: {
        result: ReturnType<typeof createDb> | null;
        error: null;
        transaction: { abort(): void } | null;
        onsuccess: Callback | null;
        onerror: Callback | null;
        onupgradeneeded: Callback | null;
      } = { result: null, error: null, transaction: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      later(() => {
        let database = databases.get(name);
        const created = !database;
        if (!database) {
          database = { version, stores: new Map() };
        }
        const current = database;
        request.result = createDb(current);
        if (created) {
          let aborted = false;
          request.transaction = { abort: () => { aborted = true; } };
          if (request.onupgradeneeded) request.onupgradeneeded();
          request.transaction = null;
          if (aborted) {
            if (request.onerror) request.onerror();
            return;
          }
          databases.set(name, current);
        }
        if (request.onsuccess) request.onsuccess();
      });
      return request;
    },
    deleteDatabase(name: string) {
      databases.delete(name);
      return { result: undefined, onsuccess: null, onerror: null };
    }
  };

  return {
    factory,
    calls,
    // The records of a store, by key; empty when the store does not exist.
    records(databaseName: string, storeName: string): Map<Key, StoredRecord> {
      const store = databases.get(databaseName)?.stores.get(storeName);
      return store ? store.records : new Map();
    }
  };
}

type MemoryIndexedDb = ReturnType<typeof createMemoryIndexedDb>;

function installIndexedDb(seed: IndexedDbSeed = {}): MemoryIndexedDb {
  const indexedDb = createMemoryIndexedDb(seed);
  vi.stubGlobal('indexedDB', indexedDb.factory);
  return indexedDb;
}

// The databases the wallpaper stores keep, by the names they open.
const WALLPAPER_DATABASES = Object.freeze({
  uploads: { name: 'lumno-newtab-wallpaper', store: 'wallpapers', keyPath: 'key' },
  images: { name: 'lumno-newtab-wallpaper-cache', store: 'images', keyPath: 'id' },
  thumbnails: { name: 'lumno-newtab-wallpaper-thumbs', store: 'thumbs', keyPath: 'id' }
});

export { WALLPAPER_DATABASES, createMemoryIndexedDb, installIndexedDb };
export type { IndexedDbCalls, IndexedDbSeed, MemoryIndexedDb };
