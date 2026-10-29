// The bookmark section's header: the heading, which leads back to the root
// folder while a subfolder is open, the breadcrumb of open folders, the pager
// and the section's actions (the bookmark manager button and the display mode
// menu). In top bar mode the actions show in the top bar instead, drawn there
// from the same model.
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { RemixIcon } from '../../shared/react/remix-icon';
import { SelectMenu, type SelectMenuControls } from '../../shared/react/select-menu';
import type { SelectMenuOption } from '../../shared/react/select-menu/menu-options';
import { useStore } from '../../shared/react/use-store';
import type { Store } from '../../shared/state/store';

export interface BookmarkCrumb {
  id: string;
  title: string;
}

export interface BookmarkPagerButtonModel {
  label: string;
  enabled: boolean;
}

export interface BookmarkModeMenuModel {
  id: string;
  title: string;
  value: string;
  options: SelectMenuOption[];
  onChange(value: string): void;
  onAction(action: string): void;
}

export type BookmarkTooltipPlacement = 'top' | 'bottom';

export interface BookmarkHeaderModel {
  heading: string;
  rootFolderId: string;
  // The open folders below the root, the last one current; empty at the root.
  crumbs: readonly BookmarkCrumb[];
  previous: BookmarkPagerButtonModel;
  next: BookmarkPagerButtonModel;
  managerLabel: string;
  modeMenu: BookmarkModeMenuModel | null;
  actionsInTopbar: boolean;
  onNavigate(folderId: string): void;
  onPage(step: -1 | 1): void;
  onOpenManager(): void;
  showTooltip(target: HTMLElement, label: string, placement: BookmarkTooltipPlacement): void;
  hideTooltip(): void;
  onMenuBeforeOpen(): void;
  getMenuViewportTopInset(): number;
}

// The header's model as the section headers set it; null before the first.
export type BookmarkHeaderStore = Store<{ model: BookmarkHeaderModel | null }>;

export interface BookmarkHeaderElements {
  pager: HTMLDivElement;
  previousButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  titleWrap: HTMLDivElement;
}

// A header button with the page's own tooltip in place of a native title.
// An unavailable button stays hoverable, marked with aria-disabled.
function HeaderButton({
  browserOnly,
  buttonRef,
  children,
  enabled = true,
  label,
  model,
  onActivate,
  placement
}: {
  browserOnly?: string;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
  enabled?: boolean;
  label: string;
  model: BookmarkHeaderModel | null;
  onActivate(): void;
  placement: BookmarkTooltipPlacement;
}) {
  const fallbackRef = useRef<HTMLButtonElement | null>(null);
  const ownRef = buttonRef || fallbackRef;
  const show = (target: HTMLElement) => {
    if (model && label) model.showTooltip(target, label, placement);
  };
  const hide = () => model?.hideTooltip();
  // A button that turns unavailable while focused gives up focus and its tooltip.
  useLayoutEffect(() => {
    const button = ownRef.current;
    if (!enabled && button && button.ownerDocument.activeElement === button) {
      button.blur();
      model?.hideTooltip();
    }
  }, [enabled, model, ownRef]);
  return (
    <button
      aria-disabled={enabled ? 'false' : 'true'}
      aria-label={label || undefined}
      className="x-nt-bookmarks-pager-btn"
      data-browser-only={browserOnly}
      data-tooltip={label || undefined}
      onBlur={hide}
      onClick={() => {
        if (enabled) onActivate();
      }}
      onFocus={(event) => show(event.currentTarget)}
      onPointerEnter={(event) => show(event.currentTarget)}
      onPointerLeave={hide}
      ref={ownRef}
      tabIndex={enabled ? 0 : -1}
      type="button"
    >
      {children}
    </button>
  );
}

function ModeMenu({
  menu,
  model,
  placement
}: {
  menu: BookmarkModeMenuModel;
  model: BookmarkHeaderModel;
  placement: BookmarkTooltipPlacement;
}) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const controls = useRef<SelectMenuControls | null>(null);
  const showTooltip = (target: EventTarget) => {
    if (!(target instanceof Element) || controls.current?.isOpen()) {
      return;
    }
    const trigger = target.closest('button');
    if (trigger) model.showTooltip(trigger, menu.title, placement);
  };
  const documentObj = host ? host.ownerDocument : null;
  return (
    <div
      className="_x_extension_select_wrap_2024_unique_ _x_extension_custom_select_2024_unique_ _x_extension_select_wrap_auto_2024_unique_ _x_extension_select_align_left_2024_unique_ x-nt-section-mode-select"
      data-icon-only="true"
      data-menu-align="left"
      data-menu-width="content"
      id={menu.id}
      onBlur={() => model.hideTooltip()}
      onFocus={(event) => showTooltip(event.target)}
      onMouseEnter={(event) => showTooltip(event.target)}
      onMouseLeave={() => model.hideTooltip()}
      ref={setHost}
    >
      {host && documentObj ? (
        <SelectMenu
          config={{
            id: menu.id,
            selectId: `${menu.id}_select`,
            iconOnly: true,
            triggerIconName: 'ri-more-line',
            menuClassName: 'x-nt-section-mode-portal',
            menuAlign: 'left',
            menuWidth: 'content',
            menuMinWidth: 168,
            menuMaxWidth: 240,
            menuPortal: true,
            menuPortalZIndex: 10020,
            menuPortalOffset: 8,
            menuTitle: menu.title,
            value: menu.value,
            ariaLabel: menu.title,
            tooltip: menu.title,
            options: menu.options,
            onAction: (payload) => menu.onAction(payload.action),
            onValueChange: (value) => menu.onChange(value)
          }}
          documentObj={documentObj}
          getViewportTopInset={() => model.getMenuViewportTopInset()}
          host={host}
          onBeforeOpen={() => model.onMenuBeforeOpen()}
          registerControls={(next) => {
            controls.current = next;
          }}
          windowObj={documentObj.defaultView || window}
        />
      ) : null}
    </div>
  );
}

