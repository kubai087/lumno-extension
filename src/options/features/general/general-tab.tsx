// The General tab: its sections in order, with a divider between each two.
import {
  autoPipEnabled,
  linkPreviewEnabled,
  newtabOpenInNewTab,
  overlayTabPriority,
  pinnedTabRecoveryEnabled,
  progressTrackingEnabled,
  restrictedAction,
  selectionQuickActionsEnabled,
  selectionQuickActionsGroupEnabled,
  selectionQuickActionsProvider,
  tabSwitcherCurrentWindowOnly,
  tabSwitcherEnabled,
  updateNoticeEnabled
} from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import { overlayOpenInCurrentTab, overlayOpenTabsDefaultVisible } from '../../../domain/settings/overlay-panel';
import {
  searchFuzzyPinyinEnabled,
  searchResultDisplayLimit,
  searchResultPriority,
  searchResultSourceTypes,
  searchResultTabPosition
} from '../../../domain/settings/search';
import { SettingRows } from '../../react/setting-rows';
import { GeneralFeaturesSection } from './features-section';
import { GeneralGlobalSection } from './global-section';
import { GeneralNewtabSection } from './newtab-section';
import { GeneralOverlaySection } from './overlay-section';
import { GeneralSearchSection } from './search-section';
import { GeneralShortcutsSection } from './shortcuts-section';

// Every setting the tab shows, read with the page's other startup reads.
export const GENERAL_TAB_SETTINGS: readonly Setting<unknown>[] = [
  updateNoticeEnabled,
  autoPipEnabled,
  tabSwitcherEnabled,
  tabSwitcherCurrentWindowOnly,
  linkPreviewEnabled,
  pinnedTabRecoveryEnabled,
  selectionQuickActionsEnabled,
  selectionQuickActionsProvider,
  selectionQuickActionsGroupEnabled,
  searchResultTabPosition,
  searchResultPriority,
  searchResultDisplayLimit,
  searchFuzzyPinyinEnabled,
  searchResultSourceTypes,
  overlayOpenInCurrentTab,
  overlayOpenTabsDefaultVisible,
  progressTrackingEnabled,
  newtabOpenInNewTab,
  restrictedAction,
  overlayTabPriority
];

export function GeneralTab() {
  return (
    <SettingRows>
      {[
        <GeneralGlobalSection key="global" />,
        <GeneralFeaturesSection key="features" />,
        <GeneralSearchSection key="search" />,
        <GeneralOverlaySection key="overlay" />,
        <GeneralNewtabSection key="newtab" />,
        <GeneralShortcutsSection key="shortcuts" />
      ]}
    </SettingRows>
  );
}
