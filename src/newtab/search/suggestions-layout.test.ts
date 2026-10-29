import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModeMenuResults } from '../../shared/search/input-mode/menu/surface';
import { createSuggestionsLayout } from './suggestions-layout';

const LIMIT = '--x-nt-suggestions-menu-fit-max-height';

function setUp() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let limit: number | null = null;
  const layoutController = {
    setSuggestionsVisible: vi.fn(),
    updateSuggestionsFloatingLayout: vi.fn()
  };
  const inputModeController = {
    // Stands in for the menu surface: caps the list at the limit set.
    placeModeMenuBelowResults: vi.fn((results: ModeMenuResults) => {
      const previous = results.element.style.getPropertyValue(results.capProperty);
      if (limit === null) {
        results.element.style.removeProperty(results.capProperty);
      } else {
        results.element.style.setProperty(results.capProperty, `${limit}px`);
      }
      return results.element.style.getPropertyValue(results.capProperty) !== previous;
    })
  };
  const layout = createSuggestionsLayout({
    suggestionsContainer: container,
    searchBox: { modeController: inputModeController },
    pageState: {
      layoutMotion: null,
      layoutController
    }
  });
  return {
    container,
    layout,
    layoutController,
    inputModeController,
    setLimit: (next: number | null) => { limit = next; }
  };
}

afterEach(() => {
  document.body.textContent = '';
});

describe('New Tab suggestions layout', () => {
  it('redraws the frame whenever the scope menu changes the list height limit', () => {
    const { container, layout, layoutController, setLimit } = setUp();

    setLimit(59);
    layout.syncSearchModeMenuResultOffset();
    expect(container.style.getPropertyValue(LIMIT)).toBe('59px');
    expect(layoutController.updateSuggestionsFloatingLayout).toHaveBeenCalledTimes(1);

    // The menu closes: the limit goes and the frame follows the taller list.
    setLimit(null);
    layout.syncSearchModeMenuResultOffset();
    expect(container.style.getPropertyValue(LIMIT)).toBe('');
    expect(layoutController.updateSuggestionsFloatingLayout).toHaveBeenCalledTimes(2);
  });

  it('leaves the frame alone when the limit stays the same', () => {
    const { layout, layoutController, setLimit } = setUp();
    setLimit(80);
    layout.syncSearchModeMenuResultOffset();
    layout.syncSearchModeMenuResultOffset();
    expect(layoutController.updateSuggestionsFloatingLayout).toHaveBeenCalledTimes(1);
  });

  it('hands the menu the list, its cap and whether it shows', () => {
    const { container, layout, inputModeController } = setUp();
    layout.syncSearchModeMenuResultOffset();
    const [results] = inputModeController.placeModeMenuBelowResults.mock.calls[0];
    expect(results.element).toBe(container);
    expect(results.capProperty).toBe(LIMIT);
    expect(results.isShown()).toBe(false);
    container.setAttribute('data-visible', 'true');
    expect(results.isShown()).toBe(true);
  });
});
