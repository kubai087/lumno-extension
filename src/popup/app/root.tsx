// The popup's one React root. The view reads the page facts, the settings
// store and the actions' state, and builds its model from them on every
// render; nothing outside calls into it.
import { useLayoutEffect, useState } from 'react';
import * as AppearanceSettings from '../../domain/settings/appearance';
import * as FeatureSettings from '../../domain/settings/features';
import * as OverlayPanelSettings from '../../domain/settings/overlay-panel';
import * as SyncStateSettings from '../../domain/settings/sync-state';
import { popupSettingsExpanded } from '../../domain/settings/page-cache';
import type { Setting } from '../../domain/settings/define';
import type { SettingsStore } from '../../platform/settings-store';
import { useSetting } from '../../shared/react/use-setting';
import { useStore } from '../../shared/react/use-store';
import type { PopupActions } from '../actions';
import type { PopupLocale } from '../locale';
import { buildModel, readSyncStatus } from '../model';
import type { PopupSettingId, PopupSettingValues } from '../model';
import type { PopupPageFacts } from '../page-facts';
import { PopupView } from '../react/popup-view';
import type { PopupHandlers } from '../react/popup-view';
import type { PortalHost } from '../../shared/react/portal-host';

type PopupSettings = { [K in PopupSettingId]: Setting<PopupSettingValues[K]> };

// The settings the popup shows, by row id.
const POPUP_SETTINGS: Readonly<PopupSettings> = Object.freeze({
  selectionQuickActions: FeatureSettings.selectionQuickActionsEnabled,
  overlaySize: OverlayPanelSettings.overlaySizeMode,
  overlayPageTheme: OverlayPanelSettings.overlayPageThemeAdaptationEnabled,
  overlayOpenTabs: OverlayPanelSettings.overlayOpenTabsDefaultVisible,
  theme: AppearanceSettings.themeMode,
  autoPip: FeatureSettings.autoPipEnabled
});

// Every setting the popup reads.
const POPUP_READ_SETTINGS: readonly Setting<unknown>[] = Object.freeze([
  ...Object.values(POPUP_SETTINGS),
  FeatureSettings.documentPipEnabled,
  SyncStateSettings.webdavStatus,
  popupSettingsExpanded
]);

function isSettingId(id: string): id is PopupSettingId {
  return Object.prototype.hasOwnProperty.call(POPUP_SETTINGS, id);
}

// The tooltips the view asks for, drawn outside React in the popup's body.
type PopupTooltips = Pick<PopupHandlers, 'onShowTooltip' | 'onHideTooltip' | 'bindTruncationTooltip'>;

interface PopupAppProps {
  facts: PopupPageFacts;
  locale: PopupLocale;
  settingsStore: SettingsStore;
  actions: PopupActions;
  tooltips: PopupTooltips;
  // After every render, once the popup has its new height.
  onRendered(): void;
}

function usePopupSettings(store: SettingsStore): PopupSettingValues {
  return {
    selectionQuickActions: useSetting(store, POPUP_SETTINGS.selectionQuickActions),
    overlaySize: useSetting(store, POPUP_SETTINGS.overlaySize),
    overlayPageTheme: useSetting(store, POPUP_SETTINGS.overlayPageTheme),
    overlayOpenTabs: useSetting(store, POPUP_SETTINGS.overlayOpenTabs),
    theme: useSetting(store, POPUP_SETTINGS.theme),
    autoPip: useSetting(store, POPUP_SETTINGS.autoPip)
  };
}

function PopupApp({ facts, locale, settingsStore, actions, tooltips, onRendered }: PopupAppProps) {
  const settings = usePopupSettings(settingsStore);
  const documentPipEnabled = useSetting(settingsStore, FeatureSettings.documentPipEnabled);
  const syncStatus = readSyncStatus(useSetting(settingsStore, SyncStateSettings.webdavStatus));
  const settingsExpanded = useSetting(settingsStore, popupSettingsExpanded);
  const [pipMenuExpanded, setPipMenuExpanded] = useState(false);
  const run = useStore(actions.store);
  useLayoutEffect(() => {
    onRendered();
  });

  const model = buildModel({
    ...facts,
    ...run,
    documentPipEnabled,
    settings,
    settingsExpanded,
    pip: { ...facts.pip, menuExpanded: pipMenuExpanded },
    syncStatus,
    lang: locale.lang,
    now: Date.now()
  }, locale.t);

  // Shows a value at once and stores it; the rest of Lumno follows the
  // storage change.
  function saveSetting(id: string, rawValue: unknown): void {
    if (!isSettingId(id)) return;
    const setting: Setting<unknown> = POPUP_SETTINGS[id];
    settingsStore.set(setting, setting.parse(rawValue)).catch(() => {});
  }

  const handlers: PopupHandlers = {
    ...tooltips,
    onAction: (id) => void actions.run(id),
    onSwitch: saveSetting,
    onSelect: saveSetting,
    // The settings and an action's options take turns being open, so the
    // popup stays inside the browser's 600px height limit.
    onSettingsToggle(expanded) {
      void settingsStore.set(popupSettingsExpanded, expanded);
      if (expanded) setPipMenuExpanded(false);
      tooltips.onHideTooltip();
    },
    onActionMenuToggle(id, expanded) {
      if (id !== 'pip') return;
      setPipMenuExpanded(expanded);
      if (expanded && settingsExpanded) void settingsStore.set(popupSettingsExpanded, false);
      tooltips.onHideTooltip();
    },
    onLink: (id) => actions.openLink(id)
  };
  return <PopupView handlers={handlers} model={model} />;
}

// Draws the popup into its host through the page's root. The first render
// is synchronous, so the browser sizes the popup to it.
function mountPopup(portals: PortalHost, host: HTMLElement, props: PopupAppProps): void {
  portals.show(host, <PopupApp {...props} />);
}

export { POPUP_READ_SETTINGS, mountPopup };
export type { PopupAppProps, PopupTooltips };
