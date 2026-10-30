import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_SOURCE_MIME_TYPES,
  MAX_CSS_URL_LENGTH,
  MAX_SOURCE_BYTES,
  MAX_THUMBNAIL_BYTES,
  MAX_WALLPAPER_BYTES,
  buildRecordFromFile,
  buildTileThumbnail
} from './wallpaper-image';
import { installCanvasFake, installImageFake } from '../../tests/fakes/canvas';

const page = { documentObj: document, windowObj: window };

function webpOfBytes(byteLength: number): string {
  return `data:image/webp;base64,${Buffer.alloc(byteLength, 1).toString('base64')}`;
}

function dataUrlBytes(dataUrl: string): number {
  return Buffer.from(dataUrl.split(',')[1] || '', 'base64').byteLength;
}

function sourceFile(type: string, size: number, name = 'wallpaper.png'): File {
  return new File([new Uint8Array(size)], name, { type });
}

// Encodes above 0.7 quality past the wallpaper limit, so the encoder has to step down.
function installEncoder(image: { width: number; height: number } = { width: 4000, height: 3000 }) {
  const encoded: Array<{ quality: number | undefined; width: number; height: number; contextOptions: unknown }> = [];
  const canvas = installCanvasFake({
    toDataUrl(target, type, quality) {
      expect(type).toBe('image/webp');
      encoded.push({ quality, width: target.width, height: target.height, contextOptions: canvas.record(target).contextOptions.at(-1) });
      return webpOfBytes(quality !== undefined && quality > 0.7 ? MAX_WALLPAPER_BYTES + 1 : 100);
    }
  });
  installImageFake({ size: () => image });
  return encoded;
}

describe('wallpaper image limits', () => {
  it('accept sources up to 25 MB of JPEG, PNG or WebP', () => {
    expect(MAX_SOURCE_BYTES).toBe(25 * 1024 * 1024);
    expect(Array.from(ACCEPTED_SOURCE_MIME_TYPES)).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });

  // The page applies a wallpaper through a CSS custom property, which Chrome
  // drops past 2 MB, so the largest WebP must still fit there as url("data:…").
  it('keep the largest wallpaper inside a CSS custom property', () => {
    expect(MAX_CSS_URL_LENGTH).toBe(2 * 1024 * 1024);
    expect(`url("${webpOfBytes(MAX_WALLPAPER_BYTES)}")`.length).toBeLessThanOrEqual(MAX_CSS_URL_LENGTH);
    expect(MAX_THUMBNAIL_BYTES).toBe(160 * 1024);
  });
});

describe('an uploaded wallpaper', () => {
  it('is stored as WebP at 2560x1440 within the size limits, with a thumbnail', async () => {
    installEncoder();
    const record = await buildRecordFromFile(page, sourceFile('image/png', 5 * 1024 * 1024));
    expect([record.width, record.height]).toEqual([2560, 1440]);
    expect(record.imageDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(dataUrlBytes(record.imageDataUrl)).toBeLessThanOrEqual(MAX_WALLPAPER_BYTES);
    expect(dataUrlBytes(record.thumbnailDataUrl)).toBeLessThanOrEqual(MAX_THUMBNAIL_BYTES);
    expect(record.name).toBe('wallpaper');
  });

  // The small copy the effects sample: the stored wallpaper at the sampler's
  // size, drawn on a read-optimised canvas like the sampler's and saved losslessly.
  it('keeps a lossless small copy at the sampler\'s size for the effects', async () => {
    const encoded = installEncoder();
    const record = await buildRecordFromFile(page, sourceFile('image/png', 1024));
    expect(record.sampleDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(encoded.find((call) => call.quality === 1)).toEqual({
      quality: 1, width: 520, height: 293, contextOptions: { willReadFrequently: true }
    });
  });

  it('refuses a source past 25 MB, one that is not an image it reads, and one too large to decode', async () => {
    installEncoder({ width: 9000, height: 100 });
    await expect(buildRecordFromFile(page, sourceFile('image/png', MAX_SOURCE_BYTES + 1, 'huge.png'))).rejects.toThrow(/source file is too large/);
    await expect(buildRecordFromFile(page, sourceFile('image/svg+xml', 100, 'polyglot.svg'))).rejects.toThrow(/Invalid image file/);
    await expect(buildRecordFromFile(page, sourceFile('image/webp', 100, 'wide.webp'))).rejects.toThrow(/source dimensions are too large/);
  });
});

describe('a panel tile\'s thumbnail', () => {
  it('is a 320x180 WebP cropped to the tile\'s 16:9', async () => {
    const canvas = installCanvasFake({ toDataUrl: () => webpOfBytes(9000) });
    installImageFake({ size: () => ({ width: 900, height: 720 }) });
    const dataUrl = await buildTileThumbnail(page, new Blob([new Uint8Array(16)], { type: 'image/jpeg' }));
    expect(dataUrl).toMatch(/^data:image\/webp;base64,/);
    const [tile] = canvas.canvases;
    expect([tile.width, tile.height]).toEqual([320, 180]);
    const drawn = canvas.record(tile).operations.find((operation) => operation.op === 'drawImage');
    expect(drawn?.args).toEqual([0, 107, 900, 506, 0, 0, 320, 180]);
  });
});
