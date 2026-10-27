import type { ReactNode } from 'react';
import { SettingSelect, type SelectControlRenderModel } from './select-control';
import { SettingTitle, type SettingRowUnsupported } from './setting-rows';
import {
  getUnsupportedProps,
  SettingsRows,
  type SettingsRowModel,
  type SettingsRowsHandlers,
  type SettingsTitleModel
} from './settings-rows-view';

// A row that picks one of the fonts installed on this device. A chosen face
// the device lacks is named under the title, with one button to clear it.
export interface OverlayFontRowModel {
  key: string;
  rowId: string;
  title: SettingsTitleModel;
  description: string;
  unsupported: SettingRowUnsupported;
  select: SelectControlRenderModel;
  missing: { id: string; text: string; actionLabel: string; hidden: boolean };
}

// The Appearance tab's webpage overlay section. Its rows hold a slot for
// each font row, keyed by the font row's key.
export interface AppearanceOverlaySectionModel {
  rows: SettingsRowModel[];
  fonts: OverlayFontRowModel[];
}

export interface AppearanceOverlaySectionHandlers {
  rows: SettingsRowsHandlers;
  onFont(key: string, family: string): void;
  onFontReset(key: string): void;
}

function OverlayFontRow({ row, handlers }: { row: OverlayFontRowModel; handlers: AppearanceOverlaySectionHandlers }) {
  return (
    <div
      className="_x_extension_setting_row_2024_unique_ _x_extension_setting_row_compact_2024_unique_"
      id={row.rowId}
      {...getUnsupportedProps(row.unsupported)}
    >
      <div>
        <SettingTitle id={row.title.id} title={row.title.text} />
        <p className="_x_extension_setting_desc_2024_unique_">{row.description}</p>
        <div
          className="_x_extension_overlay_font_missing_2026_unique_"
          hidden={row.missing.hidden}
          id={row.missing.id}
          role="status"
        >
          <span className="_x_extension_overlay_font_missing_text_2026_unique_">{row.missing.text}</span>
          <button
            className="_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_secondary_2024_unique_ _x_extension_overlay_font_reset_2026_unique_"
            onClick={() => handlers.onFontReset(row.key)}
            type="button"
          >
            {row.missing.actionLabel}
          </button>
        </div>
      </div>
      <SettingSelect
        model={row.select}
        options={{
          getViewportTopInset: handlers.rows.getViewportTopInset,
          onSelect: (family) => handlers.onFont(row.key, family),
          // Installed font lists run to hundreds of entries.
          searchable: true
        }}
      />
    </div>
  );
}

export function AppearanceOverlaySection({
  model,
  handlers
}: {
  model: AppearanceOverlaySectionModel;
  handlers: AppearanceOverlaySectionHandlers;
}) {
  const renderSlot = (key: string): ReactNode => {
    const font = model.fonts.find((row) => row.key === key);
    return font ? <OverlayFontRow handlers={handlers} row={font} /> : null;
  };
  return <SettingsRows handlers={{ ...handlers.rows, renderSlot }} rows={model.rows} />;
}
