import { describe, expect, it } from 'vitest';
import { MIN_ICON_DIMENSION, inspectIconResource } from './image-dimensions';

function pngHeader(width: number, height: number): ArrayBuffer {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes.buffer;
}

function text(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).slice().buffer;
}

describe('icon resource inspection', () => {
  it('accepts raster artwork of at least 128 pixels and reads its size', () => {
    expect(MIN_ICON_DIMENSION).toBe(128);
    expect(inspectIconResource(pngHeader(128, 128), 'image/png', 'https://example.com/icon.png', {}))
      .toMatchObject({ usable: true, width: 128, height: 128 });
  });

  it('rejects raster artwork too small for a 36px icon on a 2x display', () => {
    expect(inspectIconResource(pngHeader(32, 32), 'image/png', 'https://example.com/icon.png', {}).usable).toBe(false);
    expect(inspectIconResource(pngHeader(64, 64), 'image/png', 'https://example.com/icon-64.png', {}).usable).toBe(false);
  });

  it('accepts a small existing favicon when the caller lowers the minimum, but never an HTML page', () => {
    expect(inspectIconResource(pngHeader(32, 32), 'image/png', 'https://t2.gstatic.cn/faviconV2', {}, { minDimension: 16 }).usable).toBe(true);
    expect(inspectIconResource(text('<html>not an icon</html>'), 'image/png', 'https://t2.gstatic.cn/faviconV2', {}, { minDimension: 16 }).usable)
      .toBe(false);
  });

  it('accepts vector artwork and rejects a mislabeled HTML response', () => {
    expect(inspectIconResource(text('<svg viewBox="0 0 128 128"></svg>'), 'image/svg+xml', 'https://example.com/icon.svg', {}))
      .toMatchObject({ usable: true, vector: true });
    expect(inspectIconResource(text('<html>not an icon</html>'), 'image/png', 'https://example.com/icon.png', { declaredSize: 192 }).usable)
      .toBe(false);
  });
});