// The bookmark manager button and the display mode menu.
export function BookmarkHeaderActions({
  model,
  placement
}: {
  model: BookmarkHeaderModel;
  placement: BookmarkTooltipPlacement;
}) {
  return (
    <>
      {/* Firefox gives extensions no way to open its bookmarks Library. */}
      <HeaderButton
        browserOnly="chromium"
        label={model.managerLabel}
        model={model}
        onActivate={() => model.onOpenManager()}
        placement={placement}
      >
        <RemixIcon name="ri-bookmark-line" size={16} />
      </HeaderButton>
      {model.modeMenu ? <ModeMenu menu={model.modeMenu} model={model} placement={placement} /> : null}
    </>
  );
}

// The actions as the top bar shows them while it holds the bookmarks.
export function TopbarBookmarkActions({ store }: { store: BookmarkHeaderStore }) {
  const { model } = useStore(store);
  return model && model.actionsInTopbar ? <BookmarkHeaderActions model={model} placement="bottom" /> : null;
}

function Heading({ model }: { model: BookmarkHeaderModel | null }) {
  const heading = model ? model.heading : '';
  const nested = Boolean(model && model.crumbs.length > 0);
  const goToRoot = () => {
    if (model && nested) model.onNavigate(model.rootFolderId);
  };
  return (
    <div
      aria-label={nested ? heading : undefined}
      className={nested ? 'x-nt-bookmarks-heading x-nt-bookmarks-heading--link' : 'x-nt-bookmarks-heading'}
      data-bookmark-drop-folder-id={model ? model.rootFolderId || '1' : undefined}
      data-bookmark-drop-folder-title={model ? heading : undefined}
      onClick={nested ? goToRoot : undefined}
      onKeyDown={nested
        ? (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            goToRoot();
          }
        : undefined}
      role={nested ? 'button' : undefined}
      tabIndex={nested ? 0 : undefined}
      title={nested ? heading : undefined}
    >
      {heading}
    </div>
  );
}

function Breadcrumb({ model }: { model: BookmarkHeaderModel | null }) {
  const crumbs = model ? model.crumbs : [];
  return (
    <div className="x-nt-bookmarks-breadcrumb" style={{ display: crumbs.length > 0 ? 'inline-flex' : 'none' }}>
      {crumbs.map((crumb, index) => {
        const current = index === crumbs.length - 1;
        return (
          <span className="x-nt-bookmarks-crumb-item" key={`${crumb.id}:${index}`}>
            <span aria-hidden="true" className="x-nt-bookmarks-crumb-sep">/</span>
            <button
              aria-current={current ? 'page' : undefined}
              aria-label={crumb.title}
              className="x-nt-bookmarks-crumb"
              data-bookmark-drop-folder-id={crumb.id}
              data-bookmark-drop-folder-title={crumb.title}
              disabled={current}
              onClick={() => {
                if (!current && crumb.id && model) model.onNavigate(crumb.id);
              }}
              title={crumb.title}
              type="button"
            >
              {crumb.title}
            </button>
          </span>
        );
      })}
    </div>
  );
}

export function BookmarkHeader({
  register,
  store
}: {
  register(elements: BookmarkHeaderElements): void;
  store: BookmarkHeaderStore;
}) {
  const { model } = useStore(store);
  const pagerRef = useRef<HTMLDivElement>(null);
  const previousButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const titleWrapRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (pagerRef.current && previousButtonRef.current && nextButtonRef.current && titleWrapRef.current) {
      register({
        pager: pagerRef.current,
        previousButton: previousButtonRef.current,
        nextButton: nextButtonRef.current,
        titleWrap: titleWrapRef.current
      });
    }
  }, [register]);
  return (
    <>
      <div className="x-nt-bookmarks-title-wrap" ref={titleWrapRef}>
        <Heading model={model} />
        <Breadcrumb model={model} />
      </div>
      <div className="x-nt-bookmarks-pager" ref={pagerRef}>
        <HeaderButton
          buttonRef={previousButtonRef}
          enabled={model ? model.previous.enabled : false}
          label={model ? model.previous.label : ''}
          model={model}
          onActivate={() => model?.onPage(-1)}
          placement="top"
        >
          <RemixIcon name="ri-arrow-left-s-line" size={16} />
        </HeaderButton>
        <HeaderButton
          buttonRef={nextButtonRef}
          enabled={model ? model.next.enabled : false}
          label={model ? model.next.label : ''}
          model={model}
          onActivate={() => model?.onPage(1)}
          placement="top"
        >
          <RemixIcon name="ri-arrow-right-s-line" size={16} />
        </HeaderButton>
        {model && !model.actionsInTopbar ? <BookmarkHeaderActions model={model} placement="top" /> : null}
      </div>
    </>
  );
}
