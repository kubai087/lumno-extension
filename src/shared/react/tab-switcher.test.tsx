import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTabSwitcherView,
  type TabSwitcherViewController
} from './tab-switcher';
import { getTags } from '../../../tests/fakes/dom';
import { closestHtmlElement, queryHtmlTag } from '../dom-lookup';

let controllers: TabSwitcherViewController[] = [];

function createView() {
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'open' });
  document.body.appendChild(host);
  const onSelect = vi.fn();
  const onActivate = vi.fn();
  const onClose = vi.fn();
  let controller!: TabSwitcherViewController;
  act(() => {
    controller = createTabSwitcherView({
      document,
      root: shadow,
      selectedIndex: 0,
      ariaLabel: 'Recent tabs',
      tabs: [
        {
          id: 1,
          title: 'First tab',
          url: 'https://first.example/',
          favIconUrl: 'data:image/png;base64,dGVzdA==',
          thumbnail: 'data:image/png;base64,b2xk'
        },
        {
          id: 2,
          title: 'Second tab',
          url: 'https://second.example/'
        }
      ],
      normalizeAccentCss: () => 'rgb(1, 2, 3)',
      onSelect,
      onActivate,
      onClose
    });
  });
  controllers.push(controller);
  return { controller, host, shadow, onSelect, onActivate, onClose };
}

afterEach(() => {
  act(() => {
    controllers.forEach((controller) => controller.destroy());
  });
  controllers = [];
  document.body.textContent = '';
  vi.useRealTimers();
});

describe('Overlay tab switcher React island', () => {
  it('renders cards synchronously with the legacy DOM contract', () => {
    const { controller, shadow } = createView();

    expect(controller.panel?.dataset.reactIsland).toBe(
      'overlay-tab-switcher'
    );
    expect(controller.panel?.getAttribute('role')).toBe('listbox');
    expect(controller.buttons).toHaveLength(2);
    expect(controller.buttons[0].dataset.active).toBe('true');
    expect(controller.buttons[0].tabIndex).toBe(0);
    expect(controller.buttons[1].tabIndex).toBe(-1);
    expect(
      shadow.querySelector('.x-tab-switcher-name')?.textContent
    ).toBe('First tab');
    expect(
      shadow.querySelector('.x-tab-switcher-host')?.textContent
    ).toBe('first.example');
    expect(
      controller.buttons[0].querySelector('.x-tab-switcher-title-favicon')
    ).not.toBeNull();
    expect(
      controller.buttons[0].querySelector('.x-tab-switcher-thumb-favicon')
    ).toBeNull();
  });

  it('takes its scheme from the host and keeps its cards', () => {
    const { controller } = createView();
    const first = controller.buttons[0];
    expect(controller.panel?.dataset.theme).toBeUndefined();

    act(() => controller.setTheme('dark'));
    expect(controller.panel?.dataset.theme).toBe('dark');
    expect(controller.panel?.style.colorScheme).toBe('dark');
    expect(controller.panel?.style.getPropertyValue('--x-tab-count')).toBe('2');

    act(() => controller.setTheme('light'));
    expect(controller.panel?.dataset.theme).toBe('light');
    expect(controller.buttons[0]).toBe(first);
  });

  it('updates selection without replacing stable card nodes', () => {
    const { controller, onSelect, onActivate } = createView();
    const first = controller.buttons[0];
    const second = controller.buttons[1];

    act(() => {
      controller.updateSelection(1);
    });
    expect(controller.buttons[0]).toBe(first);
    expect(controller.buttons[1]).toBe(second);
    expect(second.dataset.active).toBe('true');
    expect(
      first.querySelector('.x-tab-switcher-title-favicon')
    ).not.toBeNull();

    act(() => {
      second.focus();
      second.click();
    });
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(onActivate).toHaveBeenCalledWith(
      1,
      expect.any(MouseEvent)
    );
  });

  it('treats a Control-held click, which macOS sends as a context menu, as a click', () => {
    const { controller, shadow, onActivate, onClose } = createView();
    const contextMenu = (target: Element, button: number) => {
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button,
        ctrlKey: true
      });
      act(() => {
        target.dispatchEvent(event);
      });
      return event;
    };

    const rightClick = contextMenu(controller.buttons[1], 2);
    expect(rightClick.defaultPrevented).toBe(false);
    expect(onActivate).not.toHaveBeenCalled();

    const controlClick = contextMenu(controller.buttons[1], 0);
    expect(controlClick.defaultPrevented).toBe(true);
    expect(onActivate).toHaveBeenCalledWith(1, controlClick);

    const closeButton = shadow.querySelectorAll('.x-tab-switcher-close')[0];
    const controlClose = contextMenu(closeButton, 0);
    expect(controlClose.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledWith(0, controlClose);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('crossfades a live thumbnail update on the existing card', () => {
    vi.useFakeTimers();
    const { controller } = createView();
    const first = controller.buttons[0];

    let result!: { ok: boolean };
    act(() => {
      result = controller.updateThumbnail({
        tabId: 1,
        url: 'https://first.example/',
        thumbnail: 'data:image/png;base64,bmV3',
        thumbnailStatus: 'ok'
      });
    });

    expect(result.ok).toBe(true);
    expect(controller.buttons[0]).toBe(first);
    expect(
      first.querySelectorAll('img[data-kind="thumbnail"]')
    ).toHaveLength(2);

    act(() => {
      vi.runAllTimers();
    });
    expect(
      first.querySelectorAll('img[data-kind="thumbnail"]')
    ).toHaveLength(1);
    expect(
      queryHtmlTag(first, 'img[data-kind="thumbnail"]', 'img')?.src
    ).toContain('bmV3');
  });

  it('closes a card from its own close button without activating it', () => {
    const { controller, shadow, onActivate, onClose } = createView();
    const closeButtons = getTags(shadow, '.x-tab-switcher-close', 'button');

    expect(controller.panel?.dataset.closePlacement).toBe('left');
    expect(closeButtons).toHaveLength(2);
    expect(closeButtons[1].getAttribute('aria-label')).toBe('Close tab');

    act(() => {
      closeButtons[1].click();
    });
    expect(onClose).toHaveBeenCalledWith(1, expect.any(MouseEvent));
    expect(onActivate).not.toHaveBeenCalled();

    act(() => {
      controller.setTabClosing(2, true);
    });
    expect(closeButtons[1].disabled).toBe(true);
    expect(
      closestHtmlElement(closeButtons[1], '.x-tab-switcher-item')
        ?.dataset.closing
    ).toBe('true');

    const first = controller.buttons[0];
    let removed = false;
    act(() => {
      removed = controller.removeTab(2);
    });
    expect(removed).toBe(true);
    expect(controller.buttons).toHaveLength(1);
    expect(controller.buttons[0]).toBe(first);
    expect(controller.removeTab(2)).toBe(false);
  });
});
