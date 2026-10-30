import { describe, expect, it } from 'vitest';
import { parseCss, readStylesheet } from '../../fakes/css';

// The page theme adaptation row applies only while the color mode follows
// the system; the shipped stylesheet hides it for an explicit mode before the
// page script runs.

describe('Options page theme adaptation row', () => {
  it.each(['light', 'dark'])('is hidden by the stylesheet in explicit %s mode', (mode) => {
    const hidden = parseCss(readStylesheet('src/options/options.css'))
      .rule(`html[data-options-theme-mode="${mode}"] #_x_extension_overlay_page_theme_adaptation_row_2026_unique_`);
    expect(hidden && [hidden.get('display'), hidden.priority('display')]).toEqual(['none', 'important']);
  });
});
