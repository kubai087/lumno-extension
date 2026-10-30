import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SiteSearchList,
  type SiteSearchListOptions,
  type SiteSearchListRenderModel
} from './site-search-list';
import { createReactRootController, type ReactRootController } from '../../shared/react/root-controller';
import { getTags } from '../../../tests/fakes/dom';
import { queryHtmlTag } from '../../shared/dom-lookup';

let controllers: Array<ReactRootController<SiteSearchListRenderModel>> = [];

function renderList(host: HTMLElement, options: SiteSearchListOptions): ReactRootController<SiteSearchListRenderModel> {
  const controller = createReactRootController(
    host,
    (value: SiteSearchListRenderModel) => <SiteSearchList model={value} options={options} />
  );
  controllers.push(controller);
  return controller;
}

const model: SiteSearchListRenderModel = {
  copy: {
    aliasLabel: '别名',
    aliasPlaceholder: '例如 小破站、油管等',
    cancelLabel: '取消',
    categoryLabel: '显示位置',
    confirmLabel: '确认',
    confirmMessage: '确认移除该项？',
    confirmMessageKey: 'confirm_remove_item',
    editLabel: '编辑',
    keyLabel: '触发词',
    keyPlaceholder: '必填，如有多个用英文逗号分隔',
    nameLabel: '显示名称',
    namePlaceholder: '选填，默认使用触发词',
    removeLabel: '移除',
    saveLabel: '保存修改',
    searchEngineCategoryLabel: '搜索引擎',
    siteCategoryLabel: '站内搜索',
    templateHelp: '搜索模板需要包含 {query}',
    templateLabel: '搜索模板'
  },
  items: [
    {
      aliasesText: '视频',
      badgeText: '自定义',
      category: 'site',
      duplicateLabel: '与内置重复',
      duplicateTemplate: 'https://example.com/?q={query}',
      duplicateTooltip: '定位内置项',
      iconUrl: 'https://example.com/favicon.ico',
      id: 'custom:ex',
      isBuiltin: false,
      key: 'ex',
      meta: 'ex · https://example.com/?q={query}',
      name: 'Example',
      normalizedTemplate: 'https://example.com/?q={query}',
      secondaryBadgeText: '站内搜索',
      template: 'https://example.com/?q={query}',
      templateEditable: true
    }
  ],
  placeholder: ''
};

function createFixture() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const options = {
    onLocateDuplicate: vi.fn(),
    onRemove: vi.fn(),
    onSave: vi.fn().mockResolvedValue({ ok: true })
  };
  const controller = renderList(host, options);
  return { controller, host, options };
}

afterEach(() => {
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  controllers = [];
  document.body.textContent = '';
});

