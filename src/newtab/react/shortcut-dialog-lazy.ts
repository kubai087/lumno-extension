import type { ShortcutDialogOptions } from './shortcut-dialog';

// The modal is needed only when editing; keep it off the initial New Tab route.
export async function createShortcutDialog(options: ShortcutDialogOptions) {
  const dialog = await import('./shortcut-dialog');
  return dialog.createShortcutDialog(options);
}
