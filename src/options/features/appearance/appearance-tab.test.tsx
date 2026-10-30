import { afterEach, describe, expect, it } from 'vitest';
import { getElement, getTags } from '../../../../tests/fakes/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import { AppearanceTab } from './appearance-tab';

afterEach(cleanUpOptionsViews);

describe('Options Appearance tab', () => {
  it('draws its sections in order, with the New Tab parts as one section', () => {
    const { host } = renderOptionsView(<AppearanceTab />);
    const titles = getTags(host, '._x_extension_section_title_2024_unique_', 'p').map((title) => title.textContent);
    expect(titles).toEqual(['全局', '网页聚焦搜索浮层', '新标签页']);
    expect(getTags(host, '._x_extension_setting_divider_wrap_2024_unique_', 'div').length).toBe(2);
  });

  it('ends the webpage overlay section with page theme adaptation', () => {
    const { host } = renderOptionsView(<AppearanceTab />);
    const row = getElement(host, '#_x_extension_overlay_page_theme_adaptation_row_2026_unique_');
    expect(row.nextElementSibling?.classList.contains('_x_extension_setting_divider_wrap_2024_unique_')).toBe(true);
  });
});
