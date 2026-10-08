(function(root) {
  'use strict';

  const CUSTOM_WALLPAPER_ID = 'custom-upload';
  const CUSTOM_WALLPAPER_ID_PREFIX = 'custom-wallpaper-';
  const DB_NAME = 'lumno-newtab-wallpaper';
  const DB_VERSION = 1;
  const STORE_NAME = 'wallpapers';
  const LEGACY_RECORD_KEY = 'custom';
  const OUTPUT_RATIO = 16 / 9;
  const MAX_OUTPUT_WIDTH = 2560;
  const THUMBNAIL_WIDTH = 480;
  const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
  const MAX_SOURCE_DIMENSION = 8192;
  const MAX_SOURCE_PIXELS = 40 * 1000 * 1000;
  const MAX_WALLPAPER_BYTES = 2 * 1024 * 1024;
  const MAX_THUMBNAIL_BYTES = 160 * 1024;
  const WEBP_QUALITIES = Object.freeze([0.88, 0.82, 0.76, 0.7, 0.64, 0.58]);
  const ACCEPTED_SOURCE_MIME_TYPES = Object.freeze([
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);
  const LEGACY_GENERIC_NAMES = [
    'Custom wallpaper',
    '\u81ea\u5b9a\u4e49\u58c1\u7eb8'
  ];

  function getOption(options, key, fallback) {
    if (options && Object.prototype.hasOwnProperty.call(options, key)) {
      return options[key];
    }
    return fallback;
  }

  function isCustomWallpaperId(id) {
    return String(id || '').startsWith(CUSTOM_WALLPAPER_ID_PREFIX);
  }

  function isGenericCustomWallpaperName(name) {
    const normalized = String(name || '').trim();
    if (!normalized) {
      return true;
    }
    return LEGACY_GENERIC_NAMES.indexOf(normalized) !== -1;
  }

  function createWallpaperLocalStore(options) {
    const documentObj = getOption(options, 'documentObj', root.document);
    const windowObj = getOption(options, 'windowObj', root.window || root);
    function notifyChange() {
      if (options && typeof options.onChange === 'function') {
        options.onChange();
      } else if (root.chrome && root.chrome.storage && root.chrome.storage.local) {
        root.chrome.storage.local.set({
          _x_extension_asset_revision_2026_unique_: `${Date.now()}-${Math.random()}`
        });
      }
    }

    function normalizeRecord(record) {
      if (!record || typeof record !== 'object') {
        return null;
      }
      const imageDataUrl = String(record.imageDataUrl || '');
      const thumbnailDataUrl = String(record.thumbnailDataUrl || imageDataUrl);
      if (!imageDataUrl || !thumbnailDataUrl) {
        return null;
      }
      const rawId = String(record.id || record.key || '').trim();
      const isLegacyRecord = rawId === CUSTOM_WALLPAPER_ID ||
        String(record.key || '') === LEGACY_RECORD_KEY;
      const id = isCustomWallpaperId(rawId)
        ? rawId
        : `${CUSTOM_WALLPAPER_ID_PREFIX}${isLegacyRecord ? 'legacy' : Date.now()}`;
      const storedName = String(record.name || '').trim();
      return {
        id,
        key: String(record.key || id),
        name: isLegacyRecord && isGenericCustomWallpaperName(storedName) ? '' : storedName,
        imageDataUrl,
        thumbnailDataUrl,
        width: Math.max(0, Number(record.width) || 0),
        height: Math.max(0, Number(record.height) || 0),
        updatedAt: Number(record.updatedAt) || Date.now()
      };
    }

    function openDb() {
      return new Promise((resolve, reject) => {
        if (!windowObj || !windowObj.indexedDB) {
          reject(new Error('IndexedDB is not available.'));
          return;
        }
        const request = windowObj.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };
        request.onerror = () => {
          reject(request.error || new Error('Failed to open wallpaper database.'));
        };
        request.onsuccess = () => {
          resolve(request.result);
        };
      });
    }

    function readAll() {
      return openDb().then((db) => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = typeof store.getAll === 'function' ? store.getAll() : null;
          if (!request) {
            reject(new Error('Wallpaper database does not support getAll.'));
            return;
          }
          request.onerror = () => {
            reject(request.error || new Error('Failed to read wallpapers.'));
          };
          request.onsuccess = () => {
            const records = Array.isArray(request.result) ? request.result : [];
            resolve(records
              .map(normalizeRecord)
              .filter(Boolean)
              .sort((a, b) => a.updatedAt - b.updatedAt));
          };
          transaction.oncomplete = () => {
            db.close();
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error || new Error('Failed to read wallpapers.'));
          };
        });
      });
    }

    function readByIds(ids) {
      const recordKeys = [];
      const addRecordKey = (key) => {
        const normalizedKey = String(key || '').trim();
        if (normalizedKey && !recordKeys.includes(normalizedKey)) {
          recordKeys.push(normalizedKey);
        }
      };
      (Array.isArray(ids) ? ids : []).forEach((value) => {
        const id = String(value || '').trim();
        if (id === CUSTOM_WALLPAPER_ID) {
          addRecordKey(LEGACY_RECORD_KEY);
          return;
        }
        if (!isCustomWallpaperId(id)) {
          return;
        }
        addRecordKey(id);
        if (id === `${CUSTOM_WALLPAPER_ID_PREFIX}legacy`) {
          addRecordKey(LEGACY_RECORD_KEY);
        }
      });
      if (recordKeys.length === 0) {
        return Promise.resolve([]);
      }
      return openDb().then((db) => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          if (typeof store.get !== 'function') {
            db.close();
            reject(new Error('Wallpaper database does not support targeted reads.'));
            return;
          }
          const records = [];
          let failed = false;
          const fail = (error) => {
            if (failed) {
              return;
            }
            failed = true;
            reject(error);
          };
          recordKeys.forEach((key) => {
            const request = store.get(key);
            request.onerror = () => {
              fail(request.error || new Error('Failed to read wallpaper.'));
            };
            request.onsuccess = () => {
              if (request.result) {
                records.push(request.result);
              }
            };
          });
          transaction.oncomplete = () => {
            db.close();
            if (failed) {
              return;
            }
            const normalizedById = new Map();
            records.map(normalizeRecord).filter(Boolean).forEach((record) => {
              normalizedById.set(record.id, record);
            });
            resolve(Array.from(normalizedById.values()).sort((a, b) => a.updatedAt - b.updatedAt));
          };
          transaction.onerror = () => {
            db.close();
            fail(transaction.error || new Error('Failed to read wallpapers.'));
          };
        });
      });
    }

    function write(record) {
      return openDb().then((db) => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          store.put(Object.assign({}, record, { key: record.key || record.id }));
          transaction.oncomplete = () => {
            db.close();
            notifyChange();
            resolve();
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error || new Error('Failed to save wallpaper.'));
          };
        });
      });
    }

    function remove(record) {
      return openDb().then((db) => {
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          store.delete(record && record.key ? record.key : '');
          transaction.oncomplete = () => {
            db.close();
            notifyChange();
            resolve();
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error || new Error('Failed to delete wallpaper.'));
          };
        });
      });
    }

    // Apply a downloaded library in one IndexedDB transaction. The caller
    // validates media before replacing the catalog and publishes its revision.
    function replaceAll(records) {
      return openDb().then((db) => new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();
        records.forEach((record) => store.put(Object.assign({}, record, { key: record.id })));
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onerror = transaction.onabort = () => {
          db.close();
          reject(transaction.error || new Error('Failed to restore wallpapers.'));
        };
      }));
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const Reader = windowObj && windowObj.FileReader ? windowObj.FileReader : root.FileReader;
        if (typeof Reader !== 'function') {
          reject(new Error('FileReader is not available.'));
          return;
        }
        const reader = new Reader();
        reader.onerror = () => {
          reject(reader.error || new Error('Failed to read image.'));
        };
        reader.onload = () => {
          resolve(String(reader.result || ''));
        };
        reader.readAsDataURL(file);
      });
    }

    function loadImageFromDataUrl(dataUrl) {
      return new Promise((resolve, reject) => {
        const ImageConstructor = windowObj && windowObj.Image ? windowObj.Image : root.Image;
        if (typeof ImageConstructor !== 'function') {
          reject(new Error('Image decoder is not available.'));
          return;
        }
        const image = new ImageConstructor();
        image.onload = () => {
          resolve(image);
        };
        image.onerror = () => {
          reject(new Error('Failed to load image.'));
        };
        image.src = dataUrl;
      });
    }

    function getCenteredCrop(width, height) {
      const sourceWidth = Math.max(1, Number(width) || 1);
      const sourceHeight = Math.max(1, Number(height) || 1);
      const sourceRatio = sourceWidth / sourceHeight;
      if (sourceRatio > OUTPUT_RATIO) {
        const cropWidth = Math.round(sourceHeight * OUTPUT_RATIO);
        return {
          x: Math.round((sourceWidth - cropWidth) / 2),
          y: 0,
          width: cropWidth,
          height: sourceHeight
        };
      }
      const cropHeight = Math.round(sourceWidth / OUTPUT_RATIO);
      return {
        x: 0,
        y: Math.round((sourceHeight - cropHeight) / 2),
        width: sourceWidth,
        height: cropHeight
      };
    }

    function getDataUrlByteLength(dataUrl) {
      const match = /^data:[^;,]+;base64,([a-zA-Z0-9+/]*={0,2})$/.exec(String(dataUrl || ''));
      if (!match) {
        return 0;
      }
      const encoded = match[1];
      const padding = encoded.endsWith('==') ? 2 : (encoded.endsWith('=') ? 1 : 0);
      return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
    }

    function renderCroppedDataUrl(image, crop, targetWidth, maxBytes) {
      const canvas = documentObj.createElement('canvas');
      const initialWidth = Math.max(1, Math.round(targetWidth));
      const minimumWidth = Math.min(initialWidth, initialWidth > THUMBNAIL_WIDTH ? 1280 : 320);
      const widths = [];
      let width = initialWidth;
      while (width >= minimumWidth) {
        if (!widths.includes(width)) widths.push(width);
        if (width === minimumWidth) break;
        width = Math.max(minimumWidth, Math.floor(width * 0.82));
      }

      for (const candidateWidth of widths) {
        const height = Math.max(1, Math.round(candidateWidth / OUTPUT_RATIO));
        canvas.width = candidateWidth;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Canvas is not available.');
        }
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(
          image,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          candidateWidth,
          height
        );
        for (const quality of WEBP_QUALITIES) {
          const dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl || !dataUrl.startsWith('data:image/webp;base64,')) {
            throw new Error('WebP encoding is not available.');
          }
          const byteSize = getDataUrlByteLength(dataUrl);
          if (byteSize > 0 && byteSize <= maxBytes) {
            return { dataUrl, width: candidateWidth, height, byteSize, quality };
          }
        }
      }
      throw new Error('Compressed wallpaper exceeds the upload limit.');
    }

    function buildRecordFromFile(file) {
      if (!file || !ACCEPTED_SOURCE_MIME_TYPES.includes(String(file.type || '').toLowerCase())) {
        return Promise.reject(new Error('Invalid image file.'));
      }
      const sourceBytes = Number(file.size);
      if (!Number.isFinite(sourceBytes) || sourceBytes <= 0 || sourceBytes > MAX_SOURCE_BYTES) {
        return Promise.reject(new Error('Wallpaper source file is too large.'));
      }
      return readFileAsDataUrl(file).then((dataUrl) => {
        return loadImageFromDataUrl(dataUrl);
      }).then((image) => {
        const sourceWidth = Math.max(1, Number(image.naturalWidth || image.width) || 1);
        const sourceHeight = Math.max(1, Number(image.naturalHeight || image.height) || 1);
        if (sourceWidth > MAX_SOURCE_DIMENSION || sourceHeight > MAX_SOURCE_DIMENSION ||
            sourceWidth * sourceHeight > MAX_SOURCE_PIXELS) {
          throw new Error('Wallpaper source dimensions are too large.');
        }
        const crop = getCenteredCrop(sourceWidth, sourceHeight);
        const outputWidth = Math.min(MAX_OUTPUT_WIDTH, Math.max(1, crop.width));
        const wallpaper = renderCroppedDataUrl(image, crop, outputWidth, MAX_WALLPAPER_BYTES);
        const thumbnail = renderCroppedDataUrl(image, crop, THUMBNAIL_WIDTH, MAX_THUMBNAIL_BYTES);
        return {
          id: `${CUSTOM_WALLPAPER_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name
            ? String(file.name).replace(/\.[^.]+$/, '')
            : '',
          imageDataUrl: wallpaper.dataUrl,
          thumbnailDataUrl: thumbnail.dataUrl,
          width: wallpaper.width,
          height: wallpaper.height,
          updatedAt: Date.now()
        };
      });
    }

    return {
      buildRecordFromFile,
      isCustomWallpaperId,
      normalizeRecord,
      readAll,
      readByIds,
      remove,
      replaceAll,
      write
    };
  }

  // Downscaled copies of link wallpapers and online photos (Bing, curated photos and museum prints)
  // live in their own database: only their IDs and links sync. The cache stays device-local, and
  // WebDAV, which uploads the custom wallpaper library, never reads or writes it, because:
  // - each device rebuilds a copy from the synced ID and encodes it to different bytes, so uploads
  //   would add one asset per device, and daily photos would pile up on the server;
  // - applying a WebDAV snapshot replaces the library database wholesale, which must not drop copies;
  // - the page prunes copies no mode shows, which must not delete synced media.
  // A sync that ever ships these images should seed this cache through write(), keyed by photo ID
  // with its source URL, rather than adding them to the library.
  const IMAGE_CACHE_DB_NAME = 'lumno-newtab-wallpaper-cache';
  const IMAGE_CACHE_STORE_NAME = 'images';

  function createWallpaperImageCache(options) {
    const windowObj = getOption(options, 'windowObj', root.window || root);
    function run(mode, task) {
      return new Promise((resolve, reject) => {
        if (!windowObj || !windowObj.indexedDB) {
          reject(new Error('IndexedDB is not available.'));
          return;
        }
        const request = windowObj.indexedDB.open(IMAGE_CACHE_DB_NAME, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(IMAGE_CACHE_STORE_NAME)) {
            request.result.createObjectStore(IMAGE_CACHE_STORE_NAME, { keyPath: 'id' });
          }
        };
        request.onerror = () => reject(request.error || new Error('Failed to open wallpaper image cache.'));
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(IMAGE_CACHE_STORE_NAME, mode);
          const result = task(transaction.objectStore(IMAGE_CACHE_STORE_NAME));
          transaction.oncomplete = () => { db.close(); resolve(result.value); };
          transaction.onerror = transaction.onabort = () => {
            db.close();
            reject(transaction.error || new Error('Failed to use wallpaper image cache.'));
          };
        };
      });
    }
    return {
      readByIds(ids) {
        const keys = (Array.isArray(ids) ? ids : []).filter(Boolean);
        if (!keys.length) return Promise.resolve([]);
        return run('readonly', (store) => {
          const result = { value: [] };
          keys.forEach((key) => {
            const request = store.get(key);
            request.onsuccess = () => { if (request.result) result.value.push(request.result); };
          });
          return result;
        });
      },
      write(record) {
        return run('readwrite', (store) => { store.put(record); return {}; });
      },
      remove(id) {
        return run('readwrite', (store) => { store.delete(id); return {}; });
      },
      keys() {
        return run('readonly', (store) => {
          const result = { value: [] };
          const request = store.getAllKeys();
          request.onsuccess = () => { result.value = request.result || []; };
          return result;
        });
      }
    };
  }

  const api = {
    CUSTOM_WALLPAPER_ID,
    CUSTOM_WALLPAPER_ID_PREFIX,
    MAX_SOURCE_BYTES,
    MAX_SOURCE_DIMENSION,
    MAX_SOURCE_PIXELS,
    MAX_WALLPAPER_BYTES,
    MAX_THUMBNAIL_BYTES,
    ACCEPTED_SOURCE_MIME_TYPES,
    createWallpaperImageCache,
    createWallpaperLocalStore
  };
  root.LumnoNewtabWallpaperLocalStore = api;
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
})(globalThis);
