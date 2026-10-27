import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { SettingDivider, SettingSwitch, SettingTitle, type SettingRowUnsupported } from './setting-rows';
import { SegmentedControl, type SegmentedControlRenderModel } from './segmented-control';
import { SettingSelect, type SelectControlRenderModel } from './select-control';
import { RangeSliderControl, type RangeSliderControlRenderModel } from './range-slider-control';
import { CheckboxGroup, type CheckboxGroupRenderModel } from './checkbox-group';
import type { ToggleControlRenderModel } from './toggle-control';
import { RemixIcon } from '../../shared/react/remix-icon';

// How a row sits in its section.
export interface SettingsRowLook {
  // Rows are compact unless set to false.
  compact?: boolean;
  // Indented under the row above it.
  subrow?: boolean;
  // A label row that heads the sub-rows after it.
  group?: boolean;
  className?: string;
}

export interface SettingsTitleModel {
  text: string;
  // Names a select's trigger together with its value.
  id?: string;
  badge?: string;
  info?: string;
}

// A link beside a row's switch, such as a guide for the setting.
export interface SettingsLinkModel {
  id: string;
  href: string;
  label: string;
  bound: boolean;
  // The browser family it is shown on, as data-browser-only names it.
  browserOnly?: string;
}

export type SettingsRowModel =
  | { type: 'header'; key: string; title: string }
  | { type: 'divider'; key: string }
  | (SettingsRowLook & {
    type: 'toggle';
    key: string;
    rowId?: string;
    title: SettingsTitleModel;
    description?: string;
    disabled?: boolean;
    // Out of the layout while the setting does not apply.
    hidden?: boolean;
    unsupported?: SettingRowUnsupported | null;
    toggle: ToggleControlRenderModel;
    link?: SettingsLinkModel | null;
  })
  | (SettingsRowLook & {
    type: 'select';
    key: string;
    rowId?: string;
    title: SettingsTitleModel;
    description?: string;
    disabled?: boolean;
    select: SelectControlRenderModel;
    searchable?: boolean;
  })
  | (SettingsRowLook & {
    type: 'segmented';
    key: string;
    rowId?: string;
    title: SettingsTitleModel;
    description?: string;
    // The option group's own id and accessible name.
    groupId: string;
    ariaLabel: string;
    groupClassName?: string;
    segmented: SegmentedControlRenderModel;
  })
  | (SettingsRowLook & {
    type: 'slider';
    key: string;
    rowId?: string;
    title: SettingsTitleModel;
    disabled?: boolean;
    // The slider's frame, which the page's styles size.
    hostId: string;
    slider: RangeSliderControlRenderModel;
  })
  | (SettingsRowLook & {
    type: 'checkbox-group';
    key: string;
    rowId?: string;
    title: SettingsTitleModel;
    description?: string;
    groupId: string;
    ariaLabel: string;
    checkboxes: CheckboxGroupRenderModel;
    // Puts the choices back as they were; hidden while they already are.
    reset?: { id: string; label: string; hidden: boolean } | null;
  })
  | (SettingsRowLook & { type: 'label'; key: string; title: SettingsTitleModel })
  | { type: 'reveal'; key: string; id: string; expanded: boolean; rows: SettingsRowModel[] }
  // Drawn by the view that holds the rows.
  | { type: 'slot'; key: string };

export interface SettingsRowsHandlers {
  onToggle(key: string, checked: boolean): void;
  onSelect(key: string, value: string): void;
  // Segmented options report through onSelect too.
  onSlide?(key: string, value: number): void;
  onCheck?(key: string, values: string[]): void;
  onMove?(key: string, fromIndex: number, toIndex: number): void;
  onReset?(key: string): void;
  // Lets the page drag a checkbox group's items; returns the detach.
  attachDrag?(key: string, host: HTMLElement | null): () => void;
  // Viewport space covered by sticky page chrome, so menus never open beneath it.
  getViewportTopInset?(): number;
  renderSlot?(key: string): ReactNode;
}

function getRowClassName(look: SettingsRowLook): string {
  return [
    '_x_extension_setting_row_2024_unique_',
    look.compact === false ? '' : '_x_extension_setting_row_compact_2024_unique_',
    look.group ? '_x_extension_setting_group_row_2026_unique_' : '',
    look.subrow ? '_x_extension_setting_subrow_2026_unique_' : '',
    look.className || ''
  ].filter(Boolean).join(' ');
}

