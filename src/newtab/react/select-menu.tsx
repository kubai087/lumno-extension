import { flushSync } from 'react-dom';
import { createViewHost } from '../dom/view-hosts';
import { SelectMenu, type SelectMenuConfig, type SelectMenuControls } from '../../shared/react/select-menu';
import { toCssLength, type SelectMenuOption } from '../../shared/react/select-menu/menu-options';
import { getPagePortals } from '../app/portals';
import { createEventBus } from '../../shared/state/events';
import { getSelectElement, getSelectMenuByOwner, getSelectTrigger, getUnclaimedSelectMenu } from '../dom/select-menus';

export interface SelectMenuControllerOptions {
  documentObj?: Document;
  getViewportTopInset?(wrapper: HTMLElement): number;
  onBeforeOpen?(): void;
  windowObj?: Window & typeof globalThis;
}

export interface SelectMenuInstance {
  menu: HTMLElement;
  select: HTMLSelectElement;
  trigger: HTMLButtonElement;
  wrapper: HTMLElement;
}

export function createSelectMenuController(
  options: SelectMenuControllerOptions = {}
) {
  const documentObj = options.documentObj || document;
  const windowObj = options.windowObj || window;
  const instances = new WeakMap<
    HTMLElement,
    {
      config: SelectMenuConfig;
      controls: SelectMenuControls;
    }
  >();
  // The hosts made and not destroyed, which isAnyOpen asks.
  const hosts = new Set<HTMLElement>();
  // `opening`: one of the menus is about to open.
  const events = createEventBus<{ opening: null }>();
  const announceOpening = () => {
    if (options.onBeforeOpen) {
      options.onBeforeOpen();
    }
    events.emit('opening', null);
  };

  const renderInstance = (host: HTMLElement) => {
    const instance = instances.get(host);
    if (!instance) {
      return;
    }
    getPagePortals().show(host, (
      <SelectMenu
        config={instance.config}
        documentObj={documentObj}
        getViewportTopInset={options.getViewportTopInset}
        host={host}
        onBeforeOpen={announceOpening}
        registerControls={(controls) => {
          instance.controls = controls;
        }}
        windowObj={windowObj}
      />
    ));
  };

  return Object.freeze({
    events,
    createSelect(config: SelectMenuConfig): SelectMenuInstance | null {
      const host = createViewHost(documentObj, 'div');
      host.id = config.id || '';
      host.className = [
        '_x_extension_select_wrap_2024_unique_',
        '_x_extension_custom_select_2024_unique_',
        '_x_extension_select_wrap_auto_2024_unique_',
        `_x_extension_select_align_${config.menuAlign || 'right'}_2024_unique_`,
        config.className || ''
      ]
        .filter(Boolean)
        .join(' ');
      host.dataset.iconOnly = config.iconOnly ? 'true' : 'false';
      host.dataset.menuAlign = config.menuAlign || 'right';
      host.dataset.menuAlignCurrent = config.menuAlign || 'right';
      host.dataset.menuMaxWidth = toCssLength(
        config.menuMaxWidth,
        'calc(100vw - 32px)'
      );
      host.dataset.menuMinWidth = toCssLength(config.menuMinWidth, '0');
      host.dataset.menuPortal = config.menuPortal === false ? '' : 'body';
      host.dataset.menuPortalOffset = String(config.menuPortalOffset || 6);
      host.dataset.menuPortalZIndex = String(config.menuPortalZIndex || 10000);
      host.dataset.menuTitle = config.menuTitle || '';
      host.dataset.menuWidth = config.menuWidth || 'auto';
      host.dataset.menuWidthCurrent = config.menuWidth || 'auto';
      host.dataset.open = 'false';
      host.dataset.reactIsland = 'newtab-select-menu';
      host.dataset.select = config.selectId || '';
      hosts.add(host);
      instances.set(host, {
        config: {
          ...config,
          options: [...(config.options || [])]
        },
        controls: {
          isOpen: () => false,
          setOpen() {},
          syncValue() {}
        }
      });
      renderInstance(host);
      const select = getSelectElement(host);
      const trigger = getSelectTrigger(host);
      const portalMenu = (config.id ? getSelectMenuByOwner(documentObj, config.id) : null) ||
        getUnclaimedSelectMenu(documentObj);
      if (!select || !trigger || !portalMenu) {
        getPagePortals().remove(host);
        return null;
      }
      portalMenu.dataset.reactSelectClaimed = 'true';
      if (config.id) {
        portalMenu.dataset.reactSelectOwner = config.id;
      }
      // Context menus are created lazily and can be opened synchronously in the
      // same pointer event. Commit the closed surface once so the browser does
      // not coalesce the first open state and skip its transition.
      void portalMenu.offsetWidth;
      return { menu: portalMenu, select, trigger, wrapper: host };
    },
    destroy(host: HTMLElement) {
      const instance = instances.get(host);
      if (!instance) {
        return;
      }
      getPagePortals().remove(host);
      instances.delete(host);
      hosts.delete(host);
    },
    isOpen(host: HTMLElement) {
      return instances.get(host)?.controls.isOpen() || false;
    },
    // Whether any menu this controller made is open.
    isAnyOpen() {
      return Array.from(hosts).some((host) => instances.get(host)?.controls.isOpen() || false);
    },
    setMenuTitle(host: HTMLElement, title: string) {
      const instance = instances.get(host);
      if (!instance) {
        return;
      }
      instance.config = { ...instance.config, menuTitle: title };
      host.dataset.menuTitle = title;
      renderInstance(host);
    },
    setOpen(host: HTMLElement, open: boolean) {
      const instance = instances.get(host);
      if (instance) {
        flushSync(() => instance.controls.setOpen(open));
      }
    },
    setOptions(
      host: HTMLElement,
      nextOptions: SelectMenuOption[],
      value?: string
    ) {
      const instance = instances.get(host);
      if (!instance) {
        return;
      }
      instance.config = {
        ...instance.config,
        options: [...(nextOptions || [])],
        value: value === undefined ? instance.config.value : String(value)
      };
      renderInstance(host);
    },
    sync(host: HTMLElement) {
      const instance = instances.get(host);
      const select = getSelectElement(host);
      if (instance && select) {
        flushSync(() => instance.controls.syncValue(select.value));
      }
    }
  });
}
