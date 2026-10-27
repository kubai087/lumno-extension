import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Settings from '../../../domain/settings';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/react/options-page';
import { AppearanceGlobalSection } from './global-section';
import { getElement, getTag, getTags } from '../../../../tests/react/dom';

const MOTION = '_x_extension_motion_effects_toggle_2026_unique_';
const SIMPLE = '_x_extension_simple_mode_toggle_2026_unique_';

function setUp() {
  return renderOptionsView(<AppearanceGlobalSection />);
}

afterEach(cleanUpOptionsViews);

describe('Options Appearance global section', () => {
  it('lists the theme, then motion effects, then simple mode', () => {
    const { host } = setUp();
    const themeRow = getElement(host, '#_x_extension_theme_mode_row_2026_unique_');
    const motion = getTag(host, `#${MOTION}`, 'input');
    const simple = getTag(host, `#${SIMPLE}`, 'input');
    expect(themeRow.compareDocumentPosition(motion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(motion.compareDocumentPosition(simple) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps its copy and defaults: motion on with its guidance, simple mode off with its description', () => {
    const { host } = setUp();
    expect(getTag(host, `#${MOTION}`, 'input').checked).toBe(true);
    expect(getTag(host, `#${SIMPLE}`, 'input').checked).toBe(false);
    const motionRow = getTag(host, `#${MOTION}`, 'input').closest('._x_extension_setting_row_2024_unique_');
    const info = motionRow ? getElement(motionRow, '._x_extension_info_button_2026_unique_') : null;
    expect(info?.dataset.tooltip).toBe('如遇卡顿，或倾向于更利落的唤起方式，可关闭');
    const simpleRow = getTag(host, `#${SIMPLE}`, 'input').closest('._x_extension_setting_row_2024_unique_');
    expect(simpleRow ? getElement(simpleRow, '._x_extension_setting_desc_2024_unique_').textContent : '')
      .toBe('移除更多提示元素，使搜索框更简洁');
  });

  it('saves a switched setting', async () => {
    const { host, writes, settings } = setUp();
    act(() => getTag(host, `#${SIMPLE}`, 'input').click());
    await settings.settle();
    expect(writes).toEqual([{ [Settings.simpleModeEnabled.key]: true }]);
  });

  it('shows the page\'s color mode in the gallery and saves a choice', async () => {
    const { host, page, writes, settings } = setUp();
    act(() => page.pageTheme.store.setState({ mode: 'dark' }));
    const buttons = getTags(host, '._x_extension_theme_gallery_2026_unique_ button', 'button');
    expect(buttons.map((button) => button.dataset.active)).toEqual(['false', 'false', 'true']);
    act(() => buttons[0]?.click());
    await settings.settle();
    expect(writes).toEqual([{ [Settings.themeMode.key]: 'system' }]);
  });
});
