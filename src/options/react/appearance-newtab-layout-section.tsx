import type { ReactNode } from 'react';
import { RangeSliderControl, type RangeSliderControlRenderModel } from './range-slider-control';
import { SegmentedControl, type SegmentedControlRenderModel } from './segmented-control';
import { SettingTitle } from './setting-rows';
import { SettingsRows, type SettingsRowModel, type SettingsRowsHandlers } from './settings-rows-view';

// How many recent site cards New Tab shows, and which ones. The choice of
// sites only shows while there are cards.
export interface RecentSitesRowModel {
  title: string;
  count: RangeSliderControlRenderModel;
  mode: SegmentedControlRenderModel | null;
}

// The New Tab layout rows of the Appearance tab. Its rows hold a slot, keyed
// 'recent', for the recent sites row.
export interface AppearanceNewtabLayoutSectionModel {
  rows: SettingsRowModel[];
  recent: RecentSitesRowModel;
}

export interface AppearanceNewtabLayoutSectionHandlers {
  rows: SettingsRowsHandlers;
  onRecentCount(value: number): void;
  onRecentMode(value: string): void;
}

function RecentSitesRow({ model, handlers }: { model: RecentSitesRowModel; handlers: AppearanceNewtabLayoutSectionHandlers }) {
  return (
    <div className="_x_extension_setting_row_2024_unique_">
      <div>
        <SettingTitle title={model.title} />
      </div>
      <div className="_x_extension_recent_select_group_2024_unique_">
        <div id="_x_extension_recent_count_control_2026_unique_">
          <RangeSliderControl model={model.count} onInput={handlers.onRecentCount} />
        </div>
        {model.mode ? (
          <div
            aria-label={model.title}
            className="_x_extension_theme_picker_2024_unique_ _x_extension_inline_tabs_2024_unique_"
            id="_x_extension_recent_mode_tabs_wrap_2024_unique_"
            role="radiogroup"
          >
            <SegmentedControl model={model.mode} onSelect={handlers.onRecentMode} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AppearanceNewtabLayoutSection({
  model,
  handlers
}: {
  model: AppearanceNewtabLayoutSectionModel;
  handlers: AppearanceNewtabLayoutSectionHandlers;
}) {
  const renderSlot = (key: string): ReactNode =>
    (key === 'recent' ? <RecentSitesRow handlers={handlers} model={model.recent} /> : null);
  return <SettingsRows handlers={{ ...handlers.rows, renderSlot }} rows={model.rows} />;
}
