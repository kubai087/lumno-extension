import { SettingsRows, type SettingsRowModel, type SettingsRowsHandlers } from './settings-rows-view';
import { ThemePicker, type ThemeMode, type ThemePickerRenderModel } from './theme-picker';

// The Appearance tab's global section: the color mode gallery, then the
// switches that apply everywhere.
export interface AppearanceGlobalSectionModel {
  title: string;
  theme: { title: string; picker: ThemePickerRenderModel };
  rows: SettingsRowModel[];
}

export interface AppearanceGlobalSectionHandlers {
  onTheme(mode: ThemeMode, button: HTMLButtonElement): void;
  rows: SettingsRowsHandlers;
}

export function AppearanceGlobalSection({
  model,
  handlers
}: {
  model: AppearanceGlobalSectionModel;
  handlers: AppearanceGlobalSectionHandlers;
}) {
  return (
    <>
      <div className="_x_extension_setting_row_2024_unique_ _x_extension_section_header_2026_unique_">
        <p className="_x_extension_section_title_2024_unique_">{model.title}</p>
      </div>
      <div className="_x_extension_setting_row_2024_unique_" id="_x_extension_theme_mode_row_2026_unique_">
        <div>
          <p className="_x_extension_setting_title_2024_unique_">{model.theme.title}</p>
        </div>
        <div
          aria-label={model.theme.title}
          className="_x_extension_theme_picker_2024_unique_ _x_extension_theme_gallery_2026_unique_"
          role="group"
        >
          <ThemePicker model={model.theme.picker} onSelect={handlers.onTheme} />
        </div>
      </div>
      <SettingsRows handlers={handlers.rows} rows={model.rows} />
    </>
  );
}
