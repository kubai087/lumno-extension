import { afterEach, describe, expect, it } from 'vitest';
import { getTags } from '../../../../tests/fakes/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import { GeneralTab } from './general-tab';

afterEach(cleanUpOptionsViews);

describe('Options General tab', () => {
  it('draws its sections in their order with a divider between each two', () => {
    const { host } = renderOptionsView(<GeneralTab />);
    const titles = getTags(host, '._x_extension_section_title_2024_unique_', 'p').map((title) => title.textContent);
    expect(titles).toEqual(['全局设置', '功能', '搜索结果设置', '网页聚焦搜索浮层', '新标签页设置', '快捷键设置']);
  });
});
