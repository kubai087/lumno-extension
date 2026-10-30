import { describe, expect, it } from 'vitest';
import { parseStylesheet } from '../../../tests/fakes/css';

// The shared range slider New Tab and Settings draw their sliders with.
describe('range slider styles', () => {
  const css = parseStylesheet('src/shared/ui/range-slider.css');

  it('hides a reset with nothing to reset', () => {
    expect(css.rule('.x-range-slider-reset:disabled')?.get('visibility')).toBe('hidden');
  });

  it('puts label, track and value on one row, with the thumb centered on the track', () => {
    expect(css.rule('.x-range-slider-field')?.get('align-items')).toBe('center');
    expect(css.rule('.x-range-slider-input::-webkit-slider-thumb')?.get('margin-top'))
      .toBe('calc((var(--x-range-slider-track-height) - var(--x-range-slider-thumb-size)) / 2)');
  });

  it('gives New Tab a compact icon button fallback for the reset', () => {
    const reset = css.entries.find((entry) => entry.selectors.some((selector) => selector.includes('_x_extension_range_slider_reset_button_2026_unique_')) &&
      entry.style.getPropertyValue('padding'));
    expect(reset && [reset.style.getPropertyValue('padding'), reset.style.getPropertyValue('border-radius')]).toEqual(['4px', '8px']);
  });
});
