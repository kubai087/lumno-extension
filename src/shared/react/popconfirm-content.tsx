import type { MouseEvent, ReactNode } from 'react';
import { BusyLabel } from './busy-label';

export interface PopconfirmCopy {
  // Only read when the popconfirm has a Cancel button.
  cancelLabel?: string;
  cancelLabelKey?: string;
  confirmLabel: string;
  confirmLabelKey?: string;
  message: string;
  messageKey: string;
}

export interface PopconfirmClassNames {
  actions: string;
  cancel: string;
  confirm: string;
  text: string;
}

// Settings keeps its adapter class names; other surfaces pass their own.
const SETTINGS_CLASS_NAMES: PopconfirmClassNames = Object.freeze({
  actions: '_x_extension_popconfirm_actions_2024_unique_',
  cancel:
    '_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_secondary_2024_unique_',
  confirm:
    '_x_extension_shortcut_submit_2024_unique_ _x_extension_shortcut_submit_primary_2024_unique_ _x_extension_shortcut_save_2024_unique_',
  text: '_x_extension_popconfirm_text_2024_unique_'
});

export function PopconfirmContent({
  busy = false,
  children,
  classNames = SETTINGS_CLASS_NAMES,
  copy,
  onCancel,
  onConfirm
}: {
  busy?: boolean;
  // Choices that go with the confirmation, drawn between the message and
  // the buttons.
  children?: ReactNode;
  classNames?: PopconfirmClassNames;
  copy: PopconfirmCopy;
  // Leave it out where the surface dismisses another way; the bubble then
  // shows only the confirm button.
  onCancel?(): void;
  onConfirm(event: MouseEvent<HTMLButtonElement>): void;
}) {
  return (
    <>
      <div className={classNames.text} data-i18n={copy.messageKey}>
        {copy.message}
      </div>
      {children}
      <div className={classNames.actions}>
        {onCancel ? (
          <button
            className={classNames.cancel}
            data-i18n={copy.cancelLabelKey || 'confirm_cancel'}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onCancel();
            }}
            type="button"
          >
            {copy.cancelLabel}
          </button>
        ) : null}
        <button
          aria-busy={busy}
          className={classNames.confirm}
          data-i18n={copy.confirmLabelKey || 'confirm_ok'}
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onConfirm(event);
          }}
          type="button"
        >
          <BusyLabel busy={busy}>{copy.confirmLabel}</BusyLabel>
        </button>
      </div>
    </>
  );
}
