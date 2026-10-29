// Custom shortcut icons: reading a picked image file, fitting it into a
// 128 px PNG, and keeping the images by shortcut id in local storage.
import { createCanvas } from '../../shared/dom/canvas';
import type { StorageAreaLike } from '../../domain/storage-port';
import { MAX_OUTPUT_BYTES, getDataUrlByteLength, normalizeIconDataUrl, normalizeIconMap } from '../../domain/shortcut-icon-map';
import type { ShortcutIconMap } from '../../domain/shortcut-icon-map';
import { newtabShortcutIcons } from '../../domain/settings/newtab-shortcuts';

// An error with a code saying which step failed.
type ShortcutIconError = Error & { code: string };

// The parts of the window the store uses; tests pass their own.
interface IconStoreWindow {
  FileReader?: typeof FileReader;
  Image?: typeof Image;
  chrome?: { runtime?: { lastError?: { message?: string } | null } };
}

interface ShortcutIconStoreOptions {
  documentObj?: Pick<Document, 'createElement'> | null;
  windowObj?: IconStoreWindow | null;
  storageArea?: StorageAreaLike | null;
  storageKey?: string;
}

interface PreparedShortcutIcon {
  dataUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
}

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_SOURCE_DIMENSION = 4096;
const OUTPUT_SIZE = 128;
const ACCEPTED_MIME_TYPES: readonly string[] = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/webp'
]);

function createIconError(code: string, message?: string): ShortcutIconError {
  return Object.assign(new Error(message || code || 'Shortcut icon error.'), {
    code: String(code || 'unknown')
  });
}

function isAcceptedMimeType(value: unknown): boolean {
  return ACCEPTED_MIME_TYPES.includes(String(value || '').trim().toLowerCase());
}

function validateSourceFile(file: Pick<Blob, 'type' | 'size'> | null | undefined): true {
  if (!file || !isAcceptedMimeType(file.type)) {
    throw createIconError('unsupported-type', 'Unsupported shortcut icon type.');
  }
  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) {
    throw createIconError('empty-file', 'Shortcut icon file is empty.');
  }
  if (size > MAX_SOURCE_BYTES) {
    throw createIconError('file-too-large', 'Shortcut icon source file is too large.');
  }
  return true;
}

function validateSourceDimensions(width: unknown, height: unknown): { width: number; height: number } {
  const sourceWidth = Math.floor(Number(width));
  const sourceHeight = Math.floor(Number(height));
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) ||
      sourceWidth <= 0 || sourceHeight <= 0) {
    throw createIconError('invalid-image', 'Shortcut icon dimensions are invalid.');
  }
  if (sourceWidth > MAX_SOURCE_DIMENSION || sourceHeight > MAX_SOURCE_DIMENSION) {
    throw createIconError('dimensions-too-large', 'Shortcut icon dimensions are too large.');
  }
  return {
    width: sourceWidth,
    height: sourceHeight
  };
}

function getContainedRect(
  sourceWidth: unknown,
  sourceHeight: unknown,
  targetSize: unknown
): { x: number; y: number; width: number; height: number } {
  const dimensions = validateSourceDimensions(sourceWidth, sourceHeight);
  const size = Math.max(1, Math.round(Number(targetSize) || OUTPUT_SIZE));
  const scale = Math.min(size / dimensions.width, size / dimensions.height);
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));
  return {
    x: Math.round((size - width) / 2),
    y: Math.round((size - height) / 2),
    width,
    height
  };
}

