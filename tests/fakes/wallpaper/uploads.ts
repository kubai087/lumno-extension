// Uploads in this device's wallpaper library (IndexedDB, tests/fakes/indexed-db.ts),
// for tests of the wallpaper runtime that start with some stored.
import { vi } from 'vitest';
import { WALLPAPER_DATABASES, installIndexedDb } from '../indexed-db';
import type { MemoryIndexedDb } from '../indexed-db';
import type { BrowserFake } from '../browser';

interface Upload {
  id: string;
  imageDataUrl: string;
  thumbnailDataUrl: string;
  updatedAt: number;
}

function upload(id: string, imageDataUrl: string, thumbnailDataUrl: string, updatedAt = 1): Upload {
  return { id, imageDataUrl, thumbnailDataUrl, updatedAt };
}

// Seeds the library, and lets the library's writes tell the page through
// `browser`, as chrome.storage.local does.
function installUploads(uploads: readonly Upload[], browser: BrowserFake): MemoryIndexedDb {
  vi.stubGlobal('chrome', browser);
  const { name, store, keyPath } = WALLPAPER_DATABASES.uploads;
  return installIndexedDb({
    [name]: { [store]: { keyPath, records: uploads.map((item) => ({ ...item, key: item.id })) } }
  });
}

// Lets the tasks the runtime queued run.
async function settleTasks(rounds = 6): Promise<void> {
  for (let round = 0; round < rounds; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export { installUploads, settleTasks, upload };
export type { Upload };
