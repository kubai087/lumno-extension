import { afterEach, describe, expect, it, vi } from 'vitest';
import * as FaviconResolver from '../../domain/favicon/resolver';
import { LumnoSearchInputMode, createModeParts, resetModeTest } from '../../../tests/fakes/search-input-mode';

afterEach(resetModeTest);

describe('Search scope menu: Tab, focus and the shortcut hint', () => {
  it('checks current favicon policy before assigning prefix and menu images', () => {
    let enhanced = true;
    const resolver = FaviconResolver.createFaviconUrlResolver({
      getRuntimeUrl: (path: string) => `chrome-extension://abc${path}`,
      isEnhancedFaviconFetchEnabled: () => enhanced
    });
    const pageUrl = 'https://custom.example.com/';
    const iconUrl = 'https://custom.example.com/favicon.ico';
    const provider = { key: 'custom', name: 'Custom', iconUrl };
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(parts, {
      // These callers deliberately retain a URL chosen before settings changed.
      getProviderIcon: () => iconUrl,
      resolveProviderIconUrl: (_provider, source) => (
        resolver.getProviderFaviconUrl(pageUrl, source)
      ),
      getModeMenuItems: () => [{
        id: 'provider:custom', kind: 'provider', label: 'Custom', provider, iconUrl
      }]
    });
    controller.setProviderPrefix(provider);
    expect(parts.modePrefixIcon.getAttribute('src')).toBe(iconUrl);
    controller.openModeMenu();
    expect(controller.menuElement.querySelector('img')?.getAttribute('src')).toBe(iconUrl);
    enhanced = false;
    controller.setProviderPrefix(provider);
    expect(parts.modePrefixIcon.getAttribute('src')).toBe(resolver.getExtensionFaviconUrl(pageUrl));
    controller.refreshModeMenu();
    const menuImages = Array.from(controller.menuElement.querySelectorAll('img'));
    expect(menuImages).toHaveLength(1);
    expect(menuImages[0].getAttribute('src')).toBe(resolver.getExtensionFaviconUrl(pageUrl));
    expect(controller.menuElement.innerHTML).not.toContain(iconUrl);
    controller.destroy();
  });

  it('reports mode-tag activation only when the visible tag state changes', () => {
    const parts = createModeParts();
    const onModeTagActiveChange = vi.fn();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      { onModeTagActiveChange }
    );

    expect(controller.hasActiveModeTag()).toBe(false);
    controller.setPrefixText('Google', {}, { modeId: 'provider:google' });
    expect(controller.hasActiveModeTag()).toBe(true);
    expect(onModeTagActiveChange).toHaveBeenCalledTimes(1);
    expect(onModeTagActiveChange).toHaveBeenLastCalledWith(true);

    controller.setPrefixText('Google', {}, { modeId: 'provider:google' });
    expect(onModeTagActiveChange).toHaveBeenCalledTimes(1);

    controller.clearProviderPrefix();
    expect(controller.hasActiveModeTag()).toBe(false);
    expect(onModeTagActiveChange).toHaveBeenCalledTimes(2);
    expect(onModeTagActiveChange).toHaveBeenLastCalledWith(false);

    controller.destroy();
  });

  it('opens only after two distinct empty-input Tab presses within the shared window', () => {
    vi.useFakeTimers();
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [{
          id: 'provider:google',
          kind: 'provider',
          label: 'Google'
        }]
      }
    );
    const createTabEvent = (options: KeyboardEventInit = {}) => new KeyboardEvent(
      'keydown',
      { bubbles: true, cancelable: true, key: 'Tab', ...options }
    );

    const firstTab = createTabEvent();
    expect(controller.shouldOpenModeMenuForActiveModeOnTab(firstTab)).toBe(false);
    expect(controller.shouldOpenModeMenuOnDoubleTab(firstTab)).toBe(false);
    expect(firstTab.defaultPrevented).toBe(true);
    expect(controller.shouldOpenModeMenuOnDoubleTab(firstTab)).toBe(false);

    const repeatedTab = createTabEvent({ repeat: true });
    expect(controller.shouldOpenModeMenuOnDoubleTab(repeatedTab)).toBe(false);
    expect(repeatedTab.defaultPrevented).toBe(true);

    const secondTab = createTabEvent();
    expect(controller.shouldOpenModeMenuForActiveModeOnTab(secondTab)).toBe(false);
    expect(controller.shouldOpenModeMenuOnDoubleTab(secondTab)).toBe(true);
    expect(secondTab.defaultPrevented).toBe(true);

    expect(controller.shouldOpenModeMenuOnDoubleTab(createTabEvent())).toBe(false);
    vi.advanceTimersByTime(700);
    expect(controller.shouldOpenModeMenuOnDoubleTab(createTabEvent())).toBe(false);
    parts.input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(controller.shouldOpenModeMenuOnDoubleTab(createTabEvent())).toBe(false);
    parts.input.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' })
    );
    expect(controller.shouldOpenModeMenuOnDoubleTab(createTabEvent())).toBe(false);
    parts.input.dispatchEvent(new FocusEvent('blur'));
    expect(controller.shouldOpenModeMenuOnDoubleTab(createTabEvent())).toBe(false);
    controller.resetModeMenuDoubleTab();

    const modifiedTab = createTabEvent({ shiftKey: true });
    expect(controller.shouldOpenModeMenuOnDoubleTab(modifiedTab)).toBe(false);
    expect(modifiedTab.defaultPrevented).toBe(false);

    controller.setPrefixText('Google', {}, { modeId: 'provider:google' });
    const taggedTab = createTabEvent();
    expect(controller.shouldOpenModeMenuOnDoubleTab(taggedTab)).toBe(false);
    expect(taggedTab.defaultPrevented).toBe(false);
    controller.destroy();
  });

  it('preserves the first overlay Tab while its automatic open-tabs tag is applied', () => {
    vi.useFakeTimers();
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(parts);
    const createTabEvent = () => new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab'
    });

    const firstTab = createTabEvent();
    expect(controller.shouldOpenModeMenuOnDoubleTab(firstTab)).toBe(false);
    expect(firstTab.defaultPrevented).toBe(true);
    controller.setPrefixText('Open tabs', {}, {
      modeId: 'openTabs',
      preserveModeMenuDoubleTab: true
    });
    expect(parts.modePrefix.dataset.modeId).toBe('openTabs');

    const secondTab = createTabEvent();
    expect(controller.shouldCompleteModeMenuDoubleTab(secondTab)).toBe(true);
    expect(secondTab.defaultPrevented).toBe(true);

    const expiredFirstTab = createTabEvent();
    controller.setPrefixText('', {}, { modeId: '' });
    expect(controller.shouldOpenModeMenuOnDoubleTab(expiredFirstTab)).toBe(false);
    controller.setPrefixText('Open tabs', {}, {
      modeId: 'openTabs',
      preserveModeMenuDoubleTab: true
    });
    vi.advanceTimersByTime(700);
    const lateSecondTab = createTabEvent();
    expect(controller.shouldCompleteModeMenuDoubleTab(lateSecondTab)).toBe(false);
    expect(lateSecondTab.defaultPrevented).toBe(false);
    controller.destroy();
  });

  it('opens on one Tab when a tag is already selected and preserves that tag', () => {
    const parts = createModeParts('overlay');
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [{
          active: true,
          id: 'provider:google',
          kind: 'provider',
          label: 'Google'
        }],
        surface: 'overlay'
      }
    );
    const createTabEvent = (options: KeyboardEventInit = {}) => new KeyboardEvent(
      'keydown',
      { bubbles: true, cancelable: true, key: 'Tab', ...options }
    );

    const untaggedTab = createTabEvent();
    expect(controller.shouldOpenModeMenuForActiveModeOnTab(untaggedTab)).toBe(
      false
    );
    expect(untaggedTab.defaultPrevented).toBe(false);

    controller.setPrefixText('Google', {}, { modeId: 'provider:google' });
    const repeatedTab = createTabEvent({ repeat: true });
    expect(controller.shouldOpenModeMenuForActiveModeOnTab(repeatedTab)).toBe(
      false
    );
    expect(repeatedTab.defaultPrevented).toBe(false);
    const modifiedTab = createTabEvent({ shiftKey: true });
    expect(controller.shouldOpenModeMenuForActiveModeOnTab(modifiedTab)).toBe(
      false
    );
    expect(modifiedTab.defaultPrevented).toBe(false);

    parts.input.value = 'query';
    const queryTab = createTabEvent();
    expect(controller.shouldOpenModeMenuForActiveModeOnTab(queryTab)).toBe(
      true
    );
    expect(queryTab.defaultPrevented).toBe(true);
    expect(controller.openModeMenu('none')).toBe(true);
    expect(parts.input.value).toBe('query');
    expect(parts.modePrefix.dataset.modeId).toBe('provider:google');
    expect(
      controller.menuElement.querySelector('[role="menuitemradio"]')
        ?.getAttribute('aria-checked')
    ).toBe('true');
    controller.closeModeMenu(false);
    parts.input.value = '';

    const taggedTab = createTabEvent();
    expect(controller.shouldOpenModeMenuForActiveModeOnTab(taggedTab)).toBe(
      true
    );
    expect(taggedTab.defaultPrevented).toBe(true);
    expect(controller.openModeMenu('none')).toBe(true);
    expect(parts.modePrefix.dataset.modeId).toBe('provider:google');
    expect(
      controller.menuElement.querySelector('[role="menuitemradio"]')
        ?.getAttribute('aria-checked')
    ).toBe('true');

    const activeCheckWhileOpen = createTabEvent();
    expect(
      controller.shouldOpenModeMenuForActiveModeOnTab(activeCheckWhileOpen)
    ).toBe(
      false
    );
    expect(activeCheckWhileOpen.defaultPrevented).toBe(false);
    const containedOpenTab = createTabEvent();
    expect(controller.handleModeMenuTabFocusToggle(containedOpenTab)).toBe(true);
    expect(containedOpenTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(parts.input);
    const toggledBackTab = createTabEvent();
    expect(controller.handleModeMenuTabFocusToggle(toggledBackTab)).toBe(true);
    expect(toggledBackTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(controller.menuElement);
    const modifiedOpenTab = createTabEvent({ shiftKey: true });
    expect(controller.handleModeMenuTabFocusToggle(modifiedOpenTab)).toBe(false);
    expect(modifiedOpenTab.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(controller.menuElement);
    controller.destroy();
  });

  it('returns to a clean double-Tab gesture after the active tag is removed', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [{
          active: true,
          id: 'provider:google',
          kind: 'provider',
          label: 'Google'
        }]
      }
    );
    const createTabEvent = () => new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab'
    });

    controller.setPrefixText('Google', {}, { modeId: 'provider:google' });
    controller.openModeMenu('none');
    controller.clearProviderPrefix();

    expect(parts.modePrefix.hasAttribute('data-mode-id')).toBe(false);
    expect(controller.menuElement.hidden).toBe(true);

    const firstTab = createTabEvent();
    expect(controller.shouldOpenModeMenuForActiveModeOnTab(firstTab)).toBe(false);
    expect(controller.shouldOpenModeMenuOnDoubleTab(firstTab)).toBe(false);
    expect(firstTab.defaultPrevented).toBe(true);

    controller.setPrefixText('Open tabs', {}, {
      modeId: 'openTabs',
      preserveModeMenuDoubleTab: true
    });
    const secondTab = createTabEvent();
    expect(controller.shouldCompleteModeMenuDoubleTab(secondTab)).toBe(true);
    expect(secondTab.defaultPrevented).toBe(true);
    controller.destroy();
  });

  it('toggles Tab focus between the input and the open scope panel', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [{
          active: true,
          id: 'provider:site',
          kind: 'provider',
          label: 'Current site'
        }]
      }
    );

    expect(controller.openModeMenu('input')).toBe(true);
    expect(controller.menuElement.hidden).toBe(false);
    expect(document.activeElement).toBe(parts.input);
    expect(controller.menuElement.dataset.searchActive).toBe('false');
    const tabEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab'
    });
    expect(controller.handleModeMenuTabFocusToggle(tabEvent)).toBe(true);
    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(controller.menuElement);
    expect(controller.menuElement.dataset.searchActive).toBe('true');
    controller.menuElement.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab'
    }));
    expect(document.activeElement).toBe(parts.input);
    expect(controller.menuElement.dataset.searchActive).toBe('false');
    controller.destroy();
  });

  it('keeps a platform-aware shortcut hint fixed outside the scrollable menu grid', () => {
    const macParts = createModeParts();
    let localizedShortcutHint = '打开面板';
    let localizedFocusToggleHint = '切换聚焦';
    let localizedFilterHint = '点击面板，输入拼音或英文快速筛选';
    let localizedFilterQuery = '检索：{query}';
    const macController = LumnoSearchInputMode.createInputModeController(
      macParts,
      {
        formatMessage: (
          key: string,
          fallback: string,
          values?: Record<string, string>
        ) => {
          if (key === 'search_scope_menu_shortcut_hint') {
            return localizedShortcutHint;
          }
          if (key === 'search_scope_menu_navigation_hint') {
            return '移动';
          }
          if (key === 'search_scope_menu_select_hint') {
            return '切换';
          }
          if (key === 'search_scope_menu_focus_toggle_hint') {
            return localizedFocusToggleHint;
          }
          if (key === 'search_scope_menu_filter_hint') {
            return localizedFilterHint;
          }
          if (key === 'search_scope_menu_filter_query') {
            return localizedFilterQuery.replace(
              '{query}',
              String(values?.query || '')
            );
          }
          return fallback;
        },
        getModeMenuItems: () => [{
          id: 'provider:google',
          kind: 'provider',
          label: 'Google'
        }],
        navigatorLike: { platform: 'MacIntel' }
      }
    );
    macController.openModeMenu('none');
    const macContent = macController.menuElement.querySelector(
      '[data-search-input-mode-menu-content]'
    );
    const macFooter = macController.menuElement.querySelector(
      '[data-search-input-mode-menu-footer]'
    );
    expect(macContent?.parentElement).toBe(macController.menuElement);
    expect(macFooter?.parentElement).toBe(macController.menuElement);
    expect(macController.menuElement.lastElementChild).toBe(macFooter);
    expect(macContent?.querySelectorAll('[role="menuitemradio"]')).toHaveLength(1);
    expect(macFooter?.querySelector('[role="menuitemradio"]')).toBeNull();
    expect(
      macFooter?.querySelector('[data-search-input-mode-menu-footer-key]')
        ?.textContent
    ).toBe('⇥ ⇥');
    expect(
      macFooter?.querySelector('[data-search-input-mode-menu-footer-text]')
        ?.textContent
    ).toBe('打开面板');
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-navigation-key]'
      )?.textContent
    ).toBe('←↑↓→');
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-navigation-text]'
      )?.textContent
    ).toBe('移动');
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-select-key]'
      )?.textContent
    ).toBe('Enter');
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-select-text]'
      )?.textContent
    ).toBe('切换');
    const footerActions = macFooter?.querySelector(
      '[data-search-input-mode-menu-footer-actions]'
    );
    const selectHint = macFooter?.querySelector(
      '[data-search-input-mode-menu-footer-select-hint]'
    );
    expect(selectHint?.children).toHaveLength(2);
    expect(selectHint?.firstElementChild).toBe(
      macFooter?.querySelector('[data-search-input-mode-menu-footer-select-key]')
    );
    expect(Array.from(footerActions?.children || []).map((element) => (
      element.getAttribute('data-search-input-mode-menu-footer-navigation-hint') !== null
        ? 'navigation'
        : element.getAttribute('data-search-input-mode-menu-footer-select-hint') !== null
          ? 'select'
          : element.getAttribute('data-search-input-mode-menu-footer-input-hint') !== null
            ? 'input'
            : 'shortcut'
    ))).toEqual(['navigation', 'select', 'input', 'shortcut']);
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-input-key]'
      )?.textContent
    ).toBe('Tab');
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-input-text]'
      )?.textContent
    ).toBe('切换聚焦');
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-filter-text]'
      )?.textContent
    ).toBe('点击面板，输入拼音或英文快速筛选');
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-divider]'
      )
    ).toBeNull();
    expect(macFooter?.firstElementChild).toBe(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-filter-text]'
      )
    );
    expect(macFooter?.lastElementChild).toBe(
      footerActions
    );
    macController.menuElement.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'g'
    }));
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-filter-text]'
      )?.textContent
    ).toBe('检索：g');
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-filter-text] .x-lumno-search-input-mode__menu-match'
      )?.textContent
    ).toBe('g');
    macController.menuElement.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Backspace'
    }));
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-filter-text]'
      )?.textContent
    ).toBe('点击面板，输入拼音或英文快速筛选');
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-filter-text] .x-lumno-search-input-mode__menu-match'
      )
    ).toBeNull();
    localizedShortcutHint = '開啟面板';
    localizedFocusToggleHint = '切換聚焦';
    localizedFilterHint = '點按面板，輸入拼音或英文快速篩選';
    localizedFilterQuery = '搜尋：{query}';
    macController.refreshModeMenuLanguage();
    expect(
      macFooter?.querySelector('[data-search-input-mode-menu-footer-text]')
        ?.textContent
    ).toBe('開啟面板');
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-input-text]'
      )?.textContent
    ).toBe('切換聚焦');
    expect(
      macFooter?.querySelector(
        '[data-search-input-mode-menu-footer-filter-text]'
      )?.textContent
    ).toBe('點按面板，輸入拼音或英文快速篩選');
    macController.destroy();

    const windowsParts = createModeParts();
    const windowsController = LumnoSearchInputMode.createInputModeController(
      windowsParts,
      { navigatorLike: { platform: 'Win32' } }
    );
    expect(
      windowsController.menuElement.querySelector(
        '[data-search-input-mode-menu-footer-key]'
      )?.textContent
    ).toBe('Tab Tab');
    windowsController.destroy();
  });
});
