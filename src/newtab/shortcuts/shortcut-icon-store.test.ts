import { describe, expect, it, vi } from 'vitest';
import {
  MAX_OUTPUT_BYTES,
  MAX_SOURCE_BYTES,
  MAX_SOURCE_DIMENSION,
  OUTPUT_SIZE,
  createShortcutIconStore,
  getContainedRect,
  isAcceptedMimeType,
  normalizeIconDataUrl,
  validateSourceDimensions,
  validateSourceFile
} from './shortcut-icon-store';
import { createBrowserFake } from '../../../tests/fakes/browser';

const pngDataUrl = (text: string) => `data:image/png;base64,${Buffer.from(text).toString('base64')}`;

function errorCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error && 'code' in error ? String(error.code) : 'not an icon error';
  }
  return 'no error';
}

// The 2D context calls the store makes; JSDOM has no canvas.
function isCanvasContext(value: object): value is CanvasRenderingContext2D {
  return 'drawImage' in value && 'clearRect' in value;
}

describe('shortcut icon store', () => {
  it('accepts raster images up to its limits', () => {
    expect(MAX_SOURCE_BYTES).toBe(10 * 1024 * 1024);
    expect(MAX_SOURCE_DIMENSION).toBe(4096);
    expect(OUTPUT_SIZE).toBe(128);
    expect(MAX_OUTPUT_BYTES).toBe(96 * 1024);
    expect(isAcceptedMimeType('image/png')).toBe(true);
    expect(isAcceptedMimeType('image/svg+xml')).toBe(false);

    expect(errorCode(() => validateSourceFile({ type: 'image/svg+xml', size: 120 }))).toBe('unsupported-type');
    // Images past 1 MB are accepted before they are fitted.
    expect(validateSourceFile({ type: 'image/png', size: (1024 * 1024) + 1 })).toBe(true);
    expect(errorCode(() => validateSourceDimensions(4097, 128))).toBe('dimensions-too-large');
    expect(errorCode(() => validateSourceFile({ type: 'image/png', size: MAX_SOURCE_BYTES + 1 }))).toBe('file-too-large');
  });

  it('bounds an icon by its decoded bytes, not the length of its data URL', () => {
    const oversized = `data:image/png;base64,${Buffer.alloc(MAX_OUTPUT_BYTES + 1).toString('base64')}`;

    expect(normalizeIconDataUrl(oversized)).toBe('');
  });

  it('centers wide and tall logos with transparent padding', () => {
    expect(getContainedRect(512, 256, 128)).toEqual({ x: 0, y: 32, width: 128, height: 64 });
    expect(getContainedRect(64, 128, 128)).toEqual({ x: 32, y: 0, width: 64, height: 128 });
  });

  it('keeps only PNG data URLs in its local storage map', async () => {
    const storageKey = '_test_shortcut_icons';
    const valid = pngDataUrl('icon');
    const storage = createBrowserFake({ local: { [storageKey]: { one: valid, invalid: 'https://example.com/icon.png' } } }).storage.local;
    const store = createShortcutIconStore({ storageArea: storage, storageKey, windowObj: {} });

    expect(await store.readAll()).toEqual({ one: valid });
    const saved = await store.writeAll({ two: valid, invalid: 'data:image/jpeg;base64,abc' });
    expect(saved).toEqual({ two: valid });
    expect(storage.values[storageKey]).toEqual(saved);
  });

  it('fits a picked image into a 128 px PNG without cropping it', async () => {
    const normalized = pngDataUrl('normalized');
    const drawImage = vi.fn();
    const context = { clearRect() {}, drawImage, imageSmoothingEnabled: false, imageSmoothingQuality: 'low' };
    if (!isCanvasContext(context)) {
      throw new Error('Expected a canvas context.');
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(normalized);
    // A 512 × 256 image that decodes as soon as it gets its source.
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(512);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(256);
    vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function decode(this: HTMLImageElement) {
      this.dispatchEvent(new Event('load'));
    });
    const store = createShortcutIconStore({
      documentObj: document,
      windowObj: { FileReader, Image },
      storageArea: createBrowserFake().storage.local
    });

    const prepared = await store.prepareFile(new File([new Uint8Array(512)], 'logo.png', { type: 'image/png' }));

    expect(prepared).toEqual({ dataUrl: normalized, sourceWidth: 512, sourceHeight: 256, outputWidth: 128, outputHeight: 128 });
    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(drawImage.mock.calls[0].slice(1)).toEqual([0, 32, 128, 64]);
  });
});
