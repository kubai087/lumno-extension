import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SettingSelect,
  type SelectControlOptions,
  type SelectControlRenderModel
} from './select-control';
import { getElement, getElements, getTag } from '../../../tests/fakes/dom';
import { queryHtmlElement, queryHtmlTag } from '../../shared/dom-lookup';

let roots: Root[] = [];

// Draws a select the way a settings view does; its host is the select's
// frame, which holds the menu too.
function mountSelect(options: SelectControlOptions) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  return {
    render(model: SelectControlRenderModel) {
      root.render(<SettingSelect model={model} options={options} />);
    },
    get host() {
      return getElement(container, '[data-select]');
    }
  };
}

const items = [
  { iconUrl: '/system.png', label: '跟随系统', labelKey: 'language_system', value: 'system' },
  { iconUrl: '/zh-cn.png', label: '简体中文', labelKey: 'language_zh_cn', value: 'zh-CN' }
];

afterEach(() => {
  act(() => roots.forEach((root) => root.unmount()));
  roots = [];
  document.body.textContent = '';
});

describe('Options select control React island', () => {
  it('renders selected labels and legacy classes', () => {
    const controller = mountSelect({
      onSelect: vi.fn()
    });

    act(() => controller.render({ id: 'language', items, value: 'system' }));
    const host = controller.host;

    expect(host.querySelector('._x_extension_select_label_2024_unique_')?.textContent)
      .toBe('跟随系统');
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(2);
    expect(queryHtmlTag(host, '._x_extension_select_value_icon_2026_unique_', 'img')?.src)
      .toContain('/system.png');
    expect(host.querySelectorAll('._x_extension_select_option_icon_2026_unique_'))
      .toHaveLength(2);
  });

  it('disables the trigger when the adapter marks the control unavailable', () => {
    const controller = mountSelect({
      onSelect: vi.fn()
    });

    act(() => controller.render({ disabled: true, id: 'provider', items, value: 'system' }));
    const host = controller.host;

    expect(host.dataset.disabled).toBe('true');
    expect(queryHtmlTag(host, 'button', 'button')?.disabled).toBe(true);
  });

  it('opens the menu and reports a selected value', () => {
    const onSelect = vi.fn();
    const controller = mountSelect({
      onSelect
    });
    act(() => controller.render({ id: 'language', items, value: 'system' }));
    const host = controller.host;

    act(() => {
      queryHtmlTag(host, 'button', 'button')?.click();
    });
    expect(host.dataset.open).toBe('true');
    const options = getElements(host, '[role="option"]');
    act(() => options[1]?.click());

    expect(onSelect).toHaveBeenCalledWith('zh-CN');
    expect(host.dataset.open).toBe('false');
    expect(host.querySelector('._x_extension_select_label_2024_unique_')?.textContent)
      .toBe('简体中文');
  });

  it('filters a searchable menu and previews each option in its own family', () => {
    const controller = mountSelect({
      onSelect: vi.fn(),
      searchable: true
    });
    act(() => controller.render({
      emptyLabel: 'No matching fonts',
      id: 'overlay-font',
      items: [
        { label: 'Default', labelKey: '', value: '' },
        { fontFamily: 'Zapfino', label: 'Zapfino', labelKey: '', value: 'Zapfino' },
        { fontFamily: 'PingFang SC', label: 'PingFang SC', labelKey: '', value: 'PingFang SC' }
      ],
      searchPlaceholder: 'Search fonts',
      value: ''
    }));
    const host = controller.host;

    act(() => {
      queryHtmlTag(host, 'button', 'button')?.click();
    });
    const search = queryHtmlTag(host, 'input[type="text"]', 'input');
    expect(search?.placeholder).toBe('Search fonts');
    // Styled as the settings page's own text field.
    expect(search?.classList.contains('_x_extension_shortcut_input_2024_unique_')).toBe(true);
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(3);
    // The field is a combobox that owns a listbox holding only the options.
    const listbox = queryHtmlElement(host, '[role="listbox"]');
    expect(search?.getAttribute('role')).toBe('combobox');
    expect(search?.getAttribute('aria-expanded')).toBe('true');
    expect(search?.getAttribute('aria-controls')).toBe(listbox?.id);
    expect(listbox?.contains(search)).toBe(false);
    expect(listbox?.querySelectorAll('[role="option"]')).toHaveLength(3);
    // The magnifier sits in the field's box, above the listbox that scrolls.
    const icon = host.querySelector('._x_extension_select_search_icon_2026_unique_');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(search?.parentElement?.contains(icon)).toBe(true);
    expect(listbox?.contains(icon)).toBe(false);

    const typeFilter = (text: string) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      act(() => {
        setter?.call(search, text);
        search?.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    typeFilter('ping');
    const visible = getElements(host, '[role="option"]');
    expect(visible).toHaveLength(1);
    expect(visible[0]?.querySelector('._x_extension_select_option_label_2026_unique_')?.textContent)
      .toBe('PingFang SC');
    // The name is drawn in its own face, quoted so any family name parses.
    expect(
      (visible[0] ? queryHtmlElement(visible[0], '._x_extension_select_option_label_2026_unique_') : null)?.style.fontFamily
    ).toContain('"PingFang SC"');
    expect(search?.getAttribute('aria-activedescendant')).toBe(visible[0]?.id);

    typeFilter('zzz');
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(host.querySelector('._x_extension_select_empty_2026_unique_')?.textContent)
      .toBe('No matching fonts');
  });

  it('chooses a filtered option from the keyboard', () => {
    const onSelect = vi.fn();
    const controller = mountSelect({
      onSelect,
      searchable: true
    });
    act(() => controller.render({
      id: 'overlay-font-keys',
      items: [
        { label: 'Default', labelKey: '', value: '' },
        { label: 'Zapfino', labelKey: '', value: 'Zapfino' },
        { label: 'PingFang SC', labelKey: '', value: 'PingFang SC' },
        { label: 'PingFang TC', labelKey: '', value: 'PingFang TC' }
      ],
      value: 'Zapfino'
    }));
    const host = controller.host;

    act(() => {
      queryHtmlTag(host, 'button', 'button')?.click();
    });
    const search = getTag(host, 'input[type="text"]', 'input');
    expect(document.activeElement).toBe(search);
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'ping');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const press = (key: string) => act(() => {
      search.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }));
    });
    // Enter and Escape that end an IME composition belong to the IME.
    act(() => {
      search.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, isComposing: true, key: 'Enter' }));
      // jsdom drops keyCode from the init dictionary.
      const imeEscape = new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' });
      Object.defineProperty(imeEscape, 'keyCode', { value: 229 });
      search.dispatchEvent(imeEscape);
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(host.dataset.open).toBe('true');
    press('ArrowDown');
    press('Enter');
    expect(onSelect).toHaveBeenCalledWith('PingFang TC');

    // A reopened menu starts from the whole list again.
    act(() => {
      queryHtmlTag(host, 'button', 'button')?.click();
    });
    expect(host.querySelectorAll('[role="option"]')).toHaveLength(4);

    // Tabbing out of the filter closes the menu behind it.
    act(() => {
      getTag(host, 'input[type="text"]', 'input')
        .dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
    });
    expect(host.dataset.open).toBe('false');
  });

  it('keeps a searchable menu in place while the filter shrinks the list', () => {
    // jsdom has no layout: rows are 32px, the window 768px tall.
    const scrollHeight = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.querySelectorAll('[role="option"]').length * 32 + 46;
      });
    const items = [
      { label: 'Default', labelKey: '', value: '' },
      ...Array.from({ length: 40 }, (_, index) => ({
        label: `Font ${index}`,
        labelKey: '',
        value: `Font ${index}`
      }))
    ];
    const open = (triggerTop: number) => {
      const controller = mountSelect({
        onSelect: vi.fn(),
        searchable: true
      });
      act(() => controller.render({ id: `font-${triggerTop}`, items, value: '' }));
      const host = controller.host;
      const trigger = getTag(host, 'button', 'button');
      trigger.getBoundingClientRect = () => new DOMRect(400, triggerTop, 280, 32);
      act(() => trigger.click());
      const menu = getElement(host, '._x_extension_select_menu_2024_unique_');
      const search = getTag(host, 'input[type="text"]', 'input');
      const type = (text: string) => act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, text);
        search.dispatchEvent(new Event('input', { bubbles: true }));
      });
      return { menu, type };
    };

    // Too little room under a trigger near the bottom: the box is held
    // against the bottom of the viewport, at the 480px cap.
    const low = open(700);
    expect([low.menu.style.top, low.menu.style.height]).toEqual(['280px', '480px']);
    // Only the listbox under the field scrolls, so the surface itself never does.
    expect(low.menu.style.overflowY).toBe('hidden');
    low.type('Font 3');
    expect([low.menu.style.top, low.menu.style.height]).toEqual(['280px', '480px']);
    low.type('zzz');
    expect([low.menu.style.top, low.menu.style.height]).toEqual(['280px', '480px']);

    // With room below, it opens under the trigger and stays there too.
    const high = open(60);
    expect([high.menu.style.top, high.menu.style.height]).toEqual(['98px', '480px']);
    high.type('Font 1');
    expect([high.menu.style.top, high.menu.style.height]).toEqual(['98px', '480px']);
    scrollHeight.mockRestore();
  });

  it('accepts adapter-driven selection and copy updates', () => {
    const controller = mountSelect({
      onSelect: vi.fn()
    });
    act(() => controller.render({ id: 'language', items, value: 'system' }));
    const host = controller.host;
    act(() => controller.render({
      id: 'language',
      items: items.map((item) => ({
        ...item,
        label: item.value === 'system' ? 'System' : 'Simplified Chinese'
      })),
      value: 'zh-CN'
    }));

    expect(host.querySelector('._x_extension_select_label_2024_unique_')?.textContent)
      .toBe('Simplified Chinese');
  });

  it('chooses an option with the keyboard and returns focus to the trigger', () => {
    const onSelect = vi.fn();
    const controller = mountSelect({ onSelect });
    act(() => controller.render({ id: 'language', items, value: 'system' }));
    const host = controller.host;

    const trigger = getTag(host, 'button', 'button');
    trigger.focus();
    const press = (key: string) => act(() => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }));
    });
    press('ArrowDown');
    expect(host.dataset.open).toBe('true');
    expect(trigger.getAttribute('aria-activedescendant')).toBe('language_control_option_0');
    press('ArrowDown');
    expect(trigger.getAttribute('aria-activedescendant')).toBe('language_control_option_1');
    press('Enter');

    expect(onSelect).toHaveBeenCalledWith('zh-CN');
    expect(host.dataset.open).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape without reporting a change', () => {
    const onSelect = vi.fn();
    const controller = mountSelect({ onSelect });
    act(() => controller.render({ id: 'language', items, value: 'system' }));
    const host = controller.host;

    act(() => queryHtmlTag(host, 'button', 'button')?.click());
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    });

    expect(host.dataset.open).toBe('false');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('names the trigger with the setting title and the current value', () => {
    const controller = mountSelect({ onSelect: vi.fn() });
    act(() => controller.render({
      id: 'language',
      items,
      labelledBy: 'language_title',
      value: 'zh-CN'
    }));
    const host = controller.host;

    const trigger = getTag(host, 'button', 'button');
    expect(trigger.getAttribute('aria-labelledby')).toBe('language_title language_control_value');
    expect(trigger.hasAttribute('aria-label')).toBe(false);
    expect(document.getElementById('language_control_value')?.textContent).toBe('简体中文');
  });
});
