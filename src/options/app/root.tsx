// The Options page's one React root: the tabs row with the version badge,
// and the settings panel with every tab, the open one shown. The panel
// draws in the page theme; the tabs row stays pinned and the panel animates
// its height once both are drawn.
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import * as NAVIGATION_DISPOSITION from '../../domain/navigation-disposition';
import * as LumnoMessaging from '../../platform/messaging';
import { useStore } from '../../shared/react/use-store';
import { followStickyTabs } from '../dom/sticky-tabs';
import { markBrowserUnsupportedSettings } from '../dom/unsupported-settings';
import { AccountTab } from '../features/account/account-tab';
import { AppearanceTab } from '../features/appearance/appearance-tab';
import { BlacklistTab } from '../features/blacklist/blacklist-tab';
import { GeneralTab } from '../features/general/general-tab';
import { LabsTab } from '../features/labs/labs-tab';
import type { OptionsNavigation } from '../features/navigation/navigation';
import { getTabItems, type SettingsTabKey } from '../features/navigation/tabs';
import { SearchSourcesTab } from '../features/search-sources/search-sources-tab';
import { SettingsNavigation } from '../react/settings-navigation';
import { OptionsPageContext, useMessages, useOptionsPage, type OptionsPage } from './context';
import type { PanelMotion } from './panel-motion';

interface OptionsAppProps {
  page: OptionsPage;
  navigation: OptionsNavigation;
  panelMotion: PanelMotion;
  // The root's host, which keeps room below the panel while it animates.
  host: HTMLElement;
}

const TABS: ReadonlyArray<[SettingsTabKey, () => ReactNode]> = [
  ['general', () => <GeneralTab />],
  ['account', () => <AccountTab />],
  ['appearance', () => <AppearanceTab />],
  ['shortcuts', () => <SearchSourcesTab />],
  ['blacklist', () => <BlacklistTab />],
  ['labs', () => <LabsTab />]
];

// The extension's version; it opens the release notes.
function VersionBadge() {
  const t = useMessages();
  const tooltip = t('settings_version_tooltip', '查看更新日志');
  const open = (event: { button: number; preventDefault(): void; stopPropagation(): void; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
    event.preventDefault();
    event.stopPropagation();
    LumnoMessaging.sendBackgroundMessage(chrome.runtime, {
      action: 'openReleasePage',
      reason: 'options-version',
      disposition: NAVIGATION_DISPOSITION.getDisposition(event, 'newTab')
    }, () => {
      // An unanswered message leaves runtime.lastError set; nothing else to do.
      void chrome.runtime.lastError;
    });
  };
  return (
    <button
      aria-label={tooltip}
      className="_x_extension_settings_version_badge_2024_unique_ _x_extension_tooltip_host_2026_unique_"
      data-tooltip={tooltip}
      id="_x_extension_settings_version_2024_unique_"
      onAuxClick={(event) => {
        if (event.button === 1) open(event);
      }}
      onClick={open}
      type="button"
    >
      {`v${chrome.runtime.getManifest().version || ''}`}
    </button>
  );
}

function OptionsLayout({ navigation, panelMotion, host }: Omit<OptionsAppProps, 'page'>) {
  const { pageTheme } = useOptionsPage();
  const getMessage = useMessages();
  const { activeTab } = useStore(navigation.store);
  const { resolved } = useStore(pageTheme.store);
  const tabsRowRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const tabsRow = tabsRowRef.current;
    return tabsRow ? followStickyTabs(tabsRow, window) : undefined;
  }, []);
  // Once the first draw is on the page: the panel's motion, and the reason
  // tooltips of rows this browser cannot honor. Both keep their identity.
  useLayoutEffect(() => {
    if (panelRef.current) {
      panelMotion.attach(panelRef.current, host, document, window);
    }
  }, [panelMotion, host]);
  useLayoutEffect(() => {
    markBrowserUnsupportedSettings(getMessage);
  }, [getMessage]);
  useEffect(() => {
    document.title = getMessage('options_page_title', 'Lumno 设置');
  }, [getMessage]);
  return (
    <>
      <div className="_x_extension_settings_tabs_row_2024_unique_" ref={tabsRowRef}>
        <div className="_x_extension_settings_tabs_frame_2026_unique_">
          <div id="_x_extension_settings_tabs_2024_unique_">
            <SettingsNavigation model={{ activeKey: activeTab, items: getTabItems(getMessage) }} onSelect={(key) => navigation.select(key)} />
          </div>
        </div>
        <VersionBadge />
        <span aria-hidden="true" className="_x_extension_settings_sticky_line_2026_unique_" />
      </div>
      <div data-theme={resolved} id="_x_extension_settings_panel_2024_unique_" ref={panelRef}>
        {TABS.map(([key, draw]) => (
          <div
            className="_x_extension_settings_content_2024_unique_"
            data-active={key === activeTab ? 'true' : 'false'}
            data-content={key}
            id={key === 'account' ? '_x_extension_account_settings_content_2026_unique_' : undefined}
            key={key}
          >
            {draw()}
          </div>
        ))}
      </div>
    </>
  );
}

export function OptionsApp({ page, ...layout }: OptionsAppProps) {
  return (
    <OptionsPageContext.Provider value={page}>
      <OptionsLayout {...layout} />
    </OptionsPageContext.Provider>
  );
}
