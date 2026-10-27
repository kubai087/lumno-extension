import { InfoButton } from './info-button';
import { SegmentedControl, type SegmentedControlRenderModel } from './segmented-control';
import { SettingSwitch } from './setting-rows';
import { ShortcutReference, type ShortcutReferenceRenderModel } from './shortcut-reference';
import type { ToggleControlRenderModel } from './toggle-control';

// The General tab's Shortcuts section: where the browser's shortcuts are
// changed, the search shortcut, what happens on restricted pages, the list
// of shortcuts, and quick tab switching.
export interface GeneralShortcutsSectionModel {
  title: string;
  // "Change them in <Extensions> -> <Keyboard shortcuts>", in parts.
  description: { prefix: string; extensions: string; shortcuts: string; suffix: string };
  openLabel: string;
  search: { title: string; diaTag: string; diaTooltip: string; status: string };
  restricted: { title: string; info: string; segmented: SegmentedControlRenderModel };
  referenceLabel: string;
  // Null until the browser's commands are read.
  reference: ShortcutReferenceRenderModel | null;
  quickSwitch: { title: string; toggle: ToggleControlRenderModel };
}

export interface GeneralShortcutsSectionHandlers {
  onOpenShortcutsPage(): void;
  onRestrictedAction(value: string): void;
  onQuickSwitch(checked: boolean): void;
}

export function GeneralShortcutsSection({
  model,
  handlers
}: {
  model: GeneralShortcutsSectionModel;
  handlers: GeneralShortcutsSectionHandlers;
}) {
  const { description, search, restricted, quickSwitch } = model;
  return (
    <>
      <div className="_x_extension_setting_row_2024_unique_ _x_extension_section_header_2026_unique_">
        <div className="_x_extension_shortcuts_section_block_2026_unique_">
          <div className="_x_extension_shortcuts_section_title_row_2026_unique_">
            <div className="_x_extension_shortcuts_section_copy_2026_unique_">
              <p className="_x_extension_section_title_2024_unique_">{model.title}</p>
              <p className="_x_extension_shortcuts_section_desc_2026_unique_">
                <span>{description.prefix}</span>
                <span className="_x_extension_shortcuts_section_desc_path_2026_unique_">{description.extensions}</span>
                <span className="_x_extension_shortcuts_section_desc_path_2026_unique_"> -&gt; </span>
                <span className="_x_extension_shortcuts_section_desc_path_2026_unique_">{description.shortcuts}</span>
                <span>{description.suffix}</span>
              </p>
            </div>
            <button
              className="_x_extension_sync_button_2024_unique_ _x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_submit_primary_2024_unique_ _x_extension_shortcuts_link_2026_unique_"
              id="_x_extension_open_shortcuts_page_2026_unique_"
              onClick={handlers.onOpenShortcutsPage}
              type="button"
            >
              <span>{model.openLabel}</span>
            </button>
          </div>
        </div>
      </div>
      <div className="_x_extension_setting_row_2024_unique_">
        <div>
          <p className="_x_extension_setting_title_2024_unique_ _x_extension_setting_title_with_icon_2024_unique_">
            <span>{search.title}</span>
            <span
              aria-label={search.diaTooltip}
              className="_x_extension_shortcut_badge_2024_unique_ _x_extension_shortcuts_dia_badge_2026_unique_ _x_extension_tooltip_host_2024_unique_"
              data-browser-only="chromium"
              data-tooltip={search.diaTooltip}
              role="img"
            >
              <span>{search.diaTag}</span>
            </span>
          </p>
        </div>
        <div className="_x_extension_sync_actions_2024_unique_ _x_extension_shortcuts_actions_2024_unique_">
          <div className="_x_extension_shortcuts_status_chip_2026_unique_" id="_x_extension_shortcuts_status_2024_unique_">
            {search.status}
          </div>
        </div>
      </div>
      <div className="_x_extension_setting_row_2024_unique_ _x_extension_setting_row_compact_2024_unique_ _x_extension_shortcut_restricted_subrow_2026_unique_">
        <div>
          <p className="_x_extension_setting_title_2024_unique_ _x_extension_setting_title_with_icon_2024_unique_">
            <span>{restricted.title}</span>
            <span id="_x_extension_restricted_action_info_2026_unique_">
              <InfoButton tooltip={restricted.info} />
            </span>
          </p>
        </div>
        <div
          aria-label={restricted.title}
          className="_x_extension_theme_picker_2024_unique_ _x_extension_inline_tabs_2024_unique_"
          id="_x_extension_restricted_action_tabs_wrap_2024_unique_"
          role="radiogroup"
        >
          <SegmentedControl model={restricted.segmented} onSelect={handlers.onRestrictedAction} />
        </div>
      </div>
      <div aria-label={model.referenceLabel} className="_x_extension_shortcut_reference_2026_unique_" id="_x_extension_shortcut_reference_2026_unique_">
        <div className="_x_extension_shortcut_reference_list_2026_unique_" id="_x_extension_shortcut_reference_list_2026_unique_">
          {model.reference ? <ShortcutReference model={model.reference} /> : null}
        </div>
      </div>
      <div className="_x_extension_setting_row_2024_unique_ _x_extension_setting_row_compact_2024_unique_" id="_x_extension_overlay_tab_priority_row_2024_unique_">
        <div>
          <p className="_x_extension_setting_title_2024_unique_">
            <span>{quickSwitch.title}</span>
          </p>
        </div>
        <SettingSwitch model={quickSwitch.toggle} onChange={handlers.onQuickSwitch} />
      </div>
    </>
  );
}
