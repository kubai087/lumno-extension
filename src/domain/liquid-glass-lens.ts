// The liquid glass lens map: which way and how far a surface's rim bends the wallpaper behind it
// at each point, and the nine-slice tiles a lens is drawn from. Only the rim bends, and a rim
// depends on the corner's radius, shape and the rim's width alone, so a lens is four corner tiles
// and four one-pixel edge strips (stretched along the sides) on a flat middle.

// The rim of a thick glass slab: the outer edge samples the scene LIQUID_GLASS_EDGE times the rim
// width inward, and the bend falls off as (1 - d / rim) ^ RIM_POWER across the whole rim, so it
// meets the flat middle with no slope left and no line where it ends. The outer part of the rim
// folds the scene back on itself (a mirrored, squeezed band, as a thick glass edge shows) and the
// inner part magnifies it into the flat middle.
export const LIQUID_GLASS_EDGE = 1.1;
const RIM_POWER = 2.6;

// The bookmarks bar's rim and its corner radius when it floats.
export const BAR_BEZEL_PX = 16;
export const BAR_RADIUS_PX = 14;

// A circular corner's exponent (CSS corner-shape: round).
export const ROUND_CORNER = 2;

export type LiquidGlassShape = 'docked' | 'floating';

// A floating surface's corner radius, corner shape and rim width; the bar's own when left out.
export interface LiquidGlassGeometry {
  bezel?: number;
  radius?: number;
  // The corner's superellipse exponent: 2 for a circle, 2^k for CSS superellipse(k).
  corner?: number;
}

// The superellipse exponent of a computed CSS corner-shape. round is a circle and squircle is
// superellipse(2); concave, square and unknown shapes, and a browser without corner-shape, read
// as round.
export function getCornerExponent(shape: string): number {
  const value = shape.trim();
  if (value === 'squircle') {
    return 4;
  }
  const match = /^superellipse\(\s*([^)\s]+)\s*\)$/.exec(value);
  const k = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(k) && k >= 0 ? 2 ** k : ROUND_CORNER;
}

// How much of the rim's bend a point keeps, `depth` of the way across the rim.
function rimStrength(depth: number) {
  return depth >= 1 ? 0 : (1 - Math.max(0, depth)) ** RIM_POWER;
}

// The rim's contours run from the surface's outline (depth 0) to the inner edge of the rim
// (depth 1), each the outline inset by that share of the rim, with corners of the surface's own
// shape. A corner at least as wide as the rim insets as is. A tighter one would leave the inner
// contours a sharp corner, where the bend snaps from sideways to inward along the diagonal: a
// seam the color split lights in each corner. Its contours widen instead, from the surface's own
// radius at the edge toward one as wide as the rim, so the bend turns every corner smoothly and
// still follows the surface's corner where the rim meets it.
function contourRadius(depth: number, radius: number, bezel: number) {
  if (radius >= bezel) {
    return radius - depth * bezel;
  }
  return (1 - depth) * (radius + (bezel - radius) * depth * (2 - depth));
}

// Whether a corner point, `x` and `y` from its two edges, lies on or inside the contour at `depth`.
function isWithinContour(x: number, y: number, depth: number, radius: number, bezel: number, corner: number) {
  const inset = depth * bezel;
  if (x < inset || y < inset) {
    return false;
  }
  const curve = contourRadius(depth, radius, bezel);
  const center = inset + curve;
  if (x >= center || y >= center) {
    return true;
  }
  return ((center - x) / curve) ** corner + ((center - y) / curve) ** corner <= 1;
}

// The inward bend at a point `x` and `y` from a corner's two edges, as [toward the side edge's
// inside, toward the top edge's inside] times strength.
function bendNearCorner(x: number, y: number, radius: number, bezel: number, corner: number): [number, number] {
  let depth = 0;
  if (isWithinContour(x, y, 1, radius, bezel, corner)) {
    return [0, 0];
  }
  if (isWithinContour(x, y, 0, radius, bezel, corner)) {
    // The contours are nested, so the depth a point lies at is found by halving.
    let low = 0;
    let high = 1;
    for (let step = 0; step < 24; step += 1) {
      const middle = (low + high) / 2;
      if (isWithinContour(x, y, middle, radius, bezel, corner)) {
        low = middle;
      } else {
        high = middle;
      }
    }
    depth = low;
  }
  const strength = rimStrength(depth);
  const curve = contourRadius(depth, radius, bezel);
  const center = depth * bezel + curve;
  if (x < center && y < center && curve > 0) {
    // Across the corner's curve: along its normal.
    const nx = Math.max(0, (center - x) / curve) ** (corner - 1);
    const ny = Math.max(0, (center - y) / curve) ** (corner - 1);
    const length = Math.hypot(nx, ny) || 1;
    return [(nx / length) * strength, (ny / length) * strength];
  }
  return x < y ? [strength, 0] : [0, strength];
}

