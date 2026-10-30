import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Settings from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import { NewtabLookSection } from './newtab-look-section';
import { getElement, getTag, getTags } from '../../../../tests/fakes/dom';

const TIME_FONT = '_x_extension_newtab_time_font_select_2026_unique_';

async function setUp() {
  const view = renderOptionsView(<NewtabLookSection />);
  // The selects mount their menus once their frames exist.
  await act(async () => {});
  const store = (setting: Setting<unknown>, raw: unknown) => view.settings.change(setting, raw);
  return { ...view, store, notifyNewtabSectionsRefresh: view.notifyNewtab };
}

const expanded = (host: HTMLElement, id: string) => getElement(host, `#${id}`).dataset.expanded;

function pick(selectId: string, value: string) {
  act(() => getElement(document, `[data-select="${selectId}"] ._x_extension_select_trigger_2024_unique_`).click());
  const option = getElement(document, `#${selectId}_control_menu [role="option"][data-value="${value}"]`);
  act(() => {
    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    option.click();
  });
}

afterEach(cleanUpOptionsViews);

describe('Options Appearance New Tab look section', () => {

  it('offers the material\'s light or dark choice only with a glass material', async () => {
    const { host, writes, store, settings } = await setUp();
    const glassTheme = '_x_extension_newtab_glass_theme_subrows_2026_unique_';
    expect(expanded(host, glassTheme)).toBe('false');
    pick('_x_extension_newtab_glass_style_select_2026_unique_', 'liquid');
    await settings.settle();
    expect(writes).toEqual([{ [Settings.newtabGlassStyle.key]: 'liquid' }]);
    expect(expanded(host, glassTheme)).toBe('true');
    act(() => getElement(host, '[data-newtab-glass-theme="dark"]').click());
    await settings.settle();
    expect(writes.at(-1)).toEqual({ [Settings.newtabGlassTheme.key]: 'dark' });
    await store(Settings.newtabGlassStyle, 'none');
    expect(expanded(host, glassTheme)).toBe('false');
    const description = getElement(host, '#_x_extension_newtab_glass_theme_row_2026_unique_ ._x_extension_setting_desc_2024_unique_');
    expect(description.classList.contains('_x_extension_setting_desc_lines_2026_unique_')).toBe(true);
  });

  it('saves the content width and asks open New Tab pages to redraw', async () => {
    const { host, writes, notifyNewtabSectionsRefresh, settings } = await setUp();
    act(() => getElement(host, '[data-newtab-width="standard"]').click());
    await settings.settle();
    expect(writes).toEqual([{ [Settings.newtabWidthMode.key]: 'standard' }]);
    expect(notifyNewtabSectionsRefresh).toHaveBeenCalledWith('all');
    expect(getTag(host, '#_x_extension_newtab_width_select_2026_unique_', 'select').value).toBe('standard');
  });

  it('shows the clock options only while New Tab shows the time', async () => {
    const { host, writes, store, settings } = await setUp();
    const time = '_x_extension_newtab_time_subrows_2026_unique_';
    await store(Settings.newtabTopContentMode, Settings.NEWTAB_TOP_CONTENT_BRAND);
    expect(expanded(host, time)).toBe('false');
    // The same choices as New Tab's own panel.
    expect(getTags(host, '[data-newtab-top-content]', 'button').map((button) => button.dataset.newtabTopContent))
      .toEqual(['brand', 'time', 'off']);
    act(() => getElement(host, '[data-newtab-top-content="time"]').click());
    await settings.settle();
    expect(writes).toEqual([{ [Settings.newtabTopContentMode.key]: 'time' }]);
    expect(expanded(host, time)).toBe('true');
    expect(getTags(host, `#${time} ._x_extension_setting_row_2024_unique_`, 'div').map((row) => row.id)).toEqual(
      ['font', 'font_weight', 'font_size', 'opacity', 'ink', 'seconds', '12_hour']
        .map((name) => `_x_extension_newtab_time_${name}_row_2026_unique_`)
    );
  });

  it('opens each face at its own default weight, saved with the face', async () => {
    const { host, writes, settings } = await setUp();
    const face = Settings.NEWTAB_TIME_FONTS.find((font) => font.id !== Settings.newtabTimeFont.parse(undefined));
    if (!face) {
      throw new Error('expected a second clock face');
    }
    pick(TIME_FONT, face.id);
    await settings.settle();
    expect(writes).toEqual([{
      [Settings.newtabTimeFont.key]: face.id,
      [Settings.newtabTimeFontWeight.key]: face.defaultWeight
    }]);
    const slider = getTag(host, '#_x_extension_newtab_time_font_weight_slider_2026_unique_', 'input');
    expect([slider.min, slider.max, slider.value]).toEqual([String(face.minWeight), String(face.maxWeight), String(face.defaultWeight)]);
  });

  it('saves the clock sliders, color and switches', async () => {
    const { host, writes, settings } = await setUp();
    const slider = getTag(host, '#_x_extension_newtab_time_opacity_slider_2026_unique_', 'input');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(slider, '60');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => getElement(host, '[data-newtab-time-ink="light"]').click());
    act(() => getTag(host, '#_x_extension_newtab_time_12_hour_toggle_2026_unique_', 'input').click());
    await settings.settle();
    expect(writes).toEqual([
      { [Settings.newtabTimeOpacity.key]: 60 },
      { [Settings.newtabTimeInk.key]: 'light' },
      { [Settings.newtabTime12Hour.key]: !Settings.newtabTime12Hour.parse(undefined) }
    ]);
    expect(getTag(host, '#_x_extension_newtab_time_12_hour_toggle_2026_unique_', 'input').dataset.i18nAriaLabel)
      .toBe('newtab_time_12_hour_title');
  });
});
