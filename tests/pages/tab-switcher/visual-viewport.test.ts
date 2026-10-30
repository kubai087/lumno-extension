import { describe, expect, it, vi } from 'vitest';
import { bootTabSwitcherPage, settle, switcherTabs } from './boot';

// The tab switcher follows the visual viewport only while it is open.
describe('Tab switcher and the visual viewport', () => {
  it('tracks visual viewport resizes and scrolls while open, and stops on close', async () => {
    const page = await bootTabSwitcherPage();
    const added = vi.spyOn(page.visualViewport, 'addEventListener');
    const removed = vi.spyOn(page.visualViewport, 'removeEventListener');
    const listening = (type: string) => added.mock.calls.filter(([each]) => each === type).length -
      removed.mock.calls.filter(([each]) => each === type).length;

    page.open({ tabs: switcherTabs(4) });
    await settle(50);
    expect(listening('resize')).toBeGreaterThan(0);
    expect(listening('scroll')).toBeGreaterThan(0);

    page.press('Escape');
    await settle(300);
    expect([listening('resize'), listening('scroll')]).toEqual([0, 0]);
  });
});
