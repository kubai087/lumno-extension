import { useRef } from 'react';
import { InfoButton } from './info-button';
import { SettingDivider } from './setting-rows';
import { WebDavList, type WebDavListModel, type WebDavListOptions } from './webdav-list';
import { RemixIcon } from '../../shared/react/remix-icon';
import { SettingsExportButton, type SettingsExportCopy, type SettingsExportIncludes } from './settings-export-button';

export type BrowserSyncTone = 'success' | 'danger' | '';

// The browser sync card: whether sync works, how much of the shortcuts it
// carries, and its export, import and sync-now buttons.
export interface BrowserSyncCardModel {
  sectionTitle: string;
  title: string;
  status: { text: string; tone: BrowserSyncTone; tooltip: string };
  // Empty hides the note.
  summary: string;
  // Whether settings can sync at all; the buttons are off otherwise.
  available: boolean;
  syncing: boolean;
  syncNowTooltip: string;
  exportCopy: SettingsExportCopy;
  importLabel: string;
  syncNowLabel: string;
}

export interface BrowserSyncCardHandlers {
  onSyncNow(): void;
  onExport(includes: SettingsExportIncludes): Promise<void>;
  onImport(file: File): void;
}

export interface WebDavCardModel {
  title: string;
  badge: string;
  info: string;
  setupHint: string;
  showSetupHint: boolean;
  // A version or loading failure; empty hides it.
  notice: string;
  list: WebDavListModel;
}

export interface AccountTabModel {
  browserSync: BrowserSyncCardModel;
  webdav: WebDavCardModel;
}

export interface AccountTabHandlers {
  browserSync: BrowserSyncCardHandlers;
  webdav: WebDavListOptions;
}

const SYNC_BUTTON_CLASS = [
  '_x_extension_sync_button_2024_unique_',
  '_x_extension_shortcut_submit_2024_unique_',
  '_x_extension_shortcut_secondary_2024_unique_',
  '_x_extension_shortcut_compact_2026_unique_'
].join(' ');

function BrowserSyncCard({
  model,
  handlers
}: {
  model: BrowserSyncCardModel;
  handlers: BrowserSyncCardHandlers;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = !model.available;
  const disabledState = disabled ? 'true' : 'false';
  return (
    <>
      <div className="_x_extension_setting_row_2024_unique_ _x_extension_section_header_2026_unique_">
        <p className="_x_extension_section_title_2024_unique_">{model.sectionTitle}</p>
      </div>
      <div className="_x_extension_setting_row_2024_unique_ _x_extension_browser_sync_row_2026_unique_">
        <div>
          <div className="_x_extension_setting_title_2024_unique_ _x_extension_setting_title_with_icon_2024_unique_ _x_extension_sync_title_with_status_2026_unique_">
            <span id="lumno-browser-sync-title">{model.title}</span>
            <span
              aria-label={model.status.tooltip}
              className="_x_extension_sync_status_2024_unique_ _x_extension_tooltip_host_2024_unique_"
              data-status={model.status.tone || undefined}
              data-tooltip={model.status.tooltip}
              id="_x_extension_sync_status_2024_unique_"
              role="img"
            >
              <span id="_x_extension_sync_status_text_2024_unique_">{model.status.text}</span>
              <RemixIcon name="ri-information-line" size={12} />
            </span>
          </div>
          <p
            aria-live="polite"
            className="_x_extension_setting_desc_2024_unique_"
            hidden={!model.summary}
            id="_x_extension_shortcut_sync_summary_2026_unique_"
          >
            {model.summary}
          </p>
        </div>
        <div className="_x_extension_sync_actions_2024_unique_">
          <div className="_x_extension_sync_buttons_2024_unique_">
            <SettingsExportButton
              className={`${SYNC_BUTTON_CLASS} _x_extension_sync_icon_faded_2024_unique_`}
              copy={model.exportCopy}
              disabled={disabled}
              onExport={handlers.onExport}
            />
            <button
              className={`${SYNC_BUTTON_CLASS} _x_extension_sync_icon_faded_2024_unique_`}
              data-disabled={disabledState}
              disabled={disabled}
              id="_x_extension_sync_import_2024_unique_"
              onClick={() => fileRef.current?.click()}
              type="button"
            >
              <RemixIcon name="ri-download-line" size={16} />
              <span>{model.importLabel}</span>
            </button>
            <button
              aria-busy={model.syncing ? 'true' : undefined}
              className={`${SYNC_BUTTON_CLASS} _x_extension_shortcut_save_2024_unique_`}
              data-disabled={disabledState}
              data-tooltip={model.syncNowTooltip}
              disabled={disabled}
              id="_x_extension_sync_now_2024_unique_"
              onClick={handlers.onSyncNow}
              type="button"
            >
              <RemixIcon className="_x_extension_sync_now_icon_2024_unique_ x-lumno-busy-spin" name="ri-refresh-line" size={16} />
              <span>{model.syncNowLabel}</span>
            </button>
          </div>
          <input
            accept="application/json"
            id="_x_extension_sync_import_input_2024_unique_"
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files ? input.files[0] : undefined;
              // Cleared so choosing the same file again imports it again.
              input.value = '';
              if (file) {
                handlers.onImport(file);
              }
            }}
            ref={fileRef}
            style={{ display: 'none' }}
            type="file"
          />
        </div>
      </div>
    </>
  );
}

function WebDavCard({ model, options }: { model: WebDavCardModel; options: WebDavListOptions }) {
  return (
    <section aria-labelledby="lumno-webdav-title" className="lumno-webdav-settings" id="lumno-webdav-settings">
      <div className="lumno-webdav-heading">
        <div className="_x_extension_setting_title_with_icon_2024_unique_ lumno-webdav-title">
          <p className="_x_extension_section_title_2024_unique_" id="lumno-webdav-title">{model.title}</p>
          <span className="_x_extension_shortcut_badge_2024_unique_ _x_extension_lab_beta_badge_2026_unique_">{model.badge}</span>
          <span id="lumno-webdav-beta-info">
            <InfoButton tooltip={model.info} />
          </span>
        </div>
      </div>
      <p className="_x_extension_setting_desc_2024_unique_" hidden={!model.showSetupHint} id="lumno-webdav-setup-hint">
        {model.setupHint}
      </p>
      <div id="lumno-webdav-list">
        <WebDavList model={model.list} options={options} />
      </div>
      <p
        className="_x_extension_setting_desc_2024_unique_ lumno-webdav-feedback"
        data-error="true"
        hidden={!model.notice}
        id="lumno-webdav-version"
      >
        {model.notice}
      </p>
    </section>
  );
}

export function AccountTab({ model, handlers }: { model: AccountTabModel; handlers: AccountTabHandlers }) {
  return (
    <>
      <BrowserSyncCard handlers={handlers.browserSync} model={model.browserSync} />
      <SettingDivider />
      <WebDavCard model={model.webdav} options={handlers.webdav} />
    </>
  );
}
