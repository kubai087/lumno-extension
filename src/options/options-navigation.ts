// Settings navigation: the tab list, the active tab, the sticky header,
// scroll and resize refreshes, and scrolling to a linked setting.
import type { createPanelHeightAnimator } from './options-panel-motion';
import type { SiteSearchProviders } from './features/site-search/providers';
import type { GetMessage } from './options-types';
import type { SettingsNavigationController, SettingsNavigationItemModel } from './react/settings-navigation';

type SettingsTabKey = 'general' | 'account' | 'appearance' | 'shortcuts' | 'blacklist' | 'labs';

// The settings tabs, in their order on the page.
const SETTINGS_TAB_KEYS: readonly SettingsTabKey[] = Object.freeze([
  'general',
  'account',
  'appearance',
  'shortcuts',
  'blacklist',
  'labs'
]);

// A tab key from a link or a click; the General tab when it names none.
function normalizeSettingsTabKey(value: unknown): SettingsTabKey {
  return SETTINGS_TAB_KEYS.find((key) => key === value) || 'general';
}

interface NavigationState {
  // Made once the page has mounted its React views.
  settingsNavigationController: SettingsNavigationController | null;
  panelHeightAnimator: ReturnType<typeof createPanelHeightAnimator> | null;
  currentActiveSettingsTab: SettingsTabKey;
}

interface NavigationDeps {
  getMessage: GetMessage;
  // Each tab's content, by its data-content.
  tabContents: Element[];
  // Read again whenever the Search sources tab opens.
  siteSearchProviders: Pick<SiteSearchProviders, 'refresh'>;
  tabsRow: Element | null;
  optionsState: NavigationState;
}

interface OptionsRouteState {
  tabKey: string;
  // What in the tab the link points at, after the first ':'.
  targetKey: string;
}

interface ScrollToTargetOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  // Flash the row once it is in view.
  flash?: boolean;
}

