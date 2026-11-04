// How much tint a glass plate needs for its text to read: the least tint opacity at which the
// plate's ink keeps a set contrast over the brightest (light ink) or darkest (dark ink) part of
// the wallpaper behind it. The tint opacity settings and the material's own tint thin a plate no
// further than this.
import { getContrastRatio } from './color';

type GlassInk = 'light' | 'dark';

// Body text's contrast (WCAG AA). Secondary labels, drawn at lower opacity, land near 3:1 then.
const GLASS_TEXT_CONTRAST = 4.5;

// The inks the plates draw text in, and the tint each sits on: light text on a dark tint, dark
// text on a white one.
const INK_RGB: Record<GlassInk, readonly number[]> = { light: [245, 245, 247], dark: [29, 29, 31] };
const TINT_LEVEL: Record<GlassInk, number> = { light: 30 / 255, dark: 250 / 255 };

// The densest tint a floor asks for: past this a plate stops reading as glass, and it reads anyway.
const MAX_TINT_FLOOR = 0.9;

function gray(level: number): number[] {
  const value = Math.round(Math.min(1, Math.max(0, level)) * 255);
  return [value, value, value];
}

// The least tint opacity (0-1) at which `ink` reads over a wallpaper patch of mean `luminance`
// (0-1, as the sampler measures it) whose brightest and darkest points are `texture` apart. The
// tint mixes with the wallpaper as the browser composites it, in sRGB; the backdrop filter's own
// dimming or lightening is left out, so the floor holds wherever the filter thins with the tint.
function getGlassTintFloor(luminance: number, texture: number, ink: GlassInk, contrast = GLASS_TEXT_CONTRAST): number {
  const spread = Math.min(1, Math.max(0, Number(texture) || 0)) / 2;
  const mean = Math.min(1, Math.max(0, Number(luminance) || 0));
  const backdrop = ink === 'light' ? Math.min(1, mean + spread) : Math.max(0, mean - spread);
  const tint = TINT_LEVEL[ink];
  const reads = (alpha: number) => getContrastRatio(INK_RGB[ink], gray(backdrop + (tint - backdrop) * alpha)) >= contrast;
  if (reads(0)) {
    return 0;
  }
  if (!reads(MAX_TINT_FLOOR)) {
    return MAX_TINT_FLOOR;
  }
  // More tint only ever moves the plate toward the tint, away from the ink, so halve the range.
  let low = 0;
  let high = MAX_TINT_FLOOR;
  for (let step = 0; step < 16; step += 1) {
    const middle = (low + high) / 2;
    if (reads(middle)) {
      high = middle;
    } else {
      low = middle;
    }
  }
  return high;
}

export { GLASS_TEXT_CONTRAST, getGlassTintFloor };
export type { GlassInk };