describe('Options site-search list', () => {
  it('shows move buttons and marks rows sortable only on orderable lists', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onMove = vi.fn();
    const controller = renderList(host, {
      onLocateDuplicate: vi.fn(),
      onMove,
      onRemove: vi.fn(),
      onSave: vi.fn().mockResolvedValue({ ok: true })
    });
    const second = { ...model.items[0], id: 'builtin:yt', isBuiltin: true, key: 'yt', name: 'YouTube' };
    act(() => controller.render({
      ...model,
      items: [model.items[0], second],
      reorder: { moveDownLabel: '下移', moveUpLabel: '上移' }
    }));

    const rows = host.querySelectorAll('._x_extension_shortcut_item_2024_unique_');
    expect(Array.from(rows).map((row) => row.getAttribute('data-sortable'))).toEqual(['true', 'true']);
    const up = getTags(host, '[data-move="up"]', 'button');
    const down = getTags(host, '[data-move="down"]', 'button');
    expect(up[0]?.disabled).toBe(true);
    expect(down[1]?.disabled).toBe(true);
    expect(down[0]?.getAttribute('aria-label')).toBe('下移');

    act(() => down[0]?.click());
    act(() => up[1]?.click());
    expect(onMove.mock.calls).toEqual([[0, 1], [1, 0]]);

    act(() => controller.render({ ...model, items: [model.items[0], second] }));
    expect(host.querySelector('[data-move]')).toBeNull();
    expect(host.querySelector('[data-sortable]')).toBeNull();
  });

  it('renders provider metadata and legacy classes', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));

    expect(host.querySelector('[data-provider-id="custom:ex"]')).not.toBeNull();
    expect(host.querySelector('._x_extension_shortcut_item_meta_2024_unique_')
      ?.textContent).toContain('{query}');
    expect(host.querySelector('[data-badge-kind="secondary"]')?.textContent)
      .toBe('站内搜索');
  });

  it('renders both category and built-in badges for search-engine cards', () => {
    const { controller, host } = createFixture();
    act(() => controller.render({
      ...model,
      items: [{
        ...model.items[0],
        badgeText: '搜索引擎',
        category: 'searchEngine',
        duplicateLabel: '',
        duplicateTemplate: '',
        duplicateTooltip: '',
        id: 'builtin:gg',
        isBuiltin: true,
        key: 'gg',
        name: 'Google',
        secondaryBadgeText: '内置',
        templateEditable: false
      }]
    }));

    const badges = host.querySelectorAll('._x_extension_shortcut_badge_2024_unique_');
    expect(Array.from(badges).map((badge) => badge.textContent)).toEqual([
      '搜索引擎',
      '内置'
    ]);
  });

  it('edits a provider draft and routes save through the adapter', async () => {
    const { controller, host, options } = createFixture();
    act(() => controller.render(model));
    act(() => {
      queryHtmlTag(host, '._x_extension_shortcut_edit_2024_unique_', 'button')
        ?.click();
    });
    const nameInput = queryHtmlTag(host, '[data-provider-field="name"]', 'input');
    act(() => {
      if (nameInput) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value'
        )?.set;
        valueSetter?.call(nameInput, 'Updated');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      queryHtmlTag(host, '[data-site-search-category="searchEngine"]', 'button')
        ?.click();
    });
    await act(async () => {
      queryHtmlTag(host, '._x_extension_shortcut_editor_2024_unique_ ._x_extension_shortcut_submit_primary_2024_unique_', 'button')?.click();
      await Promise.resolve();
    });

    expect(options.onSave).toHaveBeenCalledWith(
      'ex',
      false,
      expect.objectContaining({ category: 'searchEngine', name: 'Updated' })
    );
  });

  it('keeps the editor expanded when the adapter returns an error', async () => {
    const { controller, host, options } = createFixture();
    options.onSave.mockResolvedValue({ ok: false, error: '触发词不能为空' });
    act(() => controller.render(model));
    act(() => {
      queryHtmlTag(host, '._x_extension_shortcut_edit_2024_unique_', 'button')
        ?.click();
    });
    await act(async () => {
      queryHtmlTag(host, '._x_extension_shortcut_editor_2024_unique_ ._x_extension_shortcut_submit_primary_2024_unique_', 'button')?.click();
      await Promise.resolve();
    });

    expect(host.querySelector('._x_extension_shortcut_error_2024_unique_')?.textContent)
      .toBe('触发词不能为空');
    expect(host.querySelector('[data-expanded="true"]')).not.toBeNull();
  });

  it('routes duplicate location and confirmed removal actions', async () => {
    const { controller, host, options } = createFixture();
    act(() => controller.render(model));
    act(() => {
      queryHtmlTag(host, '._x_extension_shortcut_badge_warn_2024_unique_', 'button')
        ?.click();
      queryHtmlTag(host, '._x_extension_shortcut_remove_2024_unique_', 'button')
        ?.click();
    });
    const confirmButtons = getTags(host, '._x_extension_popconfirm_actions_2024_unique_ button', 'button');
    await act(async () => {
      confirmButtons[1]?.click();
      await Promise.resolve();
    });

    expect(options.onLocateDuplicate).toHaveBeenCalledWith(
      'https://example.com/?q={query}'
    );
    expect(options.onRemove).toHaveBeenCalledWith('ex', false);
  });
});