// Inward offset at a point, as unit direction times strength (0 in the flat middle, 1 at the rim).
export function getRimDisplacement(
  x: number,
  y: number,
  width: number,
  height: number,
  shape: LiquidGlassShape,
  geometry: LiquidGlassGeometry = {}
): [number, number] {
  const bezel = Math.min(geometry.bezel ?? BAR_BEZEL_PX, height / 2);
  if (shape === 'docked') {
    // The docked bar meets the browser and window at its top and sides; only its bottom edge shows.
    const strength = rimStrength((height - y) / bezel);
    return strength > 0 ? [0, -strength] : [0, 0];
  }
  const radius = Math.max(0, Math.min(geometry.radius ?? BAR_RADIUS_PX, width / 2, height / 2));
  const centerX = width / 2;
  const centerY = height / 2;
  const [inwardX, inwardY] = bendNearCorner(
    Math.min(x, width - x),
    Math.min(y, height - y),
    radius,
    Math.min(bezel, width / 2),
    geometry.corner ?? ROUND_CORNER
  );
  if (inwardX === 0 && inwardY === 0) {
    return [0, 0];
  }
  return [x < centerX ? inwardX : -inwardX, y < centerY ? inwardY : -inwardY];
}

type Rect = [number, number, number, number];

// Where each tile of a lens sits on a surface of this size: corners (top left, top right, bottom
// left, bottom right) then edges (top, bottom, left, right); a docked bar has its bottom edge only.
export function getLensLayout(shape: LiquidGlassShape, width: number, height: number, size: number): Rect[] {
  if (shape === 'docked') {
    return [[0, height - size, width, size]];
  }
  const across = Math.max(1, width - size * 2);
  const down = Math.max(1, height - size * 2);
  return [
    [0, 0, size, size],
    [width - size, 0, size, size],
    [0, height - size, size, size],
    [width - size, height - size, size, size],
    [size, 0, across, size],
    [size, height - size, across, size],
    [0, size, size, down],
    [width - size, size, size, down]
  ];
}

// The tiles' pixels, read off a probe surface one pixel wider than two tiles: its rims bend as
// any surface at least twice the tile size does, and its edges are the one-pixel strips. Red is
// the sideways bend and green the vertical one, 128 none.
export function getLensTilePixels(shape: LiquidGlassShape, radius: number, bezel: number, corner = ROUND_CORNER) {
  const size = Math.max(1, Math.ceil(shape === 'docked' ? bezel : Math.max(radius, bezel)));
  const probe = size * 2 + 1;
  const geometry = { bezel, radius, corner };
  const probeWidth = shape === 'docked' ? 1 : probe;
  return {
    size,
    tiles: getLensLayout(shape, probeWidth, probe, size).map(([left, top, w, h]) => {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const [dx, dy] = getRimDisplacement(left + x + 0.5, top + y + 0.5, probeWidth, probe, shape, geometry);
          const offset = (y * w + x) * 4;
          data[offset] = Math.round(128 + dx * 127);
          data[offset + 1] = Math.round(128 + dy * 127);
          data[offset + 2] = 128;
          data[offset + 3] = 255;
        }
      }
      return { width: w, height: h, data };
    })
  };
}

// The ring around a New Tab plate: wide enough on a card for the bend to show over a calm
// wallpaper. The bend stops at the ring's inner edge, so even a plate whose ring takes up most of
// its height still reads as a clear window in the middle.
const SURFACE_BEZEL_PX = 40;

// Rim width for a surface of this size, narrowed so small plates keep a flat middle.
export function getSurfaceBezel(width: number, height: number) {
  return Math.max(4, Math.min(SURFACE_BEZEL_PX, Math.min(width, height) / 3.5));
}

// How far the rim moves the backdrop. feDisplacementMap moves a pixel by up to half the scale, so
// the outer edge samples LIQUID_GLASS_EDGE of the rim inward, times the surface's `strength`.
export function getSurfaceDisplacementScale(bezel: number, strength = 1) {
  return Math.round(2 * LIQUID_GLASS_EDGE * strength * bezel);
}
