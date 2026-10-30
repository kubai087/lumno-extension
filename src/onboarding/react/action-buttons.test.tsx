import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionButtons, type ActionButtonsModel } from './action-buttons';
import { getElement } from '../../../tests/fakes/dom';
import { queryHtmlTag } from '../../shared/dom-lookup';

let roots: Root[] = [];

// Draws the group with no actions first, so its element is in place.
function createFixture() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  const options = {
    onAction: vi.fn(),
    onShowTooltip: vi.fn(),
    onHideTooltip: vi.fn()
  };
  const controller = {
    render(actions: ActionButtonsModel) {
      root.render(<ActionButtons actions={actions} handlers={options} />);
    }
  };
  act(() => controller.render({}));
  return { controller, host: getElement(container, '.onboarding-copy-actions'), options };
}

afterEach(() => {
  act(() => {
    roots.forEach((root) => root.unmount());
  });
  roots = [];
  document.body.textContent = '';
});

describe('Onboarding action buttons', () => {
  it('renders action variants, labels, icons, and tooltip metadata', () => {
    const { controller, host } = createFixture();
    act(() => {
      controller.render({
        primary: {
          actionId: 'next',
          label: 'Next',
          icon: 'ri-arrow-right-line'
        },
        secondary: {
          actionId: 'prev',
          label: 'Back'
        },
        ghost: {
          actionId: 'openOptions',
          label: 'Settings',
          icon: 'ri-external-link-line',
          tooltip: 'Open settings',
          tooltipMaxWidth: 260
        }
      });
    });

    const buttons = Array.from(host.querySelectorAll('button'));
    expect(host.dataset.visible).toBe('true');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].classList).toContain(
      'onboarding-action-button--primary'
    );
    expect(buttons[0].querySelector('.ri-arrow-right-line')).not.toBeNull();
    expect(buttons[1].querySelector('.ri-icon')).toBeNull();
    expect(buttons[2].dataset.tooltip).toBe('Open settings');
    expect(buttons[2].dataset.tooltipMaxWidth).toBe('260');
  });

  it('dispatches once without reaching the legacy document delegate', () => {
    const { controller, host, options } = createFixture();
    const documentClick = vi.fn();
    document.addEventListener('click', documentClick);
    act(() => {
      controller.render({
        primary: { actionId: 'next', label: 'Next' }
      });
    });

    act(() => {
      host.querySelector('button')?.click();
    });

    expect(options.onAction).toHaveBeenCalledTimes(1);
    expect(options.onAction.mock.calls[0][0]).toBe('next');
    expect(options.onHideTooltip).toHaveBeenCalled();
    expect(documentClick).not.toHaveBeenCalled();
    document.removeEventListener('click', documentClick);
  });

  it('preserves tooltip hover, focus, and Escape behavior', () => {
    const { controller, host, options } = createFixture();
    act(() => {
      controller.render({
        ghost: {
          actionId: 'openOptions',
          label: 'Settings',
          tooltip: 'Open settings'
        }
      });
    });
    const button = queryHtmlTag(host, 'button', 'button');
    if (!button) {
      throw new Error('fixture action button is missing');
    }

    act(() => {
      button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      button.focus();
      button.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })
      );
    });

    expect(options.onShowTooltip).toHaveBeenCalled();
    expect(options.onHideTooltip).toHaveBeenCalled();
    expect(document.activeElement).not.toBe(button);
  });

  it('hides and clears the group when a slide has no actions', () => {
    const { controller, host } = createFixture();
    act(() => {
      controller.render({
        primary: { actionId: 'next', label: 'Next' }
      });
      controller.render({});
    });

    expect(host.hidden).toBe(true);
    expect(host.dataset.visible).toBe('false');
    expect(host.childElementCount).toBe(0);
  });
});
