import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModeMenuItem } from '../search/input-mode/types';
import { queryHtmlElement, queryHtmlTag } from '../dom-lookup';
import { getElement, getTags } from '../../../tests/fakes/dom';
import { LumnoSearchInputMode, createModeParts, resetModeTest } from '../../../tests/fakes/search-input-mode';

afterEach(resetModeTest);

describe('Search scope menu: keys, pointer focus and filtering', () => {
  it('requires two distinct Backspace presses only while the scope menu is open', () => {
    vi.useFakeTimers();
    const parts = createModeParts();
    const onConfirmation = vi.fn();
    const onConfirmationReset = vi.fn();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [{
          active: true,
          id: 'provider:duckduckgo',
          kind: 'provider',
          label: 'DuckDuckGo'
        }],
        onModeTagRemovalConfirmation: onConfirmation,
        onModeTagRemovalConfirmationReset: onConfirmationReset
      }
    );
    controller.setPrefixText('DuckDuckGo', {}, {
      modeId: 'provider:duckduckgo'
    });

    expect(controller.shouldRemoveModeTagOnBackspace({ repeat: false })).toBe(
      true
    );
    expect(onConfirmation).not.toHaveBeenCalled();

    controller.openModeMenu('none');
    expect(controller.shouldRemoveModeTagOnBackspace({ repeat: false })).toBe(
      false
    );
    expect(onConfirmation).toHaveBeenCalledTimes(1);
    expect(onConfirmation).toHaveBeenLastCalledWith({ duration: 2200 });

    expect(controller.shouldRemoveModeTagOnBackspace({ repeat: true })).toBe(
      false
    );
    expect(onConfirmation).toHaveBeenCalledTimes(1);
    expect(controller.shouldRemoveModeTagOnBackspace({ repeat: false })).toBe(
      true
    );
    expect(onConfirmationReset).toHaveBeenCalledTimes(1);

    expect(controller.shouldRemoveModeTagOnBackspace({ repeat: false })).toBe(
      false
    );
    parts.input.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'a' })
    );
    expect(onConfirmationReset).toHaveBeenCalledTimes(2);
    expect(controller.shouldRemoveModeTagOnBackspace({ repeat: false })).toBe(
      false
    );
    parts.input.value = 'query';
    parts.input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onConfirmationReset).toHaveBeenCalledTimes(3);

    parts.input.value = '';
    expect(controller.shouldRemoveModeTagOnBackspace({ repeat: false })).toBe(
      false
    );
    vi.advanceTimersByTime(2200);
    expect(onConfirmationReset).toHaveBeenCalledTimes(4);
    expect(controller.shouldRemoveModeTagOnBackspace({ repeat: false })).toBe(
      false
    );
    controller.closeModeMenu();
    expect(onConfirmationReset).toHaveBeenCalledTimes(5);
    expect(controller.shouldRemoveModeTagOnBackspace({ repeat: false })).toBe(
      true
    );
    controller.destroy();
  });

  it('renders and clears the matched search provider Tab hint', () => {
    const parts = createModeParts('overlay');
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      { surface: 'overlay' }
    );

    controller.setTabHintVisible(true, { key: 'yt', name: 'YouTube' });

    expect(parts.modeTabHint.style.display).toBe('inline-flex');
    expect(parts.modeTabHintKey.textContent).toBe('Tab');
    expect(parts.modeTabHintText.textContent).toBe('使用 YouTube 搜索');
    expect(parts.modeTabHint.textContent).toBe('Tab使用 YouTube 搜索');
    expect(parts.modeTabHintKey.parentElement).toBe(parts.modeTabHint);
    expect(parts.modeTabHintText.parentElement).toBe(parts.modeTabHint);

    controller.setTabHintVisible(false);
    expect(parts.modeTabHint.style.display).toBe('none');
    controller.destroy();
  });

  it('returns New Tab pointer selection focus to the input', async () => {
    const parts = createModeParts();
    const items: ModeMenuItem[] = [
      {
        active: true,
        group: 'Search scope',
        iconName: 'ri-search-line',
        id: 'all',
        kind: 'all',
        label: 'Search everything'
      },
      {
        group: 'Browser content',
        iconName: 'ri-bookmark-3-line',
        id: 'local:bookmark',
        kind: 'local',
        label: 'Bookmarks'
      }
    ];
    const onModeMenuSelect = vi.fn((selectedItem: ModeMenuItem) => {
      items.forEach((item) => {
        item.active = item === selectedItem;
      });
    });
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        baseInputPaddingLeft: 44,
        getModeMenuItems: () => items,
        onModeMenuSelect
      }
    );

    controller.setPrefixText('Search everything', {}, {
      iconName: 'ri-search-line',
      modeId: 'all'
    });
    expect(controller.openModeMenu()).toBe(true);
    expect(parts.modePrefix.getAttribute('aria-expanded')).toBe('true');
    const menuItems = Array.from(
      getTags(controller.menuElement, '[role="menuitemradio"]', 'button')
    );
    expect(menuItems).toHaveLength(2);
    expect(menuItems[0].getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(menuItems[0]);
    const selectedIcon = menuItems[1].querySelector(
      '.x-lumno-search-input-mode__menu-icon'
    );

    menuItems[0].dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' })
    );
    expect(document.activeElement).toBe(menuItems[1]);
    menuItems[1].click();
    await Promise.resolve();

    expect(onModeMenuSelect).toHaveBeenCalledWith(items[1]);
    expect(controller.menuElement.hidden).toBe(false);
    expect(parts.modePrefix.getAttribute('aria-expanded')).toBe('true');
    const refreshedMenuItems = Array.from(
      getTags(controller.menuElement, '[role="menuitemradio"]', 'button')
    );
    expect(refreshedMenuItems[0].getAttribute('aria-checked')).toBe('false');
    expect(refreshedMenuItems[1].getAttribute('aria-checked')).toBe('true');
    expect(refreshedMenuItems[0]).toBe(menuItems[0]);
    expect(refreshedMenuItems[1]).toBe(menuItems[1]);
    expect(
      refreshedMenuItems[1].querySelector(
        '.x-lumno-search-input-mode__menu-icon'
      )
    ).toBe(selectedIcon);
    expect(document.activeElement).toBe(parts.input);
    expect(controller.menuElement.dataset.searchActive).toBe('false');
    controller.destroy();
  });

  it('moves across visual grid rows and keeps keyboard selection in the panel until Tab', () => {
    const parts = createModeParts();
    const items: ModeMenuItem[] = Array.from({ length: 6 }, (_, index) => ({
      active: index === 1,
      group: 'Search engines',
      id: `provider:${index}`,
      kind: 'provider',
      label: `Provider ${index + 1}`
    }));
    const onModeMenuSelect = vi.fn((selectedItem: ModeMenuItem) => {
      items.forEach((item) => {
        item.active = item === selectedItem;
      });
    });
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => items,
        onModeMenuSelect
      }
    );

    expect(controller.openModeMenu()).toBe(true);
    const buttons = Array.from(
      getTags(controller.menuElement, '[role="menuitemradio"]', 'button')
    );
    buttons.forEach((button, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      button.getBoundingClientRect = () => ({
        bottom: (row * 100) + 80,
        height: 80,
        left: column * 100,
        right: (column * 100) + 80,
        top: row * 100,
        width: 80,
        x: column * 100,
        y: row * 100,
        toJSON: () => ({})
      });
    });

    expect(document.activeElement).toBe(buttons[1]);
    buttons[1].dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowDown'
    }));
    expect(document.activeElement).toBe(buttons[4]);

    const enterEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter'
    });
    buttons[4].dispatchEvent(enterEvent);
    expect(enterEvent.defaultPrevented).toBe(true);
    expect(onModeMenuSelect).toHaveBeenCalledWith(items[4]);
    expect(buttons[4].getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(buttons[4]);

    const spaceEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: ' '
    });
    buttons[4].dispatchEvent(spaceEvent);
    expect(spaceEvent.defaultPrevented).toBe(true);
    expect(onModeMenuSelect).toHaveBeenLastCalledWith(items[4]);

    const tabEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab'
    });
    buttons[4].dispatchEvent(tabEvent);
    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(parts.input);
    expect(controller.menuElement.hidden).toBe(false);
    controller.destroy();
  });

  it('keeps group-title and edge-padding context visible while keyboard scrolling', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => Array.from({ length: 3 }, (_, index) => ({
          group: 'Search engines',
          id: `provider:${index}`,
          kind: 'provider',
          label: `Provider ${index + 1}`
        }))
      }
    );

    expect(controller.openModeMenu('none')).toBe(true);
    const menuContent = getElement(controller.menuElement, '[data-search-input-mode-menu-content]');
    const buttons = Array.from(
      getTags(controller.menuElement, '[role="menuitemradio"]', 'button')
    );
    menuContent.getBoundingClientRect = () => ({
      bottom: 400,
      height: 300,
      left: 0,
      right: 300,
      top: 100,
      width: 300,
      x: 0,
      y: 100,
      toJSON: () => ({})
    });
    const verticalRects = [
      { bottom: 190, top: 110 },
      { bottom: 290, top: 210 },
      { bottom: 390, top: 330 }
    ];
    buttons.forEach((button, index) => {
      const rect = verticalRects[index];
      button.getBoundingClientRect = () => ({
        bottom: rect.bottom,
        height: rect.bottom - rect.top,
        left: 0,
        right: 80,
        top: rect.top,
        width: 80,
        x: 0,
        y: rect.top,
        toJSON: () => ({})
      });
    });
    const smoothScrollTo = vi.fn((options: ScrollToOptions) => {
      menuContent.scrollTop = Number(options.top) || 0;
    });
    Object.defineProperty(menuContent, 'scrollTo', { configurable: true, value: smoothScrollTo });

    menuContent.scrollTop = 200;
    controller.menuElement.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowRight'
    }));
    expect(document.activeElement).toBe(buttons[0]);
    expect(menuContent.scrollTop).toBe(166);
    expect(smoothScrollTo).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      top: 166
    });

    menuContent.scrollTop = 100;
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'End'
    }));
    expect(document.activeElement).toBe(buttons[2]);
    expect(menuContent.scrollTop).toBe(106);
    expect(smoothScrollTo).toHaveBeenCalledTimes(1);
    controller.destroy();
  });

  it('keeps panel typing separate from the main input and filters English or pinyin matches', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [
          {
            group: 'Search engines',
            id: 'provider:google',
            kind: 'provider',
            label: 'Google'
          },
          {
            group: 'Site search',
            id: 'provider:douban',
            kind: 'provider',
            label: '豆瓣',
            provider: {
              aliases: ['douban'],
              key: 'dban',
              name: '豆瓣'
            }
          },
          {
            group: 'AI search',
            id: 'provider:doubao',
            kind: 'provider',
            label: '豆包',
            provider: {
              aliases: ['doubao'],
              key: 'dbai',
              name: '豆包'
            }
          },
          {
            group: 'Browser content',
            id: 'local:bookmark',
            kind: 'local',
            label: '书签',
            searchTerms: ['bookmark', 'bookmarks']
          }
        ]
      }
    );
    const pressMenuKey = (key: string) => {
      const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key
      });
      controller.menuElement.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      return event;
    };
    const getVisibleLabels = () => Array.from(
      getTags(controller.menuElement, '[role="menuitemradio"]', 'button')
    ).filter((button) => !button.hidden).map((button) => (
      button.querySelector('.x-lumno-search-input-mode__menu-label')?.textContent
    ));

    expect(controller.openModeMenu('none')).toBe(true);
    expect(document.activeElement).toBe(controller.menuElement);
    expect(controller.menuElement.dataset.searchActive).toBe('true');

    pressMenuKey('Tab');
    expect(document.activeElement).toBe(parts.input);
    expect(controller.menuElement.hidden).toBe(false);
    controller.menuElement.dispatchEvent(new Event('pointerdown', {
      bubbles: true,
      cancelable: true
    }));
    expect(document.activeElement).toBe(controller.menuElement);

    pressMenuKey('d');
    pressMenuKey('o');
    pressMenuKey('u');
    expect(controller.getModeMenuFilterQuery()).toBe('dou');
    expect(parts.input.value).toBe('');
    expect(getVisibleLabels()).toEqual(['豆瓣', '豆包']);
    const filteredItems = Array.from(
      getTags(controller.menuElement, '[role="menuitemradio"]', 'button')
    ).filter((button) => !button.hidden);
    expect(document.activeElement).toBe(filteredItems[0]);
    expect(
      controller.menuElement.querySelector(
        '.x-lumno-search-input-mode__menu-match'
      )?.textContent
    ).toBe('豆');

    pressMenuKey('ArrowDown');
    expect(document.activeElement).toBe(filteredItems[1]);
    pressMenuKey('Enter');
    const allMenuItems = Array.from(
      getTags(controller.menuElement, '[role="menuitemradio"]', 'button')
    );
    expect(allMenuItems[0].getAttribute('aria-checked')).toBe('false');
    expect(filteredItems[1].getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(filteredItems[1]);
    pressMenuKey('ArrowUp');
    expect(document.activeElement).toBe(filteredItems[0]);

    pressMenuKey('Tab');
    expect(document.activeElement).toBe(parts.input);
    expect(controller.getModeMenuFilterQuery()).toBe('dou');

    const filteredItem = filteredItems[0];
    filteredItem?.click();
    expect(document.activeElement).toBe(parts.input);
    expect(controller.menuElement.dataset.searchActive).toBe('false');
    expect(controller.menuElement.hidden).toBe(false);
    expect(controller.getModeMenuFilterQuery()).toBe('dou');
    const inputEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'x'
    });
    parts.input.dispatchEvent(inputEvent);
    expect(controller.shouldHandleModeMenuKeyEvent(inputEvent)).toBe(false);
    expect(controller.getModeMenuFilterQuery()).toBe('dou');

    controller.menuElement.dispatchEvent(new Event('pointerdown', {
      bubbles: true,
      cancelable: true
    }));
    expect(document.activeElement).toBe(controller.menuElement);
    expect(controller.menuElement.dataset.searchActive).toBe('true');

    pressMenuKey('Escape');
    expect(controller.menuElement.hidden).toBe(false);
    expect(controller.getModeMenuFilterQuery()).toBe('');
    'bookmark'.split('').forEach(pressMenuKey);
    expect(getVisibleLabels()).toEqual(['书签']);
    expect(
      controller.menuElement.querySelector(
        '.x-lumno-search-input-mode__menu-match'
      )?.textContent
    ).toBe('书签');

    pressMenuKey('Escape');
    'zzz'.split('').forEach(pressMenuKey);
    expect(getVisibleLabels()).toEqual([]);
    expect(document.activeElement).toBe(controller.menuElement);
    expect(
      queryHtmlElement(controller.menuElement, '.x-lumno-search-input-mode__menu-empty')?.hidden
    ).toBe(false);
    controller.destroy();
  });

  it('switches localized scope placeholders with the panel state', () => {
    const parts = createModeParts();
    parts.input.placeholder = 'Search or type a URL…';
    let language = 'zh-CN';
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        formatMessage: (key: string, fallback: string) => {
          if (key === 'search_scope_panel_placeholder') {
            return language === 'zh-CN'
              ? '搜索特定站点内容…'
              : 'Search specific site content…';
          }
          if (key === 'search_scope_active_placeholder') {
            return language === 'zh-CN'
              ? '搜索特定内容，复按 Tab 打开范围面板…'
              : 'Search within this scope; press Tab again to open the scope panel…';
          }
          return fallback;
        },
        getModeMenuItems: () => [{
          active: true,
          group: 'Search engines',
          id: 'provider:google',
          kind: 'provider',
          label: 'Google'
        }]
      }
    );

    controller.setPrefixText('Google', {}, { modeId: 'provider:google' });
    expect(parts.input.placeholder).toBe(
      '搜索特定内容，复按 Tab 打开范围面板…'
    );

    expect(controller.openModeMenu('none')).toBe(true);
    expect(parts.input.placeholder).toBe('搜索特定站点内容…');

    controller.setPrefixText('Bing', {}, { modeId: 'provider:bing' });
    expect(parts.input.placeholder).toBe('搜索特定站点内容…');

    language = 'en';
    controller.refreshModeMenuLanguage();
    expect(parts.input.placeholder).toBe('Search specific site content…');

    controller.closeModeMenu(false);
    expect(parts.input.placeholder).toBe(
      'Search within this scope; press Tab again to open the scope panel…'
    );

    controller.clearProviderPrefix();
    expect(parts.input.placeholder).toBe('Search or type a URL…');
    controller.destroy();
  });

  it('keeps built-in Chinese scopes searchable while the full pinyin runtime is still loading', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        pinyinApi: null,
        getModeMenuItems: () => [{
          group: 'Browser content',
          id: 'local:bookmark',
          kind: 'local',
          label: '书签'
        }]
      }
    );
    expect(controller.openModeMenu('none')).toBe(true);
    ['s', 'h', 'u'].forEach((key) => {
      controller.menuElement.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key
      }));
    });
    const item = queryHtmlTag(controller.menuElement, '[role="menuitemradio"]', 'button');
    expect(item?.hidden).toBe(false);
    expect(
      item?.querySelector('.x-lumno-search-input-mode__menu-match')?.textContent
    ).toBe('书');
    controller.destroy();
  });

  it('filters scope cards by mixed pinyin and initials from the start of the name', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [{
          group: 'Site search',
          id: 'provider:mixed',
          kind: 'provider',
          label: '豆包书签'
        }]
      }
    );
    expect(controller.openModeMenu('none')).toBe(true);
    const item = queryHtmlTag(controller.menuElement, '[role="menuitemradio"]', 'button');
    const typeFilter = (value: string) => {
      controller.menuElement.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Escape'
      }));
      value.split('').forEach((key) => {
        controller.menuElement.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key
        }));
      });
      return Array.from(
        item?.querySelectorAll('.x-lumno-search-input-mode__menu-match') || []
      ).map((mark) => mark.textContent);
    };

    expect(typeFilter('dbsq')).toEqual(['豆包书签']);
    expect(typeFilter('doubsq')).toEqual(['豆包书签']);
    expect(typeFilter('dbs')).toEqual(['豆包书']);
    expect(typeFilter('ouba')).toEqual([]);
    expect(item?.hidden).toBe(true);
    expect(typeFilter('sq')).toEqual([]);
    expect(item?.hidden).toBe(true);
    controller.destroy();
  });

  it('filters scope cards by letters typed on a Cyrillic keyboard layout', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [
          { group: 'Site search', id: 'provider:yandex', kind: 'provider', label: 'Яндекс' },
          { group: 'Site search', id: 'provider:google', kind: 'provider', label: 'Google' }
        ]
      }
    );
    expect(controller.openModeMenu('none')).toBe(true);
    ['я', 'н', 'д'].forEach((key) => {
      controller.menuElement.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key
      }));
    });
    const items = Array.from(getTags(controller.menuElement, '[role="menuitemradio"]', 'button'));
    expect(controller.getModeMenuFilterQuery()).toBe('янд');
    expect(items.map((item) => item.hidden)).toEqual([false, true]);
    expect(
      items[0].querySelector('.x-lumno-search-input-mode__menu-match')?.textContent
    ).toBe('Янд');
    controller.destroy();
  });

  it('finds a scope card from traditional characters', () => {
    const parts = createModeParts();
    const controller = LumnoSearchInputMode.createInputModeController(
      parts,
      {
        getModeMenuItems: () => [{
          group: 'Site search',
          id: 'provider:bank',
          kind: 'provider',
          label: '台湾银行'
        }]
      }
    );
    expect(controller.openModeMenu('none')).toBe(true);
    ['臺', '灣'].forEach((key) => {
      controller.menuElement.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key
      }));
    });
    const item = queryHtmlTag(controller.menuElement, '[role="menuitemradio"]', 'button');
    expect(item?.hidden).toBe(false);
    expect(
      item?.querySelector('.x-lumno-search-input-mode__menu-match')?.textContent
    ).toBe('台湾');
    controller.destroy();
  });
});
