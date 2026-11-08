// Shared custom select: New Tab menus and Options settings render the same
// trigger, listbox/menu semantics, keyboard model and viewport placement.
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, Dispatch, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { queryHtmlElement } from '../../dom-lookup';
import { RemixIcon } from '../remix-icon';
import type { RemixIconName } from '../../ui/remix-icon';
import { followViewport, useMenuPositioner, useOutsideDismiss } from './hooks';
import { SelectOptionRow } from './option-row';
import { filterOptions, findNextEnabledOptionIndex, isValueOption, toCssLength } from './menu-options';
import type { SelectMenuOption } from './menu-options';

export interface SelectMenuConfig {
  ariaLabel?: string;
  /**
   * Id of a visible label. The trigger is then named by that label plus the
   * current value, instead of `ariaLabel`. Requires `id`.
   */
  ariaLabelledBy?: string;
  disabled?: boolean;
  /** Shown in place of the options when a search filters out every one. */
  emptyLabel?: string;
  className?: string;
  iconOnly?: boolean;
  id?: string;
  menuAlign?: 'left' | 'middle' | 'right';
  menuClassName?: string;
  menuMaxWidth?: number | string;
  menuMinWidth?: number | string;
  menuPortal?: boolean;
  menuPortalContainer?: HTMLElement;
  menuPortalOffset?: number;
  menuPortalZIndex?: number;
  menuTitle?: string;
  menuWidth?: 'auto' | 'content' | 'trigger';
  onAction?(payload: { action: string; option: SelectMenuOption }): void;
  onCheckedChange?(value: string, checked: boolean): void;
  /** The open menu is closing, by the owner's call or on its own (Escape, a press or focus outside). */
  onClose?(): void;
  onValueChange?(value: string): boolean | void;
  options?: SelectMenuOption[];
  /**
   * Long option lists (installed fonts) get a filter field at the top of the
   * menu. Keyboard navigation then applies to the filtered options.
   */
  searchable?: boolean;
  /** The page's own text field class, so the filter looks like its other inputs. */
  searchInputClassName?: string;
  searchPlaceholder?: string;
  selectId?: string;
  tooltip?: string;
  triggerIconName?: RemixIconName;
  /** Trigger text in place of the chosen option's label, for menus of checkbox options. */
  triggerLabel?: string;
  value?: string;
}

export interface SelectMenuControls {
  isOpen(): boolean;
  setOpen(open: boolean): void;
  syncValue(value: string): void;
}

interface SelectMenuProps {
  config: SelectMenuConfig;
  documentObj: Document;
  getViewportTopInset?(wrapper: HTMLElement): number;
  host: HTMLElement;
  onBeforeOpen?(): void;
  registerControls?(controls: SelectMenuControls): void;
  windowObj: Window & typeof globalThis;
}

// The ids that tie the trigger, the filter, the menu and its rows together.
interface MenuIds {
  menu: string | undefined;
  // The listbox: the menu itself, or the list under a searchable menu's field.
  listbox: string | undefined;
  value: string | undefined;
  option(index: number): string | undefined;
}

// One empty list for a menu without options, so effects that depend on the
// options do not see a new list on each render.
const NO_OPTIONS: SelectMenuOption[] = [];

function isComposing(event: ReactKeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229;
}

function readMenuIds(config: SelectMenuConfig, searchable: boolean): MenuIds {
  const id = config.id;
  const menu = id ? `${id}_menu` : undefined;
  return {
    menu,
    // A searchable menu is a combobox: the filter field keeps focus and points
    // at the active option, and only the options sit in the listbox.
    listbox: searchable && id ? `${id}_listbox` : menu,
    value: config.ariaLabelledBy && id ? `${id}_value` : undefined,
    option: (index) => (id ? `${id}_option_${index}` : undefined)
  };
}

