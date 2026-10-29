import { act } from 'react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSelectMenuController, type SelectMenuInstance } from './select-menu';
import type { SelectMenuConfig } from '../../shared/react/select-menu';
import { getElements } from '../../../tests/react/dom';
import { queryHtmlElement } from '../../shared/dom-lookup';

type Controller = ReturnType<typeof createSelectMenuController>;
const mounted: Array<{ controller: Controller; host: HTMLElement }> = [];

const baseConfig: SelectMenuConfig = {
  ariaLabel: 'Display mode',
  className: 'x-nt-section-mode-select',
  iconOnly: true,
  id: 'mode-menu',
  menuAlign: 'left',
  menuClassName: 'x-nt-section-mode-portal',
  menuMaxWidth: 240,
  menuMinWidth: 168,
  menuPortal: true,
  menuPortalOffset: 8,
  menuPortalZIndex: 10020,
  menuTitle: 'Display mode',
  menuWidth: 'content',
  options: [
    { label: 'Folders', value: 'folder' },
    { label: 'List', value: 'list' }
  ],
  selectId: 'mode-menu-select',
  tooltip: 'Display mode',
  triggerIconName: 'ri-more-line',
  value: 'folder'
};

function createMenu(config: SelectMenuConfig = baseConfig) {
  const controller = createSelectMenuController({
    documentObj: document,
    windowObj: window
  });
  const holder: { value: SelectMenuInstance | null } = { value: null };
  act(() => {
    holder.value = controller.createSelect(config);
  });
  const instance = holder.value;
  if (!instance) {
    throw new Error('Expected React select menu instance');
  }
  document.body.appendChild(instance.wrapper);
  mounted.push({ controller, host: instance.wrapper });
  return { controller, instance };
}

afterEach(() => {
  act(() => {
    mounted.forEach(({ controller, host }) => controller.destroy(host));
  });
  mounted.length = 0;
  document.body.replaceChildren();
});

