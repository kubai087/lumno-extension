import { BlacklistList, type BlacklistListRenderModel, type BlacklistSaveHandler } from './blacklist-list';
import { InfoButton } from './info-button';
import { GroupActionConfirm, type GroupActionConfirmModel } from './group-action-confirm';
import { SettingDivider, SettingSwitch } from './setting-rows';
import { BlacklistForm, type BlacklistFormRenderModel, type BlacklistFormSaveHandler } from './settings-forms';
import type { ToggleControlRenderModel } from './toggle-control';

// The clear-all button of a list and the confirmation it asks for.
export type BlacklistClearModel = GroupActionConfirmModel;

// One rule list: its rules, its add form and its clear-all button.
export interface BlacklistGroupModel {
  description: string;
  list: BlacklistListRenderModel;
  form: BlacklistFormRenderModel;
  // A new value closes and clears the add form.
  formResetVersion: number;
  clear: BlacklistClearModel;
}

export interface BlacklistTabModel {
  search: BlacklistGroupModel & { title: string };
  // The rules for sites whose icons are not fetched; editable only while
  // enhanced fetching is on.
  favicon: BlacklistGroupModel & { enabled: boolean };
  enhancedFetch: { title: string; info: string; toggle: ToggleControlRenderModel };
}

export interface BlacklistGroupHandlers {
  onRemove(key: string): void | Promise<void>;
  onAdd: BlacklistFormSaveHandler;
  onClear(): void | Promise<void>;
}

export interface BlacklistTabHandlers {
  search: BlacklistGroupHandlers & { onEdit: BlacklistSaveHandler };
  favicon: BlacklistGroupHandlers;
  onEnhancedFetchChange(checked: boolean): void;
}

function BlacklistClearButton({
  id,
  model,
  disabled,
  onConfirm
}: {
  id: string;
  model: BlacklistClearModel;
  disabled: boolean;
  onConfirm(): void | Promise<void>;
}) {
  return (
    <GroupActionConfirm disabled={disabled} iconName="ri-delete-bin-4-line" id={id} model={model} onConfirm={onConfirm} />
  );
}

export function BlacklistTab({
  model,
  handlers
}: {
  model: BlacklistTabModel;
  handlers: BlacklistTabHandlers;
}) {
  const { search, favicon, enhancedFetch } = model;
  return (
    <div className="_x_extension_shortcuts_section_2024_unique_">
      <div className="_x_extension_shortcut_group_2024_unique_">
        <div className="_x_extension_shortcut_group_header_2024_unique_">
          <div className="_x_extension_shortcut_group_title_2024_unique_ _x_extension_section_title_2024_unique_">
            {search.title}
          </div>
          <BlacklistClearButton
            disabled={search.list.items.length === 0}
            id="_x_extension_blacklist_clear_2026_unique_"
            model={search.clear}
            onConfirm={handlers.search.onClear}
          />
        </div>
        <p className="_x_extension_setting_desc_2024_unique_ _x_extension_setting_desc_compact_2026_unique_">
          {search.description}
        </p>
        <div className="_x_extension_shortcut_list_2024_unique_" id="_x_extension_blacklist_list_2026_unique_">
          <BlacklistList model={search.list} onRemove={handlers.search.onRemove} onSave={handlers.search.onEdit} />
        </div>
      </div>
      <BlacklistForm
        frameId="_x_extension_blacklist_form_2026_unique_"
        model={search.form}
        onSave={handlers.search.onAdd}
        resetVersion={search.formResetVersion}
      />
      <SettingDivider />
      <div className="_x_extension_shortcut_group_2024_unique_">
        <div className="_x_extension_shortcut_group_header_2024_unique_">
          <div className="_x_extension_shortcut_group_title_2024_unique_ _x_extension_section_title_2024_unique_ _x_extension_section_title_with_icon_2026_unique_">
            <span>{enhancedFetch.title}</span>
            <InfoButton tooltip={enhancedFetch.info} />
          </div>
          <SettingSwitch model={enhancedFetch.toggle} onChange={handlers.onEnhancedFetchChange} />
        </div>
      </div>
      <div
        aria-disabled={favicon.enabled ? 'false' : 'true'}
        id="_x_extension_favicon_blacklist_editor_2026_unique_"
        inert={!favicon.enabled}
      >
        <div className="_x_extension_shortcut_group_2024_unique_">
          <div className="_x_extension_shortcut_group_header_2024_unique_">
            <p className="_x_extension_setting_desc_2024_unique_ _x_extension_setting_desc_compact_2026_unique_">
              {favicon.description}
            </p>
            <BlacklistClearButton
              disabled={favicon.list.items.length === 0}
              id="_x_extension_favicon_blacklist_clear_2026_unique_"
              model={favicon.clear}
              onConfirm={handlers.favicon.onClear}
            />
          </div>
          <div className="_x_extension_shortcut_list_2024_unique_" id="_x_extension_favicon_blacklist_list_2026_unique_">
            <BlacklistList model={favicon.list} onRemove={handlers.favicon.onRemove} />
          </div>
        </div>
        <BlacklistForm
          frameId="_x_extension_favicon_blacklist_form_2026_unique_"
          model={favicon.form}
          onSave={handlers.favicon.onAdd}
          resetVersion={favicon.formResetVersion}
        />
      </div>
    </div>
  );
}
