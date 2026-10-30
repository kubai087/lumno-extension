import { describe, expect, it } from 'vitest';
import { getDefaultTabDisposition, getDisposition, isBackgroundOpenEvent, isMiddleClick } from './navigation-disposition';
import type { DefaultTabOpen, Disposition } from './navigation-disposition';

describe('navigation disposition', () => {
  it('opens in a background tab on Command-click, Control-click and middle-click', () => {
    expect(isBackgroundOpenEvent({ metaKey: true, ctrlKey: false, button: 0 })).toBe(true);
    expect(isBackgroundOpenEvent({ metaKey: false, ctrlKey: true, button: 0 })).toBe(true);
    expect(isBackgroundOpenEvent({ metaKey: false, ctrlKey: false, button: 1 })).toBe(true);
    expect(isBackgroundOpenEvent({ metaKey: false, ctrlKey: false, button: 0 })).toBe(false);
  });

  it('lets a background modifier win over the fallback and keeps the fallback otherwise', () => {
    expect(getDisposition({ metaKey: true }, 'currentTab')).toBe('backgroundTab');
    expect(getDisposition({ button: 0 }, 'currentTab')).toBe('currentTab');
  });

  it('tells a middle click from a right click', () => {
    expect(isMiddleClick({ button: 1 })).toBe(true);
    expect(isMiddleClick({ button: 2 })).toBe(false);
  });

  const cases: Array<[DefaultTabOpen, Disposition]> = [
    [{}, 'newTab'],
    [{ openInOtherTab: true }, 'currentTab'],
    [{ openInBackgroundTab: true }, 'backgroundTab'],
    [{ openInOtherTab: true, openInBackgroundTab: true }, 'currentTab'],
    [{ currentTabByDefault: true }, 'currentTab'],
    [{ currentTabByDefault: true, openInOtherTab: true }, 'newTab'],
    [{ currentTabByDefault: true, openInBackgroundTab: true }, 'backgroundTab'],
    [{ currentTabByDefault: true, openInOtherTab: true, openInBackgroundTab: true }, 'newTab']
  ];

  it.each(cases)('lets Option/Alt flip the default tab and win over background opening: %j', (options, disposition) => {
    expect(getDefaultTabDisposition(options)).toBe(disposition);
  });
});
