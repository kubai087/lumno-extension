import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BlacklistList,
  type BlacklistListRenderModel,
  type BlacklistSaveHandler
} from './blacklist-list';
import { createReactRootController, type ReactRootController } from '../../shared/react/root-controller';
import { getTags } from '../../../tests/fakes/dom';
import { queryHtmlTag } from '../../shared/dom-lookup';

let controllers: Array<ReactRootController<BlacklistListRenderModel>> = [];

function renderList(
  host: HTMLElement,
  onRemove: (key: string) => void | Promise<void>,
  onSave?: BlacklistSaveHandler
): ReactRootController<BlacklistListRenderModel> {
  const controller = createReactRootController(
    host,
    (listModel: BlacklistListRenderModel) => <BlacklistList model={listModel} onRemove={onRemove} onSave={onSave} />
  );
  controllers.push(controller);
  return controller;
}

const model: BlacklistListRenderModel = {
  copy: {
    cancelLabel: '取消',
    confirmLabel: '确认',
    confirmMessage: '确认移除该项？',
    confirmMessageKey: 'confirm_remove_item',
    editLabel: '编辑',
    matchLabel: '匹配方式',
    modeOptions: [
      { label: '当前页面', mode: 'exact', tooltip: '只屏蔽这一页' },
      { label: '当前站点路径', mode: 'prefix', tooltip: '屏蔽当前路径' },
      { label: '整个网站', mode: 'suffix', tooltip: '屏蔽整个网站' }
    ],
    placeholderDomain: 'example.com',
    placeholderExact: 'example.com/path',
    placeholderPrefix: 'example.com or example.com/path',
    removeLabel: '移除',
    saveLabel: '保存修改',
    urlLabel: 'URL 规则'
  },
  editable: true,
  items: [
    {
      badgeText: '整个网站',
      badgeTone: 'suffix',
      displayPattern: 'example.com',
      inputValue: 'example.com',
      key: 'example.com::suffix',
      matchModes: ['suffix']
    }
  ]
};

function createFixture(editable = true) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const onRemove = vi.fn();
  const onSave = vi.fn().mockResolvedValue({ ok: true });
  const controller = renderList(host, onRemove, editable ? onSave : undefined);
  return { controller, host, onRemove, onSave };
}

afterEach(() => {
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  controllers = [];
  document.body.textContent = '';
});

describe('Options blacklist list', () => {
  it('renders the row, badge and action contracts', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));

    expect(host.querySelector('[data-rule-key="example.com::suffix"]'))
      .not.toBeNull();
    expect(host.querySelector('[data-tone="suffix"]')?.textContent)
      .toBe('整个网站');
  });

  it('opens the editor, enforces exclusive modes, and submits the draft', async () => {
    const { controller, host, onSave } = createFixture();
    act(() => controller.render(model));
    act(() => {
      queryHtmlTag(host, '._x_extension_shortcut_edit_2024_unique_', 'button')
        ?.click();
    });
    const modeInputs = getTags(host, '._x_extension_checkbox_group_2026_unique_ input', 'input');
    act(() => modeInputs[0]?.click());
    expect(Array.from(modeInputs).map((input) => input.checked))
      .toEqual([true, false, false]);
    await act(async () => {
      queryHtmlTag(host, '._x_extension_shortcut_editor_2024_unique_ ._x_extension_shortcut_submit_primary_2024_unique_', 'button')?.click();
      await Promise.resolve();
    });

    expect(onSave).toHaveBeenCalledWith(
      'example.com::suffix',
      'example.com',
      ['exact']
    );
  });

  it('keeps the editor open and shows adapter validation errors', async () => {
    const { controller, host, onSave } = createFixture();
    onSave.mockResolvedValue({ ok: false, error: '请输入网站域名。' });
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
      .toBe('请输入网站域名。');
    expect(host.querySelector('[data-expanded="true"]')).not.toBeNull();
  });

  it('confirms removal and supports a read-only favicon rule list', async () => {
    const { controller, host, onRemove } = createFixture(false);
    act(() => controller.render({ ...model, editable: false }));
    expect(host.querySelector('._x_extension_shortcut_edit_2024_unique_')).toBeNull();
    act(() => {
      queryHtmlTag(host, '._x_extension_shortcut_remove_2024_unique_', 'button')
        ?.click();
    });
    expect(host.querySelector('._x_extension_popconfirm_2024_unique_')
      ?.getAttribute('data-open')).toBe('true');
    const confirmButtons = getTags(host, '._x_extension_popconfirm_actions_2024_unique_ button', 'button');
    await act(async () => {
      confirmButtons[1]?.click();
      await Promise.resolve();
    });
    expect(onRemove).toHaveBeenCalledWith('example.com::suffix');
  });

  it('closes inline confirmation with Escape and restores trigger focus', () => {
    const { controller, host } = createFixture(false);
    act(() => controller.render({ ...model, editable: false }));
    const trigger = queryHtmlTag(host, '._x_extension_shortcut_remove_2024_unique_', 'button');
    act(() => trigger?.click());
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Escape'
      }));
    });

    expect(host.querySelector('._x_extension_popconfirm_2024_unique_')
      ?.getAttribute('data-open')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('runs a pending inline confirmation only once', async () => {
    let resolveRemove: () => void = () => {};
    const onRemove = vi.fn(() => new Promise<void>((resolve) => {
      resolveRemove = resolve;
    }));
    const host = document.createElement('div');
    document.body.appendChild(host);
    const controller = renderList(host, onRemove);
    act(() => controller.render({ ...model, editable: false }));
    act(() => {
      queryHtmlTag(host, '._x_extension_shortcut_remove_2024_unique_', 'button')?.click();
    });
    const confirmButton = getTags(host, '._x_extension_popconfirm_actions_2024_unique_ button', 'button')[1];

    act(() => {
      confirmButton?.click();
      confirmButton?.click();
    });

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(confirmButton?.disabled).toBe(true);
    await act(async () => {
      resolveRemove();
      await Promise.resolve();
    });
    expect(host.querySelector('._x_extension_popconfirm_2024_unique_')
      ?.getAttribute('data-open')).toBe('false');
  });
});
