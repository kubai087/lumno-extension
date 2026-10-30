import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSamplerSize } from '../../src/domain/wallpaper-sampler-size';
import {
  NEWTAB_WALLPAPER_EXTENSION_DIRECTORY,
  NEWTAB_WALLPAPER_OPTIONS,
  NEWTAB_WALLPAPER_SAMPLE_SUFFIX,
  NEWTAB_WALLPAPER_SOURCE_SIZE
} from '../../src/newtab/wallpaper/wallpaper-options';
import { repoPath } from './repository';

// The width and height a WebP (lossy, lossless or extended) or AVIF file declares.
function readImageSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  if (bytes.toString('ascii', 4, 8) === 'ftyp') {
    // AVIF: the image spatial extents property, 'ispe', after its version and flags.
    const ispe = bytes.indexOf('ispe', 0, 'ascii');
    if (ispe <= 0) throw new Error(`${file} declares no size`);
    return { width: bytes.readUInt32BE(ispe + 8), height: bytes.readUInt32BE(ispe + 12) };
  }
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  }
  throw new Error(`${file} is neither WebP nor AVIF`);
}

// scripts/build/generate-wallpaper-samples.js writes the samples; a wallpaper
// added or replaced without running it would sample a missing or stale copy.
describe('the built-in wallpapers', () => {
  const files = NEWTAB_WALLPAPER_OPTIONS.map((option) => option.file);

  it('are all listed', () => {
    expect(files.length).toBeGreaterThanOrEqual(18);
  });

  it.each(files)('%s is the size that places its samples, with a sample copy at the sampler size', (file) => {
    const full = readImageSize(repoPath(`${NEWTAB_WALLPAPER_EXTENSION_DIRECTORY}/${file}`));
    expect(full).toEqual({ width: NEWTAB_WALLPAPER_SOURCE_SIZE.width, height: NEWTAB_WALLPAPER_SOURCE_SIZE.height });
    const sampleFile = repoPath(`${NEWTAB_WALLPAPER_EXTENSION_DIRECTORY}/${file.replace(/\.webp$/, NEWTAB_WALLPAPER_SAMPLE_SUFFIX)}`);
    expect(existsSync(sampleFile)).toBe(true);
    expect(readImageSize(sampleFile)).toEqual({ ...getSamplerSize(full.width, full.height) });
  });
});
