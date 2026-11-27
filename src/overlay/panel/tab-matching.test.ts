import { describe, expect, it } from 'vitest';
import { overlayOpenTabsOrder, type OverlayOpenTabsOrder } from '../../domain/settings/overlay-panel';
import { createMemorySettings } from '../../../tests/fakes/memory-settings';
import { createTabMatching } from './tab-matching';

const TABS = [
  { id: 1, title: 'Current page', url: 'https://current.example/' },
  { id: 2, title: 'Mail', url: 'https://mail.example/' },
  { id: 3, title: 'Docs', url: 'https://docs.example/' }
];

async function matchingFor(order: OverlayOpenTabsOrder) {
  const { store } = createMemorySettings({ sync: { [overlayOpenTabsOrder.key]: order } });
  await store.include(overlayOpenTabsOrder);
  return createTabMatching({
    prioritizeCurrentPageMatch: false,
    initialContextTabUrl: '',
    overlayTabs: { currentTabId: 1, tabs: [] },
    settings: store
  });
}

describe('open tabs listed before anything is typed', () => {
  it('leaves the current tab out when ordered by recent use', async () => {
    expect((await matchingFor('recent')).filterTabsForOverlay(TABS, '').map((tab) => tab.id)).toEqual([2, 3]);
  });

  it('moves the current tab to second place when ordered by frequency', async () => {
    expect((await matchingFor('frequent')).filterTabsForOverlay(TABS, '').map((tab) => tab.id)).toEqual([2, 1, 3]);
  });

  it('keeps the current tab among the matches of a query in either order', async () => {
    expect((await matchingFor('recent')).filterTabsForOverlay(TABS, 'example').map((tab) => tab.id)).toEqual([1, 2, 3]);
  });
});
