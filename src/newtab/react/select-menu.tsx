import { flushSync } from 'react-dom';
import { SelectMenu, type SelectMenuConfig, type SelectMenuControls } from '../../shared/react/select-menu';
import { toCssLength, type SelectMenuOption } from '../../shared/react/select-menu/menu-options';
import { queryHtmlElement, queryHtmlElements, queryHtmlTag } from '../../shared/dom-lookup';
import { getPagePortals } from '../app/portals';

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
        onBeforeOpen={options.onBeforeOpen}
        registerControls={(controls) => {
          instance.controls = controls;
        }}
        windowObj={windowObj}
      />

    ));
  };

  return Object.freeze({
    createSelect(config: SelectMenuConfig): SelectMenuInstance | null {
      const host = documentObj.createElement('div');
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
      const select = host.querySelector('select');
      const trigger = host.querySelector('button');
      const menu = config.id
        ? queryHtmlElement(documentObj, `[data-react-select-owner="${config.id}"]`)
        : null;
      const portalMenu =
        menu ||
        Array.from(
          queryHtmlElements(documentObj, 'body > ._x_extension_select_menu_2024_unique_')
        ).find((candidate) => !candidate.dataset.reactSelectClaimed);
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
    },
    isOpen(host: HTMLElement) {
      return instances.get(host)?.controls.isOpen() || false;
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
      const select = queryHtmlTag(host, 'select', 'select');
      if (instance && select) {
        flushSync(() => instance.controls.syncValue(select.value));
      }
    }
  });
}
