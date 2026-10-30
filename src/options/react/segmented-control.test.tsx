import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedControl, type SegmentedControlRenderModel } from './segmented-control';
import { getTags, required } from '../../../tests/fakes/dom';
import { queryHtmlElement, queryHtmlTag } from '../../shared/dom-lookup';

let roots: Root[] = [];

const model: SegmentedControlRenderModel = {
  activeValue: 'latest',
  dataAttribute: 'data-recent-mode',
  items: [
    {
      iconName: 'ri-time-line',
      label: '最近访问',
      labelKey: 'recent_mode_latest',
      value: 'latest'
    },
    {
      iconName: 'ri-vip-diamond-line',
      label: '最常访问',
      labelKey: 'recent_mode_most',
      value: 'most'
    }
  ],
  select: {
    id: '_x_extension_recent_mode_select_2024_unique_'
  }
};

// Draws the control in a radio group, as a settings row does.
function createFixture() {
  const host = document.createElement('div');
  host.setAttribute('role', 'radiogroup');
  document.body.appendChild(host);
  const onSelect = vi.fn();
  const root = createRoot(host);
  roots.push(root);
  const controller = {
    render(next: SegmentedControlRenderModel) {
      root.render(<SegmentedControl model={next} onSelect={onSelect} />);
    }
  };
  return { controller, host, onSelect };
}

afterEach(() => {
  act(() => {
    roots.forEach((root) => root.unmount());
  });
  roots = [];
  document.body.textContent = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Options segmented control', () => {
  it('preserves indicator, data attributes, icons, and hidden select contracts', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));

    expect(host.querySelector('._x_extension_theme_indicator_2024_unique_'))
      .not.toBeNull();
    expect(host.querySelectorAll('[data-recent-mode]')).toHaveLength(2);
    expect(host.querySelector('select')?.value).toBe('latest');
  });

  it('routes button and hidden-select changes through one adapter callback', () => {
    const { controller, host, onSelect } = createFixture();
    act(() => controller.render(model));
    act(() => {
      queryHtmlTag(host, '[data-recent-mode="most"]', 'button')?.click();
      const select = queryHtmlTag(host, 'select', 'select');
      if (select) {
        select.value = 'most';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(onSelect).toHaveBeenNthCalledWith(1, 'most');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'most');
  });

  it('updates controlled state and localized copy without replacing the host', () => {
    const { controller, host } = createFixture();
    act(() => controller.render(model));
    act(() => controller.render({
      ...model,
      activeValue: 'most',
      items: model.items.map((item) => ({
        ...item,
        label: item.value === 'most' ? 'Most visited' : 'Latest'
      }))
    }));

    expect(host.isConnected).toBe(true);
    expect(host.querySelector('[data-recent-mode="most"]')?.getAttribute('aria-checked'))
      .toBe('true');
    // Radio group semantics: no tab role, no aria-selected alongside aria-checked.
    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(host.querySelector('[aria-selected]')).toBeNull();
    expect(host.querySelector('select')?.value).toBe('most');
    expect(host.querySelector('[data-recent-mode="most"]')?.textContent)
      .toContain('Most visited');
  });

  it('shows the selected state immediately and remeasures after a hidden panel becomes visible', () => {
    const { controller, host } = createFixture();
    let visible = false;
    let resizeCallback: ResizeObserverCallback = () => {};
    const observed: { observer: ResizeObserver | null } = { observer: null };
    class ResizeObserverMock implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        observed.observer = this;
        resizeCallback = callback;
      }

      disconnect() {}

      observe() {}

      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
      const left = this === host
        ? 100
        : this.dataset.recentMode === 'latest'
          ? 112
          : 190;
      const width = !visible
        ? 0
        : this === host
          ? 180
          : 70;
      return new DOMRect(left, 8, width, 32);
    });

    act(() => controller.render(model));
    const indicator = queryHtmlElement(host, '._x_extension_theme_indicator_2024_unique_');
    expect(indicator?.dataset.ready).toBe('false');
    expect(host.querySelector('[data-recent-mode="latest"]')?.getAttribute('data-active'))
      .toBe('true');

    visible = true;
    act(() => resizeCallback([], required(observed.observer, 'resize observer')));

    expect(indicator?.dataset.ready).toBe('true');
    expect(indicator?.style.width).toBe('70px');
    expect(indicator?.style.transform).toBe('translateX(12px)');
  });

  it('supports keyboard tab navigation and disabled state', () => {
    const { controller, host, onSelect } = createFixture();
    act(() => controller.render(model));

    const latest = queryHtmlTag(host, '[data-recent-mode="latest"]', 'button');
    act(() => {
      latest?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    });
    expect(onSelect).toHaveBeenCalledWith('most');

    act(() => controller.render({ ...model, disabled: true }));
    expect(queryHtmlTag(host, '[data-recent-mode="latest"]', 'button')?.disabled)
      .toBe(true);
    expect(host.querySelector('select')?.disabled).toBe(true);
  });

  it('acts as one radio group with a single tab stop that arrows move', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const { controller, host, onSelect } = createFixture();
    onSelect.mockImplementation((value: string) => {
      controller.render({ ...model, activeValue: value });
    });
    act(() => controller.render(model));

    expect(host.getAttribute('role')).toBe('radiogroup');
    const radios = () => Array.from(getTags(host, '[role="radio"]', 'button'));
    expect(radios()).toHaveLength(2);
    expect(radios().map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([0, -1]);
    expect(radios().some((radio) => radio.hasAttribute('aria-pressed'))).toBe(false);

    radios()[0].focus();
    act(() => {
      radios()[0].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' }));
    });
    expect(onSelect).toHaveBeenLastCalledWith('most');
    expect(radios().map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([-1, 0]);
    expect(document.activeElement).toBe(radios()[1]);
    expect(host.querySelector('select')?.value).toBe('most');

    act(() => {
      radios()[1].dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
    });
    expect(onSelect).toHaveBeenLastCalledWith('latest');
    expect(document.activeElement).toBe(radios()[0]);
  });

  it('keeps the first option tabbable when nothing is selected', () => {
    const { controller, host } = createFixture();
    act(() => controller.render({ ...model, activeValue: 'unknown' }));

    expect(Array.from(getTags(host, '[role="radio"]', 'button'), (radio) => radio.tabIndex))
      .toEqual([0, -1]);
  });
});
