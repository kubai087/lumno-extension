import { describe, expect, it } from 'vitest';
import { parsePageCss, parseStylesheet, type CssRule } from '../../fakes/css';

const newtabCss = parsePageCss('newtab.html');

function rule(selector: string): CssRule {
  const found = newtabCss.rule(selector);
  if (!found) throw new Error(`newtab.html does not style ${selector}`);
  return found;
}

// The first rule declaring all of `selectors` together.
function sharedEntry(...selectors: string[]) {
  return newtabCss.entries.find((entry) => selectors.every((selector) => entry.selectors.includes(selector)));
}

describe('the wallpaper effect layers', () => {
  const blurLayer = 'body[data-wallpaper-active="true"][data-wallpaper-effect="blur"]::before';

  it('filter one overscanned copy of the wallpaper for glass blur and its transition snapshot', () => {
    const copy = sharedEntry(blurLayer, '.x-nt-wallpaper-transition-layer[data-wallpaper-effect="blur"]');
    expect(copy).toBeDefined();
    expect(copy?.style.getPropertyValue('inset')).toMatch(/^calc\(0px - var\(--x-nt-wallpaper-blur-overscan/);
    expect(copy?.style.getPropertyValue('filter').replace(/\s+/g, ' ').trim()).toBe(
      'blur(var(--x-nt-wallpaper-blur-radius)) saturate(var(--x-nt-wallpaper-blur-saturate)) brightness(var(--x-nt-wallpaper-blur-brightness)) contrast(var(--x-nt-wallpaper-blur-contrast))'
    );
    expect(rule(blurLayer).get('background-image')).toMatch(/^var\(--x-nt-wallpaper-image,/);
  });

  it('replace the body wallpaper with the blurred copy instead of painting it twice', () => {
    const body = rule('body[data-wallpaper-active="true"][data-wallpaper-effect="blur"]');
    expect([body.get('--x-nt-wallpaper-overlay'), body.get('background-image')]).toEqual(['none', 'none']);
    expect(rule('body::before').get('transition')).toMatch(/opacity 180ms ease/);
  });

  it('fade filter snapshots in the 180ms of the glass background and texture', () => {
    const transition = newtabCss.entries.find((entry) => entry.selectors.some((selector) =>
      selector.includes('.x-nt-wallpaper-transition-layer[data-wallpaper-filter-transition="true"]')) &&
      entry.style.getPropertyValue('transition-duration'));
    expect(transition?.style.getPropertyValue('transition-duration')).toBe('180ms');
  });

  it('draw halftone and ASCII above a wallpaper that stays visible', () => {
    const layered = sharedEntry(
      'body[data-wallpaper-active="true"][data-wallpaper-effect="halftone"]::after',
      'body[data-wallpaper-active="true"][data-wallpaper-effect="ascii"]::after'
    );
    expect(layered?.style.getPropertyValue('opacity')).toBe('0');
    ['halftone', 'ascii'].forEach((type) => {
      expect(newtabCss.rule(`body[data-wallpaper-active="true"][data-wallpaper-effect="${type}"]`)?.get('--x-nt-wallpaper-image'))
        .not.toBe('none');
    });
  });

  it('crossfade a resized effect, hiding the destination canvas without animating it first', () => {
    const resize = sharedEntry('.x-nt-wallpaper-effect-canvas[data-resize-enter="true"]', '.x-nt-wallpaper-effect-canvas[data-resize-exit="true"]');
    expect(resize && [resize.style.getPropertyValue('opacity'), resize.style.getPropertyPriority('opacity')]).toEqual(['0', 'important']);
    const jump = rule('.x-nt-wallpaper-effect-canvas[data-resize-jump="true"]');
    expect([jump.get('transition'), jump.priority('transition')]).toEqual(['none', 'important']);
  });
});

describe('the wallpaper before the content enters', () => {
  it('has no blurred stand-in', () => {
    const declared = newtabCss.entries.flatMap((entry) => entry.style.names).concat(newtabCss.selectors());
    ['--x-nt-wallpaper-placeholder', '--x-nt-wallpaper-backdrop', 'data-wallpaper-placeholder'].forEach((name) => {
      expect(declared.filter((item) => item.includes(name))).toEqual([]);
    });
  });

  it.each(['', '::before', '::after'])('is not blurred by hidden cards before the reveal (%s)', (pseudo) => {
    const hidden = rule(`body:not([data-nt-ready="1"]) :is(*, #_x_extension_newtab_root_2024_unique_)${pseudo}`);
    expect([hidden.get('backdrop-filter'), hidden.priority('backdrop-filter')]).toEqual(['none', 'important']);
  });

  it('gives tiles their sampled colors at once instead of fading through the wallpaper\'s gray', () => {
    expect(rule('body:not([data-nt-enter="done"]) .x-nt-shortcut-icon').get('transition')).toBe('none');
    const glassCss = parseStylesheet('src/newtab/glass-style.css');
    expect(glassCss.rule('body[data-glass-style]:not([data-nt-enter="done"]) :is(.x-nt-shortcut-icon, .x-nt-shortcut-group-header)')
      ?.get('transition')).toBe('none');
  });
});