function readMenuStyle(config: SelectMenuConfig): CSSProperties {
  const transformOrigin = config.menuAlign === 'right' ? 'top right' : config.menuAlign === 'left' ? 'top left' : 'top center';
  return {
    '--x-extension-menu-surface-max-width': toCssLength(config.menuMaxWidth, 'calc(100vw - 32px)'),
    '--x-extension-menu-surface-min-width': toCssLength(config.menuMinWidth, '0'),
    transformOrigin,
    left: 0,
    right: 'auto',
    // Body portals are fixed once opened; start fixed so a closed menu never
    // stretches a scrolling page (mobile new tab flows in the document).
    ...(config.menuPortal !== false && !config.menuPortalContainer ? { position: 'fixed' } : null)
  };
}

// The filter at the top of a searchable menu. While an IME composes, Enter
// commits the pinyin and the arrows move through its candidates; none of
// them belong to the menu.
function SelectMenuSearch({ config, ids, open, filter, activeOptionId, onFilterChange, onStep, onChooseActive, onLeave, inputRef }: {
  config: SelectMenuConfig;
  ids: MenuIds;
  open: boolean;
  filter: string;
  activeOptionId: string | undefined;
  onFilterChange(filter: string): void;
  onStep(delta: number): void;
  onChooseActive(): void;
  onLeave(): void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (isComposing(event)) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      onStep(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onChooseActive();
    } else if (event.key === 'Tab') {
      // Focus leaves with Tab, so the menu should not stay open behind it.
      onLeave();
    }
  };
  return (
    // The field sits above the scrolling listbox, so the list's scrollbar
    // never runs past it; it is the first thing focused when the menu opens.
    <div className="_x_extension_select_search_2026_unique_">
      <input
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        aria-controls={ids.listbox}
        aria-expanded={open}
        aria-label={config.searchPlaceholder}
        className={`_x_extension_select_search_input_2026_unique_${config.searchInputClassName ? ` ${config.searchInputClassName}` : ''}`}
        onChange={(event) => onFilterChange(event.currentTarget.value)}
        onKeyDown={onKeyDown}
        placeholder={config.searchPlaceholder}
        ref={inputRef}
        role="combobox"
        spellCheck={false}
        type="text"
        value={filter}
      />
      <RemixIcon className="_x_extension_select_search_icon_2026_unique_" name="ri-search-line" size={16} />
    </div>
  );
}

