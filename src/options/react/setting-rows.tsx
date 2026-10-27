import type { ReactNode } from 'react';
import { InfoButton } from './info-button';
import { ToggleControl, type ToggleControlRenderModel } from './toggle-control';

// A setting the browser cannot honor: the row stays, disabled, and says why
// in a tooltip that follows the cursor (markBrowserUnsupportedSettings).
export interface SettingRowUnsupported {
  // The browser family it is unsupported on, as data-browser-family names it.
  browser: string;
  reasonKey: string;
  // True when the page runs in that browser.
  active: boolean;
}

export interface SettingToggleRowModel {
  id?: string;
  title: string;
  // A badge after the title, such as "Beta".
  badge?: string;
  info?: string;
  description?: string;
  toggle: ToggleControlRenderModel;
  unsupported?: SettingRowUnsupported | null;
}

export function SettingTitle({
  id,
  title,
  badge,
  info,
  action
}: Pick<SettingToggleRowModel, 'title' | 'badge' | 'info'> & {
  id?: string;
  // A small button after the title, such as a reset.
  action?: ReactNode;
}) {
  return (
    <p className="_x_extension_setting_title_2024_unique_" id={id}>
      <span className="_x_extension_setting_title_with_icon_2024_unique_">
        <span>{title}</span>
        {badge ? (
          <span className="_x_extension_shortcut_badge_2024_unique_ _x_extension_lab_beta_badge_2026_unique_">
            {badge}
          </span>
        ) : null}
        {info ? <InfoButton tooltip={info} /> : null}
        {action}
      </span>
    </p>
  );
}

// The switch of a row, in the page's switch frame.
export function SettingSwitch({
  model,
  onChange
}: {
  model: ToggleControlRenderModel;
  onChange(checked: boolean): void;
}) {
  return (
    <label className="_x_extension_switch_2024_unique_" htmlFor={model.id}>
      <ToggleControl model={model} onChange={onChange} />
    </label>
  );
}

export function SettingToggleRow({
  model,
  onChange
}: {
  model: SettingToggleRowModel;
  onChange(checked: boolean): void;
}) {
  const unsupported = model.unsupported || null;
  return (
    <div
      className="_x_extension_setting_row_2024_unique_ _x_extension_setting_row_compact_2024_unique_"
      data-browser-unsupported={unsupported ? unsupported.browser : undefined}
      data-unsupported-reason-key={unsupported ? unsupported.reasonKey : undefined}
      data-unsupported={unsupported && unsupported.active ? 'true' : undefined}
      aria-disabled={unsupported && unsupported.active ? true : undefined}
      id={model.id}
    >
      <div>
        <SettingTitle badge={model.badge} info={model.info} title={model.title} />
        {model.description ? (
          <p className="_x_extension_setting_desc_2024_unique_">{model.description}</p>
        ) : null}
      </div>
      <SettingSwitch model={model.toggle} onChange={onChange} />
    </div>
  );
}

export function SettingDivider() {
  return (
    <div className="_x_extension_setting_divider_wrap_2024_unique_" role="presentation">
      <div className="_x_extension_setting_divider_2024_unique_" />
    </div>
  );
}

// Rows with a divider between each two.
export function SettingRows({ children }: { children: ReactNode[] }) {
  return (
    <>
      {children.flatMap((child, index) => (index === 0 ? [child] : [<SettingDivider key={`divider-${index}`} />, child]))}
    </>
  );
}

export interface SettingToggleRowsModel {
  rows: Array<SettingToggleRowModel & { key: string }>;
}

// A list of switch rows, each reporting its key when it changes.
export function SettingToggleRows({
  model,
  onChange
}: {
  model: SettingToggleRowsModel;
  onChange(key: string, checked: boolean): void;
}) {
  return (
    <SettingRows>
      {model.rows.map((row) => (
        <SettingToggleRow key={row.key} model={row} onChange={(checked) => onChange(row.key, checked)} />
      ))}
    </SettingRows>
  );
}