function getDisabledProps(disabled: boolean | undefined) {
  if (typeof disabled !== 'boolean') {
    return {};
  }
  const state = disabled ? 'true' : 'false';
  return { 'data-disabled': state, 'aria-disabled': disabled };
}

export function getUnsupportedProps(unsupported: SettingRowUnsupported | null | undefined) {
  if (!unsupported) {
    return {};
  }
  return {
    'data-browser-unsupported': unsupported.browser,
    'data-unsupported-reason-key': unsupported.reasonKey,
    'data-unsupported': unsupported.active ? 'true' : undefined,
    'aria-disabled': unsupported.active ? true : undefined
  };
}

function RowTitle({ title, description, action }: { title: SettingsTitleModel; description?: string; action?: ReactNode }) {
  return (
    <div>
      <SettingTitle action={action} badge={title.badge} id={title.id} info={title.info} title={title.text} />
      {description ? (
        <p
          className={description.includes('\n')
            // Keeps the description's own line breaks.
            ? '_x_extension_setting_desc_2024_unique_ _x_extension_setting_desc_lines_2026_unique_'
            : '_x_extension_setting_desc_2024_unique_'}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

function RowLink({ model }: { model: SettingsLinkModel }) {
  return (
    <a
      className="_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_ghost_2026_unique_"
      data-bound={model.bound ? 'true' : 'false'}
      data-browser-only={model.browserOnly}
      href={model.href}
      id={model.id}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span data-ctrl-tab-label="">{model.label}</span>
      <RemixIcon name="ri-external-link-line" />
    </a>
  );
}

// Sub-rows open and fold with their switch. The first render only places
// them (no motion while the page loads its settings); later changes animate,
// and the rows let menus spill out once they have settled open.
export function SettingsReveal({ id, expanded, children }: { id: string; expanded: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState(false);
  const [settled, setSettled] = useState(expanded);
  const shownExpanded = useRef(expanded);

  useLayoutEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setMotion(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  useLayoutEffect(() => {
    if (shownExpanded.current === expanded) {
      return;
    }
    shownExpanded.current = expanded;
    const wrap = ref.current;
    const instant = !motion || !wrap || getComputedStyle(wrap).transitionDuration
      .split(',')
      .every((value) => parseFloat(value) === 0);
    setSettled(expanded && instant);
  }, [expanded, motion]);

  return (
    <div
      className="_x_extension_setting_reveal_2026_unique_"
      data-expanded={expanded ? 'true' : 'false'}
      data-motion={motion ? undefined : 'off'}
      data-settled={settled ? 'true' : 'false'}
      id={id}
      inert={!expanded}
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows' && expanded) {
          setSettled(true);
        }
      }}
      ref={ref}
    >
      <div className="_x_extension_setting_reveal_inner_2026_unique_">{children}</div>
    </div>
  );
}

// A group of checkboxes, optionally kept from being cleared and optionally
// reordered by dragging or with Alt and the arrow keys.
function CheckboxGroupRow({
  row,
  handlers
}: {
  row: Extract<SettingsRowModel, { type: 'checkbox-group' }>;
  handlers: SettingsRowsHandlers;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  // Set by the reset button, which hides itself: once the choices are drawn
  // in their reset order, focus moves to the first of them.
  const focusFirstChoice = useRef(false);
  const { attachDrag } = handlers;
  useLayoutEffect(() => (attachDrag ? attachDrag(row.key, groupRef.current) : undefined), [attachDrag, row.key]);
  useLayoutEffect(() => {
    if (focusFirstChoice.current) {
      focusFirstChoice.current = false;
      groupRef.current?.querySelector('input')?.focus({ preventScroll: true });
    }
  });
  const reset = row.reset ? (
    <button
      aria-label={row.reset.label}
      className="_x_extension_shortcut_group_action_2024_unique_ _x_extension_range_slider_reset_button_2026_unique_"
      data-tooltip={row.reset.label}
      hidden={row.reset.hidden}
      id={row.reset.id}
      onClick={() => {
        focusFirstChoice.current = true;
        handlers.onReset?.(row.key);
      }}
      type="button"
    >
      <RemixIcon name="ri-reset-left-line" />
    </button>
  ) : null;
  return (
    <div className={getRowClassName(row)} id={row.rowId}>
      <RowTitle action={reset} description={row.description} title={row.title} />
      <div aria-label={row.ariaLabel} className="_x_extension_checkbox_group_2026_unique_" id={row.groupId} ref={groupRef} role="group">
        <CheckboxGroup
          model={row.checkboxes}
          onChange={(values) => handlers.onCheck?.(row.key, values)}
          onMove={handlers.onMove ? (fromIndex, toIndex) => handlers.onMove?.(row.key, fromIndex, toIndex) : undefined}
        />
      </div>
    </div>
  );
}

function SettingsRow({ row, handlers }: { row: SettingsRowModel; handlers: SettingsRowsHandlers }) {
  switch (row.type) {
    case 'header':
      return (
        <div className="_x_extension_setting_row_2024_unique_ _x_extension_section_header_2026_unique_">
          <div>
            <p className="_x_extension_section_title_2024_unique_">{row.title}</p>
          </div>
        </div>
      );
    case 'divider':
      return <SettingDivider />;
    case 'toggle': {
      const toggle = <SettingSwitch model={row.toggle} onChange={(checked) => handlers.onToggle(row.key, checked)} />;
      return (
        <div
          aria-hidden={row.hidden ? true : undefined}
          className={getRowClassName(row)}
          hidden={row.hidden}
          id={row.rowId}
          {...getDisabledProps(row.disabled)}
          {...getUnsupportedProps(row.unsupported)}
        >
          <RowTitle description={row.description} title={row.title} />
          {row.link ? (
            <div className="_x_extension_setting_row_actions_2026_unique_">
              <RowLink model={row.link} />
              {toggle}
            </div>
          ) : toggle}
        </div>
      );
    }
    case 'select':
      return (
        <div className={getRowClassName(row)} id={row.rowId} {...getDisabledProps(row.disabled)}>
          <RowTitle description={row.description} title={row.title} />
          <SettingSelect
            model={row.select}
            options={{
              getViewportTopInset: handlers.getViewportTopInset,
              onSelect: (value) => handlers.onSelect(row.key, value),
              searchable: row.searchable
            }}
          />
        </div>
      );
    case 'segmented':
      return (
        <div className={getRowClassName(row)} id={row.rowId}>
          <RowTitle description={row.description} title={row.title} />
          <div
            aria-label={row.ariaLabel}
            className={['_x_extension_theme_picker_2024_unique_ _x_extension_inline_tabs_2024_unique_', row.groupClassName]
              .filter(Boolean).join(' ')}
            id={row.groupId}
            role="radiogroup"
          >
            <SegmentedControl model={row.segmented} onSelect={(value) => handlers.onSelect(row.key, value)} />
          </div>
        </div>
      );
    case 'slider':
      return (
        <div className={getRowClassName(row)} id={row.rowId} {...getDisabledProps(row.disabled)}>
          <RowTitle title={row.title} />
          <div id={row.hostId}>
            <RangeSliderControl model={row.slider} onInput={(value) => handlers.onSlide?.(row.key, value)} />
          </div>
        </div>
      );
    case 'checkbox-group':
      return <CheckboxGroupRow handlers={handlers} row={row} />;
    case 'label':
      return (
        <div className={getRowClassName(row)}>
          <RowTitle title={row.title} />
        </div>
      );
    case 'reveal':
      return (
        <SettingsReveal expanded={row.expanded} id={row.id}>
          <SettingsRows handlers={handlers} rows={row.rows} />
        </SettingsReveal>
      );
    case 'slot':
      return <>{handlers.renderSlot ? handlers.renderSlot(row.key) : null}</>;
  }
}

export function SettingsRows({ rows, handlers }: { rows: SettingsRowModel[]; handlers: SettingsRowsHandlers }) {
  return (
    <>
      {rows.map((row) => <SettingsRow handlers={handlers} key={row.key} row={row} />)}
    </>
  );
}

export interface SettingsSectionModel {
  rows: SettingsRowModel[];
}