describe('New Tab select menu React island', () => {
  it('keeps a disabled source selector closed', () => {
    const { controller, instance } = createMenu({ ...baseConfig, disabled: true });
    expect(instance.trigger.disabled).toBe(true);
    expect(instance.select.disabled).toBe(true);
    act(() => controller.setOpen(instance.wrapper, true));
    expect(controller.isOpen(instance.wrapper)).toBe(false);
  });

  it('places a modal menu inside its supplied portal container', () => {
    const modal = document.createElement('div');
    document.body.appendChild(modal);
    const { controller, instance } = createMenu({ ...baseConfig, menuPortalContainer: modal });
    expect(instance.menu.parentElement).toBe(modal);
    act(() => controller.setOpen(instance.wrapper, true));
    expect(instance.menu.dataset.open).toBe('true');
    act(() => queryHtmlElement(instance.menu, '[data-value="list"]')?.click());
    expect(instance.select.value).toBe('list');
  });

  it('matches the trigger width when a dropdown is portaled', () => {
    const { controller, instance } = createMenu({ ...baseConfig, menuWidth: 'trigger' });
    vi.spyOn(instance.trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 40, 372, 36));
    act(() => controller.setOpen(instance.wrapper, true));
    expect(instance.menu.style.width).toBe('372px');
  });

  it('positions a modal dropdown in the scaled container coordinates and tracks resizing', () => {
    const modal = document.createElement('div');
    document.body.appendChild(modal);
    const { controller, instance } = createMenu({ ...baseConfig, menuPortalContainer: modal, menuWidth: 'trigger', menuPortalOffset: 6 });
    Object.defineProperties(modal, {
      offsetWidth: { value: 400 }, offsetHeight: { value: 300 },
      clientLeft: { value: 2 }, clientTop: { value: 3 },
      scrollLeft: { value: 5 }, scrollTop: { value: 8 }
    });
    Object.defineProperties(instance.menu, {
      offsetParent: { value: modal }, offsetWidth: { value: 200 }, offsetHeight: { value: 90 }
    });
    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue(new DOMRect(120, 80, 800, 600));
    const triggerRect = vi.spyOn(instance.trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 200, 400, 72));
    act(() => controller.setOpen(instance.wrapper, true));
    expect(instance.menu.style.position).toBe('absolute');
    expect(instance.menu.style.width).toBe('200px');
    expect(instance.menu.style.left).toBe('43px');
    expect(instance.menu.style.top).toBe('107px');
    triggerRect.mockReturnValue(new DOMRect(240, 220, 400, 72));
    act(() => window.dispatchEvent(new Event('resize')));
    expect(instance.menu.style.left).toBe('63px');
    expect(instance.menu.style.top).toBe('117px');
  });

  it('uses layout dimensions rather than animated bounds for alignment', () => {
    const { controller, instance } = createMenu({ ...baseConfig, menuAlign: 'right' });
    Object.defineProperties(instance.menu, { offsetWidth: { value: 240 }, offsetHeight: { value: 180 } });
    vi.spyOn(instance.trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(800, 100, 40, 36));
    vi.spyOn(instance.menu, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 230.4, 154.8));
    act(() => controller.setOpen(instance.wrapper, true));
    expect(instance.menu.style.left).toBe('600px');
  });

  it('limits a tall menu to the space below its trigger instead of overlapping the input', () => {
    const { controller, instance } = createMenu({ ...baseConfig, menuPortalOffset: 6 });
    Object.defineProperties(instance.menu, {
      offsetHeight: { value: 480 }, clientHeight: { value: 478 }, scrollHeight: { value: 478 }
    });
    vi.spyOn(instance.trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 320, 372, 72));
    act(() => controller.setOpen(instance.wrapper, true));
    expect(instance.menu.style.top).toBe('398px');
    expect(instance.menu.style.maxHeight).toBe(`${window.innerHeight - 8 - 398}px`);
    expect(instance.menu.style.overflowY).toBe('auto');
    expect(instance.menu.style.transformOrigin).toBe('top left');
  });

  it('anchors an upward opening animation at the bottom edge beside its trigger', () => {
    const { controller, instance } = createMenu({ ...baseConfig, menuPortalOffset: 6 });
    Object.defineProperties(instance.menu, { offsetHeight: { value: 180 } });
    vi.spyOn(instance.trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 640, 372, 36));
    act(() => controller.setOpen(instance.wrapper, true));
    expect(instance.menu.style.top).toBe('454px');
    expect(instance.menu.style.transformOrigin).toBe('bottom left');
  });

  it('visually closes after selection even inside an open modal', () => {
    const style = document.createElement('style');
    style.textContent = readFileSync('src/shared/ui/menu-surface.css', 'utf8');
    document.head.appendChild(style);
    try {
      const modal = document.createElement('div');
      modal.dataset.open = 'true';
      document.body.appendChild(modal);
      const { controller, instance } = createMenu({ ...baseConfig, menuPortalContainer: modal });
      expect(getComputedStyle(instance.menu).opacity).toBe('0');
      act(() => controller.setOpen(instance.wrapper, true));
      expect(getComputedStyle(instance.menu).opacity).toBe('1');
      act(() => queryHtmlElement(instance.menu, '[data-value="list"]')?.click());
      expect(instance.select.value).toBe('list');
      expect(getComputedStyle(instance.menu).opacity).toBe('0');
      expect(getComputedStyle(instance.menu).pointerEvents).toBe('none');
    } finally {
      style.remove();
    }
  });

  it('closes when keyboard focus moves to another form field without stealing focus', () => {
    const { controller, instance } = createMenu();
    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => { instance.trigger.focus(); controller.setOpen(instance.wrapper, true); });
    act(() => input.focus());
    expect(controller.isOpen(instance.wrapper)).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('preserves the custom-select DOM and synchronous controller contract', () => {
    const { controller, instance } = createMenu();

    expect(instance.wrapper.dataset.reactIsland).toBe('newtab-select-menu');
    expect(instance.wrapper.classList.contains('x-nt-section-mode-select')).toBe(
      true
    );
    expect(instance.menu.parentElement).toBe(document.body);
    expect(instance.menu.getAttribute('aria-hidden')).toBe('true');
    expect(instance.trigger.getAttribute('aria-controls')).toBe(instance.menu.id);
    expect(controller.isOpen(instance.wrapper)).toBe(false);

    act(() => controller.setOpen(instance.wrapper, true));

    expect(controller.isOpen(instance.wrapper)).toBe(true);
    expect(instance.wrapper.dataset.open).toBe('true');
    expect(instance.menu.dataset.open).toBe('true');
    expect(instance.menu.getAttribute('aria-hidden')).toBe('false');
    expect(instance.trigger.getAttribute('aria-expanded')).toBe('true');

    act(() => controller.setOpen(instance.wrapper, false));
    expect(controller.isOpen(instance.wrapper)).toBe(false);
  });

  it('commits the closed portal surface before a synchronous first open', () => {
    const closedSurfaceReads: HTMLElement[] = [];
    const offsetWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockImplementation(function readOffsetWidth(this: HTMLElement) {
        if (
          this instanceof HTMLElement &&
          this.classList.contains('_x_extension_menu_surface_2024_unique_') &&
          this.dataset.open === 'false'
        ) {
          closedSurfaceReads.push(this);
        }
        return 0;
      });

    const { controller, instance } = createMenu();

    expect(closedSurfaceReads).toContain(instance.menu);
    act(() => controller.setOpen(instance.wrapper, true));
    expect(instance.menu.dataset.open).toBe('true');
    offsetWidthSpy.mockRestore();
  });

  it('dispatches the legacy select change event and updates selection', () => {
    const { controller, instance } = createMenu();
    const onChange = vi.fn();
    instance.select.addEventListener('change', onChange);
    act(() => controller.setOpen(instance.wrapper, true));

    act(() => {
      queryHtmlElement(instance.menu, '[data-value="list"]')
        ?.click();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(instance.select.value).toBe('list');
    expect(
      instance.menu.querySelector('[data-value="list"]')?.getAttribute(
        'data-selected'
      )
    ).toBe('true');
    expect(controller.isOpen(instance.wrapper)).toBe(false);
  });

  it('supports action rows and in-place localization updates', () => {
    const onAction = vi.fn();
    const { controller, instance } = createMenu({
      ...baseConfig,
      onAction,
      options: [
        ...(baseConfig.options || []),
        {
          action: 'pick-color',
          dividerBefore: true,
          iconName: 'ri-dropper-line',
          label: 'Pick color',
          value: '__pick__'
        }
      ]
    });
    act(() => controller.setOpen(instance.wrapper, true));
    act(() => {
      queryHtmlElement(instance.menu, '[data-value="__pick__"]')
        ?.click();
    });
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pick-color' })
    );
    expect(instance.menu.getAttribute('role')).toBe('menu');

    act(() => {
      controller.setMenuTitle(instance.wrapper, 'Anzeige');
      controller.setOptions(
        instance.wrapper,
        [{ label: 'Liste', value: 'list' }],
        'list'
      );
    });

    expect(
      instance.menu.querySelector(
        '._x_extension_select_menu_title_2024_unique_'
      )?.textContent
    ).toBe('Anzeige');
    expect(instance.select.value).toBe('list');
    expect(instance.menu.textContent).toContain('Liste');
  });

  it('renders a group title between the divider and its first option', () => {
    const { instance } = createMenu({
      ...baseConfig,
      options: [
        ...(baseConfig.options || []),
        {
          action: 'surface:adaptive',
          dividerBefore: true,
          groupTitle: 'Bar background',
          label: 'Adaptive mist',
          radio: true,
          value: '__surface_adaptive__'
        }
      ]
    });

    const titles = getElements(instance.menu, '._x_extension_select_menu_title_2024_unique_');
    const groupTitle = titles[1];
    const option = queryHtmlElement(instance.menu, '[data-value="__surface_adaptive__"]');
    expect(titles).toHaveLength(2);
    expect(groupTitle?.textContent).toBe('Bar background');
    expect(groupTitle?.previousElementSibling?.getAttribute('role')).toBe(
      'separator'
    );
    expect(groupTitle?.nextElementSibling).toBe(option);
    expect(
      instance.menu.querySelectorAll('._x_extension_select_divider_2026_unique_')
    ).toHaveLength(1);
  });

  it('keeps listbox dividers out of the option list and skips a leading one', () => {
    const { instance } = createMenu({
      ...baseConfig,
      options: [
        { dividerBefore: true, label: 'Folders', value: 'folder' },
        { dividerBefore: true, label: 'List', value: 'list' }
      ]
    });

    const dividers = instance.menu.querySelectorAll(
      '._x_extension_select_divider_2026_unique_'
    );
    expect(instance.menu.getAttribute('role')).toBe('listbox');
    expect(dividers).toHaveLength(1);
    expect(dividers[0]?.getAttribute('role')).toBe('presentation');
  });

  it('points the trigger at the active option and supports Home and End', () => {
    const { controller, instance } = createMenu({
      ...baseConfig,
      options: [
        { label: 'Folders', value: 'folder' },
        { label: 'List', value: 'list' },
        { label: 'Top', value: 'top' }
      ]
    });
    const press = (key: string) => act(() => {
      instance.trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
    });

    expect(instance.trigger.hasAttribute('aria-activedescendant')).toBe(false);
    act(() => controller.setOpen(instance.wrapper, true));
    expect(instance.trigger.getAttribute('aria-activedescendant')).toBe(
      'mode-menu_option_0'
    );
    press('End');
    expect(instance.trigger.getAttribute('aria-activedescendant')).toBe(
      'mode-menu_option_2'
    );
    expect(document.getElementById('mode-menu_option_2')?.dataset.value).toBe(
      'top'
    );
    press('Home');
    expect(instance.trigger.getAttribute('aria-activedescendant')).toBe(
      'mode-menu_option_0'
    );
  });

  it('exposes independent action choices as an accessible radio group', () => {
    const { instance } = createMenu({
      ...baseConfig,
      options: [
        ...(baseConfig.options || []),
        {
          action: 'surface:adaptive',
          checked: true,
          dividerBefore: true,
          label: 'Adaptive mist',
          radio: true,
          value: '__surface_adaptive__'
        },
        {
          action: 'surface:clear',
          checked: false,
          label: 'Clear glass',
          radio: true,
          value: '__surface_clear__'
        },
        {
          action: 'surface:custom',
          checked: false,
          label: 'Custom color',
          radio: true,
          trailingIconName: 'ri-dropper-line',
          value: '__surface_custom__'
        }
      ]
    });

    const adaptive = queryHtmlElement(instance.menu, '[data-value="__surface_adaptive__"]');
    const clear = queryHtmlElement(instance.menu, '[data-value="__surface_clear__"]');
    const custom = queryHtmlElement(instance.menu, '[data-value="__surface_custom__"]');
    expect(instance.menu.getAttribute('role')).toBe('menu');
    expect(instance.menu.querySelector('[role="separator"]')).not.toBeNull();
    expect(adaptive?.getAttribute('role')).toBe('menuitemradio');
    expect(adaptive?.getAttribute('aria-checked')).toBe('true');
    expect(adaptive?.getAttribute('data-radio-checked')).toBe('true');
    expect(adaptive?.querySelector('.ri-check-line')).toBeNull();
    expect(clear?.getAttribute('aria-checked')).toBe('false');
    expect(custom?.querySelector('.ri-dropper-line')).not.toBeNull();
    expect(custom?.querySelector('.ri-check-line')).toBeNull();

    const selectedCustom = queryHtmlElement(createMenu({
      ...baseConfig,
      id: 'selected-custom-menu',
      options: [
        {
          action: 'surface:custom',
          checked: true,
          label: 'Custom color',
          radio: true,
          trailingIconName: 'ri-dropper-line',
          value: '__selected_surface_custom__'
        }
      ],
      selectId: 'selected-custom-menu-select'
    }).instance.menu, '[data-value="__selected_surface_custom__"]');
    expect(selectedCustom?.querySelector('.ri-check-line')).toBeNull();
    expect(selectedCustom?.querySelector('.ri-dropper-line')).not.toBeNull();
  });

  it('closes when focus moves to an outside pointer target', () => {
    const { controller, instance } = createMenu();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    act(() => controller.setOpen(instance.wrapper, true));

    act(() => {
      outside.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true })
      );
    });

    expect(controller.isOpen(instance.wrapper)).toBe(false);
  });

  it('prevents disabled actions and skips them during keyboard navigation', () => {
    const onAction = vi.fn();
    const { controller, instance } = createMenu({
      ...baseConfig,
      onAction,
      value: '__disabled__',
      options: [
        {
          action: 'disabled-action',
          disabled: true,
          label: 'Open empty folder',
          value: '__disabled__'
        },
        {
          action: 'edit-action',
          label: 'Edit',
          value: '__edit__'
        },
        {
          action: 'delete-action',
          label: 'Delete',
          value: '__delete__'
        }
      ]
    });
    act(() => controller.setOpen(instance.wrapper, true));

    const disabledOption = queryHtmlElement(instance.menu, '[data-value="__disabled__"]');
    const editOption = queryHtmlElement(instance.menu, '[data-value="__edit__"]');
    expect(disabledOption?.getAttribute('aria-disabled')).toBe('true');
    expect(instance.menu.querySelector('[data-active="true"]')).toBeNull();

    act(() => disabledOption?.click());
    expect(onAction).not.toHaveBeenCalled();
    expect(controller.isOpen(instance.wrapper)).toBe(true);

    act(() => {
      editOption?.dispatchEvent(
        new MouseEvent('mouseover', { bubbles: true })
      );
    });
    expect(editOption?.getAttribute('data-active')).toBe('true');
    act(() => {
      editOption?.dispatchEvent(
        new MouseEvent('mouseout', { bubbles: true })
      );
    });
    expect(instance.menu.querySelector('[data-active="true"]')).toBeNull();

    act(() => {
      instance.trigger.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true
        })
      );
    });
    expect(
      editOption?.getAttribute(
        'data-active'
      )
    ).toBe('true');

    act(() => {
      instance.trigger.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
          cancelable: true
        })
      );
    });
    expect(
      instance.menu.querySelector('[data-value="__delete__"]')?.getAttribute(
        'data-active'
      )
    ).toBe('true');

    act(() => {
      instance.trigger.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true
        })
      );
    });
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete-action' })
    );
  });
});