function createNavigation(deps: NavigationDeps) {
  const {
    getMessage,
    tabContents,
    siteSearchProviders,
    tabsRow
  } = deps;

  // The page state object shared with options.js and the other modules.
  const optionsState = deps.optionsState;

  const OPTIONS_TARGET_SITE_SEARCH_AI = 'site-search-ai';
  const OPTIONS_TARGET_DOCUMENT_PIP = 'document-pip';

  function getSettingsNavigationItems(): SettingsNavigationItemModel[] {
    return [
      {
        key: 'general',
        labelKey: 'settings_tab_general',
        label: getMessage('settings_tab_general', '常规'),
        iconName: 'ri-command-fill'
      },
      {
        key: 'account',
        labelKey: 'settings_tab_account',
        label: getMessage('settings_tab_account', '账号与同步'),
        iconName: 'ri-user-3-line'
      },
      {
        key: 'appearance',
        labelKey: 'settings_tab_appearance',
        label: getMessage('settings_tab_appearance', '外观'),
        iconName: 'ri-moon-clear-fill'
      },
      {
        key: 'shortcuts',
        labelKey: 'settings_tab_shortcuts',
        label: getMessage('settings_tab_shortcuts', '搜索源'),
        iconName: 'ri-search-line'
      },
      {
        key: 'blacklist',
        labelKey: 'settings_tab_blacklist',
        label: getMessage('settings_tab_blacklist', '黑名单'),
        iconName: 'ri-forbid-2-fill'
      },
      {
        key: 'labs',
        labelKey: 'settings_tab_labs',
        label: getMessage('settings_tab_labs', '实验室功能'),
        iconName: 'ri-test-tube-fill'
      }
    ];
  }

  function renderSettingsNavigation(tabKey: SettingsTabKey): void {
    if (!optionsState.settingsNavigationController) {
      return;
    }
    optionsState.settingsNavigationController.render({
      activeKey: tabKey,
      items: getSettingsNavigationItems()
    });
  }

  function setActiveTab(tabKey: unknown): void {
    const nextTabKey = normalizeSettingsTabKey(tabKey);
    if (optionsState.panelHeightAnimator) {
      optionsState.panelHeightAnimator.cancel();
    }
    optionsState.currentActiveSettingsTab = nextTabKey;
    renderSettingsNavigation(nextTabKey);
    tabContents.forEach((content) => {
      const isActive = content.getAttribute('data-content') === nextTabKey;
      content.setAttribute('data-active', isActive ? 'true' : 'false');
    });
    const nextHash = `#${nextTabKey}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }

  function handleSettingsTabSelection(value: string): void {
    const tabKey = normalizeSettingsTabKey(value);
    const currentTabKey = optionsState.currentActiveSettingsTab;
    setActiveTab(tabKey);
    if (tabKey !== currentTabKey) {
      resetPageScrollToDefault();
    }
    if (tabKey === 'shortcuts') {
      void siteSearchProviders.refresh();
    }
  }

  function updateTabsStickyVisualState(): void {
    if (!tabsRow) return;
    const stickyTop = parseFloat(window.getComputedStyle(tabsRow).top || '0') || 0;
    const isStuck = tabsRow.getBoundingClientRect().top <= stickyTop + 0.5;
    tabsRow.setAttribute('data-stuck', isStuck ? 'true' : 'false');
  }

  let optionsScrollFrame = 0;
  let optionsResizeFrame = 0;
  function scheduleOptionsScrollRefresh(): void {
    if (optionsScrollFrame) {
      return;
    }
    optionsScrollFrame = window.requestAnimationFrame(() => {
      optionsScrollFrame = 0;
      updateTabsStickyVisualState();
    });
  }

  function scheduleOptionsViewportLayoutRefresh(): void {
    if (optionsResizeFrame) {
      return;
    }
    optionsResizeFrame = window.requestAnimationFrame(() => {
      optionsResizeFrame = 0;
      updateTabsStickyVisualState();
    });
  }

  function resetPageScrollToDefault(): void {
    window.scrollTo({ top: 0, behavior: 'auto' });
    updateTabsStickyVisualState();
  }

  function getOptionsRouteState(): OptionsRouteState {
    const rawHash = window.location.hash.replace('#', '').trim();
    if (!rawHash) {
      return {
        tabKey: '',
        targetKey: ''
      };
    }
    const parts = rawHash.split(':').map((part) => part.trim()).filter(Boolean);
    return {
      tabKey: parts[0] || '',
      targetKey: parts.slice(1).join(':')
    };
  }

  function getOptionsTargetElement(targetKey: string): Element | null {
    if (targetKey === OPTIONS_TARGET_DOCUMENT_PIP) {
      return document.getElementById('_x_extension_document_pip_row_2026_unique_');
    }
    if (targetKey !== OPTIONS_TARGET_SITE_SEARCH_AI) {
      return null;
    }
    return document.getElementById('_x_extension_site_search_ai_group_2026_unique_');
  }

  function scrollToOptionsTarget(targetKey: string, options?: ScrollToTargetOptions): boolean {
    const target = getOptionsTargetElement(targetKey);
    if (!target) {
      return false;
    }
    const behavior = options && options.behavior ? options.behavior : 'smooth';
    const block = options && options.block ? options.block : 'start';
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior, block });
      updateTabsStickyVisualState();
      if (options && options.flash) {
        flashOptionsTarget(target);
      }
    });
    return true;
  }

  // Points the eye at the row a deep link opened, e.g. the web clip switch
  // that the toolbar button leads to while web clip is off.
  function flashOptionsTarget(target: Element): void {
    target.removeAttribute('data-flash');
    // Reading the layout restarts the animation when the attribute returns.
    void target.getBoundingClientRect();
    target.setAttribute('data-flash', 'true');
    const onFlashEnd = () => {
      target.removeAttribute('data-flash');
      target.removeEventListener('animationend', onFlashEnd);
    };
    target.addEventListener('animationend', onFlashEnd);
  }

  return {
    renderSettingsNavigation,
    setActiveTab,
    handleSettingsTabSelection,
    updateTabsStickyVisualState,
    scheduleOptionsScrollRefresh,
    scheduleOptionsViewportLayoutRefresh,
    getOptionsRouteState,
    scrollToOptionsTarget
  };
}

export { createNavigation, normalizeSettingsTabKey, SETTINGS_TAB_KEYS };
export type { NavigationDeps, NavigationState, OptionsRouteState, ScrollToTargetOptions, SettingsTabKey };
