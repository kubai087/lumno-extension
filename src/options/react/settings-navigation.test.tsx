import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReactRootController, type ReactRootController } from '../../shared/react/root-controller';
import { SettingsNavigation, type SettingsNavigationRenderModel } from './settings-navigation';
import { getElement } from '../../../tests/fakes/dom';
import { queryHtmlTag } from '../../shared/dom-lookup';

let controllers: Array<ReactRootController<SettingsNavigationRenderModel>> = [];

const model: SettingsNavigationRenderModel = {
  activeKey: 'general',
  items: [
    {
      iconName: 'ri-command-fill',
      key: 'general',
      label: '常规',
      labelKey: 'settings_tab_general'
    },
    {
      iconName: 'ri-moon-clear-fill',
      key: 'appearance',
      label: '外观',
      labelKey: 'settings_tab_appearance'
    }
  ]
};

function createFixture() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const onSelect = vi.fn();
  const controller = createReactRootController(host, (next: SettingsNavigationRenderModel) => (
    <SettingsNavigation model={next} onSelect={onSelect} />
  ));
  controllers.push(controller);
  return { controller, host, onSelect };
}

afterEach(() => {
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  controllers = [];
  document.body.textContent = '';
});

describe('Options settings navigation', () => {
  it('preserves the indicator, tab classes, icons, and active semantics', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));

    expect(host.querySelector('._x_extension_tabs_indicator_2024_unique_'))
      .not.toBeNull();
    expect(host.querySelectorAll('._x_extension_settings_tab_button_2024_unique_'))
      .toHaveLength(2);
    expect(host.querySelector('[data-tab="general"]')?.getAttribute('aria-current'))
      .toBe('page');
    expect(host.querySelector('[data-tab="appearance"] i')?.className)
      .toContain('ri-moon-clear-fill');
  });

  it('routes tab selection through the browser adapter', () => {
    const { controller, host, onSelect } = createFixture();
    act(() => {
      controller.render(model);
      queryHtmlTag(host, '[data-tab="appearance"]', 'button')?.click();
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('appearance');
  });

  it('updates active state and localized labels without replacing the host', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));
    act(() => controller.render({
      activeKey: 'appearance',
      items: model.items.map((item) => ({
        ...item,
        label: item.key === 'appearance' ? 'Appearance' : 'General'
      }))
    }));

    expect(host.isConnected).toBe(true);
    expect(host.querySelector('[data-tab="general"]')?.getAttribute('aria-pressed'))
      .toBe('false');
    expect(host.querySelector('[data-tab="appearance"]')?.getAttribute('aria-pressed'))
      .toBe('true');
    expect(host.querySelector('[data-tab="appearance"]')?.textContent)
      .toContain('Appearance');
  });

  it('unmounts cleanly', () => {
    const { controller, host } = createFixture();
    act(() => {
      controller.render(model);
      controller.destroy();
    });

    expect(host.childElementCount).toBe(0);
  });
  it('marks hidden edges and scrolls the active tab into view when labels overflow', () => {
    const { controller, host } = createFixture();
    // jsdom has no layout: give the strip 200px of room for 600px of tabs.
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 200 });
    Object.defineProperty(host, 'scrollWidth', { configurable: true, value: 600 });
    act(() => controller.render(model));
    expect(host.dataset.overflowStart).toBe('false');
    expect(host.dataset.overflowEnd).toBe('true');

    const appearance = () => getElement(host, '[data-tab="appearance"]');
    act(() => controller.render({ ...model, activeKey: 'appearance' }));
    Object.defineProperty(appearance(), 'offsetLeft', { configurable: true, value: 500 });
    Object.defineProperty(appearance(), 'offsetWidth', { configurable: true, value: 80 });
    act(() => controller.render({ ...model, activeKey: 'general' }));
    act(() => controller.render({ ...model, activeKey: 'appearance' }));

    // Right edge 580 plus the 24px fade margin, minus the 200px viewport.
    expect(host.scrollLeft).toBe(404);
    act(() => {
      host.dispatchEvent(new Event('scroll'));
    });
    expect(host.dataset.overflowStart).toBe('true');
  });
});
