import { useState } from 'react';
import { PopconfirmContent, type PopconfirmCopy } from '../../shared/react/popconfirm-content';
import { RemixIcon } from '../../shared/react/remix-icon';
import { useExclusiveAsyncAction } from '../../shared/react/use-exclusive-async-action';
import { CheckboxGroup } from './checkbox-group';
import { usePopconfirm } from './use-popconfirm';

// What an export carries besides the settings and the shortcut list.
export interface SettingsExportIncludes {
  wallpapers: boolean;
  icons: boolean;
}

export interface SettingsExportCopy extends PopconfirmCopy {
  label: string;
  wallpapersLabel: string;
  iconsLabel: string;
}

const INCLUDE_IDS = {
  wallpapers: '_x_extension_sync_export_wallpapers_2026_unique_',
  icons: '_x_extension_sync_export_icons_2026_unique_'
} as const;

// The export button and the bubble it opens, where the reader picks whether
// the file also carries the wallpapers and shortcut icons.
export function SettingsExportButton({
  className,
  copy,
  disabled,
  onExport
}: {
  className: string;
  copy: SettingsExportCopy;
  disabled: boolean;
  onExport(includes: SettingsExportIncludes): Promise<void>;
}) {
  const { open, toggle, close, wrapRef, triggerRef } = usePopconfirm();
  const [includes, setIncludes] = useState<SettingsExportIncludes>({ wallpapers: true, icons: true });
  const exportAction = useExclusiveAsyncAction(() => onExport(includes));
  const dialogId = '_x_extension_sync_export_options_2026_unique_';
  return (
    <div className="_x_extension_popconfirm_wrap_2024_unique_" ref={wrapRef}>
      <button
        aria-controls={dialogId}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={className}
        data-disabled={disabled ? 'true' : 'false'}
        disabled={disabled || exportAction.pending}
        id="_x_extension_sync_export_2024_unique_"
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        ref={triggerRef}
        type="button"
      >
        <RemixIcon name="ri-upload-line" size={16} />
        <span>{copy.label}</span>
      </button>
      <div
        aria-hidden={!open}
        aria-label={copy.message}
        className="_x_extension_popconfirm_2024_unique_ _x_extension_sync_export_options_2026_unique_"
        data-open={open ? 'true' : 'false'}
        id={dialogId}
        role="dialog"
      >
        {open ? (
          <PopconfirmContent
            busy={exportAction.pending}
            copy={copy}
            onCancel={close}
            onConfirm={() => {
              void exportAction.run().then((outcome) => {
                if (outcome.status !== 'skipped') close();
              });
            }}
          >
            <div className="_x_extension_sync_export_choices_2026_unique_">
              <CheckboxGroup
                model={{
                  items: [
                    { checked: includes.wallpapers, id: INCLUDE_IDS.wallpapers, label: copy.wallpapersLabel,
                      labelKey: 'sync_export_include_wallpapers', value: 'wallpapers' },
                    { checked: includes.icons, id: INCLUDE_IDS.icons, label: copy.iconsLabel,
                      labelKey: 'sync_export_include_icons', value: 'icons' }
                  ]
                }}
                onChange={(values) => setIncludes({ wallpapers: values.includes('wallpapers'), icons: values.includes('icons') })}
              />
            </div>
          </PopconfirmContent>
        ) : null}
      </div>
    </div>
  );
}