// The hidden native select that carries the value for forms and tests.
function NativeSelect({ config, options, value, selectRef, onChange }: {
  config: SelectMenuConfig;
  options: SelectMenuOption[];
  value: string;
  selectRef: RefObject<HTMLSelectElement | null>;
  onChange(value: string): void;
}) {
  return (
    <select
      aria-hidden="true"
      className="_x_extension_select_2024_unique_"
      id={config.selectId}
      disabled={config.disabled}
      ref={selectRef}
      tabIndex={-1}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {options.filter(isValueOption).map((option) => (
        <option disabled={option.disabled} key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// The trigger's keys: Home and End jump while open; the arrows, Enter and
// Space open the menu, then step through it or choose.
function handleTriggerKey(event: ReactKeyboardEvent, open: boolean, visibleOptions: SelectMenuOption[],
  setActiveIndex: Dispatch<SetStateAction<number>>, setOpen: (open: boolean) => void, chooseActive: () => void): void {
  const key = event.key;
  if (open && (key === 'Home' || key === 'End')) {
    event.preventDefault();
    setActiveIndex(key === 'Home'
      ? findNextEnabledOptionIndex(visibleOptions, -1, 1)
      : findNextEnabledOptionIndex(visibleOptions, 0, -1));
    return;
  }
  if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Enter' && key !== ' ') {
    return;
  }
  event.preventDefault();
  if (!open) {
    setOpen(true);
  } else if (key === 'ArrowDown' || key === 'ArrowUp') {
    if (visibleOptions.length) {
      setActiveIndex((current) => findNextEnabledOptionIndex(visibleOptions, current, key === 'ArrowDown' ? 1 : -1));
    }
  } else {
    chooseActive();
  }
}

function MenuSurface({ config, ids, open, searchable, usesMenuSemantics, menuRef, empty, children, search }: {
  config: SelectMenuConfig;
  ids: MenuIds;
  open: boolean;
  searchable: boolean;
  usesMenuSemantics: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  empty: boolean;
  children: ReactNode;
  search: ReactNode;
}) {
  return (
    <div
      aria-hidden={!open}
      id={ids.menu}
      className={`_x_extension_select_menu_2024_unique_ _x_extension_menu_surface_2024_unique_${config.menuClassName ? ` ${config.menuClassName}` : ''}`}
      data-react-select-owner={config.id || undefined}
      data-menu-portal-active={config.menuPortal ? 'true' : undefined}
      data-menu-surface-width={config.menuWidth === 'content' ? 'content' : undefined}
      data-open={open ? 'true' : 'false'}
      data-searchable={searchable ? 'true' : undefined}
      ref={menuRef}
      role={searchable ? undefined : usesMenuSemantics ? 'menu' : 'listbox'}
      style={readMenuStyle(config)}
    >
      {search}
      {searchable && empty && config.emptyLabel ? (
        <div className="_x_extension_select_empty_2026_unique_" role="presentation">
          {config.emptyLabel}
        </div>
      ) : null}
      {config.menuTitle ? (
        <div className="_x_extension_select_menu_title_2024_unique_" role="presentation">
          {config.menuTitle}
        </div>
      ) : null}
      {searchable ? (
        <div className="_x_extension_select_listbox_2026_unique_" id={ids.listbox} role="listbox">
          {children}
        </div>
      ) : children}
    </div>
  );
}

function readPlacementSettings(config: SelectMenuConfig, searchable: boolean, win: Window, doc: Document) {
  return {
    win,
    doc,
    absolute: Boolean(config.menuPortalContainer) || config.menuPortal === false,
    matchTriggerWidth: config.menuWidth === 'trigger',
    align: config.menuAlign || 'right',
    offset: Number.isFinite(Number(config.menuPortalOffset)) ? Number(config.menuPortalOffset) : 6,
    zIndex: config.menuPortalZIndex || 10000,
    searchable
  };
}

// What choosing an option does: run its action, toggle its checkbox, or
// pick its value (which the page may refuse) and close.
interface OptionChoice {
  config: SelectMenuConfig;
  setOpen(open: boolean): void;
  setSelectedValue(value: string): void;
  selectRef: RefObject<HTMLSelectElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

function chooseSelectOption(option: SelectMenuOption, choice: OptionChoice): void {
  const { config, setOpen, triggerRef } = choice;
  if (option.disabled) {
    return;
  }
  if (option.action) {
    config.onAction?.({ action: option.action, option });
    setOpen(false);
    return;
  }
  if (option.checkbox) {
    config.onCheckedChange?.(option.value, option.checked !== true);
    return;
  }
  if (config.onValueChange?.(option.value) !== false) {
    choice.setSelectedValue(option.value);
    const select = choice.selectRef.current;
    if (select) {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  setOpen(false);
  triggerRef.current?.focus();
}

function SelectTrigger({ config, ids, open, activeOptionId, usesMenuSemantics, selectedOption, triggerRef, onToggle, onKeyDown }: {
  config: SelectMenuConfig;
  ids: MenuIds;
  open: boolean;
  activeOptionId: string | undefined;
  usesMenuSemantics: boolean;
  selectedOption: SelectMenuOption | undefined;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onToggle(): void;
  onKeyDown(event: ReactKeyboardEvent): void;
}) {
  return (
    <button
      aria-activedescendant={activeOptionId}
      aria-controls={ids.listbox}
      aria-expanded={open}
      aria-haspopup={usesMenuSemantics ? 'menu' : 'listbox'}
      aria-label={ids.value ? undefined : config.ariaLabel}
      aria-labelledby={ids.value ? `${config.ariaLabelledBy} ${ids.value}` : undefined}
      className="_x_extension_select_trigger_2024_unique_"
      disabled={config.disabled}
      data-tooltip={config.tooltip}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={onKeyDown}
      ref={triggerRef}
      type="button"
    >
      {selectedOption?.iconUrl ? (
        <img alt="" aria-hidden="true" className="_x_extension_select_value_icon_2026_unique_" src={selectedOption.iconUrl} />
      ) : null}
      <span aria-hidden={ids.value ? undefined : 'true'} className="_x_extension_select_label_2024_unique_" id={ids.value}>
        {config.triggerLabel ?? (selectedOption?.label || '')}
      </span>
      <RemixIcon className="_x_extension_select_icon_2024_unique_" name={config.triggerIconName || 'ri-arrow-down-s-line'} size={16} />
    </button>
  );
}

// Keeps the active row in view as the keys move it.
function useActiveOptionInView(open: boolean, activeIndex: number, menuRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    if (!open || activeIndex < 0) {
      return;
    }
    const activeOption = menuRef.current ? queryHtmlElement(menuRef.current, '._x_extension_select_option_2024_unique_[data-active="true"]') : null;
    activeOption?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, menuRef, open]);
}

// The menu's state: open or not, the chosen value, the active row and the
// filter, with the controls the page drives it by.
function useSelectMenuState(config: SelectMenuConfig, searchable: boolean, onBeforeOpen: (() => void) | undefined,
  registerControls: ((controls: SelectMenuControls) => void) | undefined) {
  const options = Array.isArray(config.options) ? config.options : NO_OPTIONS;
  const [open, setOpenState] = useState(false);
  const [selectedValue, setSelectedValue] = useState(String(config.value ?? ''));
  const [activeIndex, setActiveIndex] = useState(0);
  const [filter, setFilter] = useState('');
  const openRef = useRef(false);
  const visibleOptions = searchable ? filterOptions(options, filter) : options;
  // The open effect reads the list through this ref: it runs when the menu
  // opens or its options change, not on every keystroke in the filter.
  const visibleOptionsRef = useRef(visibleOptions);
  useLayoutEffect(() => {
    visibleOptionsRef.current = visibleOptions;
  });

  useEffect(() => {
    setSelectedValue(String(config.value ?? ''));
  }, [config.value]);

  const { onClose } = config;
  const setOpen = useCallback((nextOpen: boolean) => {
    if (nextOpen && config.disabled) return;
    if (nextOpen && !openRef.current) {
      onBeforeOpen?.();
    }
    if (!nextOpen && openRef.current) {
      onClose?.();
    }
    setOpenState(nextOpen);
  }, [config.disabled, onBeforeOpen, onClose]);

  useLayoutEffect(() => {
    registerControls?.({
      isOpen: () => openRef.current,
      setOpen,
      syncValue(value) {
        setSelectedValue(String(value ?? ''));
      }
    });
  }, [registerControls, setOpen]);

  return {
    options, open, setOpen, openRef, selectedValue, setSelectedValue, activeIndex, setActiveIndex,
    filter, setFilter, visibleOptions, visibleOptionsRef
  };
}

type SelectMenuState = ReturnType<typeof useSelectMenuState>;

// On opening: the filter clears, the chosen row becomes active, the menu is
// measured and placed, and it follows the viewport while open.
function useMenuOpening({ state, host, searchable, position, remeasure, windowObj, filterRef, triggerRef, menuRef, portalContainer }: {
  state: Pick<SelectMenuState, 'open' | 'openRef' | 'selectedValue' | 'setActiveIndex' | 'setFilter' | 'visibleOptionsRef' | 'options'>;
  host: HTMLElement;
  searchable: boolean;
  position(): void;
  remeasure(): void;
  windowObj: Window & typeof globalThis;
  filterRef: RefObject<HTMLInputElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  portalContainer: HTMLElement | undefined;
}): void {
  const { open, openRef, selectedValue, setActiveIndex, setFilter, visibleOptionsRef, options } = state;
  useLayoutEffect(() => {
    openRef.current = open;
    host.dataset.open = open ? 'true' : 'false';
    if (!open) {
      // A reopened menu starts from the whole list again.
      setFilter('');
      return undefined;
    }
    remeasure();
    setActiveIndex(visibleOptionsRef.current.findIndex(
      (option) => isValueOption(option) && option.value === selectedValue && !option.disabled
    ));
    position();
    if (searchable) {
      filterRef.current?.focus();
    }
    return followViewport(windowObj, [triggerRef.current, menuRef.current, portalContainer], position);
  }, [filterRef, host, menuRef, open, openRef, options, portalContainer, position, remeasure, searchable, selectedValue,
    setActiveIndex, setFilter, triggerRef, visibleOptionsRef, windowObj]);
}

export function SelectMenu({ config, documentObj, getViewportTopInset, host, onBeforeOpen, registerControls, windowObj }: SelectMenuProps) {
  const searchable = config.searchable === true;
  const {
    options, open, setOpen, openRef, selectedValue, setSelectedValue, activeIndex, setActiveIndex,
    filter, setFilter, visibleOptions, visibleOptionsRef
  } = useSelectMenuState(config, searchable, onBeforeOpen, registerControls);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  const { position, remeasure } = useMenuPositioner({
    settings: readPlacementSettings(config, searchable, windowObj, documentObj),
    host,
    openRef,
    triggerRef,
    menuRef,
    getViewportTopInset
  });

  useMenuOpening({
    state: { open, openRef, selectedValue, setActiveIndex, setFilter, visibleOptionsRef, options },
    host, searchable, position, remeasure, windowObj, filterRef, triggerRef, menuRef,
    portalContainer: config.menuPortalContainer
  });
  useActiveOptionInView(open, activeIndex, menuRef);
  useOutsideDismiss(open, documentObj, host, menuRef, triggerRef, setOpen);

  const choice: OptionChoice = { config, setOpen, setSelectedValue, selectRef, triggerRef };
  const chooseOption = (option: SelectMenuOption) => chooseSelectOption(option, choice);
  const chooseActive = () => {
    if (visibleOptions[activeIndex]) {
      chooseOption(visibleOptions[activeIndex]);
    }
  };

  const usesMenuSemantics = options.some((option) => Boolean(option.action || option.radio || option.checkbox));
  const ids = readMenuIds(config, searchable);
  const activeOptionId = open && activeIndex >= 0 && visibleOptions[activeIndex] ? ids.option(activeIndex) : undefined;
  const search = searchable ? (
    <SelectMenuSearch
      activeOptionId={activeOptionId}
      config={config}
      filter={filter}
      ids={ids}
      inputRef={filterRef}
      onChooseActive={chooseActive}
      onFilterChange={(nextFilter) => {
        setFilter(nextFilter);
        setActiveIndex(findNextEnabledOptionIndex(filterOptions(options, nextFilter), -1, 1));
      }}
      onLeave={() => setOpen(false)}
      onStep={(delta) => setActiveIndex((current) => findNextEnabledOptionIndex(visibleOptions, current, delta))}
      open={open}
    />
  ) : null;
  const menu = (
    <MenuSurface
      config={config}
      empty={!visibleOptions.length}
      ids={ids}
      menuRef={menuRef}
      open={open}
      search={search}
      searchable={searchable}
      usesMenuSemantics={usesMenuSemantics}
    >
      {visibleOptions.map((option, index) => (
        <SelectOptionRow
          active={open && activeIndex === index}
          id={ids.option(index)}
          index={index}
          key={`${option.action || option.value}:${index}`}
          onActiveChange={setActiveIndex}
          onChoose={chooseOption}
          option={option}
          selectedValue={selectedValue}
          usesMenuSemantics={usesMenuSemantics}
        />
      ))}
    </MenuSurface>
  );

  return (
    <Fragment>
      <NativeSelect config={config} onChange={setSelectedValue} options={options} selectRef={selectRef} value={selectedValue} />
      <SelectTrigger
        activeOptionId={activeOptionId}
        config={config}
        ids={ids}
        onKeyDown={(event) => handleTriggerKey(event, openRef.current, visibleOptions, setActiveIndex, setOpen, chooseActive)}
        onToggle={() => setOpen(!openRef.current)}
        open={open}
        selectedOption={options.find((option) => isValueOption(option) && option.value === selectedValue) || options.find(isValueOption)}
        triggerRef={triggerRef}
        usesMenuSemantics={usesMenuSemantics}
      />
      {config.menuPortal !== false ? createPortal(menu, config.menuPortalContainer || documentObj.body) : menu}
    </Fragment>
  );
}
