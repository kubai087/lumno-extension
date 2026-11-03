import { describe, expect, it } from 'vitest';
import {
  LIQUID_GLASS_EDGE,
  ROUND_CORNER,
  getCornerExponent,
  getLensLayout,
  getLensTilePixels,
  getRimDisplacement,
  getSurfaceBezel,
  getSurfaceDisplacementScale
} from './liquid-glass-lens';

const SUPERELLIPSE = 2 ** 1.25;

describe('liquid glass lens map', () => {
  it('reads a CSS corner shape as a superellipse exponent', () => {
    expect(getCornerExponent('superellipse(1.25)')).toBeCloseTo(SUPERELLIPSE, 10);
    expect(getCornerExponent('round')).toBe(ROUND_CORNER);
    expect(getCornerExponent('squircle')).toBe(4);
    // A browser without corner-shape, and shapes that are not convex, read as round.
    ['', 'scoop', 'superellipse(-1)', 'superellipse(infinity)'].forEach((shape) =>
      expect(getCornerExponent(shape)).toBe(ROUND_CORNER));
  });

  it('bends only the docked bar\'s bottom rim, inward', () => {
    expect(getRimDisplacement(400, 1, 800, 36, 'docked')).toEqual([0, 0]);
    expect(getRimDisplacement(400, 18, 800, 36, 'docked')).toEqual([0, 0]);
    const [dx, dy] = getRimDisplacement(400, 35.5, 800, 36, 'docked');
    expect(dx).toBe(0);
    expect(dy).toBeLessThan(-0.8);
    expect(getRimDisplacement(400, 30, 800, 36, 'docked')[1]).toBeGreaterThan(dy);
  });

  it('bends every floating rim toward the middle and leaves the middle flat', () => {
    expect(getRimDisplacement(400, 18, 800, 36, 'floating')).toEqual([0, 0]);
    expect(getRimDisplacement(400, 0.5, 800, 36, 'floating')[1]).toBeGreaterThan(0.8);
    expect(getRimDisplacement(400, 35.5, 800, 36, 'floating')[1]).toBeLessThan(-0.8);
    expect(getRimDisplacement(0.5, 18, 800, 36, 'floating')[0]).toBeGreaterThan(0.8);
    expect(getRimDisplacement(799.5, 18, 800, 36, 'floating')[0]).toBeLessThan(-0.8);
    const [cornerX, cornerY] = getRimDisplacement(2, 2, 800, 36, 'floating');
    expect(cornerX).toBeGreaterThan(0);
    expect(cornerY).toBeGreaterThan(0);
  });

  it('bends like a thick slab: hardest at the edge, easing off across the whole rim', () => {
    const bezel = 20;
    const at = (y: number) => getRimDisplacement(400, y, 800, 72, 'floating', { bezel, radius: 36 })[1];
    expect(at(0)).toBe(1);
    expect(at(10)).toBeCloseTo(0.5 ** 2.6, 5);
    // No slope left where the bend ends, so no line where the rim meets the flat middle.
    expect(at(19.5)).toBeLessThan(0.001);
    expect(at(20)).toBe(0);
    // Where each point samples the scene runs back from the edge before it runs forward: the outer
    // rim mirrors the scene, squeezed, and the inner rim magnifies it into the flat middle.
    const shift = getSurfaceDisplacementScale(bezel) / 2;
    const sampled = (y: number) => y + at(y) * shift;
    expect(sampled(0)).toBe(LIQUID_GLASS_EDGE * bezel);
    expect(sampled(4)).toBeLessThan(sampled(0));
    expect(sampled(20)).toBeGreaterThan(sampled(14));
    expect(sampled(20)).toBe(20);
  });

  it('follows the surface\'s own corner curve where the rim meets it', () => {
    const geometry = { radius: 24, bezel: 30 };
    const strength = (x: number, y: number, corner: number) =>
      Math.hypot(...getRimDisplacement(x, y, 300, 200, 'floating', { ...geometry, corner }));
    // A superellipse corner reaches further out along the diagonal than a circle of its radius:
    // this point is inside the superellipse, so already a little into the rim, but outside the
    // circle, where the bend is still at full strength.
    expect(strength(6.6, 6.6, SUPERELLIPSE)).toBeLessThan(1);
    expect(strength(6.6, 6.6, ROUND_CORNER)).toBeCloseTo(1, 10);
    // On the outline itself the bend is at full strength, along the corner's normal.
    const edge = 24 - 24 * 2 ** (-1 / SUPERELLIPSE);
    const [dx, dy] = getRimDisplacement(edge, edge, 300, 200, 'floating', { ...geometry, corner: SUPERELLIPSE });
    expect(dx).toBeCloseTo(dy, 6);
    expect(Math.hypot(dx, dy)).toBeGreaterThan(0.99);
  });

  it('turns a corner tighter than its rim smoothly, without a seam along the diagonal', () => {
    for (const corner of [ROUND_CORNER, SUPERELLIPSE]) {
      const geometry = { radius: 4, bezel: 40, corner };
      let largest = 0;
      // Past the surface's own 4px curve, which turns as fast as the outline does.
      for (let y = 6; y < 40; y += 0.5) {
        for (let x = 6; x < 40; x += 0.5) {
          const here = getRimDisplacement(x, y, 300, 200, 'floating', geometry);
          const right = getRimDisplacement(x + 0.5, y, 300, 200, 'floating', geometry);
          const below = getRimDisplacement(x, y + 0.5, 300, 200, 'floating', geometry);
          largest = Math.max(
            largest,
            Math.hypot(here[0] - right[0], here[1] - right[1]),
            Math.hypot(here[0] - below[0], here[1] - below[1])
          );
        }
      }
      // Half a pixel never turns or weakens the bend by more than the rim's steepest falloff does.
      expect(largest).toBeLessThan(0.05);
    }
  });

  it('fits the rim to any surface size', () => {
    expect(getSurfaceBezel(800, 200)).toBe(40);
    expect(getSurfaceBezel(800, 70)).toBe(20);
    expect(getSurfaceBezel(42, 42)).toBe(12);
    expect(getSurfaceBezel(8, 8)).toBe(4);
    // The outer edge samples 1.1 of the rim inward, half the map's scale.
    expect(getSurfaceDisplacementScale(20)).toBe(44);
    expect(getSurfaceDisplacementScale(30)).toBe(66);
    // A surface's strength scales the bend.
    expect(getSurfaceDisplacementScale(30, 1.2)).toBe(79);
  });

  it('rebuilds the whole rim from nine-slice tiles at any size', () => {
    for (const geometry of [{ bezel: 16, radius: 12, corner: ROUND_CORNER }, { bezel: 30, radius: 24, corner: SUPERELLIPSE }]) {
      const { size, tiles } = getLensTilePixels('floating', geometry.radius, geometry.bezel, geometry.corner);
      expect(size).toBe(geometry.bezel);
      for (const [width, height] of [[size * 2 + 8, size * 2 + 8], [200, 64], [size * 2 + 1, 120]]) {
        const rects = getLensLayout('floating', width, height, size);
        // Every point reads the tile covering it (a strip stretched along its side), or flat.
        const read = (x: number, y: number) => {
          const index = rects.findIndex(([left, top, w, h]) => x >= left && x < left + w && y >= top && y < top + h);
          if (index < 0) {
            return [128, 128];
          }
          const tile = tiles[index];
          const [left, top] = rects[index];
          const tx = tile.width === 1 ? 0 : x - left;
          const ty = tile.height === 1 ? 0 : y - top;
          const offset = (ty * tile.width + tx) * 4;
          return [tile.data[offset], tile.data[offset + 1]];
        };
        for (let y = 0; y < height; y += 3) {
          for (let x = 0; x < width; x += 3) {
            const [dx, dy] = getRimDisplacement(x + 0.5, y + 0.5, width, height, 'floating', geometry);
            expect(read(x, y)).toEqual([Math.round(128 + dx * 127), Math.round(128 + dy * 127)]);
          }
        }
      }
    }
    const docked = getLensTilePixels('docked', 0, 16);
    expect(docked.tiles).toHaveLength(1);
    expect(getLensLayout('docked', 800, 36, docked.size)).toEqual([[0, 20, 800, 16]]);
  });
});
