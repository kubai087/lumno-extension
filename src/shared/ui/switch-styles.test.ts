import { describe, expect, it } from 'vitest';
import { parseCss, readRepoFile } from '../../../tests/fakes/css';

describe('switch styles', () => {
  // Token references as written, so the ring is seen to follow the shared token.
  const css = parseCss(readRepoFile('src/shared/ui/switch.css'));

  it('rings the visible switch while its hidden checkbox has keyboard focus, in the shared focus colour', () => {
    const ring = css.rule(':is(._x_extension_switch_2024_unique_, .x-nt-wallpaper-switch) input:focus-visible + ' +
      ':is(._x_extension_switch_slider_2024_unique_, .x-nt-wallpaper-switch-slider)');
    expect([ring?.get('outline'), ring?.get('outline-offset')]).toEqual(['2px solid var(--switch-focus-ring)', '2px']);
    expect(css.entries.some((entry) => entry.style.getPropertyValue('--switch-focus-ring').trim() === 'var(--lumno-color-focus-ring)'))
      .toBe(true);
  });
});
