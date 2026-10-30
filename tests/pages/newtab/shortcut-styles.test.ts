import { describe, expect, it } from 'vitest';
import { parsePageCss, parseStylesheet, type ParsedCss } from '../../fakes/css';

// The shortcut rail, tiles, context menu and editor as New Tab ships their
// styles, and how they line up with the floating panels and with Settings.

const newtab = parsePageCss('newtab.html');
const dialog = parseStylesheet('src/newtab/shortcuts/shortcut-dialog.css');
const options = parsePageCss('src/options/options.html');

const normalize = (value: string) => value.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();

function get(css: ParsedCss, selector: string, property: string): string | null {
  return css.rule(selector)?.get(property) ?? null;
}

// Whether any rule declares `property` with `value` (or a value starting
// with it).
function anyDeclares(css: ParsedCss, property: string, value: string, prefix = false): boolean {
  return css.entries.some((entry) => {
    const declared = normalize(entry.style.getPropertyValue(property));
    return declared !== '' && (prefix ? declared.startsWith(value) : declared === value);
  });
}

function hasContinuousCorners(css: ParsedCss, selector: string): boolean {
  return css.rule(selector, /corner-shape:\s*superellipse\(1\.25\)/)?.get('corner-shape') === 'superellipse(1.25)';
}

describe('the shortcut rail', () => {
  it('styles the rail, its tiles, the add tile, the favicon mask and the context menu', () => {
    ['.x-nt-shortcuts-section', '.x-nt-shortcut-tile', '.x-nt-shortcut-tile--add', '.x-nt-shortcut-favicon-mask', '.x-nt-shortcut-context-menu']
      .forEach((selector) => expect(newtab.selectors().some((item) => item.includes(selector)), selector).toBe(true));
  });

  it('reserves its final row height and stays hidden until the stored shortcuts are drawn', () => {
    expect(anyDeclares(newtab, '--x-nt-shortcuts-reserved-height', '82px')).toBe(true);
    expect(anyDeclares(newtab, 'min-height', 'var(--x-nt-shortcuts-reserved-height, 82px)')).toBe(true);
    expect(newtab.selectors()).toContain('body:not([data-nt-ready="1"]) .x-nt-shortcuts-section');
  });

  it('wraps by the chosen per-row count, centering partial rows and aligning magnified icons at the bottom', () => {
    expect(newtab.entries.some((entry) => entry.style.getPropertyValue('--x-nt-shortcut-columns') === '10')).toBe(true);
    expect(get(newtab, '.x-nt-shortcuts-section', 'width')).toBe('min(90vw, var(--x-nt-shortcuts-target-width, 692px))');
    expect(['display', 'flex-wrap', 'justify-content', 'align-items'].map((name) => get(newtab, '.x-nt-shortcuts-grid', name)))
      .toEqual(['flex', 'wrap', 'center', 'flex-end']);
    expect(get(newtab, '.x-nt-shortcuts-grid', 'gap')).toBe('var(--x-nt-shortcuts-grid-row-gap, 10px) var(--x-nt-shortcuts-grid-column-gap, 4px)');
    expect(anyDeclares(newtab, '--x-nt-shortcut-user-row-gap', '10px')).toBe(true);
    expect(anyDeclares(newtab, '--x-nt-shortcut-user-column-gap', '4px')).toBe(true);
  });

  it('flows the default geometry through the variables Settings controls', () => {
    const tokens = newtab.entries.find((entry) => entry.style.getPropertyValue('--x-nt-shortcut-tile-size'));
    expect(tokens && [tokens.style.getPropertyValue('--x-nt-shortcut-tile-size'), tokens.style.getPropertyValue('--x-nt-shortcuts-grid-row-gap')]
      .map((value) => value.trim())).toEqual(['var(--x-nt-shortcut-user-tile-size)', 'var(--x-nt-shortcut-user-row-gap)']);
    expect(anyDeclares(newtab, '--x-nt-shortcut-user-tile-size', '64px')).toBe(true);
    expect(anyDeclares(newtab, '--x-nt-shortcut-user-icon-size', '48px')).toBe(true);
    expect(anyDeclares(newtab, '--x-nt-shortcut-user-favicon-size', '28px')).toBe(true);
  });

  it.each(['compact', 'tiny'])('keeps the size and spacing chosen in Settings at %s dock density, and the horizontal padding', (density) => {
    const rule = newtab.rule(`body[data-nt-bottom-dock-density="${density}"]`);
    expect(rule).not.toBeNull();
    (rule?.names() || []).forEach((name) => {
      expect(name).not.toMatch(/--x-nt-shortcut-(tile|icon|favicon)-size|--x-nt-shortcut-tile-padding|--x-nt-shortcuts-grid-(row|column)-gap/);
    });
    expect(rule?.get('--x-nt-shortcuts-grid-padding')).toMatch(/^\d+px 8px \d+px$/);
  });

  it('does not cap the chosen size in short windows', () => {
    newtab.entries.filter((entry) => entry.conditions.some((condition) => /max-height/.test(condition))).forEach((entry) => {
      expect(entry.style.getPropertyValue('--x-nt-shortcut-tile-size')).not.toMatch(/^min\(/);
    });
  });

  it('themes the shared slider rather than drawing its own', () => {
    expect(newtab.selectors().filter((selector) => /\.x-nt-overlay-slider::-webkit-slider-(thumb|runnable-track)|\.x-nt-overlay-tick/.test(selector)))
      .toEqual([]);
  });
});

describe('shortcut icons', () => {
  const icon = (property: string) => get(newtab, '.x-nt-shortcut-icon', property);

  it('are smooth rounded squares through a continuous-corner mask, with no border or shadow', () => {
    expect(anyDeclares(newtab, '--x-nt-shortcut-user-icon-radius', '16px')).toBe(true);
    expect(anyDeclares(newtab, '--x-nt-shortcut-favicon-radius', 'max(', true)).toBe(true);
    expect(anyDeclares(newtab, '--x-nt-shortcut-smooth-mask-outer', 'url("data:image/svg+xml,', true)).toBe(true);
    expect(anyDeclares(newtab, '--x-nt-shortcut-smooth-mask-inner', 'url("data:image/svg+xml,', true)).toBe(true);
    expect(icon('border-radius')).toBe('var(--x-nt-shortcut-icon-radius, 16px)');
    expect(icon('-webkit-mask-image')).toBe('var(--x-nt-shortcut-smooth-mask-outer)');
    expect(icon('mask-image')).toBe('var(--x-nt-shortcut-smooth-mask-outer)');
    expect(icon('border')).toBe('0');
    expect(icon('box-shadow')).toBe('none');
  });

  it('start at the compact dock size and magnify through a transform, promoted only while the dock is hovered', () => {
    expect(icon('width')).toBe('var(--x-nt-shortcut-icon-size, 48px)');
    expect(icon('transform')).toMatch(/^translate3d\(/);
    expect(icon('transition')).not.toBeNull();
    expect(icon('will-change')).toBe('auto');
    expect(newtab.selectors()).toContain('.x-nt-shortcut-tile[data-dock-distance] .x-nt-shortcut-icon');
  });

  it('prefer the wallpaper-adaptive background, then the site\'s theme background', () => {
    expect(icon('background')).toBe('var(--x-nt-shortcut-wallpaper-icon-bg, var(--x-nt-shortcut-icon-bg, rgba(241, 245, 249, 0.9)))');
  });

  it('give the add tile a softer surface than a site, slightly lighter in the dark theme', () => {
    expect(get(newtab, '.x-nt-shortcut-icon--add', 'background')).toBe('var(--x-nt-shortcut-add-bg, rgba(248, 250, 252, 0.92))');
    expect(get(newtab, 'body[data-theme="dark"] .x-nt-shortcut-icon--add', 'background')).toBe('var(--x-nt-shortcut-add-bg, rgba(255, 255, 255, 0.13))');
  });

  it('clip the favicon in a nested mask without a surface of its own, and never drag the image', () => {
    const mask = (property: string) => get(newtab, '.x-nt-shortcut-favicon-mask', property);
    expect(mask('width')).toBe('var(--x-nt-shortcut-favicon-size, 28px)');
    expect(mask('border-radius')).toBe('var(--x-nt-shortcut-favicon-radius, 8px)');
    expect(mask('overflow')).toBe('hidden');
    expect(mask('background')).toBeNull();
    expect(mask('-webkit-mask-image')).toBe('var(--x-nt-shortcut-smooth-mask-inner)');
    expect(mask('mask-image')).toBe('var(--x-nt-shortcut-smooth-mask-inner)');
    expect(get(newtab, '.x-nt-shortcut-favicon', 'border-radius')).toBe('inherit');
    expect(get(newtab, '.x-nt-shortcut-favicon', '-webkit-user-drag')).toBe('none');
  });

  it('keep the shared fallback surface for unavailable artwork, and the neutral site tile for folders', () => {
    [
      '.x-nt-shortcut-icon:has(.x-nt-shortcut-favicon[data-fallback-icon="true"])',
      '.x-nt-shortcut-icon:has(.x-nt-shortcut-favicon[data-favicon-placeholder="true"])',
      '.x-nt-shortcut-icon:has(.x-nt-favicon-fallback[data-visible="true"])'
    ].forEach((selector) => expect(get(newtab, selector, '--x-nt-shortcut-icon-bg'), selector).toBe('var(--x-nt-shortcut-fallback-icon-bg)'));
    // Folders do not follow the wallpaper-sampled fallback surface.
    expect(newtab.entries.some((entry) => entry.selectors.some((selector) => selector.includes('.x-nt-shortcut-icon--folder')) &&
      entry.selectors.some((selector) => selector.startsWith('.x-nt-shortcut-icon:has(')))).toBe(false);
    expect(get(newtab, '.x-nt-shortcut-icon--folder', '--x-nt-shortcut-icon-bg')).toBe('var(--x-nt-shortcut-folder-icon-bg)');
  });
});

describe('the shortcut dock', () => {
  it('follows the pointer smoothly, magnifying the hovered icon without overshooting', () => {
    expect(anyDeclares(newtab, '--x-nt-shortcut-dock-duration', '300ms')).toBe(true);
    expect(anyDeclares(newtab, '--x-nt-shortcut-dock-ease', 'cubic-bezier(0.22, 1, 0.36, 1)')).toBe(true);
    // Through the frame loop, not a restarted transition.
    expect(anyDeclares(newtab, '--x-nt-shortcut-dock-follow-duration', '0ms')).toBe(true);
    const hovered = '.x-nt-shortcut-tile[data-dock-distance="0"]';
    expect(get(newtab, hovered, '--x-nt-shortcut-dock-scale')).toBe('var(--x-nt-shortcut-hover-scale-near, 1.28)');
    expect(get(newtab, hovered, '--x-nt-shortcut-dock-rise')).toBe('var(--x-nt-shortcut-hover-rise-near, -6px)');
    expect(anyDeclares(newtab, '--x-nt-shortcut-hover-scale-near', '1.28')).toBe(true);
    expect(anyDeclares(newtab, '--x-nt-shortcut-hover-rise-near', '-6px')).toBe(true);
  });

  it('moves the neighbours on either side away from the hovered icon', () => {
    expect(newtab.selectors()).toContain('.x-nt-shortcut-tile[data-dock-side="before"][data-dock-distance="1"]');
    expect(newtab.selectors()).toContain('.x-nt-shortcut-tile[data-dock-side="after"][data-dock-distance="1"]');
  });

  it('keeps icons still with magnification off, lightly shading only the hovered one', () => {
    const off = '.x-nt-shortcuts-grid[data-dock-magnification="false"] .x-nt-shortcut-tile';
    expect(['--x-nt-shortcut-dock-scale', '--x-nt-shortcut-dock-shift-x', '--x-nt-shortcut-dock-rise'].map((name) => get(newtab, off, name)))
      .toEqual(['1', '0px', '0px']);
    expect(newtab.selectors()).toContain('.x-nt-shortcuts-grid[data-dock-magnification="false"] .x-nt-shortcut-tile:not([data-shortcut-dragging="true"])' +
      ':not([data-shortcut-dropping="true"]):not([data-shortcut-context-menu-open="true"]):hover .x-nt-shortcut-icon');
    expect(anyDeclares(newtab, 'filter', 'brightness(0.96)')).toBe(true);
    expect(anyDeclares(newtab, 'filter', 'brightness(1.06)')).toBe(true);
  });

  it('respects reduced motion', () => {
    expect(newtab.entries.some((entry) => entry.conditions.includes('(prefers-reduced-motion: reduce)'))).toBe(true);
  });
});

describe('dragging shortcuts', () => {
  it('shows a drag affordance and feedback, keeps the dropped tile above the row and grabs over the gaps', () => {
    expect(newtab.selectors()).toContain('.x-nt-shortcut-tile[data-shortcut-draggable="true"]');
    expect(newtab.selectors()).toContain('.x-nt-shortcut-tile[data-shortcut-dragging="true"] .x-nt-shortcut-icon');
    expect(newtab.selectors()).toContain('.x-nt-shortcut-tile[data-shortcut-dropping="true"] .x-nt-shortcut-icon');
    expect(get(newtab, '.x-nt-shortcuts-grid[data-shortcut-dragging="true"]', 'cursor')).toBe('grabbing');
    expect(get(newtab, '.x-nt-shortcuts-grid[data-shortcut-dragging="true"] .x-nt-shortcut-tile', 'cursor')).toBe('grabbing');
  });
});

describe('the shortcut context menu', () => {
  const portal = '.x-nt-shortcut-context-menu-portal';
  const option = `${portal} ._x_extension_select_option_2024_unique_`;
  const px = (property: string) => Number((get(newtab, portal, property) || '').replace(/px$/, ''));

  it('anchors a 1px point at the right-click and reuses the shared select trigger and portal', () => {
    expect(get(newtab, '.x-nt-shortcut-context-menu', 'position')).toBe('fixed');
    expect(get(newtab, '.x-nt-shortcut-context-menu', 'width')).toBe('1px');
    expect(newtab.selectors()).toContain('.x-nt-shortcut-context-menu ._x_extension_select_trigger_2024_unique_');
    expect(newtab.selectors()).toContain(portal);
  });

  it('derives its option radius from its outer radius and full inset', () => {
    expect([px('--x-nt-context-menu-radius'), px('--x-nt-context-menu-border-width'), px('--x-nt-context-menu-padding')]).toEqual([16, 1, 5]);
    expect(px('--x-nt-context-menu-radius') - px('--x-nt-context-menu-border-width') - px('--x-nt-context-menu-padding')).toBe(10);
    expect(get(newtab, portal, '--x-nt-context-menu-option-radius'))
      .toBe('calc(var(--x-nt-context-menu-radius) - var(--x-nt-context-menu-border-width) - var(--x-nt-context-menu-padding))');
    expect(get(newtab, portal, 'border-radius')).toBe('var(--x-nt-context-menu-radius, 16px)');
    expect(get(newtab, portal, 'padding')).toBe('var(--x-nt-context-menu-padding, 5px)');
    expect(get(newtab, option, 'border-radius')).toBe('var(--x-nt-context-menu-option-radius, 10px)');
  });

  it('opens on a solid surface in each theme, without a backdrop blur to delay it', () => {
    expect(get(newtab, portal, 'background')).toBe('rgb(255 255 255)');
    expect(get(newtab, portal, 'backdrop-filter')).toBeNull();
    expect(get(newtab, `body[data-theme="dark"] ${portal}`, 'background')).toBe('rgb(31 31 31)');
  });

  it('keeps the shortcut it is open for in a slightly darker hover state', () => {
    expect(get(newtab, '.x-nt-shortcut-tile[data-shortcut-context-menu-open="true"] .x-nt-shortcut-icon', 'filter')).toMatch(/^brightness\(/);
  });

  it('gives its shell and options continuous corners where supported', () => {
    [portal, option].forEach((selector) => expect(hasContinuousCorners(newtab, selector), selector).toBe(true));
  });
});

describe('the shortcut editor beside the other floating surfaces', () => {
  it('matches the bottom-right floating panel\'s corners and shadow', () => {
    ['border-radius', 'box-shadow'].forEach((property) => {
      expect(get(dialog, '.x-nt-shortcut-dialog', property), property).toBe(get(newtab, '.x-nt-wallpaper-panel', property));
    });
  });

  it('uses the Settings input tokens, as New Tab does', () => {
    const settingsPanel = '#_x_extension_settings_panel_2024_unique_';
    ['--input-focus-color', '--input-focus-shadow', '--input-placeholder', '--input-focus-bg'].forEach((property) => {
      expect(get(newtab, ':root', property), property).toBe(get(options, settingsPanel, property));
    });
    ['--input-focus-color', '--input-focus-shadow', '--input-placeholder', '--input-focus-bg', '--control-bg', '--tab-border'].forEach((property) => {
      expect(get(dialog, '.x-nt-shortcut-dialog', property), property).toBe(get(options, settingsPanel, property));
    });
  });

  it('draws its affixed inputs as Settings does', () => {
    const affix = '._x_extension_shortcut_input_affix_2026_unique_';
    const input = '._x_extension_shortcut_input_2024_unique_';
    ['display', 'align-items', 'gap', 'border-radius', 'border', 'background', 'transition', 'overflow'].forEach((property) => {
      expect(get(dialog, `.x-nt-shortcut-dialog ${affix}`, property), property).toBe(get(options, affix, property));
    });
    ['border', 'background', 'border-radius', 'padding-left', 'flex', 'min-width'].forEach((property) => {
      expect(get(dialog, `.x-nt-shortcut-dialog ${affix} ${input}`, property), property).toBe(get(options, `${affix} ${input}`, property));
    });
  });

  it('shares continuous corners with New Tab\'s floating panels and Settings\' popups', () => {
    ['.x-nt-wallpaper-panel', '.x-nt-feedback-popover', '.x-nt-bookmark-cascade-level']
      .forEach((selector) => expect(hasContinuousCorners(newtab, selector), selector).toBe(true));
    ['._x_extension_popconfirm_2024_unique_', '._x_extension_confirm_dialog_2024_unique_']
      .forEach((selector) => expect(hasContinuousCorners(options, selector), selector).toBe(true));
  });
});
