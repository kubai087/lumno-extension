// The images a WebDAV state carries as assets: reading them from data URLs,
// checking that they are still PNG or WebP images of a sane size, and
// writing them back. Throws a WebDavContractError.
import { fail } from './state-base';
import type { WebDavAssetMime } from './types';

interface ImageCheck {
  width: number;
  height: number;
}

interface DecodedImage extends ImageCheck {
  bytes: Uint8Array<ArrayBuffer>;
}

function decodeImage(dataUrl: unknown, mime: WebDavAssetMime, maximum: number): DecodedImage {
  const text = String(dataUrl);
  if (!text.startsWith(`data:${mime};base64,`)) fail('invalid-asset');
  const bytes = decodeBase64(text.slice(text.indexOf(',') + 1));
  if (!bytes.byteLength || bytes.byteLength > maximum) fail('asset-too-large');
  return { bytes, ...checkImage(bytes, mime) };
}

function decodeBase64(text: string): Uint8Array<ArrayBuffer> {
  try { return Uint8Array.from(globalThis.atob(text), (character) => character.charCodeAt(0)); }
  catch (_error) { return fail('invalid-asset'); }
}

function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  return globalThis.btoa(chunks.join(''));
}

function pngSize(bytes: Uint8Array, header: number[], view: DataView): ImageCheck {
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte)) fail('invalid-asset');
  if (bytes.length < 33 || view.getUint32(8) !== 13 || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') fail('invalid-asset');
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function webpSize(bytes: Uint8Array, header: number[], view: DataView): ImageCheck {
  if (String.fromCharCode(...header.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...header.slice(8, 12)) !== 'WEBP' ||
      bytes.length < 30 || view.getUint32(4, true) + 8 !== bytes.length) fail('invalid-asset');
  const format = String.fromCharCode(...bytes.slice(12, 16));
  if (format === 'VP8X') {
    if (bytes[20] & 2) fail('invalid-asset'); // Uploaded wallpapers are still images.
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
    };
  }
  if (format === 'VP8L' && bytes[20] === 47) {
    const dimensions = view.getUint32(21, true);
    return { width: 1 + (dimensions & 16383), height: 1 + ((dimensions >>> 14) & 16383) };
  }
  if (format === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
    return { width: view.getUint16(26, true) & 16383, height: view.getUint16(28, true) & 16383 };
  }
  return fail('invalid-asset');
}

function checkImage(bytes: Uint8Array, mime: WebDavAssetMime): ImageCheck {
  const header = Array.from(bytes.slice(0, 12));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { width, height } = mime === 'image/png' ? pngSize(bytes, header, view) : webpSize(bytes, header, view);
  if (!width || !height || width > 8192 || height > 8192 || width * height > 40000000) fail('invalid-asset');
  return { width, height };
}

function toDataUrl(bytes: Uint8Array, mime: WebDavAssetMime): string {
  return `data:${mime};base64,${encodeBase64(bytes)}`;
}

export { checkImage, decodeBase64, decodeImage, encodeBase64, toDataUrl };
export type { DecodedImage, ImageCheck };