function createShortcutIconStore(options?: ShortcutIconStoreOptions) {
  const opts = options || {};
  // An option given as null stays null; one left out takes the default.
  const documentObj = Object.hasOwn(opts, 'documentObj') ? opts.documentObj || null : globalThis.document;
  const windowObj: IconStoreWindow | null = Object.hasOwn(opts, 'windowObj')
    ? opts.windowObj || null
    : (globalThis.window || globalThis);
  const storageArea = opts.storageArea || null;
  const storageKey = String(Object.hasOwn(opts, 'storageKey') ? opts.storageKey : newtabShortcutIcons.key);

  function getRuntimeError(): { message?: string } | null {
    const chromeApi = windowObj && windowObj.chrome ? windowObj.chrome : globalThis.chrome;
    return chromeApi && chromeApi.runtime && chromeApi.runtime.lastError
      ? chromeApi.runtime.lastError
      : null;
  }

  function readAll(): Promise<ShortcutIconMap> {
    return new Promise((resolve, reject) => {
      if (!storageArea || typeof storageArea.get !== 'function') {
        resolve({});
        return;
      }
      storageArea.get([storageKey], (result) => {
        const runtimeError = getRuntimeError();
        if (runtimeError) {
          reject(createIconError('storage-read-failed', runtimeError.message));
          return;
        }
        resolve(normalizeIconMap(result && result[storageKey]));
      });
    });
  }

  function writeAll(iconMap: unknown): Promise<ShortcutIconMap> {
    const normalized = normalizeIconMap(iconMap);
    return new Promise((resolve, reject) => {
      if (!storageArea || typeof storageArea.set !== 'function') {
        reject(createIconError('storage-unavailable', 'Local extension storage is unavailable.'));
        return;
      }
      storageArea.set({ [storageKey]: normalized }, () => {
        const runtimeError = getRuntimeError();
        if (runtimeError) {
          reject(createIconError('storage-write-failed', runtimeError.message));
          return;
        }
        resolve(normalized);
      });
    });
  }

  function readFileAsDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const Reader = (windowObj && windowObj.FileReader) || globalThis.FileReader;
      if (typeof Reader !== 'function') {
        reject(createIconError('read-failed', 'FileReader is unavailable.'));
        return;
      }
      const reader = new Reader();
      reader.onerror = () => {
        reject(createIconError('read-failed', 'Failed to read shortcut icon.'));
      };
      reader.onload = () => {
        resolve(String(reader.result || ''));
      };
      reader.readAsDataURL(file);
    });
  }

  function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const ImageConstructor = (windowObj && windowObj.Image) || globalThis.Image;
      if (typeof ImageConstructor !== 'function') {
        reject(createIconError('decode-failed', 'Image decoder is unavailable.'));
        return;
      }
      const image = new ImageConstructor();
      image.onload = () => resolve(image);
      image.onerror = () => {
        reject(createIconError('decode-failed', 'Failed to decode shortcut icon.'));
      };
      image.src = dataUrl;
    });
  }

  function renderNormalizedPng(image: HTMLImageElement, sourceWidth: number, sourceHeight: number): string {
    if (!documentObj || typeof documentObj.createElement !== 'function') {
      throw createIconError('render-failed', 'Canvas is unavailable.');
    }
    const canvas = createCanvas(documentObj, OUTPUT_SIZE, OUTPUT_SIZE);
    const context = canvas.getContext('2d');
    if (!context) {
      throw createIconError('render-failed', 'Canvas is unavailable.');
    }
    const target = getContainedRect(sourceWidth, sourceHeight, OUTPUT_SIZE);
    context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, target.x, target.y, target.width, target.height);
    const dataUrl = canvas.toDataURL('image/png');
    const normalized = normalizeIconDataUrl(dataUrl);
    if (!normalized) {
      throw createIconError('render-failed', 'Failed to render shortcut icon.');
    }
    return normalized;
  }

  // Reads a picked image and fits it into the icon size.
  function prepareFile(file: Blob | null | undefined): Promise<PreparedShortcutIcon> {
    if (!file) {
      return Promise.reject(createIconError('unsupported-type', 'Unsupported shortcut icon type.'));
    }
    try {
      validateSourceFile(file);
    } catch (error) {
      return Promise.reject(error);
    }
    return readFileAsDataUrl(file)
      .then(loadImage)
      .then((image) => {
        const dimensions = validateSourceDimensions(
          image.naturalWidth || image.width,
          image.naturalHeight || image.height
        );
        return {
          dataUrl: renderNormalizedPng(image, dimensions.width, dimensions.height),
          sourceWidth: dimensions.width,
          sourceHeight: dimensions.height,
          outputWidth: OUTPUT_SIZE,
          outputHeight: OUTPUT_SIZE
        };
      });
  }

  return Object.freeze({
    storageKey,
    prepareFile,
    readAll,
    writeAll
  });
}

export {
  MAX_SOURCE_BYTES,
  MAX_SOURCE_DIMENSION,
  OUTPUT_SIZE,
  MAX_OUTPUT_BYTES,
  ACCEPTED_MIME_TYPES,
  createIconError,
  isAcceptedMimeType,
  validateSourceFile,
  validateSourceDimensions,
  getContainedRect,
  getDataUrlByteLength,
  normalizeIconDataUrl,
  normalizeIconMap,
  createShortcutIconStore
};
type ShortcutIconStore = ReturnType<typeof createShortcutIconStore>;

export type { PreparedShortcutIcon, ShortcutIconError, ShortcutIconMap, ShortcutIconStore };
