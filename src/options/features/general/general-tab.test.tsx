import { afterEach, describe, expect, it } from 'vitest';
import { expectElement, getElement, getTags } from '../../../../tests/fakes/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import { LabsTab } from '../labs/labs-tab';
import { GeneralTab } from './general-tab';

const UPDATE_NOTICE = '_x_extension_update_notice_toggle_2026_unique_';
const AUTO_PIP = '_x_extension_auto_pip_toggle_2024_unique_';
const TAB_SWITCHER = '_x_extension_tab_switcher_toggle_2026_unique_';
const TAB_POSITION = '_x_extension_search_result_tab_position_select_2026_unique_';

function settingRow(host: HTMLElement, inputId: string): HTMLElement {
  return expectElement(getElement(host, `#${inputId}`).closest('._x_extension_setting_row_2024_unique_'), `the row of #${inputId}`);
}

const isBefore = (first: Node, second: Node) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

afterEach(cleanUpOptionsViews);

describe('Options General tab', () => {
  it('draws its sections in their order with a divider between each two', () => {
    const { host } = renderOptionsView(<GeneralTab />);
    const titles = getTags(host, '._x_extension_section_title_2024_unique_', 'p').map((title) => title.textContent);
    expect(titles).toEqual(['全局设置', '功能', '搜索结果设置', '网页聚焦搜索浮层', '新标签页设置', '快捷键设置']);
  });

  it('holds the feedback section and lists picture-in-picture after the update notice, then the tab switcher, then the search results', () => {
    const { host } = renderOptionsView(<GeneralTab />);
    const updateNotice = settingRow(host, UPDATE_NOTICE);
    const autoPip = settingRow(host, AUTO_PIP);
    const tabSwitcher = settingRow(host, TAB_SWITCHER);
    const tabPosition = getElement(host, `#${TAB_POSITION}`);
    expect(isBefore(updateNotice, autoPip)).toBe(true);
    expect(isBefore(autoPip, tabSwitcher)).toBe(true);
    expect(isBefore(tabSwitcher, tabPosition)).toBe(true);
    expect(host.querySelector('#_x_extension_feedback_support_2026_unique_')).not.toBeNull();
    // The browser sync status lives on the Account tab.
    expect(host.querySelector('#lumno-browser-sync-title')).toBeNull();
  });

  it('places the result limit between the result types and the open tabs shown by default', () => {
    const { host } = renderOptionsView(<GeneralTab />);
    const [sources, limit, openTabs] = [
      '_x_extension_search_result_source_types_2026_unique_',
      '_x_extension_search_result_display_limit_setting_row_2026_unique_',
      '_x_extension_overlay_open_tabs_default_visible_toggle_2026_unique_'
    ].map((id) => getElement(host, `#${id}`));
    expect(isBefore(sources, limit) && isBefore(limit, openTabs)).toBe(true);
  });

  it('leaves picture-in-picture and the tab switcher out of Labs', () => {
    const { host } = renderOptionsView(<LabsTab />);
    expect(host.querySelector(`#${AUTO_PIP}`)).toBeNull();
    expect(host.querySelector(`#${TAB_SWITCHER}`)).toBeNull();
  });
});
