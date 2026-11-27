import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Settings from '../../../domain/settings';
import { getTag, getTags } from '../../../../tests/fakes/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import { GeneralOverlaySection } from './overlay-section';

const OPEN_KEY = Settings.overlayOpenInCurrentTab.key;
const OPEN_TABS_KEY = Settings.overlayOpenTabsDefaultVisible.key;

function setUp() {
  return renderOptionsView(<GeneralOverlaySection />);
}

afterEach(cleanUpOptionsViews);

describe('Options General webpage focus overlay section', () => {
  it('shows the overlay settings as stored and never rewrites them on its own', async () => {
    const { settings } = setUp();
    await settings.settle();
    expect(settings.writes).toEqual([]);
  });

  it('asks whether results open in a new tab, on by default, and stores the reverse', async () => {
    const { host, writes, settings } = setUp();
    const toggle = () => getTag(host, '#_x_extension_overlay_open_in_new_tab_toggle_2026_unique_', 'input');
    expect(toggle().checked).toBe(true);
    act(() => toggle().click());
    await settings.settle();
    expect(writes).toContainEqual({ [OPEN_KEY]: true });
    await settings.change(Settings.overlayOpenInCurrentTab, true);
    expect(toggle().checked).toBe(false);
    await settings.change(Settings.overlayOpenInCurrentTab, false);
    expect(toggle().checked).toBe(true);
  });

  it('saves the open tabs switch', async () => {
    const { host, writes, settings } = setUp();
    act(() => getTag(host, '#_x_extension_overlay_open_tabs_default_visible_toggle_2026_unique_', 'input').click());
    await settings.settle();
    expect(writes).toEqual([{ [OPEN_TABS_KEY]: !Settings.overlayOpenTabsDefaultVisible.parse(undefined) }]);
  });

  it('orders the open tabs by recent use by default and saves the switch to frequency', async () => {
    const { host, writes, settings } = setUp();
    const buttons = () => getTags(host, '#_x_extension_overlay_open_tabs_order_tabs_wrap_2026_unique_ button', 'button');
    expect(buttons().map((button) => button.dataset.active)).toEqual(['true', 'false']);
    act(() => buttons()[1]?.click());
    await settings.settle();
    expect(writes).toEqual([{ [Settings.overlayOpenTabsOrder.key]: 'frequent' }]);
    await settings.change(Settings.overlayOpenTabsOrder, 'recent');
    expect(buttons().map((button) => button.dataset.active)).toEqual(['true', 'false']);
  });
});
