import { useRef, type ReactNode } from 'react';
import { SettingTitle } from './setting-rows';
import { SettingsRows, type SettingsRowModel, type SettingsRowsHandlers } from './settings-rows-view';
import { RemixIcon } from '../../shared/react/remix-icon';

// The custom collection: which file it came from and how many quotes it
// holds, a way to move today's quote on, and the import.
export interface QuoteLibraryRowModel {
  title: string;
  hint: string;
  // Null until a collection is imported.
  count: { label: string; filename: string } | null;
  canShuffle: boolean;
  busy: boolean;
  importing: boolean;
  importLabel: string;
  shuffleLabel: string;
  // Why the last import failed.
  error: string;
}

// The New Tab daily quote rows of the Appearance tab. Its rows hold a slot,
// keyed 'library', for the collection row.
export interface DailyQuoteSectionModel {
  rows: SettingsRowModel[];
  library: QuoteLibraryRowModel;
}

export interface DailyQuoteSectionHandlers {
  rows: SettingsRowsHandlers;
  onImport(file: File): void;
  onShuffle(): void;
}

function QuoteLibraryRow({ model, handlers }: { model: QuoteLibraryRowModel; handlers: DailyQuoteSectionHandlers }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div
      className="_x_extension_setting_row_2024_unique_ _x_extension_setting_row_compact_2024_unique_ _x_extension_setting_subrow_2026_unique_ _x_extension_quote_library_row_2026_unique_"
      id="_x_extension_newtab_quote_library_row_2026_unique_"
    >
      <div className="_x_extension_quote_library_info_2026_unique_">
        <SettingTitle info={model.hint} title={model.title} />
        <p
          className="_x_extension_quote_import_status_2026_unique_"
          hidden={!model.error}
          id="_x_extension_newtab_quote_import_status_2026_unique_"
          role={model.error ? 'alert' : 'status'}
        >
          {model.error}
        </p>
      </div>
      <div className="_x_extension_quote_library_actions_2026_unique_">
        <span
          aria-label={model.count ? `${model.count.filename} · ${model.count.label}` : undefined}
          className="_x_extension_quote_count_2026_unique_ _x_extension_tooltip_host_2026_unique_"
          data-tooltip={model.count ? model.count.filename : ''}
          hidden={!model.count}
          id="_x_extension_newtab_quote_count_2026_unique_"
          tabIndex={0}
        >
          <RemixIcon name="ri-file-text-line" />
          <span id="_x_extension_newtab_quote_count_text_2026_unique_">{model.count ? model.count.label : ''}</span>
        </span>
        <button
          className="_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_secondary_2024_unique_ _x_extension_shortcut_compact_2026_unique_"
          disabled={model.busy}
          hidden={!model.canShuffle}
          id="_x_extension_newtab_quote_shuffle_2026_unique_"
          onClick={handlers.onShuffle}
          type="button"
        >
          {model.shuffleLabel}
        </button>
        <button
          className="_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_secondary_2024_unique_ _x_extension_shortcut_compact_2026_unique_"
          disabled={model.importing}
          id="_x_extension_newtab_quote_import_2026_unique_"
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          {model.importLabel}
        </button>
        <input
          accept=".txt,.md,.markdown,text/markdown,text/plain"
          hidden
          id="_x_extension_newtab_quote_file_2026_unique_"
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files && input.files[0];
            // Choosing the same file again should import it again.
            input.value = '';
            if (file) {
              handlers.onImport(file);
            }
          }}
          ref={fileRef}
          type="file"
        />
      </div>
    </div>
  );
}

export function DailyQuoteSection({ model, handlers }: { model: DailyQuoteSectionModel; handlers: DailyQuoteSectionHandlers }) {
  const renderSlot = (key: string): ReactNode =>
    (key === 'library' ? <QuoteLibraryRow handlers={handlers} model={model.library} /> : null);
  return <SettingsRows handlers={{ ...handlers.rows, renderSlot }} rows={model.rows} />;
}
