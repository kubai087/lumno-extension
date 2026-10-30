import { describe, expect, it } from 'vitest';
import optionsHtml from '../../../src/options/options.html?raw';
import { parsePageCss } from '../../fakes/css';
import type { CssRule } from '../../fakes/css';

// The Options page's markup and styles as shipped, before React draws.

const css = parsePageCss('src/options/options.html');
const shipped = new DOMParser().parseFromString(optionsHtml, 'text/html');

function rule(selector: string): CssRule {
  const found = css.rule(selector);
  if (!found) {
    throw new Error(`The Options page has no rule for ${selector}`);
  }
  return found;
}

function values(selector: string, names: string[]): Array<string | null> {
  const found = rule(selector);
  return names.map((name) => found.get(name));
}

describe('Options page markup', () => {
  it('announces its toast politely and as a whole before React mounts', () => {
    const toast = shipped.getElementById('_x_extension_toast_2024_unique_');
    expect(['role', 'aria-live', 'aria-atomic'].map((name) => toast?.getAttribute(name))).toEqual(['status', 'polite', 'true']);
  });

  it('loads the shared switch', () => {
    expect(shipped.querySelector('link[rel="stylesheet"][href="../shared/ui/switch.css"]')).not.toBeNull();
  });

  it('marks value pickers as toggle-button groups, not tab lists without panels', () => {
    expect(shipped.querySelector('[class*="_x_extension_inline_tabs_2024_unique_"][role="tablist"]')).toBeNull();
  });

  it('makes the version a button that opens the changelog', () => {
    const version = shipped.getElementById('_x_extension_settings_version_2024_unique_');
    expect(version?.tagName).toBe('BUTTON');
    expect(version?.getAttribute('type')).toBe('button');
    expect(version?.classList.contains('_x_extension_settings_version_badge_2024_unique_')).toBe(true);
    expect([version?.getAttribute('data-tooltip'), version?.getAttribute('data-i18n-tooltip')])
      .toEqual(['查看更新日志', 'settings_version_tooltip']);
  });
});

describe('Options page styles', () => {
  it('gives icon buttons, segmented options and theme cards a keyboard focus ring', () => {
    [
      '._x_extension_shortcut_group_action_2024_unique_:focus-visible',
      '._x_extension_shortcut_edit_2024_unique_:focus-visible',
      '._x_extension_shortcut_remove_2024_unique_:focus-visible',
      // Despite their all: unset.
      '._x_extension_theme_option_2024_unique_:focus-visible',
      '._x_extension_theme_gallery_2026_unique_ ._x_extension_theme_option_2024_unique_:focus-visible ._x_extension_theme_preview_2026_unique_'
    ].forEach((selector) => {
      expect(rule(selector).get('outline'), selector).toBe('2px solid var(--input-focus-color)');
    });
  });

  it('hides closed confirmations, growing leftward from their right-edge trigger, and shows open ones', () => {
    const closed = rule('._x_extension_popconfirm_2024_unique_');
    expect([closed.get('visibility'), closed.get('right')]).toEqual(['hidden', '0']);
    expect(closed.get('transform')).toMatch(/^translateY\(-6px\)/);
    expect(rule('._x_extension_popconfirm_2024_unique_[data-open="true"]').get('visibility')).toBe('visible');
  });

  it('makes disabled header actions look unavailable', () => {
    expect(rule('._x_extension_shortcut_group_action_2024_unique_:disabled').get('cursor')).toBe('not-allowed');
  });

  it('leaves no space under a card header for a collapsed item editor', () => {
    expect(values('._x_extension_shortcut_editor_2024_unique_', ['margin-top', 'padding-top', 'border-top']))
      .toEqual(['-12px', '0', '1px dashed transparent']);
  });

  it('gives every settings tab the same bottom spacing, without padding of its own', () => {
    expect(rule('._x_extension_settings_content_2024_unique_').get('padding-bottom')).toBe('0');
  });

  it('lets the settings panel own its height animation, its children keeping their height', () => {
    expect(values('#_x_extension_settings_panel_2024_unique_[data-height-animating="true"]', ['overflow', 'overflow-anchor', 'will-change']))
      .toEqual(['clip', 'none', 'height']);
    expect(rule('#_x_extension_settings_panel_2024_unique_[data-height-animating="true"] > *').get('flex-shrink')).toBe('0');
  });

  it('keeps a transparent scroll reserve outside the panel', () => {
    expect(values('#_x_extension_options_root_2024_unique_', ['--settings-focus-anchor-reserve', 'margin-bottom']))
      .toEqual(['0px', 'var(--settings-focus-anchor-reserve)']);
  });

  it('hides a conditional setting\'s whole row, not just its control', () => {
    const hidden = rule('._x_extension_setting_row_2024_unique_[hidden]');
    expect([hidden.get('display'), hidden.priority('display')]).toEqual(['none', 'important']);
  });

  it('lays the feedback channels out as one row of equal, filled tiles', () => {
    expect(values('._x_extension_feedback_support_links_2026_unique_', ['display', 'grid-auto-flow', 'grid-auto-columns']))
      .toEqual(['grid', 'column', 'minmax(0, 1fr)']);
    expect(rule('._x_extension_feedback_support_link_2026_unique_').get('background')).toBe('var(--feedback-support-link-bg)');
  });

  it('shows the version button as clickable, with a hover background in both themes', () => {
    const badge = '._x_extension_settings_version_badge_2024_unique_';
    expect(rule(badge).get('cursor')).toBe('pointer');
    expect(rule(`${badge}:hover`).get('background')).toBe('rgba(255, 255, 255, 0.56)');
    expect(rule(`body[data-theme="dark"] ${badge}:hover`).get('background')).toBe('rgba(255, 255, 255, 0.12)');
  });
});
